const mongoose = require("mongoose");

const shippingConfigSchema = new mongoose.Schema(
  {
    standard: {
      fee: { type: Number, default: 200, min: 0 },
      min_days: { type: Number, default: 2, min: 0 },
      max_days: { type: Number, default: 4, min: 0 },
    },
    express: {
      fee: { type: Number, default: 500, min: 0 },
      min_days: { type: Number, default: 1, min: 0 },
      max_days: { type: Number, default: 2, min: 0 },
    },
    free_shipping_over: { type: Number, default: 0 }, // 0 = disabled
  },
  { timestamps: true }
);

// ✅ Singleton helper
shippingConfigSchema.statics.getConfig = async function () {
  let cfg = await this.findOne();
  if (!cfg) cfg = await this.create({});
  return cfg;
};

module.exports = mongoose.model("ShippingConfig", shippingConfigSchema);