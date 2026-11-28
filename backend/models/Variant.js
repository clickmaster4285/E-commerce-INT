const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const softDeletePlugin = require("../utils/softDeletePlugin");

// Image information
const imageSchema = new mongoose.Schema(
  {
    img_url: {
      type: String,
      required: true,
      trim: true,
    },
    img_size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    translations: {
      title: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      title: { type: String, default: "" },
    },
    translation_status: {
      title: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    cost_price: {
      type: Number,
      required: true,
      min: 0,
    },
    selling_price: {
      type: Number,
      required: true,
      min: 0,
    },
    expiry_after_delivery: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiry_after_delivery_unit: {
      type: String,
      enum: ["days", "months", "years"],
      default: "days",
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    min_qnt: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_qnt: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ✅ Topup quantity/amount field - reusable across variants
    topup: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Dynamic attributes: color, size, weight, height etc.
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "inactive"],
    },
    // ✅ NEW: Tags field added here
    // Legacy string tags — naya code tag_ids use kare (tag_ids aaye to ye likhna band)
    tags: {
      type: [String],
      default: [],
    },
    // Tag refs (§3.7) — naam badalne par har variant me string update nahi karni padti
    tag_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
      default: [],
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    updatedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    deletedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // Soft-delete (optimizeplan.md §2.5) — pehle field missing thi, is liye
    // is_deleted:{$ne:true} filters kuch nahi karti thin.
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// ✅ Shop facets + variant list — store-scoped compound (§3.3)
variantSchema.index({ storeId: 1, product_id: 1, is_deleted: 1, created_at: 1, _id: 1 });


// ── Multi-tenant ──
variantSchema.plugin(tenantScope); // har store ka data alag (storeId)
variantSchema.plugin(softDeletePlugin);
// Case-insensitive SKU per store (collation strength 2)
variantSchema.index(
  { storeId: 1, sku: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

module.exports = mongoose.model("Variant", variantSchema);
