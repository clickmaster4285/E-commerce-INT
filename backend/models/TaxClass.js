const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const taxClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rate_bp: { type: Number, required: true, min: 0 }, // basis points, 1500 = 15%
    inclusive: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

taxClassSchema.plugin(tenantScope);
taxClassSchema.index({ storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("TaxClass", taxClassSchema);