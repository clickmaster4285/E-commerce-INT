// §7.2 — permission matrix smoke: anonymous → 401, staff(false) → 403, admin → not 401/403
// MongoMemoryReplSet (CI-safe). Skips if the memory server cannot start.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";
process.env.JWT_SA_ACCESS_SECRET = process.env.JWT_SA_ACCESS_SECRET || "test-sa-access-secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-purpose-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const oid = () => new mongoose.Types.ObjectId();

let replSet = null;
let ctx = null;

test.before(async () => {
  try {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 10000 });
  } catch (err) {
    console.warn("MongoMemoryReplSet unavailable:", err.message);
    return;
  }
  const storeId = oid();
  const subdomain = `permp1${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Perm P1", subdomain, store_status: "closed",
    email: "store@example.com", phone: "03001112233",
  });
  const adminId = oid();
  const staffId = oid();
  const base = { storeId, status: "active", is_deleted: false, password: "x".repeat(60) };
  await Employee.collection.insertOne({
    ...base, _id: adminId, name: "Owner", username: "ownerp1", email: "ownerp1@example.com",
    role: "admin", permissions: {},
  });
  await Employee.collection.insertOne({
    ...base, _id: staffId, name: "Clerk", username: "clerkp1", email: "clerkp1@example.com",
    role: "staff", permissions: { dashboard: false, employees: false, discounts: false, finance: false },
  });
  ctx = {
    host: `${subdomain}.${ROOT}`,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
    staffToken: tokens.signAccess("admin", { subjectId: staffId, role: "staff", storeId, sid: "t" }),
  };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  if (replSet) await replSet.stop().catch(() => {});
  setImmediate(() => process.exit(0));
});

const call = (path, token) => {
  const req = request(app).get(`${API}${path}`).set("Host", ctx.host).set("X-Auth-Aud", "admin");
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

// Chhota sample: permission gate alag-alag router se
const ROUTES = ["/employees", "/discounts", "/dashboard/stats", "/finance/overview", "/finance/transactions"];

for (const path of ROUTES) {
  test(`permission matrix GET ${path}: anon 401 / staff(false) 403 / admin allowed`, async (t) => {
    if (!ctx) return t.skip("MongoMemoryReplSet not available");
    const anon = await call(path);
    assert.equal(anon.status, 401, `anon ${path} → ${anon.status}`);
    const staff = await call(path, ctx.staffToken);
    assert.equal(staff.status, 403, `staff ${path} → ${staff.status} ${JSON.stringify(staff.body)}`);
    const admin = await call(path, ctx.adminToken);
    assert.ok(![401, 403].includes(admin.status), `admin ${path} → ${admin.status} ${JSON.stringify(admin.body)}`);
  });
}

test("finance/transactions returns [] for an empty ledger", async (t) => {
  if (!ctx) return t.skip("MongoMemoryReplSet not available");
  const res = await call("/finance/transactions", ctx.adminToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.data, []);
});