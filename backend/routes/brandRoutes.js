const express = require("express");

const {
  getNextBrandCode,    // ✅ NEW: Added
  createBrand,
  getBrands,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadConfig");
const processBrandLogo = require("../middleware/imageMiddleware");

const router = express.Router();


// ================================
// ✅ NEW: GET NEXT BRAND CODE (BRD-001, BRD-002, ...)
// ⚠️ Ye /:id se PEHLE hona zaroori hai!
// ================================
router.get(
  "/next-code",
  authMiddleware,
  getNextBrandCode
);


// ================================
// CREATE BRAND
// ================================
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.single("logo"),
  processBrandLogo,
  createBrand
);


// ================================
// GET ALL BRANDS
// ================================
router.get(
  "/",
  authMiddleware,
  getBrands
);


// ================================
// GET BRAND WITH PRODUCTS
// ================================
router.get(
  "/:id/details",
  authMiddleware,
  getBrandWithProducts
);


// ================================
// GET SINGLE BRAND
// ================================
router.get(
  "/:id",
  authMiddleware,
  getBrandById
);


// ================================
// UPDATE BRAND
// ================================
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  upload.single("logo"),
  processBrandLogo,
  updateBrand
);


// ================================
// DELETE BRAND
// ================================
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  deleteBrand
);


module.exports = router;