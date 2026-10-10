const mongoose = require("mongoose");

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

productSchema.index({ category_id: 1 });
productSchema.index({ brand_id: 1 });
productSchema.index({ status: 1, is_deleted: 1 });
// ✅ Featured Products page — filter (is_featured) + "recent first" sort dono
//    is compound index se serve hote hain (bina in-memory sort). `_id` tie-break
//    un products ke liye hai jinka featured_at abhi null hai (purana data / seed).
productSchema.index({ is_featured: 1, is_deleted: 1, featured_at: -1, _id: -1 });
// ✅ Products list pagination — sort ({ created_at: -1, _id: -1 }) isi index se
//    serve hota hai (bina in-memory sort), aur _id tie-break pages ko overlap hone
//    se rokta hai jab kai products ka created_at same ho.
productSchema.index({ created_at: -1, _id: -1 });

module.exports = mongoose.model("Product", productSchema);
