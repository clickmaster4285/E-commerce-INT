const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
  {
    // ==========================================
    // BASIC INFORMATION
    // ==========================================
    name: {
      type: String,
      required: [true, "Deal name is required"],
      trim: true,
      maxlength: 100,
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
    // DEAL TYPE & TARGET
    // ==========================================
    type: {
      type: String,
      enum: ["percentage", "fixed_amount", "buy_x_get_y", "bundle", "free_shipping"],
      required: [true, "Deal type is required"],
    },

    applyTo: {
      type: String,
      enum: ["all", "product", "category", "brand", "collection"],
      required: [true, "Target scope is required"],
      default: "all",
    },

    // ==========================================
    // REFERENCES (Conditional Requirement)
    // ==========================================
    productIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    }],

    categoryIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    }],

    brandIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    }],

    // ==========================================
    // DISCOUNT VALUES
    // ==========================================
    discountValue: {
      type: Number,
      required: function() { return ["percentage", "fixed_amount"].includes(this.type); },
      min: 0,
      validate: {
        validator: function(v) {
          if (this.type === "percentage") return v <= 100;
          return true;
        },
        message: "Percentage cannot exceed 100%",
      },
    },

    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    // ==========================================
    // BUY X GET Y LOGIC
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
      max: 100,
    },

    // ==========================================
    // BUNDLE DEAL
    // ==========================================
    bundleProducts: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
    }],

    bundlePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // SCHEDULE (REQUIRED)
    // ==========================================
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },

    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function(v) {
          return this.startDate ? v > this.startDate : true;
        },
        message: "End date must be after start date",
      },
    },

    // ==========================================
    // QUANTITY RESTRICTIONS
    // ==========================================
    minQuantity: {
      type: Number,
      default: 1, // Changed default to 1 for better UX
      min: 1,
    },

    maxQuantity: {
      type: Number,
      default: null,
      min: 0,
    },

    // ==========================================
    // USAGE LIMITS
    // ==========================================
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    // ==========================================
    // CUSTOMER RESTRICTIONS
    // ==========================================
    customerType: {
      type: String,
      enum: ["all", "new_customer", "existing_customer", "specific_customer"],
      default: "all",
    },

    customerIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],

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
// INDEXES FOR PERFORMANCE
// ==========================================
dealSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
dealSchema.index({ type: 1 });
dealSchema.index({ applyTo: 1 });
dealSchema.index({ productIds: 1 });
dealSchema.index({ categoryIds: 1 });
dealSchema.index({ brandIds: 1 });

module.exports = mongoose.model("Deal", dealSchema);