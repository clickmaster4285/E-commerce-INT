const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const uploadDealImageFile = require("../middleware/dealImageMiddleware");
const { publicCache } = require("../utils/publicCache");
const { invalidateOn } = require("../middleware/invalidateOn");
const { validate } = require("../middleware/validate");
const dealValidators = require("../validators/dealValidators");

const {
  createDeal,
  getDeals,
  getActiveDeals,
  getDealById,
  getDealTargets,
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
router.get("/:id/targets", authMiddleware, checkPermission("deals"), getDealTargets);
router.get("/:id", authMiddleware, checkPermission("deals"), getDealById);
// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropDealsCache = invalidateOn("deals");
router.post("/", authMiddleware, checkPermission("deals"), validate(dealValidators.createDeal), dropDealsCache, createDeal);
router.put("/:id", authMiddleware, checkPermission("deals"), validate(dealValidators.updateDeal), dropDealsCache, updateDeal);
router.delete("/:id", authMiddleware, checkPermission("deals"), validate(dealValidators.dealId), dropDealsCache, deleteDeal);
router.patch("/:id/toggle-status", authMiddleware, checkPermission("deals"), dropDealsCache, toggleDealStatus);

// 404 global handler (app.js) sambhalta hai

module.exports = router;
