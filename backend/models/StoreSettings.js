const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// Admin / checkout settings — Store document se split (§3.10)
const storeSettingsSchema = new mongoose.Schema(
  {
    tax: {
      rate: { type: Number, default: 0 },
      inclusive: { type: Boolean, default: false },
      default_tax_class_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaxClass",
        default: null,
      },
    },
    units: {
      weight_unit: { type: String, default: "kg", trim: true },
    },
    locale: {
      default_locale: { type: String, default: "en", trim: true },
      supported_locales: { type: [String], default: () => ["en"] },
    },
    social: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      youtube: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
    seo: {
      meta_title: { type: String, default: "" },
      meta_description: { type: String, default: "" },
      meta_keywords: { type: String, default: "" },
    },
    contact: {
      support_email: { type: String, default: "" },
      support_phone: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

storeSettingsSchema.plugin(tenantScope);
storeSettingsSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("StoreSettings", storeSettingsSchema);