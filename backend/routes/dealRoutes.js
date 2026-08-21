const express = require("express");
const authMiddleware = require("../middleware/authMiddleware"); // ✅ Auth middleware import
const { checkPermission } = require("../middleware/checkPermission"); // ✅ Permission middleware import

const {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  toggleDealStatus,
} = require("../controllers/dealController");

const router = express.Router();

// ==========================================
// DEAL ROUTES (Protected with Permissions)
// ==========================================

// ✅ GET all deals - Requires 'deals' permission
router.get("/", authMiddleware, checkPermission("deals"), getDeals);

// ✅ GET single deal - Requires 'deals' permission
router.get("/:id", authMiddleware, checkPermission("deals"), getDealById);

// ✅ CREATE deal - Requires 'deals' permission
router.post("/", authMiddleware, checkPermission("deals"), createDeal);

// ✅ UPDATE deal - Requires 'deals' permission
router.put("/:id", authMiddleware, checkPermission("deals"), updateDeal);

// ✅ DELETE deal - Requires 'deals' permission
router.delete("/:id", authMiddleware, checkPermission("deals"), deleteDeal);

// ✅ TOGGLE active / disabled - Requires 'deals' permission
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  checkPermission("deals"),
  toggleDealStatus
);

// ==========================================
// 🛡️ 404 HANDLER
// ==========================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Deal API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = router;