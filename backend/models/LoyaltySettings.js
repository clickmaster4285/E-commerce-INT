const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// LOYALTY SETTINGS — har store ka ek document (program ke rules)
// ----------------------------------------------------------
// enabled false ho to koi points na milte hain na kharch hote hain,
// lekin purana balance mehfooz rehta hai (program dobara on ho sakta hai).
// ==========================================================

const loyaltySettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    programName: { type: String, trim: true, default: "Rewards", maxlength: 40 },

    // Har `spendUnit` rupay kharch par `pointsPerUnit` points
    earn: {
      enabled: { type: Boolean, default: true },
      pointsPerUnit: { type: Number, default: 1, min: 0 },
      spendUnit: { type: Number, default: 100, min: 1 },
      minOrderSubtotal: { type: Number, default: 0, min: 0 },
    },

    signupBonus: {
      enabled: { type: Boolean, default: true },
      points: { type: Number, default: 100, min: 0 },
    },

    // `redeemPoints` points = `redeemValue` rupay discount
    redeem: {
      enabled: { type: Boolean, default: true },
      redeemPoints: { type: Number, default: 100, min: 1 },
      redeemValue: { type: Number, default: 10, min: 0 },
      minPoints: { type: Number, default: 100, min: 0 },
      maxPercent: { type: Number, default: 50, min: 1, max: 100 },
    },

    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

loyaltySettingsSchema.plugin(tenantScope, { index: false }); // unique index neeche define hai
loyaltySettingsSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("LoyaltySettings", loyaltySettingsSchema);
