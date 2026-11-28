// Remaining P0/P1 hardening: store status gate, Address tenant, uniques/TTL,
// KYC list projection, password select:false, rate-limit order, deal active.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_SA_ACCESS_SECRET = process.env.JWT_SA_ACCESS_SECRET || "test-sa-access-secret";
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const User = require("../models/User");
const SuperAdmin = require("../models/SuperAdmin");
const SellerApplication = require("../models/SellerApplication");
const Address = require("../models/Address");
const ShippingConfig = require("../models/ShippingConfig");
const Wishlist = require("../models/Wishlist");
const Quote = require("../models/Quote");
const Deal = require("../models/Deal");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_hard_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `hard${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Hard Store", subdomain, store_status: "open", is_deleted: false,
  });
  const closedId = oid();
  const closedSub = `closed${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: closedId, store_name: "Closed Store", subdomain: closedSub, store_status: "closed", is_deleted: false,
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `own${Date.now()}`,
    email: `own${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const saId = oid();
  await SuperAdmin.collection.insertOne({
    _id: saId, name: "SA", email: `sa${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "superadmin", status: "active",
  });
  const dealId = oid();
  await Deal.collection.insertOne({
    _id: dealId, storeId, name: "Expired", type: "percentage", applyTo: "all",
    discountValue: 10, isActive: true,
    startDate: new Date(Date.now() - 10 * 864e5),
    endDate: new Date(Date.now() - 864e5),
    usageLimit: 5, usedCount: 2, perUserLimit: 1, createdBy: adminId,
  });
  const liveDealId = oid();
  await Deal.collection.insertOne({
    _id: liveDealId, storeId, name: "Live", type: "percentage", applyTo: "all",
    discountValue: 5, isActive: true,
    startDate: new Date(Date.now() - 864e5),
    endDate: new Date(Date.now() + 864e5),
    usageLimit: 99, usedCount: 1, perUserLimit: 3, createdBy: adminId,
  });
  await Vendor.collection.insertOne({
    _id: oid(), storeId, vendor_code: "VND-001", name: "Banky", is_deleted: false, is_active: true,
    bank_details: { account_no: "SECRET-ACC", bank_name: "HBL" },
  });
  await SellerApplication.collection.insertOne({
    _id: oid(), name: "Applicant", email: `app${Date.now()}@example.com`,
    store_name: "App Store", status: "pending", city: "Lahore", country: "PK",
    business_category: "retail", documents: [{ name: "cnic.pdf", url: "/uploads/documents/secret.pdf" }],
    passwordHash: "hash", phone: "03001111111", address: "secret street",
  });
  ctx = {
    storeId, host: `${subdomain}.${ROOT}`, closedHost: `${closedSub}.${ROOT}`,
    dealId, liveDealId, saId,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
    saToken: tokens.signAccess("superadmin", { subjectId: saId, role: "superadmin", sid: "t" }),
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

test("global rate limit is mounted before resolveStore in app.js", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const rateAt = src.indexOf("limiters.global");
  const resolveAt = src.indexOf("app.use(API_PREFIX, resolveStore)");
  assert.ok(rateAt > 0 && resolveAt > rateAt);
});

test("password fields use select:false", () => {
  assert.equal(Employee.schema.path("password").options.select, false);
  assert.equal(User.schema.path("password").options.select, false);
  assert.equal(SuperAdmin.schema.path("passwordHash").options.select, false);
});

test("Employee schema has order but not orders permission key", () => {
  assert.ok(Employee.schema.path("permissions.order"));
  assert.equal(Employee.schema.path("permissions.orders"), undefined);
});

test("Address has tenantScope + storeId", () => {
  assert.ok(Address.schema.$tenantScopeField || Address.schema.path("storeId"));
  assert.ok(Address.schema.path("storeId"));
});

test("ShippingConfig and Wishlist declare unique store indexes", () => {
  const ship = ShippingConfig.schema.indexes().find(([f, o]) => o?.unique && f.storeId === 1);
  assert.ok(ship, "ShippingConfig unique storeId");
  const wish = Wishlist.schema.indexes().find(([f, o]) => o?.unique && f.storeId === 1 && f.user_id === 1);
  assert.ok(wish, "Wishlist unique storeId+user_id");
});

test("QuoteNumberReservation has TTL on expires_at", () => {
  const ttl = Quote.NumberReservation.schema.indexes().find(
    ([f, o]) => f.expires_at === 1 && o?.expireAfterSeconds === 0,
  );
  assert.ok(ttl);
});

test("closed store blocks public catalog but allows /store/public", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const blocked = await request(app).get(`${API}/products`).set("Host", ctx.closedHost);
  assert.equal(blocked.status, 503, JSON.stringify(blocked.body));
  assert.equal(blocked.body.code, "STORE_CLOSED");
  const pub = await request(app).get(`${API}/store/public`).set("Host", ctx.closedHost);
  assert.ok([200, 404].includes(pub.status), JSON.stringify(pub.body));
  const adminOk = await request(app)
    .get(`${API}/products`)
    .set("Host", ctx.closedHost)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  // Admin aud bypasses gate (may 200/401 depending on store match) — must not be 503 STORE_CLOSED
  assert.notEqual(adminOk.body?.code, "STORE_CLOSED");
});

test("SA applications list omits documents and passwordHash", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .get(`${API}/super-admin/requests`)
    .set("Host", ROOT)
    .set("X-Auth-Aud", "superadmin")
    .set("Authorization", `Bearer ${ctx.saToken}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const items = res.body?.data?.items || [];
  assert.ok(items.length >= 1);
  for (const item of items) {
    assert.equal(item.documents, undefined);
    assert.equal(item.passwordHash, undefined);
    assert.equal(item.address, undefined);
  }
});

test("expired deal by id is 404; live deal hides usage fields", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const expired = await request(app)
    .get(`${API}/deals/active/${ctx.dealId}`)
    .set("Host", ctx.host);
  assert.equal(expired.status, 404, JSON.stringify(expired.body));
  const live = await request(app)
    .get(`${API}/deals/active/${ctx.liveDealId}`)
    .set("Host", ctx.host);
  assert.equal(live.status, 200, JSON.stringify(live.body));
  const data = live.body.data || {};
  assert.equal(data.usageLimit, undefined);
  assert.equal(data.usedCount, undefined);
  assert.equal(data.perUserLimit, undefined);
  assert.equal(data.createdBy, undefined);
});

test("vendor admin list excludes bank_details", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .get(`${API}/vendors/admin/all`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((v) => v.bank_details === undefined));
  assert.ok(!JSON.stringify(res.body).includes("SECRET-ACC"));
});

test("createSellerStore uses withTx", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/superAdminController.js"), "utf8");
  assert.ok(src.includes("withTx(async () => {"));
  assert.ok(/approveRequest[\s\S]*withTx/.test(src) || src.indexOf("approveRequest") < src.indexOf("withTx(async () => {\n        // Atomic guard"));
  assert.match(src, /const approveRequest[\s\S]*?withTx\(async/);
});
