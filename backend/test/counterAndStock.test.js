// Concurrency tests against a REAL MongoDB (optimizeplan.md §3.2 / §4.1 / §7.2).
// Local replica set (rs0) par ek alag throwaway DB banta hai aur aakhir me drop.
// MongoDB available na ho to tests skip (CI me MongoMemoryReplSet baad me).
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });

const { runWithStore } = require("../utils/tenantContext");
const { nextSeq, peekSeq, formatNumber, maxNumericSuffix } = require("../utils/counter");
const Counter = require("../models/Counter");
const Order = require("../models/Order");
const Variant = require("../models/Variant");

const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testDb = `ecommerce_test_${process.pid}_${Date.now()}`;
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/${testDb}$2`);

let connected = false;
test.before(async () => {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
    await Counter.init();
    connected = true;
  } catch {
    connected = false;
  }
});
test.after(async () => {
  if (connected) {
    // Background index builds (autoIndex) khatam hone do — warna drop ke baad collections dobara ban jati hain
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

const storeA = new mongoose.Types.ObjectId();
const storeB = new mongoose.Types.ObjectId();

test("50 concurrent nextSeq calls get 50 unique consecutive numbers", async (t) => {
  if (!connected) return t.skip("MongoDB not reachable");
  const seqs = await runWithStore(storeA, () => Promise.all(Array.from({ length: 50 }, () => nextSeq("order"))));
  const sorted = [...seqs].sort((a, b) => a - b);
  assert.equal(new Set(seqs).size, 50, "no duplicates");
  assert.deepEqual(sorted, Array.from({ length: 50 }, (_, i) => i + 1));
});

test("counters are per store", async (t) => {
  if (!connected) return t.skip("MongoDB not reachable");
  const first = await runWithStore(storeB, () => nextSeq("order"));
  assert.equal(first, 1, "store B starts its own sequence");
});

test("lazy seed continues from existing data (numeric, not lexical: ORD-99999 → ORD-100000)", async (t) => {
  if (!connected) return t.skip("MongoDB not reachable");
  const store = new mongoose.Types.ObjectId();
  await runWithStore(store, async () => {
    await Order.collection.insertMany([
      { storeId: store, order_number: "ORD-99999" },
      { storeId: store, order_number: "ORD-00042" },
    ]);
    const seed = () => maxNumericSuffix(Order, "order_number", /^ORD-/);
    assert.equal(await seed(), 99999);
    assert.equal(formatNumber("ORD-", await peekSeq("order", { seed }), 5), "ORD-100000", "preview does not consume");
    assert.equal(formatNumber("ORD-", await nextSeq("order", { seed }), 5), "ORD-100000");
    assert.equal(formatNumber("ORD-", await nextSeq("order", { seed }), 5), "ORD-100001");
  });
});

test("SKU / category / brand / employee helpers use atomic nextSeq (§3.2 remainder)", async (t) => {
  if (!connected) return t.skip("MongoDB not reachable");
  const { getNextSku, peekNextSku } = require("../utils/skuHelper");
  const { getNextCategoryCode, peekNextCategoryCode } = require("../utils/categoryCodeHelper");
  const Brand = require("../models/Brand");
  const Category = require("../models/Category");
  const Employee = require("../models/Employee");

  const store = new mongoose.Types.ObjectId();
  await runWithStore(store, async () => {
    await Variant.collection.insertOne({ storeId: store, product_id: new mongoose.Types.ObjectId(), sku: "sku_9", title: "T", cost_price: 1, selling_price: 2, quantity: 0 });
    assert.equal(await peekNextSku(), "sku_10", "SKU preview does not consume");
    assert.equal(await getNextSku(), "sku_10");
    assert.equal(await getNextSku(), "sku_11");

    await Category.collection.insertOne({ storeId: store, name: "C", category_code: "cat_42", is_deleted: false });
    assert.equal(await peekNextCategoryCode(), "cat_43");
    assert.equal(await getNextCategoryCode(), "cat_43");

    await Brand.collection.insertOne({ storeId: store, name: "B", brand_code: "BRD-099", is_deleted: false });
    const brandSeed = () => maxNumericSuffix(Brand, "brand_code", /^BRD-\d+$/);
    assert.equal(formatNumber("BRD-", await peekSeq("brand", { seed: brandSeed }), 3), "BRD-100");
    assert.equal(formatNumber("BRD-", await nextSeq("brand", { seed: brandSeed }), 3), "BRD-100");

    await Employee.collection.insertOne({ storeId: store, name: "E", email: "e@t.test", username: "e1", password: "x", role: "staff", employeeCode: "EMP-00007" });
    const empSeed = () => maxNumericSuffix(Employee, "employeeCode", /^EMP-\d+$/);
    assert.equal(formatNumber("EMP-", await nextSeq("employee", { seed: empSeed }), 5), "EMP-00008");
  });
});

test("conditional stock decrement: 20 parallel orders for stock 5 → exactly 5 succeed, stock never negative", async (t) => {
  if (!connected) return t.skip("MongoDB not reachable");
  const store = new mongoose.Types.ObjectId();
  await runWithStore(store, async () => {
    const { insertedId } = await Variant.collection.insertOne({ storeId: store, product_id: new mongoose.Types.ObjectId(), sku: "T-1", title: "T", cost_price: 1, selling_price: 2, quantity: 5 });
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      Variant.updateOne({ _id: insertedId, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } })));
    const succeeded = results.filter((r) => r.modifiedCount === 1).length;
    const doc = await Variant.findById(insertedId).lean();
    assert.equal(succeeded, 5);
    assert.equal(doc.quantity, 0);
  });
});
