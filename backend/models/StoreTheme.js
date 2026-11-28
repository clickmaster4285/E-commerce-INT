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

    // sha1 of JSON — write ke waqt ek baar; adminView har response par poora JSON serialize nahi karta (§4.5)
    draft_hash: { type: String, default: null },
    published_hash: { type: String, default: null },

    draftRevision: { type: Number, default: 0 },
    publishedVersion: { type: Number, default: 0 },

    draftUpdatedAt: { type: Date, default: null },
    draftUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },

    // Published theme ke seller text ka translation (utils/themeTranslation.js)
    // { "<key>": { h: md5, ur: "...", ar: "..." } } — publish ke baad async bharta hai
    translations: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    translationsUpdatedAt: { type: Date, default: null },

    // Scheduled publish — draft ka SNAPSHOT { at, data, note, by, createdAt } (utils/themeScheduler)
    scheduled: { type: mongoose.Schema.Types.Mixed, default: null },
    // Pichla scheduled publish fail hua ho (e.g. schema invalid) → editor me dikhta hai
    lastScheduleError: { type: mongoose.Schema.Types.Mixed, default: null },

    // Shareable preview links — sirf token ka sha256 hash (asli token kabhi save nahi)
    previewLinks: {
      type: [
        new mongoose.Schema(
          {
            hash: { type: String, required: true },
            expiresAt: { type: Date, required: true },
            createdAt: { type: Date, default: Date.now },
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, minimize: false, collection: "store_themes" },
);

// ── Multi-tenant ──
storeThemeSchema.plugin(tenantScope);
// Har store ka sirf ek theme document
storeThemeSchema.index({ storeId: 1 }, { unique: true });
// Scheduler har minute sirf due themes dhoondta hai
storeThemeSchema.index({ "scheduled.at": 1 }, { sparse: true });

module.exports = mongoose.model("StoreTheme", storeThemeSchema);
