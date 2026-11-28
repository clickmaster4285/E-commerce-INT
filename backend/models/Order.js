const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const orderSchema = new mongoose.Schema(
  {
    order_number: { type: String, required: true },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    checkout_draft_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Checkout attempt ki key (Idempotency-Key header) — double submit par ek hi order
    idempotency_key: { type: String, default: undefined },

    items: [
      {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
        name: { type: String, required: true },
        brand: { type: String, default: "" },
        variantTitle: { type: String, default: "" },
        image: { type: String, default: "" },
        price: { type: Number, required: true },
        // Checkout par product.tax ka snapshot (percent). Default nahi: purane
        // orders me field missing rehti hai, taake edit "0%" aur "pata nahi" alag rakhe.
        tax_rate: { type: Number, min: 0, max: 100 },
        original_price: { type: Number, default: 0 },
        discount_name: { type: String, default: "" },
        discount_id: { type: mongoose.Schema.Types.ObjectId, ref: "Discount", default: null },
        savings: { type: Number, default: 0 },
        qty: { type: Number, required: true, min: 1 },
        
        // ✅ NEW: Deal-specific fields for Buy X Get Y & others
        deal_id: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: null },
        deal_type: { type: String, default: "" },
        deal_name: { type: String, default: "" },
        deal_buy_quantity: { type: Number, default: 0 },
        deal_get_quantity: { type: Number, default: 0 },
        free_items: { type: Number, default: 0 },
        payable_items: { type: Number, default: 0 },
        deal_savings: { type: Number, default: 0 },

        // ✅ NEW: Bundle deal fields (combo deal)
        bundle_id: { type: mongoose.Schema.Types.ObjectId, ref: "Bundle", default: null },
        bundle_name: { type: String, default: "" },
        bundle_price: { type: Number, default: 0 },
        bundle_savings: { type: Number, default: 0 },
      },
    ],

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
      default: "standard",
    },
    payment: {
      method: { type: String, enum: ["cod", "bank", "card"], required: true },
      status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    },

    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    // Loyalty — total = subtotal + shipping + tax − loyalty_discount
    loyalty_points_redeemed: { type: Number, default: 0 },
    loyalty_discount: { type: Number, default: 0 },
    loyalty_points_earned: { type: Number, default: 0 },
    total: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    notes: { type: String, default: "" },
    cancel_reason: { type: String, default: "" },   // ✅ ADD
    translations: {
      notes: { type: Map, of: String, default: () => ({}) },
      cancel_reason: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      notes: { type: String, default: "" },
      cancel_reason: { type: String, default: "" },
    },
    translation_status: {
      notes: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      cancel_reason: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    },
    // ✅ NEW: Root level deal tracking
    deal_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
    }],
    total_deal_savings: {
      type: Number,
      default: 0,
    },

    // ✅ NEW: Root level bundle tracking
    bundle_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bundle",
      },
    ],
    total_bundle_savings: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ── Multi-tenant ──
orderSchema.plugin(tenantScope); // har store ka data alag (storeId)
orderSchema.index({ storeId: 1, order_number: 1 }, { unique: true }); // unique per store
orderSchema.index(
  { storeId: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
);
orderSchema.index(
  { storeId: 1, checkout_draft_id: 1 },
  { unique: true, partialFilterExpression: { checkout_draft_id: { $type: "objectId" } } },
);
orderSchema.index({ storeId: 1, created_at: -1 });
orderSchema.index({ storeId: 1, status: 1, created_at: -1 });
orderSchema.index({ storeId: 1, user_id: 1, created_at: -1 });
orderSchema.index({ storeId: 1, "items.product_id": 1, created_at: -1 });

module.exports = mongoose.model("Order", orderSchema);
