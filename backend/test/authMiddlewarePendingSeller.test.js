const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
// Admin session token ab apne audience secret se (utils/tokens.js)
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";

const authMiddleware = require("../middleware/authMiddleware");
const tokens = require("../utils/tokens");
const { allowPendingSeller } = require("../middleware/allowPendingSeller");
const Employee = require("../models/Employee");

const employeeId = new mongoose.Types.ObjectId();
const asQuery = (data) => ({ select() { return this; }, async lean() { return data; } });

const run = async ({ method, pending = true, optIn = false }) => {
  const original = Employee.findById;
  const storeId = new mongoose.Types.ObjectId();
  Employee.findById = () => asQuery({ _id: employeeId, status: "active", seller_pending: pending, storeId });
  const token = tokens.signAccess("admin", { subjectId: employeeId, role: "staff", storeId, sid: "test-session" });
  const req = { method, headers: { authorization: `Bearer ${token}` }, cookies: {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  try {
    if (optIn) allowPendingSeller(req, res, () => {});
    await authMiddleware(req, res, () => { nextCalled = true; });
  } finally {
    Employee.findById = original;
  }
  return { res, nextCalled };
};

test("pending seller write requests are blocked with SELLER_PENDING", async () => {
  const { res, nextCalled } = await run({ method: "POST" });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "SELLER_PENDING");
});

test("pending seller can call routes that opt in via allowPendingSeller (store handoff)", async () => {
  const { res, nextCalled } = await run({ method: "POST", optIn: true });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("pending seller can still read (GET)", async () => {
  const { nextCalled } = await run({ method: "GET" });
  assert.equal(nextCalled, true);
});

test("approved staff writes are not affected", async () => {
  const { nextCalled } = await run({ method: "POST", pending: false });
  assert.equal(nextCalled, true);
});
