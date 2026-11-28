const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const storeAttributeValueSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { _id: true },
);

const storeAttributeSchema = new mongoose.Schema(
  {
    template_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttributeTemplate",
      default: null,
    },
    // Store-specific override jab template se alag naam chahiye
    name: { type: String, trim: true, default: "" },
    values_override: { type: [storeAttributeValueSchema], default: [] },
    custom_values: { type: [storeAttributeValueSchema], default: [] },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

storeAttributeSchema.plugin(tenantScope);
storeAttributeSchema.index({ storeId: 1, template_id: 1 });

module.exports = mongoose.model("StoreAttribute", storeAttributeSchema);