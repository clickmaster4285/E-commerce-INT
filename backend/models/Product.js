const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    product_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
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

    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },

    purchase_price: {
      type: Number,
      required: true,
      min: 0,
    },

    selling_price: {
      type: Number,
      required: true,
      min: 0,
    },

    cost_price: {
      type: Number,
      default: 0,
      min: 0,
    },

    tax_rate: {
      type: Number,
      default: 0,
      min: 0,
    },

    weight: {
      type: Number,
      default: 0,
      min: 0,
    },

    length: {
      type: Number,
      default: 0,
      min: 0,
    },

    width: {
      type: Number,
      default: 0,
      min: 0,
    },

    height: {
      type: Number,
      default: 0,
      min: 0,
    },

    image_url: {
      type: String,
      trim: true,
      default: "",
    },

    minimum_stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    maximum_stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    reorder_level: {
      type: Number,
      default: 0,
      min: 0,
    },

    is_serialized: {
      type: Boolean,
      default: false,
    },

    is_batch_tracked: {
      type: Boolean,
      default: false,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

module.exports = mongoose.model("Product", productSchema);