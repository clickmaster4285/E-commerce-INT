const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const cartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ✅ Mixed = poora item object as-is save hoga (deal fields bhi)
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);


// ── Multi-tenant ──
cartSchema.plugin(tenantScope); // har store ka data alag (storeId)
cartSchema.index({ storeId: 1, user_id: 1 }, { unique: true }); // unique per store

module.exports = mongoose.model("Cart", cartSchema);
