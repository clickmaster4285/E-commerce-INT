const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createDiscount,
  getDiscounts,
  getDiscountById,
  updateDiscount,
  deleteDiscount,
  getPublicDiscounts,
} = require("../controllers/discountController");

const { publicCache, invalidate } = require("../utils/publicCache");

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropDiscountsCache = (req, res, next) => { invalidate("discounts"); next(); };

// =====================================================
// PUBLIC ROUTES (60s memo — output same)
// =====================================================

router.get("/public", publicCache(60 * 1000), getPublicDiscounts);

// =====================================================
// ADMIN ROUTES
// =====================================================

router.post("/", authMiddleware, dropDiscountsCache, createDiscount);

router.get("/", authMiddleware, getDiscounts);

router.get("/:id", authMiddleware, getDiscountById);

router.put("/:id", authMiddleware, dropDiscountsCache, updateDiscount);

router.delete("/:id", authMiddleware, dropDiscountsCache, deleteDiscount);

module.exports = router;