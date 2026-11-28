// §7.2 — concurrency smoke: parallel stock decrements never oversell, counters stay unique.
// MongoMemoryReplSet; whole file stays well under 30s.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { _resetTxSupportCache } = require("../utils/tx");
const { runWithStore } = require("../utils/tenantContext");
const { nextSeq } = require("../utils/counter");
const Counter = require("../models/Counter");
const StockLevel = require("../models/StockLevel");
const StockMovement = require("../models/StockMovement");
const Variant = require("../models/Variant");
const stock = require("../services/stock");

let replSet = null;
let connected = false;

test.before(async () => {
  try {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 10000 });
    _resetTxSupportCache();
    await Promise.all([Counter.init(), StockLevel.init(), StockMovement.init(), Variant.init()]);
    connected = true;
  } catch (err) {
    console.warn("MongoMemoryReplSet unavailable:", err.message);
  }
});

test.after(async () => {
  _resetTxSupportCache();
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  if (replSet) await replSet.stop().catch(() => {});
});

test("20 parallel -1 stock adjusts on qty 10 → exactly 10 succeed, on_hand 0", async (t) => {
  if (!connected) return t.skip("MongoMemoryReplSet not available");
  const storeId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  await Variant.collection.insertOne({
    _id: variantId, storeId, product_id: new mongoose.Types.ObjectId(), sku: "CONC-1", title: "Conc",
    cost_price: 1, selling_price: 5, quantity: 10, is_deleted: false,
  });
  await runWithStore(storeId, async () => {
    await StockLevel.create({ variant_id: variantId, location_id: "main", on_hand: 10, reserved: 0 });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        stock.adjust({ variant_id: variantId, qty_delta: -1, kind: "sale", idempotency_key: `conc-${i}` })),
    );
    assert.equal(results.filter((r) => r.ok).length, 10);
    assert.equal(results.filter((r) => !r.ok).length, 10);
    const level = await StockLevel.findOne({ variant_id: variantId }).lean();
    assert.equal(level.on_hand, 0);
    assert.equal(await StockMovement.countDocuments({ variant_id: variantId }), 10);
    assert.equal((await Variant.findById(variantId).lean()).quantity, 0);
  });
});

test("nextSeq: 40 parallel calls over 2 keys → unique & gapless per key", async (t) => {
  if (!connected) return t.skip("MongoMemoryReplSet not available");
  const storeId = new mongoose.Types.ObjectId();
  const [orders, invoices] = await runWithStore(storeId, () => Promise.all([
    Promise.all(Array.from({ length: 20 }, () => nextSeq("order"))),
    Promise.all(Array.from({ length: 20 }, () => nextSeq("invoice"))),
  ]));
  for (const seqs of [orders, invoices]) {
    assert.equal(new Set(seqs).size, 20);
    assert.deepEqual([...seqs].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  }
});
