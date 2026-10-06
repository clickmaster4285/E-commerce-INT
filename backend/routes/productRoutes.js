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

const { publicCache, invalidate } = require("../utils/publicCache");

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropProductsCache = (req, res, next) => { invalidate("products"); next(); };

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
router.get("/facets", masterCache, publicCache(30 * 1000), getProductFacets);
router.get("/category-tiles", masterCache, publicCache(60 * 1000), getCategoryTiles);
router.get("/:id", getProductById);

// ==========================================
// 🛡️ ADMIN ROUTES — login + permission
// ==========================================
router.post(
  "/",
  authMiddleware,
  checkPermission("products"),
  dropProductsCache,
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  createProduct,
);

router.put(
  "/:id",
  authMiddleware,
  checkPermission("products"),
  dropProductsCache,
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  updateProduct,
);

router.delete("/:id", authMiddleware, checkPermission("products"), dropProductsCache, deleteProduct);
router.patch("/:id/toggle-status", authMiddleware, checkPermission("products"), dropProductsCache, toggleProductStatus);
// ✅ Featured Products page — bulk mark / unmark ("Manage Products" popup)
//    "/:id" routes se PEHLE register — warna "bulk-featured" ko id samajh sakta hai.
router.patch("/bulk-featured", authMiddleware, checkPermission("products"), dropProductsCache, bulkProductFeatured);
// ✅ Featured Products page — single mark / unmark
router.patch("/:id/toggle-featured", authMiddleware, checkPermission("products"), dropProductsCache, toggleProductFeatured);

module.exports = router;