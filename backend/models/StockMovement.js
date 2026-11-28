const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const immutablePlugin = require("../utils/immutablePlugin");

const STOCK_KINDS = [
  "sale",
  "sale_cancel",
  "return",
  "purchase_receive",
  "adjust_add",
  "adjust_remove",
  "count_set",
  "transfer_in",
  "transfer_out",
  "opening_balance",
];

const stockMovementSchema = new mongoose.Schema(
  {
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    location_id: {
      type: String,
      trim: true,
      default: "main",
    },
    qty_delta: {
      type: Number,
      required: true,
    },
    on_hand_after: {
      type: Number,
      required: true,
      min: 0,
    },
    kind: {
      type: String,
      enum: STOCK_KINDS,
      required: true,
    },
    ref_type: { type: String, trim: true, default: "" },
    ref_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    line_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    unit_cost_minor: { type: Number, default: 0, min: 0 },
    reason: { type: String, trim: true, default: "" },
    explanation: { type: String, trim: true, default: "" },
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    actor_name: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, default: "" },
    variant_title: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
    idempotency_key: { type: String, trim: true, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "stock_movements",
  },
);

stockMovementSchema.plugin(tenantScope);
stockMovementSchema.plugin(immutablePlugin);

stockMovementSchema.index(
  { storeId: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
);
stockMovementSchema.index({ storeId: 1, variant_id: 1, at: -1 });
stockMovementSchema.index({ storeId: 1, at: -1 });
stockMovementSchema.index({ storeId: 1, ref_type: 1, ref_id: 1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);
module.exports.STOCK_KINDS = STOCK_KINDS;