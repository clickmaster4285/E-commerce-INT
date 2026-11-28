const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const addressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Default display name; normalize via utils/geo.normalizeCountryCode when validating input
    country: { type: String, default: "Pakistan", trim: true },
    full_name: { type: String, required: true, trim: true },
    street_address1: { type: String, required: true, trim: true },
    street_address2: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zip_code: { type: String, default: "", trim: true },
    phone: { type: String, required: true, trim: true },
    delivery_instructions: { type: String, default: "", trim: true },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// ── Multi-tenant (§3.6) — compound index already covers storeId (§3.3 index:false)
addressSchema.plugin(tenantScope, { index: false });
addressSchema.index({ storeId: 1, user_id: 1 });

module.exports = mongoose.model("Address", addressSchema);
