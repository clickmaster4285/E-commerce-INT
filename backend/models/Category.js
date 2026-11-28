const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const categoryAttributeSchema = new mongoose.Schema(
  {
    attribute_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attribute",
      required: true,
    },
    is_required: { type: Boolean, default: false },
    is_visible: { type: Boolean, default: true },
    is_filterable: { type: Boolean, default: false },
    is_searchable: { type: Boolean, default: false },
    is_variant_option: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
    // ✅ FIX: Persist user-supplied default value (e.g. "red", "8GB")
    value: { type: mongoose.Schema.Types.Mixed, default: "" },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    // ✅ CHANGED: tenant_id is now optional to support global/single-store mode
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: false, 
      index: true,
    },

    category_code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },

    // ==========================================
    // 🌍 AUTOMATIC TRANSLATIONS (LibreTranslate)
    // ------------------------------------------
    // English `name`/`description` source of truth hain — inme kabhi koi
    // write nahi hota; translation alag `translations` map me chala jaata
    // hai. `translation_source` har field ke English text ka hash rakhta
    // hai, jisse pata chalta hai ke translation stale hai ya nahi (English
    // edit hua → hash badla → dobara generate).
    // Category ka `name` descriptive hai (Mobile Phones, Laptops) is liye
    // woh translate hota hai.
    translations: {
      name: { type: Map, of: String, default: () => ({}) },
      description: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      name: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    translation_status: {
      name: {
        type: String,
        enum: ["pending", "done", "failed", "skipped"],
        default: "pending",
      },
      description: {
        type: String,
        enum: ["pending", "done", "failed", "skipped"],
        default: "pending",
      },
    },

    parent_category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // Persist fields the admin UI already sends (strict mode used to drop them)
    category_type: { type: String, trim: true, default: "" },
    image_url: { type: String, trim: true, default: "" },
    sort_order: { type: Number, default: 0 },

    attributes: { type: [categoryAttributeSchema], default: [] },

    is_active: { type: Boolean, default: true },

    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },

    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    deletedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ✅ UPDATED: Index no longer requires tenant_id for uniqueness (Global Code Uniqueness)
categorySchema.index(
  { storeId: 1, category_code: 1, is_deleted: 1 },
  { unique: true }
);

// ✅ UPDATED: General search index without mandatory tenant filter
categorySchema.index({
  name: 1,
  parent_category_id: 1,
  is_deleted: 1,
});


// ── Multi-tenant ──
categorySchema.plugin(tenantScope); // har store ka data alag (storeId)

module.exports = mongoose.model("Category", categorySchema);