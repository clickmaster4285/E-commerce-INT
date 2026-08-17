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

// ✅ CREATE PRODUCT — Permission required
router.post(
  "/",
  authMiddleware,
  checkPermission("products"),
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  createProduct,
);

// ✅ UPDATE PRODUCT — Permission required
router.put(
  "/:id",
  authMiddleware,
  checkPermission("products"),
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  updateProduct,
);

// ✅ DELETE PRODUCT — Permission required
router.delete("/:id", authMiddleware, checkPermission("products"), deleteProduct);

// ✅ TOGGLE STATUS — Permission required
router.patch("/:id/toggle-status", authMiddleware, checkPermission("products"), toggleProductStatus);

// ✅ GET ALL PRODUCTS — No permission (read-only, sab dekh saken)
router.get("/", authMiddleware, getProducts);

// ✅ GET SINGLE PRODUCT — No permission (read-only)
router.get("/:id", authMiddleware, getProductById);

module.exports = router;