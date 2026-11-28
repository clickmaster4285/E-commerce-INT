// §3.1 — withTx on a real replica set (MongoMemoryReplSet) + tenant ALS
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { withTx, TxAbort, _resetTxSupportCache } = require("../utils/tx");
const { runWithStore, getStoreId } = require("../utils/tenantContext");

let replSet = null;
let Probe = null;

test.before(async () => {
  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    _resetTxSupportCache();
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName, "memory server must expose a replica set name");
    Probe = mongoose.models.TxProbe || mongoose.model(
      "TxProbe",
      new mongoose.Schema({ n: Number, storeId: String, ok: Boolean }, { collection: "tx_probe", strict: false })
    );
  } catch (err) {
    console.warn("MongoMemoryReplSet unavailable:", err.message);
    if (mongoose.connection.readyState === 1) await mongoose.disconnect().catch(() => {});
    if (replSet) await replSet.stop().catch(() => {});
    replSet = null;
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

test("withTx rolls back writes on TxAbort", async (t) => {
  if (!replSet) return t.skip("MongoMemoryReplSet not available");
  // Native driver collection inserts ignore mongoose transactionAsyncLocalStorage —
  // use a real model so the session is applied automatically.
  await Probe.deleteMany({});

  await assert.rejects(
    () =>
      withTx(async () => {
        await Probe.create([{ n: 1 }]);
        throw new TxAbort(400, { success: false, message: "boom" });
      }),
    (err) => err instanceof TxAbort && err.status === 400
  );

  assert.equal(await Probe.countDocuments({}), 0);
});

test("withTx keeps tenant ALS storeId inside the callback", async (t) => {
  if (!replSet) return t.skip("MongoMemoryReplSet not available");
  const storeId = new mongoose.Types.ObjectId().toString();
  let seen = null;

  await runWithStore(storeId, async () => {
    assert.equal(getStoreId(), storeId);
    await withTx(async () => {
      seen = getStoreId();
      await Probe.create([{ storeId, ok: true }]);
    });
  });

  assert.equal(seen, storeId);
  await Probe.deleteMany({});
});

test("db.js source: upgrades retryWrites=false; requires replica set", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "../config/db.js"), "utf8");
  assert.match(src, /retryWrites=false/); // only as a pattern to rewrite → true
  assert.match(src, /\$1retryWrites=true/);
  assert.doesNotMatch(src, /mongoose\.connect\([^)]*retryWrites:\s*false/);
  assert.match(src, /MongoDB must be a replica set/);
  assert.match(src, /maxPoolSize/);
  assert.match(src, /autoIndex/);
  assert.match(src, /serverSelectionTimeoutMS/);

  const tx = fs.readFileSync(path.join(__dirname, "../utils/tx.js"), "utf8");
  assert.doesNotMatch(tx, /STANDALONE fallback/);
  assert.match(tx, /transactionAsyncLocalStorage/);

  const purge = fs.readFileSync(path.join(__dirname, "../scripts/purgeStore.js"), "utf8");
  assert.match(purge, /withTx\(async \(\) => \{/);

  const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  assert.match(readme, /rs\.initiate/);
  assert.match(readme, /replicaSet=rs0/);

  const envEx = fs.readFileSync(path.join(__dirname, "../.env.example"), "utf8");
  assert.match(envEx, /replicaSet=rs0/);
  assert.match(envEx, /retryWrites=true/);
});

test("money/stock controllers no longer branch on !transactional", () => {
  const fs = require("fs");
  const path = require("path");
  for (const rel of [
    "controllers/orderController.js",
    "controllers/posController.js",
    "controllers/invoiceController.js",
    "controllers/purchaseOrderController.js",
    "controllers/stockController.js",
    "controllers/superAdminController.js",
  ]) {
    const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
    assert.doesNotMatch(src, /supportsTransactions/, rel);
    assert.doesNotMatch(src, /!transactional/, rel);
  }
});
