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
router.put("/admin/config", authMiddleware, checkPermission("shipping"), updateShippingConfig);
router.get("/admin/rules", authMiddleware, checkPermission("shipping"), getShippingRules);
router.post("/admin/rules", authMiddleware, checkPermission("shipping"), createShippingRule);
router.put("/admin/rules/:id", authMiddleware, checkPermission("shipping"), updateShippingRule);
router.delete("/admin/rules/:id", authMiddleware, checkPermission("shipping"), deleteShippingRule);
router.patch("/admin/rules/:id/toggle", authMiddleware, checkPermission("shipping"), toggleShippingRule);

// ✅ Custom shipping methods CRUD (admin)
router.get("/admin/methods", authMiddleware, checkPermission("shipping"), getShippingMethods);
router.post("/admin/methods", authMiddleware, checkPermission("shipping"), createShippingMethod);
router.put("/admin/methods/:id", authMiddleware, checkPermission("shipping"), updateShippingMethod);
router.delete("/admin/methods/:id", authMiddleware, checkPermission("shipping"), deleteShippingMethod);
router.patch("/admin/methods/:id/toggle", authMiddleware, checkPermission("shipping"), toggleShippingMethod);

module.exports = router;