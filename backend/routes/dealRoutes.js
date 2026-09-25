const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const {
  createDeal,
  getDeals,
  getActiveDeals,
  getDealById,
  getActiveDealById, // ✅ NEW
  updateDeal,
  deleteDeal,
  toggleDealStatus,
} = require("../controllers/dealController");

const router = express.Router();

// ==========================================
// 🌐 PUBLIC ROUTES — bina login (User GUI)
// ==========================================
router.get("/active", getActiveDeals);
router.get("/active/:id", getActiveDealById); // ✅ NEW: Single deal detail public

// ==========================================
// 🛡️ ADMIN ROUTES — login + permission
// ==========================================
router.get("/", authMiddleware, checkPermission("deals"), getDeals);
router.get("/:id", authMiddleware, checkPermission("deals"), getDealById);
router.post("/", authMiddleware, checkPermission("deals"), createDeal);
router.put("/:id", authMiddleware, checkPermission("deals"), updateDeal);
router.delete("/:id", authMiddleware, checkPermission("deals"), deleteDeal);
router.patch("/:id/toggle-status", authMiddleware, checkPermission("deals"), toggleDealStatus);

router.use((req, res) => {
  res.status(404).json({ success: false, message: `Deal API endpoint not found: ${req.method} ${req.originalUrl}` });
});

module.exports = router;  