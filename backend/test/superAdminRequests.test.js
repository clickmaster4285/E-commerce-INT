const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });

const controller = require("../controllers/superAdminController");
const SellerApplication = require("../models/SellerApplication");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");

const appId = new mongoose.Types.ObjectId();
const storeId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

// Mongoose query jaisa chainable object (select/lean/setOptions)
const q = (data) => {
  const query = {
    select() { return query; },
    setOptions() { return query; },
    lean: async () => data,
    then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  };
  return query;
};

const stubAll = (stubs) => {
  const restore = [];
  for (const [model, key, fn] of stubs) {
    const prev = model[key];
    model[key] = fn;
    restore.push(() => { model[key] = prev; });
  }
  return () => restore.reverse().forEach((fn) => fn());
};

const mockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const baseApp = (overrides = {}) => ({
  _id: appId,
  name: "Hamza",
  email: "hamza@example.com",
  store_name: "Hamza Store",
  status: "pending",
  store_id: storeId,
  user_id: userId,
  ...overrides,
});

const superAdmin = { _id: new mongoose.Types.ObjectId(), email: "sa@example.com", name: "Super Admin" };

test("deleteRequest refuses approved sellers", async () => {
  let deleteCalled = false;
  const restore = stubAll([
    [SellerApplication, "findById", () => q(baseApp({ status: "approved" }))],
    [SellerApplication, "findOneAndDelete", () => { deleteCalled = true; return q(null); }],
  ]);
  try {
    const res = mockRes();
    await controller.deleteRequest({ params: { id: String(appId) }, superAdmin }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(deleteCalled, false);
  } finally { restore(); }
});

test("deleteRequest removes the pending request with its closed store and admin account (no customer user)", async () => {
  const calls = {};
  const originalUserDeleteOne = User.deleteOne;
  User.deleteOne = () => { throw new Error("deleteRequest must not touch customer_users"); };
  const restore = stubAll([
    [SellerApplication, "findById", () => q(baseApp())],
    [SellerApplication, "findOneAndDelete", (filter) => { calls.app = filter; return q(baseApp()); }],
    [Store, "deleteOne", (filter) => { calls.store = filter; return q({ deletedCount: 1 }); }],
    [Employee, "deleteMany", (filter) => { calls.employees = filter; return q({ deletedCount: 1 }); }],
  ]);
  try {
    const res = mockRes();
    await controller.deleteRequest({ params: { id: String(appId) }, superAdmin }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.removed, { store: 1, adminAccounts: 1 });
    // Guards: approved never deleted, open store never deleted, customer_users untouched
    assert.deepEqual(calls.app.status, { $ne: "approved" });
    assert.deepEqual(calls.store.store_status, { $ne: "open" });
    assert.equal(String(calls.employees.storeId), String(storeId));
  } finally { restore(); User.deleteOne = originalUserDeleteOne; }
});

test("updateRequest only edits pending requests", async () => {
  const restore = stubAll([[SellerApplication, "findById", () => q(baseApp({ status: "approved" }))]]);
  try {
    const res = mockRes();
    await controller.updateRequest({ params: { id: String(appId) }, body: { store_name: "New" }, superAdmin }, res);
    assert.equal(res.statusCode, 409);
  } finally { restore(); }
});

test("updateRequest validates fields", async () => {
  const res = mockRes();
  await controller.updateRequest({ params: { id: String(appId) }, body: { name: "x", phone: "12ab" }, superAdmin }, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors.name);
  assert.ok(res.body.errors.phone);
});

test("updateRequest saves changes and syncs the linked store", async () => {
  const calls = {};
  const restore = stubAll([
    [SellerApplication, "findById", () => q(baseApp({ city: "Lahore" }))],
    [SellerApplication, "findOneAndUpdate", (filter, update) => { calls.app = { filter, update }; return q(baseApp({ ...update.$set })); }],
    [Store, "updateOne", (filter, update) => { calls.store = update; return q({}); }],
  ]);
  try {
    const res = mockRes();
    await controller.updateRequest(
      { params: { id: String(appId) }, body: { city: "Karachi", store_description: "Phones" }, superAdmin },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(calls.app.filter.status, "pending");
    assert.deepEqual(calls.store.$set, { description: "Phones", city: "Karachi" });
  } finally { restore(); }
});
