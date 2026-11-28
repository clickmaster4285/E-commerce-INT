const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { requirePermission } = require("../middleware/checkPermission");
const { getFinanceOverview, listLedgerTransactions } = require("../controllers/financeController");

const router = express.Router();

// Finance sensitive hai: admin always, baqi staff ko `finance === true` chahiye
// (default false) — isi liye mode "requireTrue" (baqi routes denyFalse chalate hain).
const requireFinancePermission = requirePermission("finance", {
  mode: "requireTrue",
  message: "Finance access is not enabled for this account.",
});

router.get("/overview", authMiddleware, requireFinancePermission, getFinanceOverview);
// Ledger-based transactions list (§9.2) — khali ledger par []
router.get("/transactions", authMiddleware, requireFinancePermission, listLedgerTransactions);

module.exports = router;
