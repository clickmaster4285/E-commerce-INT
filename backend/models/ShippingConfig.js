const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

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

// ✅ Singleton helper — upsert so parallel first loads cannot duplicate
shippingConfigSchema.statics.getConfig = async function () {
  let cfg = await this.findOne();
  if (cfg) return cfg;
  try {
    cfg = await this.create({});
  } catch (err) {
    if (err?.code === 11000) {
      cfg = await this.findOne();
      if (cfg) return cfg;
    }
    throw err;
  }
  return cfg;
};


// storeId via plugin with index:false — unique {storeId} below is the only index (§3.3)
shippingConfigSchema.plugin(tenantScope, { index: false });
// One config doc per store — concurrent getConfig() must not create duplicates
shippingConfigSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("ShippingConfig", shippingConfigSchema);