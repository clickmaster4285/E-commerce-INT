const express = require("express");

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  productImagesUpload,
  validateProductImages,
} = require("../middleware/productImageMiddleware");

const saveProductImages = require("../middleware/saveProductImages");

const router = express.Router();

// ✅ PUBLIC — User storefront ke liye (koi login nahi chahiye)
router.get("/", getProducts);
router.get("/:id", getProductById);

// 🔐 ADMIN — Create/Update/Delete (login + admin zaroori)
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  createProduct
);

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  updateProduct
);

router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

module.exports = router;