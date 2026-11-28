// §4.3–§4.5 query perf: statusCounts, keyset cursor, category ancestors
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { runWithStore } = require("../utils/tenantContext");
const { statusCounts, sumCounts, facetCounts } = require("../utils/statusCounts");
const { keysetFilter, encodeCursor, decodeCursor } = require("../utils/keysetPaginate");
const { buildAncestorMap, computeAncestors, rebuildDescendantAncestors, getDescendantIds } = require("../utils/categoryAncestors");
const Quote = require("../models/Quote");
const Category = require("../models/Category");

let mongod = null;
let connected = false;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 10000 });
    connected = true;
  } catch (err) {
    console.warn("MongoMemoryServer unavailable:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect().catch(() => {});
  if (mongod) await mongod.stop().catch(() => {});
});

// ---------- keyset (pure) ----------
test("keyset cursor encode/decode round trip + invalid input", () => {
  const doc = { _id: oid(), created_at: new Date("2026-01-02T03:04:05.678Z") };
  const cursor = encodeCursor(doc);
  const decoded = decodeCursor(cursor);
  assert.equal(decoded.at.toISOString(), doc.created_at.toISOString());
  assert.equal(String(decoded.id), String(doc._id));

  const f = keysetFilter(cursor);
  assert.equal(f.$or.length, 2);
  assert.deepEqual(Object.keys(f.$or[0]), ["created_at"]);
  assert.ok(f.$or[0].created_at.$lt instanceof Date);
  assert.deepEqual(Object.keys(f.$or[1]).sort(), ["_id", "created_at"]);

  assert.equal(keysetFilter("garbage!!"), null);
  assert.equal(keysetFilter(""), null);
  assert.equal(keysetFilter(undefined), null);
  assert.equal(encodeCursor({}), null);
  assert.equal(keysetFilter(Buffer.from(JSON.stringify({ t: 1, id: "nope" })).toString("base64url")), null);
});

test("buildAncestorMap builds root->parent chains and survives cycles", () => {
  const a = oid(), b = oid(), c = oid();
  const map = buildAncestorMap([
    { _id: a, parent_category_id: null },
    { _id: b, parent_category_id: a },
    { _id: c, parent_category_id: b },
  ]);
  assert.deepEqual(map.get(String(a)), []);
  assert.deepEqual(map.get(String(b)).map(String), [String(a)]);
  assert.deepEqual(map.get(String(c)).map(String), [String(a), String(b)]);

  const x = oid(), y = oid();
  const cyc = buildAncestorMap([{ _id: x, parent_category_id: y }, { _id: y, parent_category_id: x }]);
  assert.ok(cyc.get(String(x)).length <= 1);
});

// ---------- statusCounts ----------
test("statusCounts: one $group, match + store scope", async (t) => {
  if (!connected) return t.skip("mongo unavailable");
  const storeA = oid(), storeB = oid();
  const mk = (storeId, status, deleted = false) => ({
    storeId, status, is_deleted: deleted, quote_number: `Q-${oid()}`, created_at: new Date(),
  });
  await Quote.collection.insertMany([
    mk(storeA, "Sent"), mk(storeA, "Sent"), mk(storeA, "Accepted"), mk(storeA, "Rejected", true), mk(storeB, "Sent"),
  ]);

  await runWithStore(storeA, async () => {
    const all = await statusCounts(Quote, { match: { is_deleted: false } });
    assert.deepEqual(all, { Sent: 2, Accepted: 1 });
    assert.equal(sumCounts(all), 3);
    const withDeleted = await statusCounts(Quote);
    assert.equal(sumCounts(withDeleted), 4);

    const facet = await facetCounts(Quote, { total: {}, sent: { status: "Sent" }, none: { status: "Nope" } }, { match: { is_deleted: false } });
    assert.deepEqual(facet, { total: 3, sent: 2, none: 0 });
  });
});

// ---------- category ancestors ----------
test("category ancestors: compute, rebuild on move, getDescendantIds", async (t) => {
  if (!connected) return t.skip("mongo unavailable");
  const storeId = oid();
  const mk = (name, parent = null, extra = {}) => ({
    _id: oid(), storeId, category_code: name.toUpperCase(), name, parent_category_id: parent,
    ancestors: [], is_deleted: false, is_active: true, ...extra,
  });
  const root = mk("root"), mid = mk("mid", root._id), leaf = mk("leaf", mid._id), other = mk("other");
  await Category.collection.insertMany([root, mid, leaf, other]);

  await runWithStore(storeId, async () => {
    assert.deepEqual(await computeAncestors(Category, null), []);
    assert.deepEqual((await computeAncestors(Category, leaf._id)).map(String), [root._id, mid._id, leaf._id].map(String));

    // backfill-jaisa: mid/leaf ki ancestors set karo
    await Category.collection.updateOne({ _id: mid._id }, { $set: { ancestors: [root._id] } });
    await Category.collection.updateOne({ _id: leaf._id }, { $set: { ancestors: [root._id, mid._id] } });

    assert.deepEqual((await getDescendantIds(storeId, root._id)).map(String).sort(), [mid._id, leaf._id].map(String).sort());
    assert.deepEqual((await getDescendantIds(storeId, mid._id)).map(String), [String(leaf._id)]);

    // mid ko other ke neeche move karo
    const newAnc = await computeAncestors(Category, other._id);
    await Category.collection.updateOne({ _id: mid._id }, { $set: { parent_category_id: other._id, ancestors: newAnc } });
    const touched = await rebuildDescendantAncestors(Category, mid._id, newAnc);
    assert.equal(touched, 1);

    const leafDoc = await Category.findById(leaf._id).lean();
    assert.deepEqual(leafDoc.ancestors.map(String), [other._id, mid._id].map(String));
    assert.deepEqual(await getDescendantIds(storeId, root._id), []);
    assert.deepEqual((await getDescendantIds(storeId, other._id)).map(String).sort(), [mid._id, leaf._id].map(String).sort());
  });

  // doosre store ki ids nazar nahi aati
  assert.deepEqual(await getDescendantIds(oid(), other._id), []);
});
