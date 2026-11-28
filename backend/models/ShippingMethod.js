const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ✅ Custom shipping methods — admin inko "Add New" se add karta hai.
//    'code' frontend checkout + orders mein method id ki tarah use hota hai.
const shippingMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    translations: { name: { type: Map, of: String, default: () => ({}) } },
    translation_source: { name: { type: String, default: "" } },
    translation_status: { name: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" } },
    code: { type: String, required: true, trim: true, lowercase: true },
    fee: { type: Number, default: 0, min: 0 },
    min_days: { type: Number, default: 2, min: 0 },
    max_days: { type: Number, default: 4, min: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);


// ── Multi-tenant ──
shippingMethodSchema.plugin(tenantScope); // har store ka data alag (storeId)
shippingMethodSchema.index({ storeId: 1, code: 1 }, { unique: true }); // unique per store

module.exports = mongoose.model("ShippingMethod", shippingMethodSchema);
