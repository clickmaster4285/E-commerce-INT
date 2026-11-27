// ==========================================================
// COUNTER — per-store atomic sequence (optimizeplan.md §3.2)
// ----------------------------------------------------------
// Order / invoice / POS / PO / quote / lead numbers, SKU, codes: pehle har
// generator "sabse bada number dhoondo + 1" karta tha (poori collection scan,
// concurrent requests par duplicate). Ab ek document per {storeId, key} aur
// atomic $inc. Dekho utils/counter.js.
// ==========================================================
const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "counters", versionKey: false },
);

counterSchema.plugin(tenantScope);
counterSchema.index({ storeId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Counter", counterSchema);
