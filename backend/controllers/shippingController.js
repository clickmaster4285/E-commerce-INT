const ShippingConfig = require("../models/ShippingConfig");
const ShippingRule = require("../models/ShippingRule");

const emit = (event, data) => {
  try {
    const { getIO } = require("../utils/socket");
    getIO().emit(event, data);
  } catch (e) {}
};

// ✅ Core calculator — checkout + placeOrder dono use karenge
const calculateShipping = async ({ items = [], method = "standard", subtotal = 0 }) => {
  const config = await ShippingConfig.getConfig();
  let fee = method === "express" ? config.express.fee : config.standard.fee;
  let reason = method === "express" ? "Express rate" : "Standard rate";
  let free = false;

  // ✅ Threshold free shipping
  if (config.free_shipping_over > 0 && subtotal >= config.free_shipping_over) {
    free = true;
    reason = `Free shipping over Rs. ${config.free_shipping_over.toLocaleString()}`;
  }

  // ✅ Brand / Category / Product rules
  if (!free && items.length) {
    const rules = await ShippingRule.find({ is_active: true }).lean();
    outer: for (const item of items) {
      for (const r of rules) {
        const refId = String(r.ref_id);
        const match =
          (r.rule_type === "product" && refId === String(item.productId || item.product_id || item._id)) ||
          (r.rule_type === "brand" && refId === String(item.brandId || item.brand_id)) ||
          (r.rule_type === "category" && refId === String(item.categoryId || item.category_id));
        if (match) {
          if (r.shipping_type === "free") {
            free = true;
            reason = `Free shipping (${r.rule_type} rule)`;
            break outer;
          }
          fee = r.fee;
          reason = `Fixed rate (${r.rule_type} rule)`;
        }
      }
    }
  }

  return { fee: free ? 0 : fee, free, reason, config };
};

// ==========================================
// GET /api/shipping/config (public)
// ==========================================
const getShippingConfig = async (req, res) => {
  try {
    const config = await ShippingConfig.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// POST /api/shipping/quote (user)
// ==========================================
const quoteShipping = async (req, res) => {
  try {
    const { items = [], method = "standard", subtotal = 0 } = req.body || {};
    const result = await calculateShipping({ items, method, subtotal });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PUT /api/shipping/admin/config
// ==========================================
const updateShippingConfig = async (req, res) => {
  try {
    const config = await ShippingConfig.getConfig();
    const b = req.body || {};

    if (b.standard) {
      config.standard.fee = Math.max(0, Number(b.standard.fee) || 0);
      config.standard.min_days = Math.max(0, Number(b.standard.min_days) || 0);
      config.standard.max_days = Math.max(config.standard.min_days, Number(b.standard.max_days) || 0);
    }
    if (b.express) {
      config.express.fee = Math.max(0, Number(b.express.fee) || 0);
      config.express.min_days = Math.max(0, Number(b.express.min_days) || 0);
      config.express.max_days = Math.max(config.express.min_days, Number(b.express.max_days) || 0);
    }
    if (b.free_shipping_over !== undefined) {
      config.free_shipping_over = Math.max(0, Number(b.free_shipping_over) || 0);
    }

    await config.save();
    emit("shipping:updated", config);
    res.json({ success: true, message: "Shipping settings updated", data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// RULES CRUD
// ==========================================
const getShippingRules = async (req, res) => {
  try {
    const rules = await ShippingRule.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createShippingRule = async (req, res) => {
  try {
    const { rule_type, ref_id, shipping_type = "free", fee = 0, is_active = true, note = "" } = req.body || {};
    if (!["product", "category", "brand"].includes(rule_type) || !ref_id) {
      return res.status(400).json({ success: false, message: "Invalid rule type or target" });
    }
    const rule = await ShippingRule.create({
      rule_type, ref_id, shipping_type,
      fee: shipping_type === "fixed" ? Math.max(0, Number(fee) || 0) : 0,
      is_active, note,
    });
    emit("shippingRules:updated", rule);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShippingRule = async (req, res) => {
  try {
    const rule = await ShippingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    const b = req.body || {};
    if (b.rule_type) rule.rule_type = b.rule_type;
    if (b.ref_id) rule.ref_id = b.ref_id;
    if (b.shipping_type) rule.shipping_type = b.shipping_type;
    if (b.fee !== undefined) rule.fee = Math.max(0, Number(b.fee) || 0);
    if (b.is_active !== undefined) rule.is_active = !!b.is_active;
    if (b.note !== undefined) rule.note = b.note;

    await rule.save();
    emit("shippingRules:updated", rule);
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShippingRule = async (req, res) => {
  try {
    await ShippingRule.findByIdAndDelete(req.params.id);
    emit("shippingRules:updated", { id: req.params.id });
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleShippingRule = async (req, res) => {
  try {
    const rule = await ShippingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    rule.is_active = !rule.is_active;
    await rule.save();
    emit("shippingRules:updated", rule);
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  calculateShipping,
  getShippingConfig,
  quoteShipping,
  updateShippingConfig,
  getShippingRules,
  createShippingRule,
  updateShippingRule,
  deleteShippingRule,
  toggleShippingRule,
};