const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// STORE THEME VERSION — har publish ka snapshot (history / rollback)
// Restore hamesha DRAFT me jata hai, seedha published me nahi.
// Har store ke sirf aakhri MAX_VERSIONS rakhe jate hain (publish par prune).
// ==========================================================

const MAX_VERSIONS = 20;

const storeThemeVersionSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    version: { type: Number, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    note: { type: String, default: "", trim: true, maxlength: 200 },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: true, minimize: false, collection: "store_theme_versions" },
);

// ── Multi-tenant ──
storeThemeVersionSchema.plugin(tenantScope);
storeThemeVersionSchema.index({ storeId: 1, version: -1 }, { unique: true });

storeThemeVersionSchema.statics.MAX_VERSIONS = MAX_VERSIONS;

module.exports = mongoose.model("StoreThemeVersion", storeThemeVersionSchema);
