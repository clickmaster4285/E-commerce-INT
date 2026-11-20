const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const wishlistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);


// ── Multi-tenant ──
wishlistSchema.plugin(tenantScope); // har store ka data alag (storeId)

module.exports = mongoose.model("Wishlist", wishlistSchema);
