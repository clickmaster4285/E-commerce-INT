const express = require("express");
const { createBrand, getBrands, getBrandById, getBrandWithProducts, updateBrand, deleteBrand } = require("../controllers/brandController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware"); // <--- Naya import

const router = express.Router();

// Sirf ADMIN add, update, delete kar sakta hai
router.post("/",  createBrand);
router.put("/:id", updateBrand);
router.delete("/:id", deleteBrand);

// Sab (Admin aur User) dekh sakte hain
router.get("/", getBrands);
router.get("/:id/details", getBrandWithProducts);
router.get("/:id", getBrandById);

module.exports = router;