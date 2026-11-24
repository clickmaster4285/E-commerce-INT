const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// STORE THEME — store editor ka data (har store ka EK document)
// ----------------------------------------------------------
//   draft     → admin editor me kaam chal raha (public ko kabhi nahi dikhta)
//   published → storefront yahi render karta hai (GET /theme/public)
//
// draft/published ka shape config/themeSchema.js define karta hai aur har
// save utils/themeValidator.js se guzarta hai — isliye yahan Mixed.
//
// draftRevision: optimistic concurrency — PUT /theme/draft me baseRevision
// match na ho (doosre admin ne save kar diya) → 409.
// ==========================================================

const storeThemeSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },

    draft: { type: mongoose.Schema.Types.Mixed, default: null },
    published: { type: mongoose.Schema.Types.Mixed, default: null },

    draftRevision: { type: Number, default: 0 },
    publishedVersion: { type: Number, default: 0 },

    draftUpdatedAt: { type: Date, default: null },
    draftUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: true, minimize: false, collection: "store_themes" },
);

// ── Multi-tenant ──
storeThemeSchema.plugin(tenantScope);
// Har store ka sirf ek theme document
storeThemeSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("StoreTheme", storeThemeSchema);
