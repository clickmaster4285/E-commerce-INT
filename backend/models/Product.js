const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const softDeletePlugin = require("../utils/softDeletePlugin");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brand_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },

    has_variants: {
      type: Boolean,
      default: false,
    },

    tag_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // 🌍 AUTOMATIC TRANSLATIONS (LibreTranslate)
    // ------------------------------------------
    // English `name`/`description` upar hi source of truth hain — inme kabhi
    // koi write nahi hota, translation alag `translations` map me jaata hai.
    // `translation_source` me us English text ka hash rehta hai jisse stale
    // translation detect hoti hai (English edit → hash badla → regenerate).
    //
    // Product names containing model/code digits stay in English; descriptive
    // names and descriptions use the sidecar map without changing source data.
    translations: {
      name: { type: Map, of: String, default: () => ({}) },
      description: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      name: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    translation_status: {
      name: {
        type: String,
        enum: ["pending", "done", "failed", "skipped"],
        default: "pending",
      },
      description: {
        type: String,
        enum: ["pending", "done", "failed", "skipped"],
        default: "pending",
      },
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    isPerishable: {
      type: Boolean,
      default: false,
    },

    expiryDuration: {
      type: Number,
      default: 0,
      min: 0,
    },

    expiryUnit: {
      type: String,
      enum: ["days", "months", "years"],
      default: "days",
    },

    // ✅ NEW: Dynamic specifications from category attributes
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // ✅ FEATURED — admin is product ko "Featured Products" page se mark/unmark
    //    kar sakta hai. Default false → purane products featured nahi banenge.
    is_featured: {
      type: Boolean,
      default: false,
    },

    // ✅ FEATURED_AT — featured mark karne ka timestamp.
    //    Featured Products page ka "recent upar" order IS field se chalta hai,
    //    `created_at` se nahi: bulk/seed insert me sab products ka created_at
    //    bilkul same hota hai (same millisecond), is liye created_at par sort
    //    kuch nahi badalta aur order sirf _id (random) par chala jata tha.
    //    Unmark karte waqt null ho jata hai → dobara feature karne par naya
    //    timestamp milta hai aur wo product foran top par aa jata hai.
    featured_at: {
      type: Date,
      default: null,
    },

    // ── §3.4 read-model (productSummary.refresh maintain karta hai) ──
    price_from: { type: Number, default: null },
    price_to: { type: Number, default: null },
    stock_total: { type: Number, default: 0, min: 0 },
    in_stock: { type: Boolean, default: false },
    variant_count: { type: Number, default: 0, min: 0 },
    primary_image: { type: String, default: "" },
    rating_avg: { type: Number, default: 0, min: 0, max: 5 },
    rating_count: { type: Number, default: 0, min: 0 },
    rating_dist: {
      type: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 },
      },
      default: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
    },
    // Lowercased name + brand + category + SKUs — prefix search (§4.4)
    search_text: { type: String, default: "", index: false },

    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    updatedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    deletedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// ✅ §3.3 — har compound storeId se shuru (ESR rule)
productSchema.index({ storeId: 1, is_deleted: 1, status: 1, created_at: -1, _id: -1 });
productSchema.index({ storeId: 1, is_featured: 1, is_deleted: 1, featured_at: -1, _id: -1 });
productSchema.index({ storeId: 1, category_id: 1, is_deleted: 1 });
productSchema.index({ storeId: 1, brand_id: 1, is_deleted: 1 });
productSchema.index({ storeId: 1, tag_ids: 1 });
productSchema.index({ storeId: 1, price_from: 1 });
productSchema.index({ storeId: 1, search_text: 1 });


// ── Multi-tenant ──
productSchema.plugin(tenantScope); // har store ka data alag (storeId)
productSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("Product", productSchema);
