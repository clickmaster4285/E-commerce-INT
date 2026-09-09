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
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, lowercase: true },
    
    // Category field for filtering attributes by type
    category: { type: String, trim: true, lowercase: true, index: true },
    
    data_type: {
      type: String,
      required: true,
      default: "text",
    },
    unit: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    values: { type: [attributeValueSchema], default: [] },
    variant_allowed: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ✅ Updated unique index without tenant_id
attributeSchema.index({ code: 1, is_deleted: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);