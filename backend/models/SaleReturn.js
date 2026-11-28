const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const immutablePlugin = require("../utils/immutablePlugin");

const returnLineSchema = new mongoose.Schema(
  {
    line_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
    qty: { type: Number, required: true, min: 0.001 },
    amount_minor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const saleReturnSchema = new mongoose.Schema(
  {
    ref_type: {
      type: String,
      enum: ["order", "pos_sale", "invoice"],
      required: true,
    },
    ref_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    lines: {
      type: [returnLineSchema],
      default: () => [],
    },
    refund_payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    method: {
      type: String,
      trim: true,
      default: "",
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "returns",
  },
);

saleReturnSchema.plugin(tenantScope);
saleReturnSchema.plugin(immutablePlugin);

saleReturnSchema.index({ storeId: 1, ref_type: 1, ref_id: 1, at: -1 });
saleReturnSchema.index({ storeId: 1, at: -1 });

module.exports = mongoose.model("SaleReturn", saleReturnSchema);