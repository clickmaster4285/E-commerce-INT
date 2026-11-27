// Public responses se admin-only data na nikle (optimizeplan.md §2.1 / §9.2)
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";

const { redactPublic, redactInPlace, DEFAULT_PUBLIC_REDACT } = require("../middleware/redactPublic");
const { optionalAdmin } = require("../middleware/authMiddleware");
const tokens = require("../utils/tokens");
const Employee = require("../models/Employee");

const fakeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
};

test("redactPublic strips admin-only keys at any depth for shoppers", () => {
  const req = { headers: {} };
  const res = fakeRes();
  redactPublic()(req, res, () => {});
  const id = new mongoose.Types.ObjectId();
  res.json({
    data: [{
      _id: id,
      name: "Shirt",
      createdby: { name: "Staff", email: "staff@example.com" },
      variants: [{ sku: "A1", selling_price: 10, cost_price: 4, min_qnt: 1, max_qnt: 9, topup: 2, quantity: 5 }],
    }],
    purchaseOrderHistory: [{ cost_price: 4 }],
  });
  const product = res.body.data[0];
  assert.equal(product.name, "Shirt");
  assert.equal(product.createdby, undefined);
  assert.deepEqual(product.variants[0], { sku: "A1", selling_price: 10, quantity: 5 });
  assert.equal(res.body.purchaseOrderHistory, undefined);
  assert.ok(product._id instanceof mongoose.Types.ObjectId, "ObjectId values are left intact");
});

test("redactPublic leaves the admin payload untouched", () => {
  const req = { headers: {}, authAud: "admin" };
  const res = fakeRes();
  redactPublic()(req, res, () => {});
  res.json({ variants: [{ cost_price: 4 }] });
  assert.equal(res.body.variants[0].cost_price, 4);
});

test("redactInPlace survives circular references", () => {
  const a = { cost_price: 1 };
  a.self = a;
  redactInPlace(a, new Set(DEFAULT_PUBLIC_REDACT));
  assert.equal(a.cost_price, undefined);
});

test("optionalAdmin: no admin hint → public view (next, no auth)", async () => {
  const req = { headers: {}, cookies: {} };
  let nextCalled = false;
  await optionalAdmin(req, fakeRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.authAud, undefined);
});

test("optionalAdmin: admin hint without token → 401 (frontend refresh), never a silent public view", async () => {
  const req = { headers: { "x-auth-aud": "admin" }, cookies: {} };
  const res = fakeRes();
  let nextCalled = false;
  await optionalAdmin(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("optionalAdmin: admin hint with a valid session → admin view", async () => {
  const employeeId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();
  const original = Employee.findById;
  Employee.findById = () => ({ select() { return this; }, async lean() { return { _id: employeeId, status: "active", storeId }; } });
  const token = tokens.signAccess("admin", { subjectId: employeeId, role: "admin", storeId, sid: "s1" });
  const req = { method: "GET", headers: { "x-auth-aud": "admin", authorization: `Bearer ${token}` }, cookies: {} };
  let nextCalled = false;
  try {
    await optionalAdmin(req, fakeRes(), () => { nextCalled = true; });
  } finally {
    Employee.findById = original;
  }
  assert.equal(nextCalled, true);
  assert.equal(req.authAud, "admin");
});
