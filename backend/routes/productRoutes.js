const express = require("express");

const {
  createProduct,
  getProducts,
  getProductStats,
  getProductFacets,
  getCategoryTiles,
  getProductById,
  getProductDocumentHistory,
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
//    Server-side memo (publicCache) hi caching layer hai — wo har admin mutation
//    par `dropProductsCache` se drop ho jaata hai.
//
// ⚠️ Yahan PEHLE ek browser-level `Cache-Control: public, max-age=60` bhi tha.
//    Wo ek alag, UNSYNCED cache layer tha: socket event aane par frontend cache
//    patch karta hai, phir `invalidate()` refetch karta hai — lekin browser apne
//    60s ke HTTP cache se purana response serve kar deta (server tak request jaata
//    hi nahi) aur wahi stale data React Query cache ko wapas likh deta.
//    Isiliye "Explore Our Categories" section rename/disable hone par purana data
//    dikhata tha jabki sidebar (`/categories/public`, jis par ye header nahi tha)
//    sahi update ho jata tha.
//    Ab header hataya gaya hai — Express ka default ETag/304 unchanged data ke
//    liye conditional GET deta hai (cheap), aur fresh data hamesha server se aata hai.
router.get("/facets", publicCache(30 * 1000), getProductFacets);
router.get("/category-tiles", publicCache(60 * 1000), getCategoryTiles);
router.get("/admin/:id/history", authMiddleware, checkPermission("products"), getProductDocumentHistory);
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
router.patch("/bulk-featured", authMiddleware, checkPermission("featuredProducts"), bulkProductFeatured);
// ✅ Featured Products page — single mark / unmark
router.patch("/:id/toggle-featured", authMiddleware, checkPermission("featuredProducts"), toggleProductFeatured);

module.exports = router;
