const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getShippingConfig, getActiveShippingRules, quoteShipping, updateShippingConfig,
  getShippingRules, createShippingRule, updateShippingRule,
  deleteShippingRule, toggleShippingRule,
  getActiveShippingMethods, getShippingMethods, createShippingMethod,
  updateShippingMethod, deleteShippingMethod, toggleShippingMethod,
} = require("../controllers/shippingController");

const router = express.Router();

// Public / user
router.get("/config", getShippingConfig);
// ✅ Public: user GUI reads active rules via this endpoint (no auth needed).
router.get("/rules", getActiveShippingRules);
// ✅ Public: custom shipping methods (active only) — checkout GUI ke liye.
router.get("/methods", getActiveShippingMethods);
router.post("/quote", authMiddleware, quoteShipping);

// Admin
router.put("/admin/config", authMiddleware.requireAdmin, checkPermission("shipping"), updateShippingConfig);
router.get("/admin/rules", authMiddleware.requireAdmin, checkPermission("shipping"), getShippingRules);
router.post("/admin/rules", authMiddleware.requireAdmin, checkPermission("shipping"), createShippingRule);
router.put("/admin/rules/:id", authMiddleware.requireAdmin, checkPermission("shipping"), updateShippingRule);
router.delete("/admin/rules/:id", authMiddleware.requireAdmin, checkPermission("shipping"), deleteShippingRule);
router.patch("/admin/rules/:id/toggle", authMiddleware.requireAdmin, checkPermission("shipping"), toggleShippingRule);

// ✅ Custom shipping methods CRUD (admin)
router.get("/admin/methods", authMiddleware.requireAdmin, checkPermission("shipping"), getShippingMethods);
router.post("/admin/methods", authMiddleware.requireAdmin, checkPermission("shipping"), createShippingMethod);
router.put("/admin/methods/:id", authMiddleware.requireAdmin, checkPermission("shipping"), updateShippingMethod);
router.delete("/admin/methods/:id", authMiddleware.requireAdmin, checkPermission("shipping"), deleteShippingMethod);
router.patch("/admin/methods/:id/toggle", authMiddleware.requireAdmin, checkPermission("shipping"), toggleShippingMethod);

module.exports = router;