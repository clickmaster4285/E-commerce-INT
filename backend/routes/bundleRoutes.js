const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const {
  createBundle,
  getBundles,
  getBundleById,
  updateBundle,
  deleteBundle,
  toggleBundleStatus,
  getActiveBundles,
} = require("../controllers/bundleController");

const {
  bundleImageUpload,
  processBundleImage,
} = require("../middleware/bundleImageMiddleware");

const router = express.Router();

// ==========================================
// 🌐 PUBLIC ROUTES — bina login (User GUI)
// ⚠️ "/active" har "/:id" se pehle hona chahiye
// ==========================================
router.get("/active", getActiveBundles);

// ==========================================
// 🛡️ ADMIN ROUTES — login + permission
// ==========================================
router.get("/", authMiddleware, checkPermission("bundles"), getBundles);

router.get("/:id", authMiddleware, checkPermission("bundles"), getBundleById);

// ✅ Image upload wahi method jo product images me use hota hai
//    (shared multer uploadConfig + sharp processing)
router.post(
  "/",
  authMiddleware,
  checkPermission("bundles"),
  bundleImageUpload,
  processBundleImage,
  createBundle
);

router.put(
  "/:id",
  authMiddleware,
  checkPermission("bundles"),
  bundleImageUpload,
  processBundleImage,
  updateBundle
);

router.delete("/:id", authMiddleware, checkPermission("bundles"), deleteBundle);

router.patch(
  "/:id/toggle-status",
  authMiddleware,
  checkPermission("bundles"),
  toggleBundleStatus
);

router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Bundle API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = router;
