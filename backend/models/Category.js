const mongoose = require("mongoose");

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

    parent_category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // ✅ FIX: Persist category_type (Mobile / PC / Clothing) sent from frontend
    category_type: { type: String, trim: true, default: "" },

    attributes: { type: [categoryAttributeSchema], default: [] },
    image_url: { type: String, trim: true, default: "" },
    sort_order: { type: Number, default: 0 },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
    
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ✅ UPDATED: Index no longer requires tenant_id for uniqueness (Global Code Uniqueness)
categorySchema.index(
  { category_code: 1, is_deleted: 1 },
  { unique: true }
);

// ✅ UPDATED: General search index without mandatory tenant filter
categorySchema.index({
  name: 1,
  parent_category_id: 1,
  is_deleted: 1,
});

module.exports = mongoose.model("Category", categorySchema);