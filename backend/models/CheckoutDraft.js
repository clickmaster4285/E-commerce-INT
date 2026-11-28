const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const { cartItemSchema, maxItemsValidator } = require("./shared/cartItemSchema");

const checkoutDraftSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    drafts: [
      {
        step: { type: Number, default: 1 },
        selectedKeys: [{ type: String }],
        selectedAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
        shippingMethod: { type: String, default: "standard" },
        paymentMethod: { type: String, default: "cod" },
        saved: { type: Boolean, default: false },
        status: { type: String, enum: ["active", "completed"], default: "active", index: true },
        items: { type: [cartItemSchema], default: [], validate: maxItemsValidator },
        subtotal: { type: Number },
        shipping: { type: Number },
        tax: { type: Number },
        discount: { type: Number },
        estimatedTotal: { type: Number },
        order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);


// ── Multi-tenant ──
checkoutDraftSchema.plugin(tenantScope); // har store ka data alag (storeId)
checkoutDraftSchema.index({ storeId: 1, user_id: 1 }, { unique: true }); // unique per store

module.exports = mongoose.model("CheckoutDraft", checkoutDraftSchema);
