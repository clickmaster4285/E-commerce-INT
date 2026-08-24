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
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

// ==========================================
// 🌐 PUBLIC ROUTES — bina login (User GUI)
// ==========================================
router.get("/", getCategoriesPublic);
router.get("/:id", getCategoryById);

// ==========================================
// 🛡️ ADMIN ROUTES — login + permission
// ==========================================
router.get("/admin/all", authMiddleware, checkPermission("categories"), getCategoriesAdmin);
router.get("/next-code", authMiddleware, getNextCode);
router.post("/", authMiddleware, checkPermission("categories"), createCategory);
router.put("/:id", authMiddleware, checkPermission("categories"), updateCategory);
router.delete("/:id", authMiddleware, checkPermission("categories"), deleteCategory);

module.exports = router;