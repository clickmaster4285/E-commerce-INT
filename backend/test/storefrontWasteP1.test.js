// Storefront request-waste P1 (§9.2): wishlist ids, orders summary, pos summary,
// and source checks for chat gating / polling / brand options.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Wishlist = require("../models/Wishlist");
const Order = require("../models/Order");
const Product = require("../models/Product");
const PosSale = require("../models/PosSale");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_waste_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();
const fe = (...parts) => path.join(__dirname, "..", "..", "frontend", "src", ...parts);

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `waste${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Waste Store", subdomain, store_status: "open", is_deleted: false,
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `wown${Date.now()}`,
    email: `wown${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const userId = oid();
  await User.collection.insertOne({
    _id: userId, storeId, name: "Buyer", username: `wuser${Date.now()}`,
    email: `wuser${Date.now()}@example.com`, password: "x".repeat(60),
    status: "active", is_deleted: false,
  });
  const p1 = oid();
  const p2 = oid();
  await Product.collection.insertMany([
    { _id: p1, storeId, name: "A", status: "active", is_deleted: false },
    { _id: p2, storeId, name: "B", status: "active", is_deleted: false },
  ]);
  await Wishlist.collection.insertOne({ storeId, user_id: userId, products: [p1, p2] });
  await Order.collection.insertMany([
    { _id: oid(), storeId, user_id: userId, order_number: "W-1", status: "pending", total: 10, items: [], created_at: new Date() },
    { _id: oid(), storeId, user_id: userId, order_number: "W-2", status: "delivered", total: 20, items: [], created_at: new Date() },
    { _id: oid(), storeId, user_id: userId, order_number: "W-3", status: "cancelled", total: 5, items: [], created_at: new Date() },
  ]);
  await PosSale.collection.insertOne({
    _id: oid(), storeId, sale_number: "PS-1", total: 40, subtotal: 40, status: "completed",
    payment: { method: "cash", status: "paid" }, cashier_name: "Owner",
    items: [{ product_id: p1, variant_id: oid(), product_name: "A", quantity: 1, unit_price: 40, line_total: 40 }],
    created_at: new Date(),
  });
  ctx = {
    storeId, userId, p1, p2, host: `${subdomain}.${ROOT}`,
    userToken: tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "t" }),
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
  };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  setImmediate(() => process.exit(0));
});

test("GET /users/wishlist/ids returns only ids and count", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/users/wishlist/ids`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "user")
    .set("Authorization", `Bearer ${ctx.userToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 2);
  assert.ok(Array.isArray(res.body.ids));
  assert.equal(res.body.ids.length, 2);
  assert.equal(res.body.wishlist, undefined);
});

test("GET /orders/my/summary returns totals without order rows", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/orders/my/summary`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "user")
    .set("Authorization", `Bearer ${ctx.userToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.total, 3);
  assert.equal(res.body.data.active, 1);
  assert.equal(res.body.data.byStatus.delivered, 1);
  assert.equal(res.body.data.byStatus.cancelled, 1);
});

test("GET /pos/summary returns counters", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/pos/summary`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.todayCount >= 1);
  assert.ok(Number(res.body.data.todayRevenue) >= 40);
});

test("frontend gates chat fetches on open and uses wishlist ids", () => {
  const chat = fs.readFileSync(fe("components", "chat", "SupportChatWidget.js"), "utf8");
  assert.equal((chat.match(/enabled: customerMode && open/g) || []).length >= 2, true);
  assert.match(chat, /enabled: adminMode && open/);

  const ctxSrc = fs.readFileSync(fe("components", "user", "WishlistContext.js"), "utf8");
  assert.match(ctxSrc, /\/users\/wishlist\/ids/);
  assert.match(ctxSrc, /hasAuthSession/);

  const wishPage = fs.readFileSync(fe("app", "(user)", "wishlist", "page.js"), "utf8");
  assert.match(wishPage, /\["wishlist", "products"\]/);

  const account = fs.readFileSync(fe("app", "(user)", "account", "page.js"), "utf8");
  assert.match(account, /\/orders\/my\/summary/);
  assert.doesNotMatch(account, /get\("\/orders\/my"\)/);
});

test("frontend removes banner/deal polling and uses header slim search", () => {
  const banner = fs.readFileSync(fe("components", "user", "BannerSlider.js"), "utf8");
  assert.doesNotMatch(banner, /refetchInterval/);
  assert.match(banner, /staleTime:\s*60\s*\*\s*1000/);

  const deals = fs.readFileSync(fe("components", "user", "DealsSection.js"), "utf8");
  assert.doesNotMatch(deals, /refetchInterval/);

  const discount = fs.readFileSync(fe("components", "user", "DiscountContext.js"), "utf8");
  assert.doesNotMatch(discount, /refetchInterval/);

  const header = fs.readFileSync(fe("components", "user", "Header.js"), "utf8");
  assert.match(header, /debouncedSearch\.length >= 2/);
  assert.match(header, /slim:\s*1/);

  const brandApi = fs.readFileSync(fe("apis", "admin", "brandApi.js"), "utf8");
  assert.match(brandApi, /\/brands\/admin\/options/);
});
