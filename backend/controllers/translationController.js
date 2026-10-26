const Brand = require("../models/brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const Attribute = require("../models/Attribute");
const Review = require("../models/Review");
const Banner = require("../models/Banner");
const Variant = require("../models/Variant");
const StockHistory = require("../models/StockHistory");
const Order = require("../models/Order");
const PurchaseOrder = require("../models/PurchaseOrder");
const Vendor = require("../models/Vendor");
const ShippingMethod = require("../models/ShippingMethod");
const { TARGET_LOCALES } = require("../utils/libreTranslate");
const { syncDocumentTranslations } = require("../utils/translationService");

const MODELS = { Brand, Category, Product, Discount, Deal, Attribute, Review, Banner, Variant, StockHistory, Order, PurchaseOrder, Vendor, ShippingMethod };
const PERMISSIONS = { Brand: "brands", Category: "categories", Product: "products", Discount: "discounts", Deal: "deals", Attribute: "attribute", Review: "reviews", Banner: "banners", Variant: "manageStock", StockHistory: "manageStock", Order: "order", PurchaseOrder: "purchaseOrders", Vendor: "vendors", ShippingMethod: "shipping" };

async function translatePage(req, res) {
  const { model, ids, locale } = req.body || {};
  if (!MODELS[model] || !Array.isArray(ids) || ids.length > 50 || !ids.every((id) => typeof id === "string")) {
    return res.status(400).json({ success: false, message: "Invalid page translation request" });
  }
  if (!TARGET_LOCALES.includes(locale)) {
    return res.status(400).json({ success: false, message: "Unsupported translation language" });
  }
  const permission = PERMISSIONS[model];
  if (req.user?.role?.toLowerCase() !== "admin" && req.user?.permissions?.[permission] === false) {
    return res.status(403).json({ success: false, message: `Access denied: ${permission}` });
  }

  try {
    const Model = MODELS[model];
    const docs = await Model.find({ _id: { $in: [...new Set(ids)] }, is_deleted: { $ne: true } })
      .select("_id name description brand_id title comment storeResponse.message values translations translation_source translation_status eyebrow heading altText primaryButton.text secondaryButton.text notes cancel_reason product_name variant_title reason explanation company_name address city state country")
      .lean();
    let translated = 0;
    let failed = 0;
    let processed = 0;
    for (const doc of docs) {
      const result = await syncDocumentTranslations(Model, doc, { locales: [locale] });
      processed++;
      translated += result.translated;
      if (result.failed) failed++;
      if (result.serviceUnavailable) {
        // Translation service unavailable ho to har remaining record par
        // retry wait karwana page request ko ghair-zaroori lamba karega.
        break;
      }
    }
    return res.json({ success: true, processed, translated, failed });
  } catch (error) {
    console.error(`[translation] page sync failed (${model}/${locale}):`, error?.message || error);
    return res.status(503).json({ success: false, message: "Page translations could not be generated" });
  }
}

module.exports = { translatePage };
