const express = require("express");
const {
  getStockOverview,
  adjustStock,
  getStockHistory,
} = require("../controllers/stockController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

// ==========================================
// 🛡️ STOCK ROUTES — login + manageStock permission
// ==========================================

router.get(
  "/",
  authMiddleware,
  checkPermission("manageStock"),
  getStockOverview
);

router.post(
  "/adjust",
  authMiddleware,
  checkPermission("manageStock"),
  adjustStock
);

router.get(
  "/history",
  authMiddleware,
  checkPermission("manageStock"),
  getStockHistory
);

module.exports = router;
