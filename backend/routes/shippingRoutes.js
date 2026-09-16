const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getShippingConfig, getActiveShippingRules, quoteShipping, updateShippingConfig,
  getShippingRules, createShippingRule, updateShippingRule,
  deleteShippingRule, toggleShippingRule,
} = require("../controllers/shippingController");

const router = express.Router();

// Public / user
router.get("/config", getShippingConfig);
// ✅ Public: user GUI reads active rules via this endpoint (no auth needed).
router.get("/rules", getActiveShippingRules);
router.post("/quote", authMiddleware, quoteShipping);

// Admin
router.put("/admin/config", authMiddleware, checkPermission("shipping"), updateShippingConfig);
router.get("/admin/rules", authMiddleware, checkPermission("shipping"), getShippingRules);
router.post("/admin/rules", authMiddleware, checkPermission("shipping"), createShippingRule);
router.put("/admin/rules/:id", authMiddleware, checkPermission("shipping"), updateShippingRule);
router.delete("/admin/rules/:id", authMiddleware, checkPermission("shipping"), deleteShippingRule);
router.patch("/admin/rules/:id/toggle", authMiddleware, checkPermission("shipping"), toggleShippingRule);

module.exports = router;