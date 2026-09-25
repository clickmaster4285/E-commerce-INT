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
