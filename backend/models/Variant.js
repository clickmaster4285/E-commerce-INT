  const mongoose = require("mongoose");

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
        unique: true,
        trim: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
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

      // Dynamic attributes:
      // color, size, weight, height etc.
      attributes: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      images: {
        type: [imageSchema],
        default: [],
      },

      createdby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      updatedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      deletedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
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

  module.exports = mongoose.model("Variant", variantSchema);