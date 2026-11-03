
const mongoose = require("mongoose");

const posSaleItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    product_name: {
      type: String,
      required: true,
      trim: true,
    },
    product_image: {
      type: String,
      default: "",
      trim: true,
    },
    sku: {
      type: String,
      default: "",
      trim: true,
    },
    variant_title: {
      type: String,
      default: "",
      trim: true,
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
    discount_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    flat_discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    line_total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const posSaleSchema = new mongoose.Schema(
  {
    sale_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    customer_snapshot: {
      name: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
    },

    cashier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    cashier_name: {
      type: String,
      default: "",
      trim: true,
    },

    created_by_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    created_by_name: { type: String, default: "", trim: true },

    edit_history: {
      type: [{
        edited_at: { type: Date, default: Date.now },
        edited_by_id: { type: mongoose.Schema.Types.ObjectId, default: null },
        edited_by_name: { type: String, default: "", trim: true },
        changes: [{
          action: { type: String, enum: ["added", "removed", "quantity", "price", "discount", "tax", "sale_discount", "customer", "payment", "notes", "sale_total"], required: true },
          product_name: { type: String, default: "", trim: true },
          variant_title: { type: String, default: "", trim: true },
          sku: { type: String, default: "", trim: true },
          from_quantity: { type: Number, default: 0 },
          to_quantity: { type: Number, default: 0 },
          from_value: { type: String, default: "" },
          to_value: { type: String, default: "" },
        }],
      }],
      default: [],
    },

    items: {
      type: [posSaleItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "A sale must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tax_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    additional_tax_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    payment: {
      method: {
        type: String,
        enum: ["cash", "card", "mobile_wallet", "bank_transfer"],
        required: true,
        default: "cash",
      },
      amount_received: {
        type: Number,
        required: true,
        min: 0,
      },
      change_due: {
        type: Number,
        default: 0,
        min: 0,
      },
      reference: {
        type: String,
        default: "",
        trim: true,
      },
    },

    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },
    returns: {
      type: [{
        returned_at: { type: Date, default: Date.now },
        returned_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        returned_by_name: { type: String, default: "", trim: true },
        reason: { type: String, required: true, default: "Previously recorded return", trim: true, maxlength: 300 },
        refund_method: { type: String, enum: ["cash", "card", "mobile_wallet", "bank_transfer", "store_credit"], default: "cash" },
        refund_total: { type: Number, min: 0, required: true },
        items: [{
          variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true },
          product_name: { type: String, default: "", trim: true },
          sku: { type: String, default: "", trim: true },
          variant_title: { type: String, default: "", trim: true },
          quantity: { type: Number, min: 1, required: true },
          refund_amount: { type: Number, min: 0, required: true },
        }],
      }],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

posSaleSchema.index({ customer_id: 1, created_at: -1 });
posSaleSchema.index({ created_at: -1 });

module.exports = mongoose.model("PosSale", posSaleSchema);
