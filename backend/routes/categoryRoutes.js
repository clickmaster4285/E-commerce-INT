const express = require("express");

const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// CREATE
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createCategory
);

// UPDATE
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  updateCategory
);

// DELETE
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  deleteCategory
);

// GET ALL
router.get(
  "/",
  authMiddleware,
  getCategories
);

// GET ONE
router.get(
  "/:id",
  authMiddleware,
  getCategoryById
);

module.exports = router;