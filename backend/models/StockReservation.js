const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const stockReservationSchema = new mongoose.Schema(
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
    qty: {
      type: Number,
      required: true,
      min: 0.001,
    },
    checkout_draft_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckoutDraft",
      default: null,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "committed", "released", "expired"],
      default: "active",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "stock_reservations",
  },
);

stockReservationSchema.plugin(tenantScope);

stockReservationSchema.index({ storeId: 1, expires_at: 1 });
stockReservationSchema.index({ storeId: 1, checkout_draft_id: 1 });

module.exports = mongoose.model("StockReservation", stockReservationSchema);