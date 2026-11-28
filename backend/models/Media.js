const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, trim: true, default: "image" },
    url: { type: String, required: true, trim: true },
    size: { type: Number, default: 0, min: 0 },
    mime: { type: String, trim: true, default: "" },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    sha256: { type: String, required: true, trim: true },
    ref_count: { type: Number, default: 1, min: 0 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

mediaSchema.plugin(tenantScope);
mediaSchema.index({ storeId: 1, sha256: 1 }, { unique: true });

module.exports = mongoose.model("Media", mediaSchema);