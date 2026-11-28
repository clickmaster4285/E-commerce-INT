// §6.5 — tenantScope fail-closed: context na ho to query THROW (DB nahi chahiye:
// capture hook query ko MongoDB tak jane se pehle rok deta hai).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.ROOT_DOMAIN = process.env.ROOT_DOMAIN || "root.test";
delete process.env.TENANT_FAIL_CLOSED;

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const { runWithStore, runUnscoped } = require("../utils/tenantContext");

mongoose.set("bufferTimeoutMS", 200);

const STORE_A = new mongoose.Types.ObjectId();
const STORE_B = new mongoose.Types.ObjectId();
const STOP = "captured";
const captured = {};

const schema = new mongoose.Schema({ name: String }, { collection: "fc_things" });
schema.plugin(tenantScope);
// plugin ke BAAD register → plugin pehle chalta hai; yahan tak pahunche = scope guzar gaya
schema.pre(["find", "findOne", "countDocuments"], { query: true, document: false }, function capture() {
  captured.filter = this.getFilter();
  throw new Error(STOP);
});
schema.pre("aggregate", function capture() {
  captured.pipeline = this.pipeline();
  throw new Error(STOP);
});
schema.pre("bulkWrite", function capture() {
  throw new Error(STOP);
});
const Thing = mongoose.model("FailClosedThing", schema);

const reached = (p) => assert.rejects(p, (e) => e.message === STOP);
const failsClosed = (p) => assert.rejects(p, /Tenant scope missing/);

test("no store context: scoped find / findOne / count / aggregate / bulkWrite THROW", async () => {
  await failsClosed(Thing.find({}));
  await failsClosed(Thing.findOne({ name: "x" }));
  await failsClosed(Thing.countDocuments({}));
  await failsClosed(Thing.aggregate([{ $match: {} }]));
  await failsClosed(Thing.bulkWrite([{ insertOne: { document: { name: "x" } } }]));
});

test("skipTenantScope still works (query / aggregate / bulkWrite)", async () => {
  await reached(Thing.find({}).setOptions({ skipTenantScope: true }));
  await reached(Thing.aggregate([{ $match: {} }]).option({ skipTenantScope: true }));
  await reached(Thing.bulkWrite([{ insertOne: { document: { name: "x" } } }], { skipTenantScope: true }));
});

test("runUnscoped is the explicit no-filter path", async () => {
  await reached(runUnscoped(async () => await Thing.find({})));
  assert.equal(captured.filter.$and, undefined);
});

test("store context still scopes by storeId", async () => {
  await reached(runWithStore(STORE_A, async () => await Thing.find({})));
  assert.equal(String(captured.filter.$and[0].storeId), String(STORE_A));
});

test("insertMany: mismatched storeId rejected, missing storeId stamped", async () => {
  await assert.rejects(
    runWithStore(STORE_A, async () => await Thing.insertMany([{ name: "x", storeId: STORE_B }])),
    /Cross-store write blocked/,
  );
  // same store / missing → hook pass hota hai (phir DB buffer timeout; hamein sirf scope error nahi chahiye)
  const docs = [{ name: "y" }];
  await runWithStore(STORE_A, async () => await Thing.insertMany(docs)).catch(() => {});
  assert.equal(String(docs[0].storeId), String(STORE_A));
});

test("scopeSubPipelines: $lookup into store-owned collection is scoped (cached collection map)", () => {
  const pipeline = [{ $lookup: { from: "fc_things", localField: "a", foreignField: "b", as: "t" } }];
  tenantScope.scopeSubPipelines(pipeline, STORE_A);
  assert.equal(String(pipeline[0].$lookup.pipeline[0].$match.storeId), String(STORE_A));
});
