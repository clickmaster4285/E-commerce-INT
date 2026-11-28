const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// §3.4 — dashboard/finance range reads (updated on order/POS/invoice writes)
const storeDailyStatsSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true }, // YYYY-MM-DD (store TZ)
    revenue: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    items: { type: Number, default: 0 },
    newCustomers: { type: Number, default: 0 },
    byProduct: { type: [{ product_id: mongoose.Schema.Types.ObjectId, qty: Number, revenue: Number }], default: [] },
    byCategory: { type: [{ category_id: mongoose.Schema.Types.ObjectId, qty: Number, revenue: Number }], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

storeDailyStatsSchema.plugin(tenantScope, { index: false });
storeDailyStatsSchema.index({ storeId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("StoreDailyStats", storeDailyStatsSchema);
