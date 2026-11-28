const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const { cartItemSchema, maxItemsValidator } = require("./shared/cartItemSchema");

const cartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ✅ Typed subschema (strict:false) — deal fields bhi as-is save hote hain, max 50 items
    items: { type: [cartItemSchema], default: [], validate: maxItemsValidator },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);


// ── Multi-tenant ──
cartSchema.plugin(tenantScope); // har store ka data alag (storeId)
cartSchema.index({ storeId: 1, user_id: 1 }, { unique: true }); // unique per store

module.exports = mongoose.model("Cart", cartSchema);
