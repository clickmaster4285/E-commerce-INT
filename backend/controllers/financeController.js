const { readLedgerRange } = require("../services/financeRead");
const { buildFinanceOverview } = require("../services/financeService"); // overview assembly (§4.2)
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

exports.getFinanceOverview = asyncHandler(async (req, res) => {
  const out = await buildFinanceOverview(req.query);
  return res.status(out.status).json(out.body);
});
// Ledger slice — finance overview yahan shift ho sakta hai jab reporting stable ho
exports.readLedgerRangeForStore = async (req, res) => {
  try {
    const storeId = req.store?._id;
    if (!storeId) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }
    const from = req.query.from || req.query.startDate;
    const to = req.query.to || req.query.endDate;
    const { entries, balances } = await readLedgerRange(storeId, from, to);
    return res.status(200).json({ success: true, data: { entries, balances } });
  } catch (error) {
    console.error("Finance ledger read error:", error);
    return res.status(500).json({ success: false, message: "Unable to load ledger entries" });
  }
};

// §9.2 — ledger → transactions list DTO (minor units). Ledger khali ho to data: [].
// GET /finance/transactions?from&to&limit  (default: pichhle 30 din)
const toTransactionDto = (entry) => {
  const lines = Array.isArray(entry.lines) ? entry.lines : [];
  return {
    id: String(entry._id),
    journalNo: entry.journal_no,
    date: entry.at,
    refType: entry.ref_type || "",
    refId: entry.ref_id ? String(entry.ref_id) : null,
    memo: entry.memo || "",
    amountMinor: lines.reduce((sum, line) => sum + (Number(line.debit_minor) || 0), 0),
    lines: lines.map((line) => ({
      account: line.account,
      debitMinor: Number(line.debit_minor) || 0,
      creditMinor: Number(line.credit_minor) || 0,
    })),
  };
};

exports.listLedgerTransactions = async (req, res) => {
  try {
    const storeId = req.store?._id;
    if (!storeId) return res.status(404).json({ success: false, message: "Store not found" });
    const to = req.query.to || req.query.endDate || new Date();
    const from = req.query.from || req.query.startDate || new Date(new Date(to).getTime() - 30 * 24 * 60 * 60 * 1000);
    const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const { entries } = await readLedgerRange(storeId, from, to);
    return res.status(200).json({ success: true, data: entries.slice(0, limit).map(toTransactionDto) });
  } catch (error) {
    console.error("Finance transactions error:", error);
    return res.status(500).json({ success: false, message: "Unable to load transactions" });
  }
};

exports._toTransactionDto = toTransactionDto;
exports._readLedgerRange = readLedgerRange;