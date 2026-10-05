const mongoose = require("mongoose");

// ==========================================
// BUNDLE PRODUCT (product + quantity)
// ==========================================
const bundleProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false }
);

// ==========================================
// BUNDLE (Combo Deal)
// ==========================================
const bundleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Bundle name is required"],
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ Bundle me kam se kam 2 products hone chahiye
    products: {
      type: [bundleProductSchema],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2,
        message: "A bundle must contain at least 2 products",
      },
    },

    // ✅ MANUAL cover image — mandatory (Daraz combo deal style).
    // Stores the uploaded image PATH, e.g. "uploads/bundles/<bundleId>/cover_123.webp"
    // (same "uploads/..." path style used for product / banner / brand images)
    image: {
      type: String,
      required: [true, "Bundle image is required"],
      trim: true,
    },

    bundlePrice: {
      type: Number,
      required: [true, "Bundle price is required"],
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
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
  },
  { timestamps: true }
);

// ==========================================
// INDEXES
// ==========================================
bundleSchema.index({ isActive: 1, createdAt: -1 });
bundleSchema.index({ "products.product": 1 });

module.exports = mongoose.model("Bundle", bundleSchema);
