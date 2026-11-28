const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const immutablePlugin = require("../utils/immutablePlugin");

const paymentSchema = new mongoose.Schema(
  {
    direction: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
    method_code: {
      type: String,
      trim: true,
      required: true,
    },
    amount_minor: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      trim: true,
      default: "PKR",
    },
    status: {
      type: String,
      enum: ["pending", "captured", "failed", "refunded"],
      default: "pending",
    },
    ref_type: {
      type: String,
      enum: ["order", "pos_sale", "invoice", "purchase_order"],
      required: true,
    },
    ref_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    party_type: {
      type: String,
      enum: ["customer", "vendor", null],
      default: null,
    },
    party_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reference: {
      type: String,
      trim: true,
      default: "",
    },
    received_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    idempotency_key: {
      type: String,
      trim: true,
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "payments",
  },
);

paymentSchema.plugin(tenantScope);
paymentSchema.plugin(immutablePlugin);

paymentSchema.index(
  { storeId: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
);
paymentSchema.index({ storeId: 1, ref_type: 1, ref_id: 1 });
paymentSchema.index({ storeId: 1, party_type: 1, party_id: 1, at: -1 });
paymentSchema.index({ storeId: 1, at: -1 });

module.exports = mongoose.model("Payment", paymentSchema);