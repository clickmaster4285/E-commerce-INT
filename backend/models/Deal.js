const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
  {
    // ==========================================
    // BASIC INFORMATION
    // ==========================================

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

    image: {
      type: String,
      default: "",
    },

    // ==========================================
    // DEAL TYPE
    // ==========================================

    type: {
      type: String,
      enum: [
        "percentage",
        "fixed",
        "buy_x_get_y",
        "bundle",
        "free_shipping",
        "flash_sale",
      ],
      required: true,
    },
   type: {
      type: String,
      enum: [
        "percentage",
        "fixed_amount", // Fixed: "fixed" ki jagah "fixed_amount" kar diya
        "buy_x_get_y",
        "bundle",
        "free_shipping",
      ],
      required: true,
    },
    // ==========================================
    // APPLY DEAL TO
    // ==========================================

    applyTo: {
      type: String,
      enum: [
        "all",
        "product",
        "category",
        "brand",
        "collection",
      ],
      default: "product",
    },

    // ==========================================
    // PRODUCTS
    // ==========================================

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // ==========================================
    // CATEGORIES
    // ==========================================

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // ==========================================
    // BRANDS
    // ==========================================

    brandIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],

    // ==========================================
    // DISCOUNT
    // ==========================================

    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
    },

    // ==========================================
    // BUY X GET Y
    // ==========================================

    buyQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    getQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    getDiscountValue: {
      type: Number,
      default: 100,
      min: 0,
    },

    // ==========================================
    // BUNDLE DEAL
    // ==========================================

    bundleProducts: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
      },
    ],

    bundlePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // DEAL SCHEDULE
    // ==========================================

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // ==========================================
    // USAGE LIMIT
    // ==========================================

    usageLimit: {
      type: Number,
      default: null,
      min: 0,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: null,
      min: 0,
    },

    // ==========================================
    // CUSTOMER RESTRICTIONS
    // ==========================================

    customerType: {
      type: String,
      enum: [
        "all",
        "new_customer",
        "existing_customer",
        "specific_customer",
      ],
      default: "all",
    },

    customerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ==========================================
    // ORDER QUANTITY
    // ==========================================

    minQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxQuantity: {
      type: Number,
      default: null,
      min: 0,
    },

    // ==========================================
    // COMBINATION RULES
    // ==========================================

    allowWithCoupon: {
      type: Boolean,
      default: false,
    },

    allowWithOtherDeals: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // ADMIN CONTROL
    // ==========================================

    isActive: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // CREATED / UPDATED BY
    // ==========================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

dealSchema.index({
  isActive: 1,
  startDate: 1,
  endDate: 1,
});

dealSchema.index({
  type: 1,
});

dealSchema.index({
  applyTo: 1,
});

// ==========================================
// MODEL
// ==========================================

const Deal = mongoose.model("Deal", dealSchema);

module.exports = Deal;