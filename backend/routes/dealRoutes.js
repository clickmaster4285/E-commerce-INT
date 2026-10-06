const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const uploadDealImageFile = require("../middleware/dealImageMiddleware");
const { publicCache, invalidate } = require("../utils/publicCache");

const {
  createDeal,
  getDeals,
  getActiveDeals,
  getDealById,
  getActiveDealById, // ✅ NEW
  updateDeal,
  deleteDeal,
  toggleDealStatus,
  uploadDealImage,
} = require("../controllers/dealController");

const router = express.Router();

// ==========================================
// 🌐 PUBLIC ROUTES — bina login (User GUI)
// ==========================================
// ✅ /active (slim list): 700 deals + populates — 30s memo (output same)
router.get("/active", publicCache(30 * 1000), getActiveDeals);
router.get("/active/:id", publicCache(30 * 1000), getActiveDealById); // ✅ NEW: Single deal detail public

// ==========================================
// 🛡️ ADMIN ROUTES — login + permission
// ==========================================
// ⚠️ Ye route "/:id" se pehle hai — warna "upload-image" ko id samajh liya jata
router.post(
  "/upload-image",
  authMiddleware,
  checkPermission("deals"),
  uploadDealImageFile,
  uploadDealImage
);

router.get("/", authMiddleware, checkPermission("deals"), getDeals);
router.get("/:id", authMiddleware, checkPermission("deals"), getDealById);
// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropDealsCache = (req, res, next) => { invalidate("deals"); next(); };
router.post("/", authMiddleware, checkPermission("deals"), dropDealsCache, createDeal);
router.put("/:id", authMiddleware, checkPermission("deals"), dropDealsCache, updateDeal);
router.delete("/:id", authMiddleware, checkPermission("deals"), dropDealsCache, deleteDeal);
router.patch("/:id/toggle-status", authMiddleware, checkPermission("deals"), dropDealsCache, toggleDealStatus);

router.use((req, res) => {
  res.status(404).json({ success: false, message: `Deal API endpoint not found: ${req.method} ${req.originalUrl}` });
});

module.exports = router;  