const express = require("express");
const { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory } = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware"); // <--- Naya import

const router = express.Router();

// Sirf ADMIN add, update, delete kar sakta hai
router.post("/", authMiddleware, adminMiddleware, createCategory);
router.put("/:id", authMiddleware, adminMiddleware, updateCategory);
router.delete("/:id", authMiddleware, adminMiddleware, deleteCategory);

// Sab (Admin aur User) dekh sakte hain
router.get("/", authMiddleware, getCategories);
router.get("/:id", authMiddleware, getCategoryById);

module.exports = router;