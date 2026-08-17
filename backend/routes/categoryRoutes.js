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
const { checkPermission } = require("../middleware/checkPermission");
const router = express.Router();

// ✅ GET next code — No permission (just generates a code)
router.get("/next-code", authMiddleware, getNextCode);

// ✅ CREATE — Permission required
router.post("/", authMiddleware, checkPermission("categories"), createCategory);

// ✅ UPDATE — Permission required
router.put("/:id", authMiddleware, checkPermission("categories"), updateCategory);

// ✅ DELETE — Permission required
router.delete("/:id", authMiddleware, checkPermission("categories"), deleteCategory);

// ✅ GET all — No permission (read-only, sab dekh saken)
router.get("/", authMiddleware, getCategories);

// ✅ GET by id — No permission (read-only)
router.get("/:id", authMiddleware, getCategoryById);

module.exports = router;