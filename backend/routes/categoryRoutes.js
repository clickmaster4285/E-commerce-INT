const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const {
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryAttributes,
  assignCategoryAttributes,
} = require("../controllers/categoryController");

const Category = require("../models/Category");

const router = express.Router();

// ==========================================
// ✅ PUBLIC ROUTE — Bina login ke categories (User GUI ke liye)
// Ye route PEHLE declare karna zaroori hai warna "/" wala route pehle match ho jayega
// ==========================================
router.get("/public", async (req, res) => {
  try {
    const categories = await Category.find({ is_deleted: false })
      .select("name description parent_category_id category_type sort_order created_at")
      .sort({ sort_order: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("❌ Public categories fetch error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
});

// ==========================================
// ✅ FIX: /admin/all route — global mode (no tenant_id filter)
// ==========================================
router.get("/admin/all", authMiddleware, async (req, res) => {
  try {
    const categories = await Category.find({ is_deleted: false })
      .select("name category_code description parent_category_id category_type attributes sort_order created_at")
      .sort({ sort_order: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("Error fetching admin categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category tree",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
});

// ==========================================
// EXISTING ROUTES (Preserved — Admin-only)
// ==========================================
router.get("/next-code", authMiddleware, checkPermission("products"), getNextCode);
router.get("/", authMiddleware, checkPermission("products"), getCategories);
router.get("/:id", authMiddleware, checkPermission("products"), getCategoryById);
router.get("/:id/attributes", authMiddleware, checkPermission("products"), getCategoryAttributes);
router.post("/", authMiddleware, checkPermission("products"), createCategory);
router.put("/:id", authMiddleware, checkPermission("products"), updateCategory);
router.put("/:id/attributes", authMiddleware, checkPermission("products"), assignCategoryAttributes);
router.delete("/:id", authMiddleware, checkPermission("products"), deleteCategory);

module.exports = router;