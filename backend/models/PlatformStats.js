const mongoose = require("mongoose");

// §3.4 — super-admin dashboard counters (event or cron updated)
const platformStatsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true }, // e.g. "global"
    stores: { type: Number, default: 0 },
    sellers: { type: Number, default: 0 },
    customers: { type: Number, default: 0 },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

module.exports = mongoose.model("PlatformStats", platformStatsSchema);
