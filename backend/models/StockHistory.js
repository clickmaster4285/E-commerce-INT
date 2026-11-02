const mongoose = require("mongoose");

const stockHistorySchema = new mongoose.Schema(
  {
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },

    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    product_name: {
      type: String,
      trim: true,
      default: "",
    },

    sku: {
      type: String,
      trim: true,
      default: "",
    },

    variant_title: {
      type: String,
      trim: true,
      default: "",
    },

    previous_quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    new_quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    change_quantity: {
      type: Number,
      required: true,
    },

    adjustment_type: {
      type: String,
      enum: ["add", "remove", "set"],
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ Adjust form ka "Explanation" (notes) — reason ke sath alag save hota hai
    // taake Stock History section mein bhi dikhaya ja sake.
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    translations: {
      product_name: { type: Map, of: String, default: () => ({}) },
      variant_title: { type: Map, of: String, default: () => ({}) },
      reason: { type: Map, of: String, default: () => ({}) },
      explanation: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      product_name: { type: String, default: "" },
      variant_title: { type: String, default: "" },
      reason: { type: String, default: "" },
      explanation: { type: String, default: "" },
    },
    translation_status: {
      product_name: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      variant_title: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      reason: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      explanation: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    },

    performed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performed_by_name: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

module.exports = mongoose.model(
  "StockHistory",
  stockHistorySchema
);
