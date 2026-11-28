// §3.9 — money, ledger immutability, stock adjust concurrency
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { withTx, _resetTxSupportCache } = require("../utils/tx");
const { runWithStore } = require("../utils/tenantContext");
const { allocate, add, toMinor } = require("../utils/money");
const { validateLines } = require("../services/ledger");
const LedgerEntry = require("../models/LedgerEntry");
const Payment = require("../models/Payment");
const StockMovement = require("../models/StockMovement");
const StockLevel = require("../models/StockLevel");
const Variant = require("../models/Variant");
const stock = require("../services/stock");

let replSet = null;
let connected = false;

test.before(async () => {
  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 10000 });
    _resetTxSupportCache();
    await Promise.all([
      LedgerEntry.init(),
      Payment.init(),
      StockMovement.init(),
      StockLevel.init(),
      Variant.init(),
    ]);
    connected = true;
  } catch (err) {
    console.warn("MongoMemoryReplSet unavailable:", err.message);
    connected = false;
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

test("money.allocate parts sum to total", () => {
  const total = 1001;
  const parts = [1, 1, 1];
  const slices = allocate(total, parts);
  assert.equal(add(...slices), total);
  assert.deepEqual(slices, [334, 334, 333]);

  const uneven = allocate(500, [3, 1]);
  assert.equal(add(...uneven), 500);
  assert.equal(uneven[0] + uneven[1], 500);
});

test("money toMinor half-up", () => {
  assert.equal(toMinor(10.005), 1001);
  assert.equal(toMinor(10.004), 1000);
});

test("ledger validateLines rejects unbalanced journal", () => {
  assert.throws(
    () => validateLines([{ debit_minor: 100, credit_minor: 0 }, { debit_minor: 0, credit_minor: 90 }]),
    /balance/i,
  );
  assert.doesNotThrow(() =>
    validateLines([
      { debit_minor: 100, credit_minor: 0, account: "cash" },
      { debit_minor: 0, credit_minor: 100, account: "sales_revenue" },
    ]),
  );
});

test("LedgerEntry schema rejects unbalanced lines on save", async (t) => {
  if (!connected) return t.skip("MongoMemoryReplSet not available");
  const storeId = new mongoose.Types.ObjectId();
  await runWithStore(storeId, async () => {
    const entry = new LedgerEntry({
      journal_no: 1,
      lines: [
        { account: "cash", debit_minor: 50, credit_minor: 0 },
        { account: "sales_revenue", debit_minor: 0, credit_minor: 40 },
      ],
    });
    await assert.rejects(() => entry.validate(), /balance/i);
  });
});

test("Payment and StockMovement are immutable without allowCorrection", async (t) => {
  if (!connected) return t.skip("MongoMemoryReplSet not available");
  const storeId = new mongoose.Types.ObjectId();
  await runWithStore(storeId, async () => {
    const refId = new mongoose.Types.ObjectId();
    await Payment.collection.insertOne({
      storeId,
      direction: "in",
      method_code: "cash",
      amount_minor: 100,
      currency: "PKR",
      status: "captured",
      ref_type: "invoice",
      ref_id: refId,
      at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await assert.rejects(
      () => Payment.updateOne({ ref_id: refId }, { $set: { status: "failed" } }),
      (err) => err?.code === "IMMUTABLE",
    );

    const variantId = new mongoose.Types.ObjectId();
    await StockMovement.collection.insertOne({
      storeId,
      variant_id: variantId,
      location_id: "main",
      qty_delta: -1,
      on_hand_after: 0,
      kind: "sale",
      at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await assert.rejects(
      () => StockMovement.deleteOne({ variant_id: variantId }),
      (err) => err?.code === "IMMUTABLE",
    );
  });
});

test("stock.adjust concurrent decrements cannot oversell", async (t) => {
  if (!connected) return t.skip("MongoMemoryReplSet not available");

  const storeId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();

  await Variant.collection.insertOne({
    _id: variantId,
    storeId,
    product_id: productId,
    sku: "TST-1",
    title: "Test",
    cost_price: 1,
    selling_price: 10,
    quantity: 3,
    is_deleted: false,
  });

  await runWithStore(storeId, async () => {
    await StockLevel.create({
      variant_id: variantId,
      location_id: "main",
      on_hand: 3,
      reserved: 0,
    });

    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        stock.adjust({
          variant_id: variantId,
          qty_delta: -2,
          kind: "sale",
          idempotency_key: `sale-test-${i}`,
        }),
      ),
    );

    const ok = attempts.filter((r) => r.ok);
    const fail = attempts.filter((r) => !r.ok);
    assert.equal(ok.length, 1, "only one sale of 2 should succeed");
    assert.equal(fail.length, 4);

    const level = await StockLevel.findOne({ variant_id: variantId }).lean();
    assert.equal(level.on_hand, 1);

    const variant = await Variant.findById(variantId).lean();
    assert.equal(variant.quantity, 1);

    const moves = await StockMovement.countDocuments({ variant_id: variantId });
    assert.equal(moves, 1);
  });
});