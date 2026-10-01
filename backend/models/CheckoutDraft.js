const mongoose = require("mongoose");

const checkoutDraftSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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
        items: { type: mongoose.Schema.Types.Mixed, default: [] },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

module.exports = mongoose.model("CheckoutDraft", checkoutDraftSchema);
