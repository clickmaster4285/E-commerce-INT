const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const documentTemplateSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ["invoice", "quote", "receipt", "po"],
    },
    name: { type: String, required: true, trim: true },
    pdf_design: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    terms: { type: String, trim: true, default: "" },
    bank_details: { type: String, trim: true, default: "" },
    version: { type: Number, default: 1, min: 1 },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

documentTemplateSchema.plugin(tenantScope);
documentTemplateSchema.index({ storeId: 1, kind: 1, is_default: 1 });

module.exports = mongoose.model("DocumentTemplate", documentTemplateSchema);