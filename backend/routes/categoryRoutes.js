const express = require("express");
const {
  getNextCode,
  createCategory,
  getCategories,
  getCategoriesPublic,
  getCategoriesAdmin,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware"); // ✅ Auth middleware import
const { checkPermission } = require("../middleware/checkPermission"); // ✅ Permission middleware import

const router = express.Router();

// ==========================================
// CATEGORY ROUTES (Protected with Permissions)
// ==========================================

// ✅ GET next code — No permission required (just generates a code)
router.get("/next-code", authMiddleware, getNextCode);

// ✅ CREATE category — Requires 'categories' permission
router.post("/", authMiddleware, checkPermission("categories"), createCategory);

// ✅ UPDATE category — Requires 'categories' permission
router.put("/:id", authMiddleware, checkPermission("categories"), updateCategory);

// ✅ DELETE category — Requires 'categories' permission
router.delete("/:id", authMiddleware, checkPermission("categories"), deleteCategory);

// ✅ GET all categories — Requires 'categories' permission
router.get("/", authMiddleware, checkPermission("categories"), getCategories);

// ✅ GET by id — Requires 'categories' permission
router.get("/:id", authMiddleware, checkPermission("categories"), getCategoryById);

// ==========================================
// ️ 404 HANDLER
// ==========================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Category API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = router;