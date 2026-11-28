// Ledger read path — overview dhree dhree yahan migrate ho sakta hai (§4.3)

let LedgerEntry;
let AccountBalance;
try {
  LedgerEntry = require("../models/LedgerEntry");
  AccountBalance = require("../models/AccountBalance");
} catch {
  LedgerEntry = null;
  AccountBalance = null;
}

/**
 * Store ledger entries between dates (inclusive). Model missing ho to [].
 * @param {import("mongoose").Types.ObjectId|string} storeId
 * @param {Date|string} from
 * @param {Date|string} to
 */
async function readLedgerRange(storeId, from, to) {
  if (!LedgerEntry || !storeId) return { entries: [], balances: [] };

  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { entries: [], balances: [] };
  }

  const entries = await LedgerEntry.find({
    storeId,
    at: { $gte: start, $lte: end },
  })
    .sort({ at: -1, journal_no: -1 })
    .lean();

  let balances = [];
  if (AccountBalance) {
    balances = await AccountBalance.find({ storeId }).lean();
  }

  return { entries, balances };
}

module.exports = { readLedgerRange };