const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brand_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },

    has_variants: {
      type: Boolean,
      default: false,
    },

    tag_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    description: {
      type: String,
      trim: true,
      default: "",
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ✅ NEW: Dynamic specifications from category attributes
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // ✅ FEATURED — admin is product ko "Featured Products" page se mark/unmark
    //    kar sakta hai. Default false → purane products featured nahi banenge.
    is_featured: {
      type: Boolean,
      default: false,
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
    is_deleted: {
      type: Boolean,
      default: false,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

productSchema.index({ category_id: 1 });
productSchema.index({ brand_id: 1 });
productSchema.index({ status: 1, is_deleted: 1 });
// ✅ Featured Products page — filter + sort dono is index par
productSchema.index({ is_featured: 1, is_deleted: 1 });

module.exports = mongoose.model("Product", productSchema);