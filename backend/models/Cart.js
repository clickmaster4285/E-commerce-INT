const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    product_id: { type: String, default: "" },
    variant_id: { type: String, default: "" },
    name: { type: String, default: "" },
    brand: { type: String, default: "" },
    price: { type: Number, default: 0 },
    image: { type: String, default: "" },
    variantTitle: { type: String, default: "" },
    qty: { type: Number, default: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("Cart", cartSchema);