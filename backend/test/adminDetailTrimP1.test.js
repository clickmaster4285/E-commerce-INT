// Admin detail trims + chat counts + socket singleton + FE dead code (§9.3/§9.4)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_SA_ACCESS_SECRET = process.env.JWT_SA_ACCESS_SECRET || "test-sa-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const Customer = require("../models/Customer");
const PosSale = require("../models/PosSale");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const ChatConversation = require("../models/ChatConversation");
const Order = require("../models/Order");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_trim_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();
const fe = (...parts) => path.join(__dirname, "..", "..", "frontend", "src", ...parts);

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `trim${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Trim Store", subdomain, store_status: "open", is_deleted: false,
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `town${Date.now()}`,
    email: `town${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const customerId = oid();
  await Customer.collection.insertOne({
    _id: customerId, storeId, name: "Cust", email: "c@example.com", phone: "0300",
    address: "Lahore", notes: "n", is_deleted: false,
    activity: [{ action: "created" }],
  });
  for (let i = 0; i < 3; i++) {
    await PosSale.collection.insertOne({
      _id: oid(), storeId, customer_id: customerId, sale_number: `S-${i}`,
      total: 10 + i, status: "completed", payment: { method: "cash" },
      items: [{ product_name: "X", quantity: 1 }], created_at: new Date(),
    });
  }
  await Quote.collection.insertOne({
    _id: oid(), storeId, customer_id: customerId, quote_number: "Q-1",
    total: 50, status: "Draft", is_deleted: false, quote_date: new Date(), created_at: new Date(),
  });
  await Invoice.collection.insertOne({
    _id: oid(), storeId, customer_id: customerId, invoice_number: "I-1",
    total: 50, status: "Unpaid", is_deleted: false, invoice_date: new Date(), created_at: new Date(),
  });
  await ChatConversation.collection.insertOne({
    _id: oid(), storeId, status: "open", unread_admin_count: 2,
    last_message_at: new Date(), inquiry_type: "general",
  });
  await ChatConversation.collection.insertOne({
    _id: oid(), storeId, status: "closed", unread_admin_count: 0,
    last_message_at: new Date(), inquiry_type: "general",
  });
  await Order.collection.insertOne({
    _id: oid(), storeId, order_number: "O-1", total: 99, status: "pending",
    payment: { status: "pending" }, items: [{ image: "/a.webp" }],
    address_snapshot: { full_name: "Buyer" }, created_at: new Date(),
  });
  ctx = {
    storeId, customerId, host: `${subdomain}.${ROOT}`,
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

test("GET /customers/:id?slim=1 returns prefill fields only", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/customers/${ctx.customerId}?slim=1`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.name, "Cust");
  assert.equal(d.recent_sales, undefined);
  assert.equal(d.quote_history, undefined);
  assert.equal(d.activity, undefined);
});

test("GET /customers/:id returns true counts and capped history", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/customers/${ctx.customerId}`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.total_sales, 3);
  assert.equal(d.quote_count, 1);
  assert.equal(d.invoice_count, 1);
  assert.ok(d.total_spent >= 30);
  assert.ok((d.recent_sales || []).length <= 20);
  assert.equal(d.recent_sales[0].items?.[0]?.unit_price, undefined);
  assert.equal(d.quote_history[0].pdf_design, undefined);
});

test("GET /chats/admin/counts returns tab totals", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/chats/admin/counts`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.ok(d.all >= 2);
  assert.ok(d.open >= 1);
  assert.ok(d.closed >= 1);
  assert.ok(d.unread >= 1);
});

test("dashboard recentOrders uses select (source)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/dashboardController.js"), "utf8");
  assert.match(src, /\.select\("order_number total status payment\.status/);
  assert.match(src, /actLimit/);
});

test("FE singleton socket + dead files + lazy designer (source)", () => {
  const navbar = fs.readFileSync(fe("components", "adminComponents", "Navbar.js"), "utf8");
  assert.match(navbar, /getAdminSocket/);
  assert.doesNotMatch(navbar, /from "socket\.io-client"/);

  const sidebar = fs.readFileSync(fe("components", "adminComponents", "Sidebar.js"), "utf8");
  assert.match(sidebar, /getAdminSocket/);
  assert.doesNotMatch(sidebar, /from "socket\.io-client"/);

  const layout = fs.readFileSync(fe("app", "admin", "AdminLayoutClient.js"), "utf8");
  assert.match(layout, /getAdminSocket/);
  assert.doesNotMatch(layout, /from ['"]socket\.io-client['"]/);

  const chats = fs.readFileSync(fe("app", "admin", "chats", "page.js"), "utf8");
  assert.match(chats, /adminChatApi\.counts/);

  const vendor = fs.readFileSync(fe("app", "admin", "vendors", "[id]", "page.js"), "utf8");
  assert.match(vendor, /detail\?\.payments/);
  assert.doesNotMatch(vendor, /purchaseOrderApi\.getById/);

  const quotesNew = fs.readFileSync(fe("app", "admin", "quotes", "new", "page.js"), "utf8");
  assert.match(quotesNew, /dynamic\(\(\) => import\("@\/components\/admin\/QuoteTemplateDesigner"\)/);
  assert.match(quotesNew, /getById\(customerId, \{ slim: true \}\)/);

  const axios = fs.readFileSync(fe("apis", "axiosInstance.js"), "utf8");
  assert.match(axios, /timeout: 15000/);

  const address = fs.readFileSync(fe("components", "user", "AddressForm.js"), "utf8");
  assert.match(address, /libphonenumber-js\/min/);

  const feed = fs.readFileSync(fe("components", "superadmin", "ActivityFeed.js"), "utf8");
  assert.match(feed, /5 \* 60 \* 1000/);

  assert.equal(fs.existsSync(fe("hooks", "useEmployeeSocket.js")), false);
  assert.equal(fs.existsSync(fe("hooks", "useSocket.js")), false);
  assert.equal(fs.existsSync(fe("components", "user", "BrandSection.js")), false);
  assert.equal(fs.existsSync(fe("components", "user", "TrustBar.js")), false);
  assert.equal(fs.existsSync(fe("components", "admin", "CalculationSummaryCard.js")), false);

  const nextCfg = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "next.config.mjs"), "utf8");
  assert.match(nextCfg, /images:\s*\{/);
  assert.match(nextCfg, /remotePatterns/);
});
