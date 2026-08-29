const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getShippingConfig, quoteShipping, updateShippingConfig,
  getShippingRules, createShippingRule, updateShippingRule,
  deleteShippingRule, toggleShippingRule,
} = require("../controllers/shippingController");

const router = express.Router();

// Public / user
router.get("/config", getShippingConfig);
router.post("/quote", authMiddleware, quoteShipping);

// Admin
router.put("/admin/config", authMiddleware, checkPermission("store"), updateShippingConfig);
router.get("/admin/rules", authMiddleware, checkPermission("store"), getShippingRules);
router.post("/admin/rules", authMiddleware, checkPermission("store"), createShippingRule);
router.put("/admin/rules/:id", authMiddleware, checkPermission("store"), updateShippingRule);
router.delete("/admin/rules/:id", authMiddleware, checkPermission("store"), deleteShippingRule);
router.patch("/admin/rules/:id/toggle", authMiddleware, checkPermission("store"), toggleShippingRule);

module.exports = router;