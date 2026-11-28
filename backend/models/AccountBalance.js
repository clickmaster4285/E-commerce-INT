const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const accountBalanceSchema = new mongoose.Schema(
  {
    account: { type: String, trim: true, required: true },
    party_type: {
      type: String,
      enum: ["customer", "vendor", null],
      default: null,
    },
    // party_id null → "" taake unique compound sparse na chahiye
    party_id: { type: String, trim: true, default: "" },
    balance_minor: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "account_balances",
  },
);

accountBalanceSchema.plugin(tenantScope);

accountBalanceSchema.index({ storeId: 1, account: 1, party_id: 1 }, { unique: true });

module.exports = mongoose.model("AccountBalance", accountBalanceSchema);