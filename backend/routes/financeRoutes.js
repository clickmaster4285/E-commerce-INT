const express = require("express");
const { isAdminRole } = require("../utils/roles");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { getFinanceOverview } = require("../controllers/financeController");

const router = express.Router();

const requireFinancePermission = (req, res, next) => {
  if (isAdminRole(req.user?.role) || req.user?.permissions?.finance === true) return next();
  return res.status(403).json({ success: false, message: "Finance access is not enabled for this account." });
};

router.get("/overview", authMiddleware, requireFinancePermission, getFinanceOverview);

module.exports = router;
