const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { requirePermission } = require("../middleware/checkPermission");
const { getFinanceOverview } = require("../controllers/financeController");

const router = express.Router();

// Finance sensitive hai: admin always, baqi staff ko `finance === true` chahiye
// (default false) — isi liye mode "requireTrue" (baqi routes denyFalse chalate hain).
const requireFinancePermission = requirePermission("finance", {
  mode: "requireTrue",
  message: "Finance access is not enabled for this account.",
});

router.get("/overview", authMiddleware, requireFinancePermission, getFinanceOverview);

module.exports = router;
