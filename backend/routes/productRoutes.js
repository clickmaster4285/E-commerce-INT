const express = require("express");

const {
  createProduct,
  getProducts,
  getProductsPublic,
  getProductsAdmin,
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
// 🌐 PUBLIC ROUTES — bina token (User GUI)
// ==========================================
router.get("/", getProductsPublic);
router.get("/:id", getProductById);

// ==========================================
// 🛡️ ADMIN ROUTES — token + permission
// ==========================================
router.get("/admin/all", authMiddleware, checkPermission("products"), getProductsAdmin);

router.post(
  "/",
  authMiddleware,
  checkPermission("products"),
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  createProduct
);

router.put(
  "/:id",
  authMiddleware,
  checkPermission("products"),
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  updateProduct
);

router.delete("/:id", authMiddleware, checkPermission("products"), deleteProduct);

router.patch("/:id/toggle-status", authMiddleware, checkPermission("products"), toggleProductStatus);

module.exports = router;