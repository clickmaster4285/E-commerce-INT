const express = require("express");

const {
  createProduct,
  getProducts,
  getProductStats,
  getProductFacets,
  getCategoryTiles,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleProductFeatured,
  bulkProductFeatured,
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
// ✅ Storefront shop facets + category tiles — "/:id" se PEHLE (warna id match ho jayega)
// Master-data GETs: short public cache (60s) + ETag (express default).
// User-specific/cart/orders par kabhi nahi — sirf ye do static-ish routes.
const masterCache = (req, res, next) => {
  res.set("Cache-Control", "public, max-age=60, must-revalidate");
  next();
};
router.get("/facets", masterCache, getProductFacets);
router.get("/category-tiles", masterCache, getCategoryTiles);
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
// ✅ Featured Products page — bulk mark / unmark ("Manage Products" popup)
//    "/:id" routes se PEHLE register — warna "bulk-featured" ko id samajh sakta hai.
router.patch("/bulk-featured", authMiddleware, checkPermission("featuredProducts"), bulkProductFeatured);
// ✅ Featured Products page — single mark / unmark
router.patch("/:id/toggle-featured", authMiddleware, checkPermission("featuredProducts"), toggleProductFeatured);

module.exports = router;