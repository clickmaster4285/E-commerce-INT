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

// =====================================================
// PUBLIC ROUTES
// =====================================================

router.get("/public", getPublicDiscounts);

// =====================================================
// ADMIN ROUTES
// =====================================================

router.post("/", authMiddleware, createDiscount);

router.get("/", authMiddleware, getDiscounts);

router.get("/:id", authMiddleware, getDiscountById);

router.put("/:id", authMiddleware, updateDiscount);

router.delete("/:id", authMiddleware, deleteDiscount);

module.exports = router;