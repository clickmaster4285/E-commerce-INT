const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// STORE PAGE — seller ke custom pages (About, FAQ, Contact ...)
// Storefront URL: /pages/<slug>. content = sanitized HTML (utils/themeValidator).
// Slug har store me unique ({ storeId, slug }).
// ==========================================================

const storePageSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    content: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },

    seo: {
      title: { type: String, default: "", trim: true, maxlength: 120 },
      description: { type: String, default: "", trim: true, maxlength: 300 },
    },

    // ── Translations (Banner pattern — English source of truth) ──
    translations: {
      title: { type: Map, of: String, default: () => ({}) },
      content: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      title: { type: String, default: "" },
      content: { type: String, default: "" },
    },
    translation_status: {
      title: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      content: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: true, collection: "store_pages" },
);

// ── Multi-tenant ──
storePageSchema.plugin(tenantScope);
storePageSchema.index({ storeId: 1, slug: 1 }, { unique: true });
storePageSchema.index({ storeId: 1, status: 1, updatedAt: -1 });

storePageSchema.statics.SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

module.exports = mongoose.model("StorePage", storePageSchema);
