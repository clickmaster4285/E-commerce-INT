// ==========================================================
// productQueryService (§4.4) — shared list/filter for getProducts + stats
// ----------------------------------------------------------
// Controllers thin rehte hain; filter / category-subtree / shop params yahan.
// ==========================================================
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const { escapeRegex } = require("../utils/escapeRegex");

const collectIds = (value) => {
  const arr = Array.isArray(value) ? value : String(value || "").split(",");
  const out = [];
  for (const raw of arr) {
    const id = String(raw || "").trim();
    if (id && id !== "all" && mongoose.Types.ObjectId.isValid(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
};

/** Category subtree expand — ancestors fast path, else tree walk (§4.4). */
const expandCategorySubtrees = async (rootIds) => {
  if (!rootIds.length) return [];

  const legacyChild = await Category.exists({
    is_deleted: false,
    parent_category_id: { $ne: null },
    $or: [{ ancestors: { $exists: false } }, { ancestors: { $size: 0 } }],
  });
  if (!legacyChild) {
    const roots = new Set(rootIds.map(String));
    const rows = await Category.find({
      is_deleted: false,
      is_active: true,
      ancestors: { $in: [...roots].filter((r) => mongoose.isValidObjectId(r)).map((r) => new mongoose.Types.ObjectId(r)) },
    }).select("_id ancestors").lean();
    const activeSet = new Set([...roots, ...rows.map((r) => String(r._id))]);
    const out = new Set(roots);
    for (const row of rows) {
      const anc = (row.ancestors || []).map(String);
      let lastRoot = -1;
      anc.forEach((a, i) => { if (roots.has(a)) lastRoot = i; });
      if (anc.slice(lastRoot + 1).every((a) => activeSet.has(a))) out.add(String(row._id));
    }
    return [...out];
  }

  const cats = await Category.find({ is_deleted: false, is_active: true }).select("parent_category_id").lean();
  const childrenOf = new Map();
  cats.forEach((c) => {
    const pid = String(c.parent_category_id?._id || c.parent_category_id || "");
    if (!pid) return;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid).push(String(c._id));
  });
  const set = new Set(rootIds.map(String));
  let grew = true;
  while (grew) {
    grew = false;
    set.forEach((sid) => {
      (childrenOf.get(sid) || []).forEach((child) => {
        if (!set.has(child)) {
          set.add(child);
          grew = true;
        }
      });
    });
  }
  return [...set];
};

const buildProductFilter = async (query = {}) => {
  const brandIds = collectIds(query.brand_ids ?? query.brand_id);
  const categoryIds = collectIds(query.category_ids ?? query.category_id);
  const statusFilter = String(query.status || "").trim();
  const search = String(query.search || query.q || "").trim();
  const featuredFilter = String(query.featured || "").trim().toLowerCase();

  const filter = { is_deleted: { $ne: true } };
  if (brandIds.length === 1) filter.brand_id = brandIds[0];
  else if (brandIds.length > 1) filter.brand_id = { $in: brandIds };
  if (categoryIds.length) {
    const expanded = await expandCategorySubtrees(categoryIds);
    filter.category_id = { $in: expanded.length ? expanded : categoryIds };
  }
  if (statusFilter && statusFilter !== "all") filter.status = statusFilter;
  if (featuredFilter === "true" || featuredFilter === "1") filter.is_featured = true;
  else if (featuredFilter === "false" || featuredFilter === "0") filter.is_featured = false;

  if (search) {
    const escaped = escapeRegex(search);
    const prefix = { $regex: `^${escaped}`, $options: "i" };
    const rx = { $regex: escaped, $options: "i" };
    const [brandDocs, catDocs, variantDocs] = await Promise.all([
      Brand.find({ name: rx, is_deleted: { $ne: true }, is_active: true }).select("_id").lean().catch(() => []),
      Category.find({ name: rx, is_deleted: { $ne: true }, is_active: true }).select("_id").lean().catch(() => []),
      Variant.find({ sku: rx, is_deleted: { $ne: true } }).select("product_id").lean().catch(() => []),
    ]);
    const legacyOr = [
      { name: rx },
      { brand_id: { $in: brandDocs.map((b) => b._id) } },
      { category_id: { $in: catDocs.map((c) => c._id) } },
      { _id: { $in: variantDocs.map((v) => v.product_id) } },
    ];
    filter.$or = [
      { search_text: prefix },
      {
        $and: [
          { $or: [{ search_text: "" }, { search_text: { $exists: false } }, { search_text: null }] },
          { $or: legacyOr },
        ],
      },
    ];
  }

  return { filter, search };
};

const SHOP_STOCK_STATES = ["in", "low", "out"];

const toIdList = (value, cap = 100) => {
  const arr = Array.isArray(value) ? value : String(value || "").split(",");
  const out = [];
  for (const raw of arr) {
    const id = String(raw || "").trim();
    if (id && mongoose.Types.ObjectId.isValid(id) && !out.includes(id)) out.push(id);
    if (out.length >= cap) break;
  }
  return out;
};

const numOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseShopParams = (query = {}) => {
  let minPrice = numOrNull(query.minPrice);
  let maxPrice = numOrNull(query.maxPrice);
  if (minPrice !== null && minPrice < 0) minPrice = 0;
  if (maxPrice !== null && maxPrice < 0) maxPrice = 0;
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const stockStates = toIdList(query.stockStates ?? query.stock, 10).filter((s) =>
    SHOP_STOCK_STATES.includes(s),
  );
  const bandNums = toIdList(query.discount ?? query.discounts ?? [], 10)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const singleBand = numOrNull(query.discountBand);
  if (singleBand !== null && singleBand > 0) bandNums.push(singleBand);
  const threshold = numOrNull(query.minDiscount);
  if (threshold !== null && threshold > 0) bandNums.push(threshold);
  const minDiscountBand = bandNums.length ? Math.min(...bandNums) : null;
  const dealIds = toIdList(query.dealIds ?? query.deal, 50).filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );
  const ids = toIdList(query.ids, 50);
  const hasShopFilters =
    minPrice !== null ||
    maxPrice !== null ||
    stockStates.length > 0 ||
    minDiscountBand !== null ||
    dealIds.length > 0;
  return { minPrice, maxPrice, stockStates, minDiscountBand, dealIds, ids, hasShopFilters };
};

module.exports = {
  collectIds,
  expandCategorySubtrees,
  buildProductFilter,
  parseShopParams,
  SHOP_STOCK_STATES,
  Product, // re-export for callers that want one import surface
};
