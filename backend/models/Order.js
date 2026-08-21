const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    order_number: { type: String, unique: true, required: true },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: [
      {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
        name: { type: String, required: true },
        brand: { type: String, default: "" },
        variantTitle: { type: String, default: "" },
        image: { type: String, default: "" },
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1 },
      },
    ],

    // Address ka snapshot (order ke waqt ka — baad mein address change ho to order na toote)
    address_snapshot: {
      full_name: { type: String, required: true },
      phone: { type: String, required: true },
      country: { type: String, default: "Pakistan" },
      street_address1: { type: String, required: true },
      street_address2: { type: String, default: "" },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip_code: { type: String, default: "" },
    },
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null },
    shipping_method: {
      type: String,
      enum: ["standard", "express"],
      default: "standard",
    },
    payment: {
      method: { type: String, enum: ["cod", "bank", "card"], required: true },
      status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    },

    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("Order", orderSchema);