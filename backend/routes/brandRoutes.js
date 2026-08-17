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
const upload = require("../middleware/uploadConfig");
const processBrandLogo = require("../middleware/imageMiddleware");

const router = express.Router();

// ✅ PUBLIC — All brands
router.get("/", getBrands);

// 🔐 ADMIN — ⚠️ SPECIFIC routes PEHLE
router.get("/next-code", authMiddleware, getNextBrandCode);

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.single("logo"),
  processBrandLogo,
  createBrand
);

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  upload.single("logo"),
  processBrandLogo,
  updateBrand
);

router.delete("/:id", authMiddleware, adminMiddleware, deleteBrand);

// ✅ PUBLIC — ⚠️ DYNAMIC routes LAST mein
router.get("/:id/details", getBrandWithProducts);
router.get("/:id", getBrandById);

module.exports = router;