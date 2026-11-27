// ==========================================================
// TRANSACTIONS (optimizeplan.md §3.1)
// ----------------------------------------------------------
//   const { result, transactional } = await withTx(async () => { ...writes... });
//
// • MongoDB replica set chahiye (local dev: rs0 single node — pehle se hai).
//   Production bhi replica set (3 nodes / Atlas) honi chahiye.
// • `transactionAsyncLocalStorage`: callback ke andar HAR Mongoose query/
//   save khud transaction session use karti hai — `{ session }` har jagah
//   pass karne ki zaroorat nahi. Tenant (storeId) ALS alag hai, dono saath chalte hain.
// • Driver TransientTransactionError / WriteConflict par callback DOBARA chalata
//   hai — is liye callback ke andar in-memory state shuru me reset karo.
// • Business rule fail (stock khatam, deal limit) → `throw new TxAbort(status, body)`
//   → sab rollback; caller `err instanceof TxAbort` par wahi response bhejta hai.
// • STANDALONE fallback: agar server replica set nahi (transactions supported
//   nahi), callback bina transaction chalta hai aur `transactional: false`
//   lautata hai — caller apna compensation (stock wapas) khud kare. Startup
//   log me bari warning aati hai. Ye sirf purane deployments ke liye hai.
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
    supportCache.then((ok) => {
      if (!ok) {
        const msg = "MongoDB is NOT a replica set — checkout runs WITHOUT transactions (compensation only). Configure a replica set (optimizeplan.md §3.1).";
        log.error(msg);
        console.warn(`⚠️  ${msg}`);
      }
    });
  }
  return supportCache;
}

/** @returns {Promise<{ result: any, transactional: boolean }>} */
async function withTx(fn) {
  if (!(await supportsTransactions())) {
    return { result: await fn(), transactional: false };
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
