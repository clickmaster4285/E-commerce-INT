// ==========================================================
// TRANSACTIONS (optimizeplan.md §3.1)
// ----------------------------------------------------------
//   const { result, transactional } = await withTx(async () => { ...writes... });
//
// • MongoDB MUST be a replica set — config/db.js fails boot otherwise.
//   Standalone fallback / manual compensation paths are gone.
// • `transactionAsyncLocalStorage`: har Mongoose query/save andar session
//   use karti hai — `{ session }` har jagah pass karne ki zaroorat nahi.
//   Tenant (storeId) ALS alag hai; dono saath chalte hain (tested).
// • Driver TransientTransactionError / WriteConflict par callback DOBARA
//   chalata hai — in-memory state callback ke shuru me reset karo.
// • Business rule fail → `throw new TxAbort(status, body)` → poora rollback.
// ==========================================================
const mongoose = require("mongoose");
const log = require("./logger");

mongoose.set("transactionAsyncLocalStorage", true);

class TxAbort extends Error {
  constructor(status, body) {
    super(body?.message || "Transaction aborted");
    this.name = "TxAbort";
    this.status = status;
    this.body = body;
  }
}

let supportCache = null; // Promise<boolean>

/** True when connected to a replica set / mongos. Boot already requires this. */
async function supportsTransactions() {
  if (!supportCache) {
    supportCache = (async () => {
      try {
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        return Boolean(hello?.setName || hello?.msg === "isdbgrid");
      } catch {
        return false;
      }
    })();
  }
  return supportCache;
}

/**
 * Run `fn` inside a snapshot/majority transaction.
 * @returns {Promise<{ result: any, transactional: true }>}
 */
async function withTx(fn) {
  if (!(await supportsTransactions())) {
    const msg = "MongoDB must be a replica set for withTx (optimizeplan.md §3.1)";
    log.error(msg);
    throw new Error(msg);
  }
  const result = await mongoose.connection.transaction(fn, {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
  return { result, transactional: true };
}

/** Sirf tests ke liye */
function _resetTxSupportCache() { supportCache = null; }
function _forceTxSupportForTests(value) { supportCache = Promise.resolve(Boolean(value)); }

module.exports = { withTx, TxAbort, supportsTransactions, _resetTxSupportCache, _forceTxSupportForTests };
