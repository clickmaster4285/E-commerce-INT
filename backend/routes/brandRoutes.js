const express = require("express");
const {
  getNextBrandCode,
  createBrand,
  getBrands,
  getBrandsPublic,
  getBrandsAdmin,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const upload = require("../middleware/uploadConfig");
const processBrandLogo = require("../middleware/imageMiddleware");
const { publicCache, invalidate } = require("../utils/publicCache");
const router = express.Router();

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropBrandsCache = (req, res, next) => { invalidate("brands"); next(); };

// ==========================================
// 🌐 PUBLIC ROUTES — bina token (User GUI)
// ==========================================
// ✅ 1000 brands / 247KB — 60s memo (output same)
router.get("/", publicCache(60 * 1000), getBrandsPublic);
router.get("/next-code", authMiddleware, getNextBrandCode); // ✅ STATIC route FIRST
router.get("/:id/details", getBrandWithProducts);           // ✅ dynamic AFTER static
router.get("/:id", getBrandById);

// ==========================================
// 🛡️ ADMIN ROUTES — token + permission
// ==========================================
router.get("/admin/all", authMiddleware, checkPermission("brands"), getBrandsAdmin);
router.post("/", authMiddleware, checkPermission("brands"), dropBrandsCache, upload.single("logo"), processBrandLogo, createBrand);
router.put("/:id", authMiddleware, checkPermission("brands"), dropBrandsCache, upload.single("logo"), processBrandLogo, updateBrand);
router.delete("/:id", authMiddleware, checkPermission("brands"), dropBrandsCache, deleteBrand);

module.exports = router;