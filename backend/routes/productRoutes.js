const express = require("express");
const { createProduct, getProducts, getProductById, updateProduct, deleteProduct } = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware"); // <--- Naya import

const router = express.Router();

// Sirf ADMIN add, update, delete kar sakta hai
router.post("/", authMiddleware, adminMiddleware, createProduct);
router.put("/:id", authMiddleware, adminMiddleware, updateProduct);
router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

// Sab (Admin aur User) dekh sakte hain
router.get("/", authMiddleware, getProducts);
router.get("/:id", authMiddleware, getProductById);

module.exports = router;