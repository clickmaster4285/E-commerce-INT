const express = require("express");

const router = express.Router();

// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

const {
  createDiscount,
  getDiscounts,
  getDiscountById,
  getDiscountTargets,
  updateDiscount,
  deleteDiscount,
  getPublicDiscounts,
} = require("../controllers/discountController");

const { publicCache } = require("../utils/publicCache");
const { invalidateOn } = require("../middleware/invalidateOn");

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropDiscountsCache = invalidateOn("discounts");

// =====================================================
// PUBLIC ROUTES (60s memo — output same)
// =====================================================

router.get("/public", publicCache(60 * 1000), getPublicDiscounts);

// =====================================================
// ADMIN ROUTES
// =====================================================

router.post("/", authMiddleware, checkPermission("discounts"), dropDiscountsCache, createDiscount);

router.get("/", authMiddleware, checkPermission("discounts"), getDiscounts);

router.get("/:id/targets", authMiddleware, checkPermission("discounts"), getDiscountTargets);

router.get("/:id", authMiddleware, checkPermission("discounts"), getDiscountById);

router.put("/:id", authMiddleware, checkPermission("discounts"), dropDiscountsCache, updateDiscount);

router.delete("/:id", authMiddleware, checkPermission("discounts"), dropDiscountsCache, deleteDiscount);

module.exports = router;
