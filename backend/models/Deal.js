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
    // BUNDLE OFFER CONDITION (single rule)
    // ==========================================
    // A bundle deal can have exactly ONE offer condition:
    //   mode "all"   → customer must buy ALL selected products
    //                  (required quantity = number of selected products)
    //   mode "limit" → customer must buy `buyQuantity` items
    //
    // Until the condition is met the bundle deal does not apply.
    bundleRule: {
      mode: {
        type: String,
        enum: ["all", "limit"],
        default: "all",
      },

      // Only used when mode === "limit"
      buyQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      rewardType: {
        type: String,
        enum: ["percentage", "fixed_amount", "free_product"],
        default: "percentage",
      },

      // percentage = %, fixed_amount = Rs. (free_product keeps 0)
      value: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
          validator: function (v) {
            if (this.rewardType === "percentage") return Number(v) <= 100;
            return true;
          },
          message: "Percentage reward cannot exceed 100%",
        },
      },

      // Free gift product (only for rewardType "free_product")
      freeProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },

      freeQuantity: {
        type: Number,
        default: 1,
        min: 1,
      },
    },

    // ✅ Bundle deal ki main image (admin panel se upload hoti hai)
    // Storefront par deal card / deal detail me ye image dikhayi jati hai
    image: {
      type: String,
      default: "",
      trim: true,
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
      default:0,
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

   
    // ==========================================
    // COMBINATION RULES
    // ==========================================
  

  

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