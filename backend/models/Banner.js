const mongoose = require("mongoose");

const buttonSchema = new mongoose.Schema({
  text: { type: String, default: "" },
  linkType: {
    type: String,
    enum: ["custom_url", "product", "category", "brand", "collection", "campaign", "deal", "none"],
    default: "none",
  },
  link: { type: String, default: "" },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection" },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal" }, // ✅ Deal promotion link
}, { _id: false });

const displayRulesSchema = new mongoose.Schema({
  pages: [{ type: String, enum: ["homepage", "category", "product", "cart", "checkout"] }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  devices: [{ type: String, enum: ["desktop", "tablet", "mobile"] }],
}, { _id: false });

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    bannerType: { type: String, enum: ["homepage_hero", "promotional", "product", "collection", "popup"], required: true },
    status: { type: String, enum: ["active", "inactive", "scheduled", "expired", "draft"], default: "draft" },
    position: { type: Number, default: 0 },

    desktopImage: { type: String, required: true },
   
    


    eyebrow: { type: String, default: "" },
    heading: { type: String, default: "" },
    description: { type: String, default: "" },
    
    primaryButton: { type: buttonSchema, default: () => ({}) },
    secondaryButton: { type: buttonSchema, default: () => ({}) },

    startDate: { type: Date },
    endDate: { type: Date },
   
   
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },

    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);