const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    permissions: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    is_system: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

roleSchema.plugin(tenantScope);
roleSchema.index({ storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);