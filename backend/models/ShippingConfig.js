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


// Declare storeId without a plain index so the unique compound below is the only one (§3.3)
shippingConfigSchema.add({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
});
shippingConfigSchema.plugin(tenantScope); // har store ka data alag (storeId)
// One config doc per store — concurrent getConfig() must not create duplicates
shippingConfigSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("ShippingConfig", shippingConfigSchema);