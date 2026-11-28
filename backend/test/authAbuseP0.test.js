// Phase §2.3 Auth & abuse (optimizeplan.md): permissions, OTP atomicity,
// store-scoped customer auth, RegExp escape, card rejection, store_status.
// Throwaway database. Skips if MongoDB is down.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const request = require("supertest");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";
process.env.JWT_SA_ACCESS_SECRET = process.env.JWT_SA_ACCESS_SECRET || "test-sa-access-secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-purpose-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const { escapeRegex } = require("../utils/escapeRegex");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Otp = require("../models/Otp");
const PendingRegistration = require("../models/PendingRegistration");
const SuperAdmin = require("../models/SuperAdmin");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_authp0_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `authp0${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Auth P0", subdomain, store_status: "closed",
    email: "store@example.com", phone: "03001112233",
  });

  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `owner${Date.now()}`,
    email: `owner${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });

  // Staff with every permission explicitly false
  const staffId = oid();
  const denied = {
    dashboard: false, employees: false, products: false, discounts: false,
    brands: false, vendors: false, purchaseOrders: false, store: true,
  };
  await Employee.collection.insertOne({
    _id: staffId, storeId, name: "Clerk", username: `clerk${Date.now()}`,
    email: `clerk${Date.now()}@example.com`, password: "x".repeat(60),
    role: "staff", status: "active", is_deleted: false, permissions: denied,
  });

  const userId = oid();
  const passwordHash = await bcrypt.hash("secret12", 4);
  await User.collection.insertOne({
    _id: userId, storeId, name: "Buyer", username: `buyer${Date.now()}`,
    email: `buyer${Date.now()}@example.com`, password: passwordHash,
    status: "active", role: "user", is_deleted: false, emailVerified: true,
  });

  const saId = oid();
  const staffSaId = oid();
  await SuperAdmin.collection.insertOne({
    _id: saId, name: "Root SA", email: `sa${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "superadmin", status: "active",
  });
  await SuperAdmin.collection.insertOne({
    _id: staffSaId, name: "SA Staff", email: `sastaff${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "staff", status: "active",
  });

  await Promise.all([Otp.init(), PendingRegistration.init(), Store.init()]);

  ctx = {
    storeId,
    host: `${subdomain}.${ROOT}`,
    platformHost: ROOT.includes(".") ? ROOT : `platform.${ROOT}`,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
    staffToken: tokens.signAccess("admin", { subjectId: staffId, role: "staff", storeId, sid: "t" }),
    userToken: tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "t" }),
    saToken: tokens.signAccess("superadmin", { subjectId: saId, userId: saId, role: "superadmin", sid: "t" }),
    saStaffToken: tokens.signAccess("superadmin", { subjectId: staffSaId, userId: staffSaId, role: "staff", sid: "t" }),
    userId,
    userEmail: (await User.collection.findOne({ _id: userId })).email,
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

const asStaff = (method, path) => request(app)[method](`${API}${path}`)
  .set("Host", ctx.host).set("X-Auth-Aud", "admin").set("Authorization", `Bearer ${ctx.staffToken}`);

const asAdmin = (method, path) => request(app)[method](`${API}${path}`)
  .set("Host", ctx.host).set("X-Auth-Aud", "admin").set("Authorization", `Bearer ${ctx.adminToken}`);

test("escapeRegex escapes metacharacters", () => {
  assert.equal(escapeRegex("a.b+c?"), "a\\.b\\+c\\?");
  assert.equal(escapeRegex("(x)|[y]"), "\\(x\\)\\|\\[y\\]");
});

test("staff with permissions.false is blocked on gated admin routes", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const paths = [
    ["get", "/discounts"],
    ["get", "/tags"],
    ["get", "/employees"],
    ["get", "/brands/next-code"],
    ["get", "/vendors/next-code"],
    ["get", "/purchase-orders/next-code"],
    ["get", "/categories/admin/all"],
    ["get", "/dashboard/stats"],
    ["get", "/variants"],
  ];
  for (const [method, path] of paths) {
    const res = await asStaff(method, path);
    assert.equal(res.status, 403, `${method.toUpperCase()} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
  }
});

test("admin still reaches the same gated routes", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await asAdmin("get", "/dashboard/stats");
  assert.ok([200, 500].includes(res.status), `admin dashboard → ${res.status}`); // 500 ok if empty aggregations edge
  const discounts = await asAdmin("get", "/discounts?page=1&limit=10");
  assert.ok([200, 500].includes(discounts.status), JSON.stringify(discounts.body));
});

test("customer login on platform host is refused (middleware STORE_REQUIRED)", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .post(`${API}/users/login`)
    .set("Host", ctx.platformHost)
    .send({ email: ctx.userEmail, password: "secret12" });
  // resolveStore blocks store-owned APIs on the platform host before the controller
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "STORE_REQUIRED");
});

test("customer login on store host works", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .post(`${API}/users/login`)
    .set("Host", ctx.host)
    .send({ email: ctx.userEmail, password: "secret12" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.ok(res.body.user);
});

test("forgot-password on platform host is refused (middleware STORE_REQUIRED)", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .post(`${API}/users/forgot-password`)
    .set("Host", ctx.platformHost)
    .send({ email: ctx.userEmail });
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "STORE_REQUIRED");
});

test("parallel wrong OTP guesses cannot exceed the attempt limit", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  // Closed store → 503 before OTP logic; open for this race test
  await Store.collection.updateOne({ _id: ctx.storeId }, { $set: { store_status: "open" } });
  require("../middleware/resolveStore").invalidateStoreCache(ctx.host);
  const email = `otp${Date.now()}@example.com`;
  const hash = await bcrypt.hash("000000", 4);
  await Otp.collection.insertOne({
    storeId: ctx.storeId, email, purpose: "password_reset", code_hash: hash,
    expires_at: new Date(Date.now() + 600000), attempts: 4, consumed: false, verified: false,
    created_at: new Date(),
  });
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    request(app)
      .post(`${API}/users/verify-reset-otp`)
      .set("Host", ctx.host)
      .send({ email, otp: "111111" })));
  await Store.collection.updateOne({ _id: ctx.storeId }, { $set: { store_status: "closed" } });
  require("../middleware/resolveStore").invalidateStoreCache(ctx.host);
  const surviving = await Otp.collection.find({ email, purpose: "password_reset" }).toArray();
  // All wrong; at most one claim of the last attempt, then the record is deleted
  assert.ok(surviving.every((r) => r.attempts <= 5), `attempts=${surviving.map((r) => r.attempts)}`);
  assert.ok(
    results.every((r) => [400, 429].includes(r.status)),
    `unexpected statuses: ${results.map((r) => `${r.status}:${r.body?.code || r.body?.message}`).join(", ")}`,
  );
  assert.ok(results.some((r) => r.status === 429) || surviving.length === 0);
});

test("placeOrder rejects raw card fields", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  // Store fixture starts closed (store_status tests); open briefly so card reject runs before checkout
  await Store.collection.updateOne({ _id: ctx.storeId }, { $set: { store_status: "open" } });
  require("../middleware/resolveStore").invalidateStoreCache(ctx.host);
  const res = await request(app)
    .post(`${API}/orders`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "user")
    .set("Authorization", `Bearer ${ctx.userToken}`)
    .send({
      items: [{ variant_id: String(oid()), qty: 1 }],
      address_id: String(oid()),
      payment_method: "card",
      card_number: "4111111111111111",
      card_cvv: "123",
      card_expiry: "12/30",
      card_holder_name: "Test User",
    });
  await Store.collection.updateOne({ _id: ctx.storeId }, { $set: { store_status: "closed" } });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "CARD_DATA_REJECTED");
});

test("store admin cannot reopen a closed store via store_status", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const before = await Store.collection.findOne({ _id: ctx.storeId });
  assert.equal(before.store_status, "closed");
  const res = await asAdmin("put", "/store").send({ store_status: "open", store_name: "Auth P0" });
  assert.ok([200, 400].includes(res.status), JSON.stringify(res.body));
  const after = await Store.collection.findOne({ _id: ctx.storeId });
  assert.equal(after.store_status, "closed");
});

test("super-admin staff role cannot manage /team", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .get(`${API}/super-admin/team`)
    .set("Host", ctx.platformHost)
    .set("X-Auth-Aud", "superadmin")
    .set("Authorization", `Bearer ${ctx.saStaffToken}`);
  assert.equal(res.status, 403);
});

test("seller apply status route is mounted with a rate limiter", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { limiters } = require("../middleware/rateLimit");
  assert.equal(typeof limiters.sellerApplyStatus, "function");
  const res = await request(app)
    .get(`${API}/seller/apply/status`)
    .set("Host", ctx.platformHost)
    .query({ email: "nobody@example.com" });
  assert.ok([404, 400, 429].includes(res.status));
});
