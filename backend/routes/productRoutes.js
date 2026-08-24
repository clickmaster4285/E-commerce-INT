const express = require("express");

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
} = require("../controllers/productController");

const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const {
  productImagesUpload,
  validateProductImages,
} = require("../middleware/productImageMiddleware");

const saveProductImages = require("../middleware/saveProductImages");

const router = express.Router();

// ==========================================
// 🌐 PUBLIC ROUTES — bina login (User GUI)
// ==========================================
router.get("/", getProducts);
router.get("/:id", getProductById);

// ==========================================
// 🛡️ ADMIN ROUTES — login + permission
// ==========================================
router.post(
  "/",
  authMiddleware,
  checkPermission("products"),
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  createProduct,
);

router.put(
  "/:id",
  authMiddleware,
  checkPermission("products"),
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  updateProduct,
);

router.delete("/:id", authMiddleware, checkPermission("products"), deleteProduct);
router.patch("/:id/toggle-status", authMiddleware, checkPermission("products"), toggleProductStatus);

module.exports = router;