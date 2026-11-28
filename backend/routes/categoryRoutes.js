const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

const {
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryAttributes,
  getCategoryAttributesHierarchical,
  assignCategoryAttributes,
  getPublicCategories,
  getCategoryOptions,
  getAdminCategories,
} = require("../controllers/categoryController");

const { publicCache } = require("../utils/publicCache");
const { invalidateOn } = require("../middleware/invalidateOn");

const router = express.Router();

// ✅ Admin mutation ke baad public cache drop (foran fresh)
// "products" bhi drop karna zaroori hai — category-tiles (`/api/products/category-tiles`)
// namespace `products` me cache hota hai, aur wahan bhi category list/counts aate hain.
const dropCategoriesCache = invalidateOn(["categories", "products"]); // 2xx ke BAAD drop

// Handlers controllers/categoryController.js me hain — yahan sirf path + middleware (§5.1)

// ✅ PUBLIC — PEHLE declare karna zaroori hai warna "/:id" match ho jayega (60s memo)
router.get("/public", publicCache(60 * 1000), getPublicCategories);

// Admin — parent selector (compact) aur paginated list
router.get("/admin/options", authMiddleware, checkPermission("products"), getCategoryOptions);
router.get("/admin/all", authMiddleware, checkPermission("products"), getAdminCategories);

router.get("/next-code", authMiddleware, checkPermission("products"), getNextCode);
router.get("/", authMiddleware, checkPermission("products"), getCategories);
router.get("/:id", authMiddleware, checkPermission("products"), getCategoryById);
router.get("/:id/attributes", authMiddleware, checkPermission("products"), getCategoryAttributes);
router.get("/:id/attributes-hierarchy", authMiddleware, checkPermission("products"), getCategoryAttributesHierarchical);
router.post("/", authMiddleware, checkPermission("products"), dropCategoriesCache, createCategory);
router.put("/:id", authMiddleware, checkPermission("products"), dropCategoriesCache, updateCategory);
router.put("/:id/attributes", authMiddleware, checkPermission("products"), dropCategoriesCache, assignCategoryAttributes);
router.delete("/:id", authMiddleware, checkPermission("products"), dropCategoriesCache, deleteCategory);

module.exports = router;
