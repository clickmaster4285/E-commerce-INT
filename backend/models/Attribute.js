const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const attributeValueSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },

    // 🌍 `label` ka auto-translation (locale -> text), e.g. { ur: "سرخ" }.
    // `value` RAW rehta hai — wahi variant matching / filtering ke liye use
    // hota hai, is liye use kabhi translate nahi karte.
    label_translations: { type: Map, of: String, default: () => ({}) },
    // `label` ka hash — badla ya nahi, yehi se pata chalta hai.
    label_source: { type: String, default: "" },
  },
  { _id: true }
);

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, lowercase: true },

    // Category field for filtering attributes by type
    category: { type: String, trim: true, lowercase: true, index: true },

    data_type: {
      type: String,
      required: true,
      default: "text",
    },
    unit: { type: String, trim: true, default: "" },

    values: { type: [attributeValueSchema], default: [] },
    variant_allowed: { type: Boolean, default: true },
    filterable: { type: Boolean, default: false },
    searchable: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ==========================================
    // 🌍 AUTOMATIC TRANSLATIONS (LibreTranslate)
    // ------------------------------------------
    // Attribute ka `name` descriptive hota hai (Color, RAM, Storage) is liye
    // woh translate hota hai; per-option `label` translations upar
    // `values[].label_translations` me rehti hain. English `name` kabhi
    // overwrite nahi hota — `translations` alag map hai.
    translations: {
      name: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      name: { type: String, default: "" },
    },
    translation_status: {
      name: {
        type: String,
        enum: ["pending", "done", "failed", "skipped"],
        default: "pending",
      },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ── Multi-tenant ── har store ke apne attributes (pehle global the aur koi bhi
// store admin dusre stores ke attributes badal / delete kar sakta tha).
// Purane global docs: node scripts/migrateAttributesPerStore.js
attributeSchema.plugin(tenantScope);
attributeSchema.index({ storeId: 1, code: 1, is_deleted: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);
