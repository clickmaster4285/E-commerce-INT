// Per-store models + tenantScope gaps (bulkWrite / estimatedDocumentCount /
// document deleteOne / $lookup) + OTP reset store binding.
// DB nahi: queries ek baad wale "capture" hook par rok di jati hain (MongoDB tak nahi jati).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.ROOT_DOMAIN = process.env.ROOT_DOMAIN || "root.test";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const tenantScope = require("../utils/tenantScopePlugin");
const { runWithStore } = require("../utils/tenantContext");

mongoose.set("bufferTimeoutMS", 200);

const STORE_A = new mongoose.Types.ObjectId();
const STORE_B = new mongoose.Types.ObjectId();
const STOP = "captured";

// ── Test models: plugin + capture hook (plugin ke BAAD register → plugin pehle chalta hai) ──
const captured = {};
function makeModel(name, collection) {
  const schema = new mongoose.Schema({ name: String, code: String }, { collection });
  schema.plugin(tenantScope);
  schema.pre(["deleteOne", "updateOne", "find"], { query: true, document: false }, function capture() {
    captured[this.op] = { filter: this.getFilter(), update: this.getUpdate?.() };
    throw new Error(STOP);
  });
  schema.pre("bulkWrite", function capture(...args) {
    captured.bulkWrite = args.find(Array.isArray);
    throw new Error(STOP);
  });
  schema.pre("aggregate", function capture() {
    captured.aggregate = this.pipeline();
    throw new Error(STOP);
  });
  return mongoose.model(name, schema);
}
const Thing = makeModel("TestThing", "test_things");
const Other = makeModel("TestOther", "test_others");
const Plain = mongoose.model("TestPlain", new mongoose.Schema({ x: Number }, { collection: "test_plain" }));

const inStore = (storeId, fn) => runWithStore(storeId, fn);
const stopped = (promise) => assert.rejects(promise, (e) => e.message === STOP || e.message.includes(STOP));
const ids = (v) => String(v);

// ───────────────────────── Models ─────────────────────────
test("Employee: email/username unique per store, not globally", () => {
  const Employee = require("../models/Employee");
  const indexes = Employee.schema.indexes();
  assert.ok(indexes.some(([k, o]) => k.storeId === 1 && k.email === 1 && o.unique));
  assert.ok(indexes.some(([k, o]) => k.storeId === 1 && k.username === 1 && o.unique));
  assert.notEqual(Employee.schema.path("email").options.unique, true);
  assert.notEqual(Employee.schema.path("username").options.unique, true);
  assert.ok(!indexes.some(([k, o]) => o.unique && !("storeId" in k) && ("email" in k || "username" in k)));
});

test("Attribute: tenant-scoped with per-store unique code", () => {
  const Attribute = require("../models/Attribute");
  assert.equal(Attribute.schema.$tenantScopeField, "storeId");
  const indexes = Attribute.schema.indexes();
  assert.ok(indexes.some(([k, o]) => k.storeId === 1 && k.code === 1 && k.is_deleted === 1 && o.unique));
  assert.ok(!indexes.some(([k, o]) => o.unique && !("storeId" in k)));
});

test("Otp: tenant-scoped (code store-bound)", () => {
  const Otp = require("../models/Otp");
  assert.equal(Otp.schema.$tenantScopeField, "storeId");
  assert.ok(Otp.schema.path("storeId"));
});

test("Store schedules attribute seeding for new stores only", () => {
  const Store = require("../models/Store");
  const posts = Store.schema.s.hooks._posts.get("save") || [];
  assert.ok(posts.length >= 1);
});

// ───────────────────────── Plugin gaps ─────────────────────────
test("estimatedDocumentCount is refused inside a store context", async () => {
  await inStore(STORE_A, () =>
    assert.rejects(Thing.estimatedDocumentCount(), /not store-scoped/),
  );
});

test("estimatedDocumentCount still allowed with skipTenantScope (explicit system use)", async () => {
  await inStore(STORE_A, () =>
    assert.rejects(
      Thing.estimatedDocumentCount().setOptions({ skipTenantScope: true }),
      (e) => !/not store-scoped/.test(e.message),
    ),
  );
});

test("bulkWrite: every op is scoped to the current store", async () => {
  await inStore(STORE_A, () =>
    stopped(
      Thing.bulkWrite([
        { insertOne: { document: { name: "a" } } },
        { updateOne: { filter: { code: "x" }, update: { $set: { name: "b", storeId: STORE_B } }, upsert: true } },
        { updateMany: { filter: {}, update: { $set: { name: "c" } } } },
        { replaceOne: { filter: { code: "y" }, replacement: { name: "d", storeId: STORE_B } } },
        { deleteOne: { filter: { code: "z" } } },
        { deleteMany: { filter: {} } },
      ]),
    ),
  );
  const [ins, upd, many, rep, del, delMany] = captured.bulkWrite;
  assert.equal(ids(ins.insertOne.document.storeId), ids(STORE_A));
  for (const op of [upd.updateOne, many.updateMany, rep.replaceOne, del.deleteOne, delMany.deleteMany]) {
    assert.deepEqual(op.filter.$and[1], { storeId: STORE_A });
  }
  assert.equal(upd.updateOne.update.$set.storeId, undefined); // store badalna mana
  assert.equal(ids(upd.updateOne.update.$setOnInsert.storeId), ids(STORE_A));
  assert.equal(ids(rep.replaceOne.replacement.storeId), ids(STORE_A));
});

test("bulkWrite: inserting a document for another store is blocked", async () => {
  await inStore(STORE_A, () =>
    assert.rejects(Thing.bulkWrite([{ insertOne: { document: { name: "x", storeId: STORE_B } } }]), /Cross-store/),
  );
});

test("document deleteOne / updateOne go through the scoped query", async () => {
  const doc = Thing.hydrate({ _id: new mongoose.Types.ObjectId(), name: "n", storeId: STORE_B });
  await inStore(STORE_A, () => stopped(doc.deleteOne()));
  assert.deepEqual(captured.deleteOne.filter.$and.at(-1), { storeId: STORE_A });
  await inStore(STORE_A, () => stopped(doc.updateOne({ name: "changed" })));
  assert.deepEqual(captured.updateOne.filter.$and.at(-1), { storeId: STORE_A });
});

test("aggregate: $lookup / $unionWith / $graphLookup into store-owned collections are scoped", async () => {
  await inStore(STORE_A, () =>
    stopped(
      Thing.aggregate([
        { $lookup: { from: "test_others", localField: "code", foreignField: "code", as: "o" } },
        { $lookup: { from: "test_others", let: { c: "$code" }, pipeline: [{ $match: { x: 1 } }], as: "p" } },
        { $lookup: { from: "test_plain", localField: "code", foreignField: "x", as: "plain" } },
        { $unionWith: "test_others" },
        { $graphLookup: { from: "test_others", startWith: "$code", connectFromField: "code", connectToField: "code", as: "g" } },
        { $facet: { nested: [{ $lookup: { from: "test_others", localField: "code", foreignField: "code", as: "n" } }] } },
      ]),
    ),
  );
  const [top, simple, withPipeline, plain, union, graph, facet] = captured.aggregate;
  assert.deepEqual(top, { $match: { storeId: STORE_A } });
  assert.deepEqual(simple.$lookup.pipeline, [{ $match: { storeId: STORE_A } }]);
  assert.deepEqual(withPipeline.$lookup.pipeline, [{ $match: { storeId: STORE_A } }, { $match: { x: 1 } }]);
  assert.equal(plain.$lookup.pipeline, undefined); // non-scoped collection unchanged
  assert.deepEqual(union.$unionWith, { coll: "test_others", pipeline: [{ $match: { storeId: STORE_A } }] });
  assert.deepEqual(graph.$graphLookup.restrictSearchWithMatch, { storeId: STORE_A });
  assert.deepEqual(facet.$facet.nested[0].$lookup.pipeline, [{ $match: { storeId: STORE_A } }]);
});

test("no store context (platform / scripts) → pipelines untouched", async () => {
  await stopped(Thing.aggregate([{ $lookup: { from: "test_others", localField: "code", foreignField: "code", as: "o" } }]));
  assert.equal(captured.aggregate.length, 1);
  assert.equal(captured.aggregate[0].$lookup.pipeline, undefined);
});

// ───────────────────────── OTP reset store binding ─────────────────────────
function callReset(storeId, tokenStoreId) {
  const { resetPasswordWithOtp } = require("../controllers/otpController");
  const resetToken = jwt.sign(
    { email: "a@b.co", purpose: "password_reset", otpId: String(new mongoose.Types.ObjectId()), storeId: tokenStoreId },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    resetPasswordWithOtp(
      { body: { email: "a@b.co", resetToken, newPassword: "secret123" }, store: storeId ? { _id: storeId } : null, headers: {} },
      res,
    );
  });
}

test("reset token from store A is rejected on store B (before any DB lookup)", async () => {
  const r = await callReset(STORE_B, String(STORE_A));
  assert.equal(r.status, 400);
  assert.match(r.body.message, /Invalid reset request/);
});

test("store reset token is rejected on the platform host, and vice versa", async () => {
  assert.equal((await callReset(null, String(STORE_A))).status, 400);
  assert.equal((await callReset(STORE_A, null)).status, 400);
});

test.after(() => mongoose.disconnect());
