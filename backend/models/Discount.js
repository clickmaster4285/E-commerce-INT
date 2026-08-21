const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC INFORMATION
    // =====================================================

    code: {
      type: String,
      required: [true, "Discount code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    // =====================================================
    // DISCOUNT VALUE
    // =====================================================

    type: {
      type: String,
      enum: ["percentage", "fixed", "fixed_price"],
      required: [true, "Discount type is required"],
      default: "percentage",
    },

    value: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Value cannot be negative"],
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, "Max cap cannot be negative"],
    },

    // =====================================================
    // TARGET TYPE
    // =====================================================

    applyTo: {
      type: String,
      enum: [
        "all",
        "specific_products",
        "specific_categories",
        "specific_brands",
        "specific_tags",
        "specific_sizes",
        "price_range",
      ],
      default: "all",
    },

    // =====================================================
    // PRODUCT TARGETS
    // =====================================================

    selectedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // =====================================================
    // CATEGORY TARGETS
    // =====================================================

    selectedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // =====================================================
    // BRAND TARGETS
    // =====================================================

    selectedBrands: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],

    // =====================================================
    // TAG TARGETS
    // =====================================================

    selectedTags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    // =====================================================
    // SIZE TARGETS
    // =====================================================

    selectedSizes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Size",
      },
    ],

    // =====================================================
    // PRICE RANGE
    // =====================================================

    priceMin: {
      type: Number,
      default: null,
      min: [0, "Minimum price cannot be negative"],
    },

    priceMax: {
      type: Number,
      default: null,
      min: [0, "Maximum price cannot be negative"],
    },

    // =====================================================
    // CONDITIONS
    // =====================================================

    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },

    minQuantity: {
      type: Number,
      default: null,
      min: [1, "Minimum quantity must be at least 1"],
    },

    // =====================================================
    // VALIDITY
    // =====================================================

    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },

    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },

    // =====================================================
    // USAGE LIMITS
    // =====================================================

    usageLimit: {
      type: Number,
      default: null,
      min: [1, "Usage limit must be at least 1"],
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, "Per user limit must be at least 1"],
    },

    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // RULES
    // =====================================================

    priority: {
      type: Number,
      default: 1,
      min: 1,
    },

    isStackable: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // STATUS
    // =====================================================

    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "active",
        "disabled",
      ],
      default: "draft",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // =====================================================
    // CREATED BY
    // =====================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

discountSchema.index({
  isActive: 1,
  endDate: 1,
});

discountSchema.index({
  code: 1,
  is_deleted: 1,
});

discountSchema.index({
  applyTo: 1,
  isActive: 1,
});

module.exports = mongoose.model(
  "Discount",
  discountSchema
);