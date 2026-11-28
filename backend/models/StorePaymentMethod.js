const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const { PAYMENT_METHOD_CODES } = require("../config/paymentMethods");

const storePaymentMethodSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: PAYMENT_METHOD_CODES,
    },
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    ledger_account: { type: String, trim: true, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

storePaymentMethodSchema.plugin(tenantScope);
storePaymentMethodSchema.index({ storeId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("StorePaymentMethod", storePaymentMethodSchema);