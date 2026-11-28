const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const referralSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  referralCode: { type: String, required: true, uppercase: true, trim: true },
  referrerPoints: { type: Number, default: 0, min: 0 },
  friendPoints: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["pending", "rewarded", "ineligible"], default: "pending" },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

referralSchema.plugin(tenantScope);
referralSchema.index({ storeId: 1, referredUserId: 1 }, { unique: true });
referralSchema.index({ storeId: 1, referrerId: 1, created_at: -1 });

module.exports = mongoose.model("Referral", referralSchema);
