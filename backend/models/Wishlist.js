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


// ── Multi-tenant — compound unique already covers storeId (§3.3 index:false)
wishlistSchema.plugin(tenantScope, { index: false });
wishlistSchema.index({ storeId: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model("Wishlist", wishlistSchema);
