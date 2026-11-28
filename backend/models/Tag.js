// models/Tag.js
const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const tagSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, lowercase: true },
  slug: { 
    type: String, 
    sparse: true // ✅ Yeh line add karein
    },
    // Audit fields (optional but good practice)
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);


// ── Multi-tenant ──
tagSchema.plugin(tenantScope); // har store ka data alag (storeId)
tagSchema.index({ storeId: 1, name: 1 }, { unique: true }); // unique per store
tagSchema.index({ storeId: 1, slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } }); // unique per store

module.exports = mongoose.model("Tag", tagSchema);