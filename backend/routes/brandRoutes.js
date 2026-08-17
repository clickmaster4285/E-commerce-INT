const express = require("express");

const {
  getNextBrandCode,
  createBrand,
  getBrands,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const upload = require("../middleware/uploadConfig");
const processBrandLogo = require("../middleware/imageMiddleware");

const router = express.Router();

// ================================
// GET NEXT BRAND CODE — No permission needed (just generates a code)
// ================================
router.get(
  "/next-code",
  authMiddleware,
  getNextBrandCode
);

// ================================
// CREATE BRAND — Permission required
// ================================
router.post(
  "/",
  authMiddleware,
  checkPermission("brands"),
  upload.single("logo"),
  processBrandLogo,
  createBrand
);

// ================================
// GET ALL BRANDS — No permission needed (read-only)
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
// UPDATE BRAND — Permission required
// ================================
router.put(
  "/:id",
  authMiddleware,
  checkPermission("brands"),
  upload.single("logo"),
  processBrandLogo,
  updateBrand
);

// ================================
// DELETE BRAND — Permission required
// ================================
router.delete(
  "/:id",
  authMiddleware,
  checkPermission("brands"),
  deleteBrand
);

module.exports = router;