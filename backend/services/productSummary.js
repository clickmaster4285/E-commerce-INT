// ==========================================================
// PRODUCT SUMMARY — §3.4 read-model refresh
// ----------------------------------------------------------
// Variant / stock / review writes ke baad Product par denormalized
// fields update karo taake list/facets poori Variant aggregate na karen.
// ==========================================================
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Review = require("../models/Review");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const log = require("../utils/logger");

const emptyDist = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

/**
 * @param {import("mongoose").Types.ObjectId|string} productId
 * @param {{ session?: import("mongoose").ClientSession }} [opts]
 */
async function refresh(productId, { session } = {}) {
  if (!productId) return null;
  const id = typeof productId === "string" ? new mongoose.Types.ObjectId(productId) : productId;
  const q = (query) => (session ? query.session(session) : query);

  const product = await q(Product.findById(id).select("name brand_id category_id storeId")).lean();
  if (!product) return null;

  const [variantAgg] = await q(
    Variant.aggregate([
      { $match: { product_id: id, is_deleted: { $ne: true } } },
      { $sort: { created_at: 1, _id: 1 } },
      {
        $group: {
          _id: "$product_id",
          variant_count: { $sum: 1 },
          stock_total: { $sum: { $ifNull: ["$quantity", 0] } },
          price_from: { $min: "$selling_price" },
          price_to: { $max: "$selling_price" },
          primary_image: { $first: { $arrayElemAt: ["$images.img_url", 0] } },
          skus: { $push: "$sku" },
        },
      },
    ]),
  );

  const [ratingAgg] = await q(
    Review.aggregate([
      {
        $match: {
          product_id: id,
          is_deleted: { $ne: true },
          status: { $ne: "hidden" },
        },
      },
      {
        $group: {
          _id: "$product_id",
          rating_count: { $sum: 1 },
          rating_avg: { $avg: "$rating" },
          ratings: { $push: "$rating" },
        },
      },
    ]),
  );

  const dist = emptyDist();
  if (ratingAgg?.ratings) {
    for (const r of ratingAgg.ratings) {
      const key = Math.min(5, Math.max(1, Math.round(Number(r) || 0)));
      dist[key] = (dist[key] || 0) + 1;
    }
  }

  let brandName = "";
  let categoryName = "";
  if (product.brand_id) {
    const b = await q(Brand.findById(product.brand_id).select("name")).lean();
    brandName = b?.name || "";
  }
  if (product.category_id) {
    const c = await q(Category.findById(product.category_id).select("name")).lean();
    categoryName = c?.name || "";
  }

  const skus = Array.isArray(variantAgg?.skus) ? variantAgg.skus.filter(Boolean) : [];
  const search_text = [product.name, brandName, categoryName, ...skus]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const stock_total = Math.max(0, Number(variantAgg?.stock_total) || 0);
  const patch = {
    variant_count: Number(variantAgg?.variant_count) || 0,
    stock_total,
    in_stock: stock_total > 0,
    price_from: variantAgg?.price_from != null ? Number(variantAgg.price_from) : null,
    price_to: variantAgg?.price_to != null ? Number(variantAgg.price_to) : null,
    primary_image: variantAgg?.primary_image || "",
    rating_avg: ratingAgg?.rating_count
      ? Math.round((Number(ratingAgg.rating_avg) || 0) * 100) / 100
      : 0,
    rating_count: Number(ratingAgg?.rating_count) || 0,
    rating_dist: dist,
    search_text,
  };

  await q(Product.updateOne({ _id: id }, { $set: patch }));
  return patch;
}

/** Fire-and-forget — request path pe await mat karo unless transaction me ho (§6.3 queue) */
function refreshAsync(productId) {
  if (!productId) return;
  try {
    const { enqueueProductSummary } = require("../jobs/productSummary");
    enqueueProductSummary(productId);
  } catch (err) {
    Promise.resolve()
      .then(() => refresh(productId))
      .catch((e) => log.warn("productSummary.refresh failed:", e?.message || e));
  }
}

module.exports = { refresh, refreshAsync, emptyDist };
