const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const discountSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC INFORMATION
    // =====================================================

    code: {
      type: String,
      required: [true, "Discount code is required"],
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
    translations: {
      name: { type: Map, of: String, default: () => ({}) },
      description: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      name: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    translation_status: {
      name: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      description: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
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
    // PRICE RANGE (applyTo: price_range) — pehle controller/UI
    // ye fields bhejte the lekin schema me nahi thin (strict drop)
    // =====================================================
    priceMin: { type: Number, default: null, min: 0 },
    priceMax: { type: Number, default: null, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    priority: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0, min: 0 },

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



    // =====================================================
    // RULES
    // =====================================================

    isStackable: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // STATUS
    // =====================================================

    status: {
      type: String,
      enum: ["draft", "scheduled", "active", "disabled"],
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

    // =====================================================
    // UPDATED BY
    // =====================================================

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

// ── Multi-tenant ──
discountSchema.plugin(tenantScope); // har store ka data alag (storeId)
discountSchema.index({ storeId: 1, code: 1 }, { unique: true }); // unique per store
discountSchema.index({ storeId: 1, isActive: 1, endDate: 1 });
discountSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("Discount", discountSchema);
