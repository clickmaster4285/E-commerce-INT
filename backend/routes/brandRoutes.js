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
const router = express.Router();

// ==========================================
// 🌐 PUBLIC ROUTES — bina token (User GUI)
// ==========================================
router.get("/", getBrandsPublic);
router.get("/next-code", authMiddleware, getNextBrandCode); // ✅ STATIC route FIRST
router.get("/:id/details", getBrandWithProducts);           // ✅ dynamic AFTER static
router.get("/:id", getBrandById);

// ==========================================
// 🛡️ ADMIN ROUTES — token + permission
// ==========================================
router.get("/admin/all", authMiddleware, checkPermission("brands"), getBrandsAdmin);
router.post("/", authMiddleware, checkPermission("brands"), upload.single("logo"), processBrandLogo, createBrand);
router.put("/:id", authMiddleware, checkPermission("brands"), upload.single("logo"), processBrandLogo, updateBrand);
router.delete("/:id", authMiddleware, checkPermission("brands"), deleteBrand);

module.exports = router;