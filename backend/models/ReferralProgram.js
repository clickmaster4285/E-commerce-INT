const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const referralProgramSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  referrerPoints: { type: Number, default: 100, min: 0, max: 1000000 },
  friendPoints: { type: Number, default: 100, min: 0, max: 1000000 },
  saleReferrerPoints: { type: Number, default: 0, min: 0, max: 1000000 },
  headline: { type: String, trim: true, default: "Invite a friend, earn rewards", maxlength: 100 },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

referralProgramSchema.plugin(tenantScope, { index: false }); // unique index neeche define hai
referralProgramSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("ReferralProgram", referralProgramSchema);
