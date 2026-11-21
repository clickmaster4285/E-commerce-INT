const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const shippingRuleSchema = new mongoose.Schema(
  {
    rule_type: {
      type: String,
      enum: ["product", "category", "brand", "all"],
      required: true,
    },
    // ✅ For "all" rules, ref_id is null. For others, points to a brand/category/product ObjectId.
    ref_id: { type: mongoose.Schema.Types.ObjectId, required: false, default: null },
    shipping_type: { type: String, enum: ["free", "fixed"], default: "free" },
    fee: { type: Number, default: 0, min: 0 }, // sirf fixed ke liye
    is_active: { type: Boolean, default: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);


// ── Multi-tenant ──
shippingRuleSchema.plugin(tenantScope); // har store ka data alag (storeId)

module.exports = mongoose.model("ShippingRule", shippingRuleSchema);