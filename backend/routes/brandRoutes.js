const express = require("express");
const {
  getNextBrandCode,
  createBrand,
  getBrandsPublic,
  getBrandsAdmin,
  getBrandOptions,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const processBrandLogo = require("../middleware/imageMiddleware");
const { publicCache } = require("../utils/publicCache");
const { invalidateOn } = require("../middleware/invalidateOn");
const router = express.Router();

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropBrandsCache = invalidateOn("brands"); // 2xx ke BAAD drop (finish hook)

// ==========================================
// 🌐 PUBLIC ROUTES — bina token (User GUI)
// ==========================================
// ✅ 1000 brands / 247KB — 60s memo (output same)
router.get("/", publicCache(60 * 1000), getBrandsPublic);
router.get("/next-code", authMiddleware, checkPermission("brands"), getNextBrandCode); // ✅ STATIC route FIRST
router.get("/admin/options", authMiddleware, checkPermission("brands"), getBrandOptions);
router.get("/:id/details", getBrandWithProducts);           // ✅ dynamic AFTER static
router.get("/:id", getBrandById);

// ==========================================
// 🛡️ ADMIN ROUTES — token + permission
// ==========================================
router.get("/admin/all", authMiddleware, checkPermission("brands"), getBrandsAdmin);
router.post("/", authMiddleware, checkPermission("brands"), dropBrandsCache, processBrandLogo.upload, processBrandLogo, createBrand);
router.put("/:id", authMiddleware, checkPermission("brands"), dropBrandsCache, processBrandLogo.upload, processBrandLogo, updateBrand);
router.delete("/:id", authMiddleware, checkPermission("brands"), dropBrandsCache, deleteBrand);

module.exports = router;