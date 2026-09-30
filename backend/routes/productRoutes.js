const express = require("express");

const {
  createProduct,
  getProducts,
  getProductStats,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleProductFeatured,
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
// ✅ Summary stats (stat cards) — list se alag route, taake independently load ho sake.
//    Note: "/:id" se PEHLE register hona zaroori hai warna "stats" id samajh liya jayega.
router.get("/stats", getProductStats);
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
// ✅ Featured Products page — mark / unmark
router.patch("/:id/toggle-featured", authMiddleware, checkPermission("products"), toggleProductFeatured);

module.exports = router;