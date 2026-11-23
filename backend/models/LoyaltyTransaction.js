const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// LOYALTY TRANSACTION — points ki har tabdeeli ka record (ledger)
// ----------------------------------------------------------
// source_key har event ke liye unique hai (store ke andar), is liye
// ek hi signup / order / refund ke points do baar nahi lag sakte:
//   signup:<userId>   earn:<orderId>   redeem:<orderId>
//   refund:<orderId>  adjust:<id>
// ==========================================================

const TYPES = ["signup", "earn", "redeem", "refund", "adjust"];
const STATUSES = ["pending", "available", "reversed"];

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: TYPES, required: true },
    points: { type: Number, required: true }, // + credit, − debit
    status: { type: String, enum: STATUSES, default: "available" },
    source_key: { type: String, required: true },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    order_number: { type: String, default: "" },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    claimed_at: { type: Date, default: null }, // welcome bonus customer ne claim kiya (balance already credited)
    actor_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    actor_name: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

loyaltyTransactionSchema.plugin(tenantScope); // har store ka data alag (storeId)
loyaltyTransactionSchema.index({ storeId: 1, source_key: 1 }, { unique: true });
loyaltyTransactionSchema.index({ storeId: 1, user_id: 1, created_at: -1 });
loyaltyTransactionSchema.index({ storeId: 1, type: 1, created_at: -1 });

module.exports = mongoose.model("LoyaltyTransaction", loyaltyTransactionSchema);
module.exports.TYPES = TYPES;
module.exports.STATUSES = STATUSES;
