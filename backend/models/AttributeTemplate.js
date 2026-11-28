const mongoose = require("mongoose");
const translatablePlugin = require("./shared/translatablePlugin");

const templateValueSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    label_translations: { type: Map, of: String, default: () => ({}) },
    label_source: { type: String, default: "" },
  },
  { _id: true },
);

// Platform-wide templates — NO tenantScope (§3.10)
const attributeTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, trim: true, lowercase: true, default: "" },
    data_type: { type: String, required: true, default: "text" },
    unit: { type: String, trim: true, default: "" },
    values: { type: [templateValueSchema], default: [] },
    variant_allowed: { type: Boolean, default: true },
    filterable: { type: Boolean, default: false },
    searchable: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

attributeTemplateSchema.plugin(translatablePlugin, ["name"]);
attributeTemplateSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model("AttributeTemplate", attributeTemplateSchema);