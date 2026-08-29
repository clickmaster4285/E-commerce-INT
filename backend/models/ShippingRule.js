const mongoose = require("mongoose");

const shippingRuleSchema = new mongoose.Schema(
  {
    rule_type: {
      type: String,
      enum: ["product", "category", "brand"],
      required: true,
    },
    ref_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    shipping_type: { type: String, enum: ["free", "fixed"], default: "free" },
    fee: { type: Number, default: 0, min: 0 }, // sirf fixed ke liye
    is_active: { type: Boolean, default: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShippingRule", shippingRuleSchema);