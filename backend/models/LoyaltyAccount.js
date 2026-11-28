const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// LOYALTY ACCOUNT — har customer (User) ka points balance
// ----------------------------------------------------------
// balance  → abhi kharch ho sakne wale points
// pending  → orders ke points jo delivery par available honge
// Ye numbers sirf loyaltyService se $inc hote hain — har tabdeeli ka
// record LoyaltyTransaction me hota hai.
// ==========================================================

const loyaltyAccountSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    balance: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    lifetimeEarned: { type: Number, default: 0 },
    lifetimeRedeemed: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

loyaltyAccountSchema.plugin(tenantScope); // har store ka data alag (storeId)
loyaltyAccountSchema.index({ storeId: 1, user_id: 1 }, { unique: true });
loyaltyAccountSchema.index({ storeId: 1, balance: -1 });

module.exports = mongoose.model("LoyaltyAccount", loyaltyAccountSchema);
