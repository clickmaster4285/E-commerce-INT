const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// §3.9 P3 — perishable lots (optional)
const stockLotSchema = new mongoose.Schema(
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
    lot_no: {
      type: String,
      trim: true,
      required: true,
    },
    expiry_date: {
      type: Date,
      default: null,
    },
    qty: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "stock_lots",
  },
);

stockLotSchema.plugin(tenantScope);

stockLotSchema.index({ storeId: 1, variant_id: 1, lot_no: 1 }, { unique: true });
stockLotSchema.index({ storeId: 1, expiry_date: 1 });

module.exports = mongoose.model("StockLot", stockLotSchema);