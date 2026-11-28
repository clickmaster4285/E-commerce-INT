const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const stockLevelSchema = new mongoose.Schema(
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
    on_hand: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorder_min: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorder_max: {
      type: Number,
      default: 0,
      min: 0,
    },
    avg_cost_minor: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "stock_levels",
  },
);

stockLevelSchema.plugin(tenantScope);

stockLevelSchema.index({ storeId: 1, variant_id: 1, location_id: 1 }, { unique: true });
stockLevelSchema.index({ storeId: 1, on_hand: 1 });

module.exports = mongoose.model("StockLevel", stockLevelSchema);