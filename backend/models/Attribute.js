const mongoose = require("mongoose");

const attributeValueSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { _id: true }
);

const attributeSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: false,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, lowercase: true },
    // data_type is constrained by the attributeController to one of:
    //   text | number | decimal | multi_select
    // Existing records created before this restriction (e.g. "select",
    // "boolean", "color") continue to load fine — only new writes are
    // validated in the controller.
    data_type: {
      type: String,
      required: true,
      default: "text",
    },
    unit: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    values: { type: [attributeValueSchema], default: [] },
    variant_allowed: { type: Boolean, default: false },
 
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Unique code per tenant
attributeSchema.index({ tenant_id: 1, code: 1, is_deleted: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);