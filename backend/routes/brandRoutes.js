const express = require("express");
const { createBrand, getBrands, getBrandById, getBrandWithProducts, updateBrand, deleteBrand } = require("../controllers/brandController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware"); // <--- Naya import

const router = express.Router();

// Sirf ADMIN add, update, delete kar sakta hai
router.post("/", authMiddleware, adminMiddleware, createBrand);
router.put("/:id", authMiddleware, adminMiddleware, updateBrand);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBrand);

// Sab (Admin aur User) dekh sakte hain
router.get("/", authMiddleware, getBrands);
router.get("/:id/details", authMiddleware, getBrandWithProducts);
router.get("/:id", authMiddleware, getBrandById);

module.exports = router;