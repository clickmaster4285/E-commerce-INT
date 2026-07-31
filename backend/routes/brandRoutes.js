const express = require("express");
const { createBrand,getBrands,getBrandById,getBrandWithProducts,updateBrand,deleteBrand } = require("../controllers/brandController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/",authMiddleware, createBrand);
router.get("/",authMiddleware, getBrands);
router.get("/:id/details",authMiddleware, getBrandWithProducts);
router.get("/:id",authMiddleware, getBrandById);
router.put("/:id",authMiddleware, updateBrand);
router.delete("/:id",authMiddleware, deleteBrand);
module.exports = router;