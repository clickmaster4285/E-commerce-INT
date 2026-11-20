const express = require("express");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
const authMiddleware = require("../middleware/authMiddleware");
const { getFinanceOverview } = require("../controllers/financeController");

const router = express.Router();

const requireFinancePermission = (req, res, next) => {
  if (isAdminRole(req.user?.role) || req.user?.permissions?.finance === true) return next();
  return res.status(403).json({ success: false, message: "Finance access is not enabled for this account." });
};

router.get("/overview", authMiddleware, requireFinancePermission, getFinanceOverview);

module.exports = router;
