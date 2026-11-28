const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// LOYALTY NOTICE — admin ki taraf se points badle to customer ko batana
// ----------------------------------------------------------
// kind:
//   gift            → admin ne points diye (+points, note = reason)
//   deduct          → admin ne points hataye (points = kitne hate)
//   order_cancelled → order cancel: refunded (wapas) + reversed (kaate)
//   order_restored  → cancel order dobara active: restored + recharged
// seen_at null = customer ne abhi nahi dekha (storefront popup dikhata hai)
// ==========================================================

const KINDS = ["gift", "deduct", "order_cancelled", "order_restored"];

const loyaltyNoticeSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: KINDS, required: true },
    points: { type: Number, default: 0 },
    refunded: { type: Number, default: 0 },
    reversed: { type: Number, default: 0 },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    order_number: { type: String, default: "" },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    balance_after: { type: Number, default: 0 },
    seen_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

loyaltyNoticeSchema.plugin(tenantScope); // har store ka data alag (storeId)
loyaltyNoticeSchema.index({ storeId: 1, user_id: 1, seen_at: 1, created_at: -1 });

module.exports = mongoose.model("LoyaltyNotice", loyaltyNoticeSchema);
module.exports.KINDS = KINDS;
