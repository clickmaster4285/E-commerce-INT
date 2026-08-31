const express = require("express");
const {
  getStockOverview,
  adjustStock,
  getStockHistory,
} = require("../controllers/stockController");
const authMiddleware = require("../middleware/authMiddleware");
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
