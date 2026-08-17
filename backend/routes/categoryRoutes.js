const express = require("express");
const {
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// ✅ PUBLIC — All categories
router.get("/", getCategories);

// 🔐 ADMIN — ⚠️ SPECIFIC routes PEHLE (/:id se pehle!)
router.get("/next-code", authMiddleware, adminMiddleware, getNextCode);
router.post("/", authMiddleware, adminMiddleware, createCategory);
router.put("/:id", authMiddleware, adminMiddleware, updateCategory);
router.delete("/:id", authMiddleware, adminMiddleware, deleteCategory);

// ✅ PUBLIC — ⚠️ DYNAMIC route LAST mein
router.get("/:id", getCategoryById);

module.exports = router;