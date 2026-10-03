const mongoose = require("mongoose");

const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Tag = require("../models/Tag");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const Deal = require("../models/Deal");
const Discount = require("../models/Discount");
// ✅ Safe Brand model loader (file name case-sensitive ho sakti hai)
const loadBrandModel = () => {
  const paths = [
    "../models/Brand",
    "../models/brand",
    "../models/Brands",
    "../models/brands",
  ];
  for (const p of paths) {
    try {
      return require(p);
    } catch (e) {
      // agla path try karo
    }
  }
  return null;
};
const Brand = loadBrandModel();

const { getNextSku } = require("../utils/skuHelper");
const { deleteProductUploadFolder } = require("../utils/uploadHelpers");

const { getIO } = require("../utils/socket");
const { pushGlobalActivity, isSameValue, isSameList } = require("../utils/activityHelper");

// ======================================================
// SOCKET HELPER
// ======================================================
const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) {
      io.emit(event, data);
    }
  } catch (error) {
    console.warn("⚠️ Socket emit failed:", error.message);
  }
};

// ======================================================
// JSON PARSER
// ======================================================
const parseJSON = (value, fallback = []) => {
  try {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
  } catch (error) {
    return fallback;
  }
};

// ======================================================
// NUMBER HELPER
// ======================================================
const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

// ======================================================
// SKU NORMALIZER
// ======================================================
const normalizeSku = (sku) => {
  return String(sku || "").trim();
};

// ======================================================
// REGEX ESCAPER
// ======================================================
const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ======================================================
// ⭐ SHARED TAG RESOLVER (Find or Create)
// Ensures every tag name exists as a Tag document (with
// createdby tracked) so the Tags tab can show who created it.
// ======================================================
const resolveTags = async (tagNames, userId) => {
  if (!Array.isArray(tagNames) || tagNames.length === 0) return [];

  const cleanNames = [...new Set(
    tagNames
      .map(n => String(n).trim().toLowerCase())
      .filter(Boolean)
  )];

  if (cleanNames.length === 0) return [];

  // ✅ Look up by name regardless of soft-delete: re-creating a soft-deleted
  // name hits the unique `name` index (E11000), so restore that doc instead.
  const existingTags = await Tag.find({
    name: { $in: cleanNames }
  }).lean();

  const existingMap = new Map(existingTags.map(t => [t.name, t]));
  const finalTagIds = [];

  for (const name of cleanNames) {
    const found = existingMap.get(name);
    if (found) {
      if (found.is_deleted) {
        // Restore the soft-deleted tag so the unique index is not violated
        await Tag.updateOne({ _id: found._id }, { $set: { is_deleted: false } });
      }
      finalTagIds.push(found._id);
    } else {
      const newTag = await Tag.create({
        name,
        createdby: userId,
        updatedby: userId
      });
      finalTagIds.push(newTag._id);
    }
  }

  return finalTagIds;
};

// ======================================================
// ⭐ VALIDATE SPECIFICATIONS AGAINST CATEGORY ATTRIBUTES
// ======================================================
const validateSpecifications = async (categoryId, specifications, tenantId) => {
  if (!specifications || typeof specifications !== 'object') {
    return {};
  }

  const category = await Category.findOne({
    _id: categoryId,
    is_deleted: false,
  }).lean();

  if (!category) {
    throw new Error("Invalid category");
  }

  const attributeIds = (category.attributes || []).map(attr => attr.attribute_id);
  
  if (attributeIds.length === 0) {
    return specifications;
  }

  const attributes = await Attribute.find({
    _id: { $in: attributeIds },
    tenant_id: tenantId,
    is_deleted: false,
    is_active: true,
  }).lean();

  const attributeMap = new Map(attributes.map(attr => [attr.code, attr]));
  const validatedSpecs = {};

  for (const [code, value] of Object.entries(specifications)) {
    const attr = attributeMap.get(code);
    
    if (!attr) {
      continue;
    }

    const config = category.attributes.find(a => String(a.attribute_id) === String(attr._id));
    
    if (config?.is_required && (!value || value === '')) {
      throw new Error(`Specification "${attr.name}" is required`);
    }

    if (attr.data_type === 'select' || attr.data_type === 'multi_select') {
      const validValues = (attr.values || []).map(v => v.value);
      if (value && !validValues.includes(value)) {
        throw new Error(`Invalid value for "${attr.name}"`);
      }
    }

    if (attr.data_type === 'number' || attr.data_type === 'decimal') {
      const numValue = Number(value);
      if (value && !Number.isFinite(numValue)) {
        throw new Error(`"${attr.name}" must be a valid number`);
      }
    }

    validatedSpecs[code] = value;
  }

  return validatedSpecs;
};

// ======================================================
// SHARED FILTER BUILDER
// ✅ Products list aur Products summary stats — dono same filter use karte hain
//    (search / category / brand / status) taake dono ka data consistent rahe.
// ======================================================
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

// ✅ Category subtree expand (homeCatalog.categorySubtreeIds parity) —
// parent select ho to uske saare children bhi match hote hain
const expandCategorySubtrees = async (rootIds) => {
  if (!rootIds.length) return [];
  const cats = await Category.find({ is_deleted: false }).select("parent_category_id").lean();
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
  // ✅ Featured Products page — sirf "?featured=true" bheje tab filter lagta hai
  //    (legacy callers filter nahi bhejte → unka behavior bilkul same rehta hai).
  const featuredFilter = String(query.featured || "").trim().toLowerCase();

  // ---- Filter build ----
  // ✅ Optional filters (category/status) — legacy mode ko break nahi karte,
  //     sirf tab apply hote hain jab explicitly bheja jaye.
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
    const rx = { $regex: escapeRegex(search), $options: "i" };
    const [brandDocs, catDocs, variantDocs] = await Promise.all([
      Brand
        ? Brand.find({ name: rx, is_deleted: { $ne: true } }).select("_id").lean().catch(() => [])
        : Promise.resolve([]),
      Category.find({ name: rx, is_deleted: { $ne: true } }).select("_id").lean().catch(() => []),
      Variant.find({ sku: rx, is_deleted: { $ne: true } }).select("product_id").lean().catch(() => []),
    ]);
    filter.$or = [
      { name: rx },
      { brand_id: { $in: brandDocs.map((b) => b._id) } },
      { category_id: { $in: catDocs.map((c) => c._id) } },
      { _id: { $in: variantDocs.map((v) => v.product_id) } },
    ];
  }

  return { filter, search };
};

// ======================================================
// 🛍️ SHOP FACETS (storefront server-side filtering)
// Client semantics (homeCatalog.js) ka exact port:
//  - price: FIRST variant (created_at:1) ki selling_price; variant na ho to 0
//  - stock: variant quantities ka sum (na ho to 0); out<1, low<5, else in
//  - deal: dealMatchesProduct jaisa (direct category/brand match)
//  - discount %: DiscountContext engine jaisa (public discounts only,
//    percentage/fixed, best price, Math.round parity; fixed_price ignored)
// ======================================================
const SHOP_STOCK_STATES = ["in", "low", "out"];
const LOW_STOCK_THRESHOLD = 5;

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

// ✅ Sanitized shop params — invalid/negative/NaN → safe default/ignore
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
  // ✅ discount bands (?discount=10&discount=20) + single (?discountBand=20) + threshold (?minDiscount=)
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

// ✅ Ek aggregation me first-variant price + stock sum (Variant index se)
const variantStatsMap = async (productIds) => {
  const map = new Map();
  if (!productIds.length) return map;
  const rows = await Variant.aggregate([
    { $match: { product_id: { $in: productIds }, is_deleted: { $ne: true } } },
    // ✅ _id tie-break: same-millisecond seeds par $first hamesha find()[0] jaisa
    { $sort: { created_at: 1, _id: 1 } },
    {
      $group: {
        _id: "$product_id",
        price: { $first: "$selling_price" },
        stock: { $sum: { $ifNull: ["$quantity", 0] } },
      },
    },
  ]);
  rows.forEach((r) => {
    map.set(String(r._id), {
      price: Number(r.price) || 0,
      stock: Number(r.stock) || 0,
    });
  });
  return map;
};

const stockStateOf = (stock) => {
  if (!(stock >= 1)) return "out";
  if (stock < LOW_STOCK_THRESHOLD) return "low";
  return "in";
};

// ✅ Active public discounts — getPublicDiscounts wali query (matching set same)
const activePublicDiscounts = async () => {
  const now = new Date();
  return Discount.find({
    is_deleted: false,
    isActive: true,
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .select("type value applyTo selectedProducts selectedCategories selectedBrands isActive")
    .lean();
};

const discountAppliesTo = (disc, pid, cid, bid) => {
  const inList = (list, value) =>
    (list || []).some((entry) => String(entry?._id || entry) === value);
  if (disc.applyTo === "all") return true;
  if (disc.applyTo === "product" || disc.applyTo === "specific_products") {
    const ids = disc.productIds || disc.selectedProducts || [];
    return inList(ids, pid);
  }
  if (disc.applyTo === "category" || disc.applyTo === "specific_categories") {
    const ids = disc.categoryIds || disc.selectedCategories || [];
    return cid && inList(ids, cid);
  }
  if (disc.applyTo === "brand" || disc.applyTo === "specific_brands") {
    const ids = disc.brandIds || disc.selectedBrands || [];
    return bid && inList(ids, bid);
  }
  return false;
};

// ✅ DiscountContext engine ka exact math (first-variant price basis)
const discountPercentFor = (price, pid, cid, bid, discounts) => {
  if (!(price > 0)) return 0;
  let best = price;
  for (const disc of discounts || []) {
    if (!disc.isActive) continue;
    if (!discountAppliesTo(disc, pid, cid, bid)) continue;
    let final = price;
    const val = Number(disc.value ?? disc.discountValue) || 0;
    if (disc.type === "percentage") {
      final = price * (1 - val / 100);
    } else if (disc.type === "fixed" || disc.type === "fixed_amount") {
      final = Math.max(0, price - val);
    }
    if (final < best) best = final;
  }
  if (!(best < price)) return 0;
  const discounted = Math.round(best);
  if (!(discounted < price)) return 0;
  return Math.round(((price - discounted) / price) * 100);
};

// ✅ dealMatchesProduct (homeCatalog) ka exact port — direct category/brand match
const dealMatchesIds = (deal, pid, cid, bid) => {
  if (!deal || !pid) return false;
  const inList = (list, value) =>
    (list || []).some((entry) => String(entry?._id || entry || "") === value);
  switch (deal.applyTo) {
    case "product":
      return inList(deal.productIds, pid);
    case "category":
      return inList(deal.categoryIds, cid);
    case "brand":
      return inList(deal.brandIds, bid);
    case "all":
    case "collection":
    default:
      return (deal.productIds || []).length ? inList(deal.productIds, pid) : true;
  }
};

const activeDealsByIds = async (dealIds) => {
  if (!dealIds.length) return [];
  const now = new Date();
  const docs = await Deal.find({ _id: { $in: dealIds } })
    .select("name type applyTo productIds categoryIds brandIds isActive startDate endDate")
    .lean();
  // ✅ Client parity: sirf active window wali deals participate karti hain;
  // stale/expired id ho to koi filtering nahi (sab pass)
  return docs.filter(
    (d) => d.isActive && new Date(d.startDate) <= now && new Date(d.endDate) >= now,
  );
};

// ✅ Product refs (deal/discount matching ke liye) — ek query me
const productRefsMap = async (ids) => {
  if (!ids.length) return new Map();
  const refs = await Product.find({ _id: { $in: ids } })
    .select("category_id brand_id")
    .lean();
  return new Map(
    refs.map((r) => [
      String(r._id),
      {
        cid: String(r.category_id?._id || r.category_id || ""),
        bid: String(r.brand_id?._id || r.brand_id || ""),
      },
    ]),
  );
};

// ✅ Active deals (sidebar counts + deal facet) — window check ke saath
const allActiveDeals = async () => {
  const now = new Date();
  return Deal.find({ isActive: true, startDate: { $lte: now }, endDate: { $gte: now } })
    .select("name type applyTo productIds categoryIds brandIds isActive startDate endDate")
    .lean();
};

// ✅ Indexed match structures — 600+ deals / 400+ discounts par double-loop
// ki jagah single pass (facets endpoint seconds se ms me).
const buildDiscountIndex = (discounts) =>
  (discounts || []).map((disc) => ({
    disc,
    val: Number(disc.value ?? disc.discountValue) || 0,
    all: disc.applyTo === "all",
    pSet: new Set(
      (disc.productIds || disc.selectedProducts || []).map((e) => String(e?._id || e || "")),
    ),
    cSet: new Set(
      (disc.categoryIds || disc.selectedCategories || []).map((e) => String(e?._id || e || "")),
    ),
    bSet: new Set(
      (disc.brandIds || disc.selectedBrands || []).map((e) => String(e?._id || e || "")),
    ),
  }));

const discountPctIndexed = (price, pid, cid, bid, idx) => {
  if (!(price > 0)) return 0;
  let best = price;
  for (const entry of idx) {
    const disc = entry.disc;
    if (!disc.isActive) continue;
    let applies = false;
    if (entry.all) applies = true;
    else if (disc.applyTo === "product" || disc.applyTo === "specific_products") applies = entry.pSet.has(pid);
    else if (disc.applyTo === "category" || disc.applyTo === "specific_categories") applies = !!cid && entry.cSet.has(cid);
    else if (disc.applyTo === "brand" || disc.applyTo === "specific_brands") applies = !!bid && entry.bSet.has(bid);
    if (!applies) continue;
    let final = price;
    if (disc.type === "percentage") final = price * (1 - entry.val / 100);
    else if (disc.type === "fixed" || disc.type === "fixed_amount") final = Math.max(0, price - entry.val);
    if (final < best) best = final;
  }
  if (!(best < price)) return 0;
  const discounted = Math.round(best);
  if (!(discounted < price)) return 0;
  return Math.round(((price - discounted) / price) * 100);
};

// ✅ Final (discounted) price — DiscountContext/calculateProductDiscount parity
// (regular listing: Discount collection hi lagta hai, deals alag filter hain).
// Koi discount na ho → original price (rounded). Example: 100 par 30% off → 70,
// is liye price-range filter/bounds/sort isi FINAL price par chalte hain.
const finalPriceIndexed = (price, pid, cid, bid, idx) => {
  if (!(price > 0)) return 0;
  let best = price;
  for (const entry of idx) {
    const disc = entry.disc;
    if (!disc.isActive) continue;
    let applies = false;
    if (entry.all) applies = true;
    else if (disc.applyTo === "product" || disc.applyTo === "specific_products") applies = entry.pSet.has(pid);
    else if (disc.applyTo === "category" || disc.applyTo === "specific_categories") applies = !!cid && entry.cSet.has(cid);
    else if (disc.applyTo === "brand" || disc.applyTo === "specific_brands") applies = !!bid && entry.bSet.has(bid);
    if (!applies) continue;
    let final = price;
    if (disc.type === "percentage") final = price * (1 - entry.val / 100);
    else if (disc.type === "fixed" || disc.type === "fixed_amount") final = Math.max(0, price - entry.val);
    if (final < best) best = final;
  }
  return Math.round(best);
};

const buildDealIndex = (deals) => {
  const byProduct = new Map();
  const byCategory = new Map();
  const byBrand = new Map();
  const openAll = [];
  const push = (map, key, deal) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(deal);
  };
  (deals || []).forEach((deal) => {
    const hasP = (deal.productIds || []).length > 0;
    if (deal.applyTo === "product" && hasP) {
      deal.productIds.forEach((e) => push(byProduct, String(e?._id || e || ""), deal));
    } else if (deal.applyTo === "category") {
      (deal.categoryIds || []).forEach((e) => push(byCategory, String(e?._id || e || ""), deal));
    } else if (deal.applyTo === "brand") {
      (deal.brandIds || []).forEach((e) => push(byBrand, String(e?._id || e || ""), deal));
    } else if (deal.applyTo === "all" || deal.applyTo === "collection") {
      if (hasP) deal.productIds.forEach((e) => push(byProduct, String(e?._id || e || ""), deal));
      else openAll.push(deal);
    }
  });
  return { byProduct, byCategory, byBrand, openAll };
};

// ✅ Ek product se match hone wali deals (candidates only — dealMatchesIds parity)
const matchingDealsIndexed = (dealIdx, pid, cid, bid) => {
  const out = new Set(dealIdx.openAll);
  (dealIdx.byProduct.get(pid) || []).forEach((d) => out.add(d));
  if (cid) (dealIdx.byCategory.get(cid) || []).forEach((d) => out.add(d));
  if (bid) (dealIdx.byBrand.get(bid) || []).forEach((d) => out.add(d));
  return [...out].filter((deal) => dealMatchesIds(deal, pid, cid, bid));
};

// ✅ Shop facets apply — matching product _ids (ObjectId) ya null (koi facet nahi)
// exclude: "price" | "stock" | "discount" | "deal" (leave-one-out counts ke liye)
// pre: { stats, refsMap, discountDocs, dealDocs } — dobara fetch se bachne ke liye
const applyShopFacets = async (baseFilter, shop, exclude = null, pre = null) => {
  const usePrice = exclude !== "price" && (shop.minPrice !== null || shop.maxPrice !== null);
  const useStock = exclude !== "stock" && shop.stockStates.length > 0;
  const useDiscount = exclude !== "discount" && shop.minDiscountBand !== null;
  const useDeal = exclude !== "deal" && shop.dealIds.length > 0;
  if (!usePrice && !useStock && !useDiscount && !useDeal) return null;

  const baseDocs = await Product.find(baseFilter).select("_id").lean();
  let working = baseDocs.map((d) => d._id);
  if (!working.length) return [];

  let stats = null;
  if (usePrice || useStock || useDiscount) {
    stats = pre?.stats || (await variantStatsMap(working));
  }

  // ✅ Price range FINAL (discounted) price par — refs + discounts isi liye
  // yahin chahiye (pehle sirf deal/discount filter mangte the).
  let refsMap = null;
  let discountIdx = null;
  if (usePrice || useDeal || useDiscount) {
    refsMap = pre?.refsMap || (await productRefsMap(working));
  }
  if (usePrice || useDiscount) {
    const discounts = pre?.discountDocs || (await activePublicDiscounts());
    discountIdx = buildDiscountIndex(discounts);
  }

  if (usePrice) {
    working = working.filter((id) => {
      const pid = String(id);
      const price = stats.get(pid)?.price || 0;
      const refs = refsMap.get(pid) || { cid: "", bid: "" };
      const final = finalPriceIndexed(price, pid, refs.cid, refs.bid, discountIdx);
      if (shop.minPrice !== null && final < shop.minPrice) return false;
      if (shop.maxPrice !== null && final > shop.maxPrice) return false;
      return true;
    });
    if (!working.length) return [];
  }

  if (useStock) {
    working = working.filter((id) =>
      shop.stockStates.includes(stockStateOf(stats.get(String(id))?.stock || 0)),
    );
    if (!working.length) return [];
  }

  if (useDeal) {
    const deals = pre?.dealDocs || (await activeDealsByIds(shop.dealIds));
    // ✅ Client parity: valid deal na mile to filtering off (sab pass)
    if (deals.length) {
      const dealIdx = buildDealIndex(deals);
      working = working.filter((id) => {
        const pid = String(id);
        const refs = refsMap.get(pid) || { cid: "", bid: "" };
        return matchingDealsIndexed(dealIdx, pid, refs.cid, refs.bid).length > 0;
      });
      if (!working.length) return [];
    }
  }

  if (useDiscount) {
    working = working.filter((id) => {
      const pid = String(id);
      const price = stats.get(pid)?.price || 0;
      const refs = refsMap.get(pid) || { cid: "", bid: "" };
      return discountPctIndexed(price, pid, refs.cid, refs.bid, discountIdx) >= shop.minDiscountBand;
    });
  }

  return working;
};

// ======================================================
// SUMMARY STATS COMPUTE
// ✅ Stat cards ke liye GLOBAL stats — filter ke mutabiq poori dataset par
//     (sirf current page par nahi). Ek aggregation se variants + stock dono.
// ✅ Ye logic list se alag (dedicated /products/stats) use hota hai.
// ======================================================
const computeProductStats = async (filter, totalOverride = null) => {
  const allMatchedIds = (await Product.find(filter).select("_id").lean()).map((d) => d._id);
  const [total, activeProducts, variantAgg] = await Promise.all([
    Number.isFinite(totalOverride) ? Promise.resolve(totalOverride) : Product.countDocuments(filter),
    allMatchedIds.length
      ? Product.countDocuments({ _id: { $in: allMatchedIds }, status: "active" })
      : Promise.resolve(0),
    allMatchedIds.length
      ? Variant.aggregate([
          { $match: { is_deleted: { $ne: true }, product_id: { $in: allMatchedIds } } },
          { $group: { _id: null, totalVariants: { $sum: 1 }, totalStock: { $sum: { $ifNull: ["$quantity", 0] } } } },
        ])
      : Promise.resolve([]),
  ]);

  return {
    totalProducts: total,
    activeProducts,
    // ✅ Summary card ke liye Inactive = Total - Active (brand stats jaisa hi pattern)
    inactiveProducts: Math.max(0, total - activeProducts),
    totalVariants: variantAgg[0]?.totalVariants || 0,
    totalStock: variantAgg[0]?.totalStock || 0,
  };
};

// ======================================================
// GET ALL PRODUCTS (UPDATED WITH PRICE CALCULATION)
// ======================================================
// ✅ DETERMINISTIC LIST ORDER (pagination ka base)
// Sirf `created_at` par sort karna kaafi nahi tha: bulk/seed insert ki wajah se
// kai products ka created_at bilkul same (same millisecond) hota hai, aur MongoDB
// ka sort ties par stable nahi hota. Is liye har page request par ties ka order
// badal jata tha → skip/limit ke saath pages overlap karte the (page 2 par page 1
// ke products dobara aa jate the aur kuch products kabhi dikhte hi nahi the).
// `_id` tie-breaker ek TOTAL order banata hai, is liye har page exactly ek baar.
const PRODUCT_LIST_SORT = { created_at: -1, _id: -1 };

// ✅ FEATURED PAGE SORT — "recent upar, top par"
//    Featured Products page ke liye. `created_at` yahan kaam ka nahi: bulk/seed
//    insert me sab products ka created_at ek hi millisecond ka hota hai, is liye
//    created_at par sort sab tie karta hai aur order sirf _id (random ObjectId)
//    par chala jata tha — user ko "recent upar" dikhai hi nahi deta tha.
//    `featured_at` wo timestamp hai jab product featured mark kiya gaya → jo
//    abhi feature hua wo hamesha top. Purane featured products (featured_at null)
//    niche rehte hain aur created_at → _id se deterministic order milta hai.
const FEATURED_RECENT_SORT = { featured_at: -1, created_at: -1, _id: -1 };

// ======================================================
// GET ALL PRODUCTS (OPTIONAL SERVER-SIDE PAGINATION)
// ✅ Non-breaking: agar ?limit= nahi bheja gaya to purana full-array response hi milega
// ======================================================
const getProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 0; // 0 = legacy mode (cap 50; admin 20 bhejta hai)
    const sort = String(req.query.sort || "newest");

    // ---- Filter build ----
    // ✅ Shared helper — same filter summary stats endpoint (/products/stats) bhi use karta hai.
    const { filter } = await buildProductFilter(req.query);
    // ✅ Shop facets (storefront) + BundleCard ids — legacy callers inhe bhejte hi nahi
    const shop = parseShopParams(req.query);
    if (shop.ids.length) {
      filter._id = { $in: shop.ids };
    } else if (shop.hasShopFilters) {
      const facetIds = await applyShopFacets(filter, shop);
      filter._id = { $in: facetIds && facetIds.length ? facetIds : [new mongoose.Types.ObjectId()] };
    }

    const isPriceSort = sort === "price-asc" || sort === "price-desc";
    // ✅ Best-offers tab — engine-identical discount % ke hisaab se desc
    const isDiscountSort = sort === "discount-desc";
    // ✅ Sirf Featured Products page ye sort bhejta hai (?sort=featured-recent).
    //    Baaki sab callers ke liye PRODUCT_LIST_SORT wala purana order same rehta hai.
    const isFeaturedRecent = sort === "featured-recent";
    const listSort = isFeaturedRecent ? FEATURED_RECENT_SORT : PRODUCT_LIST_SORT;

    // ---- LEGACY MODE (no limit) → exact old behavior ----
    if (!limit) {
      const products = await Product.find(filter)
        .populate("category_id", "name")
        .populate("brand_id", "name")
        .populate("tag_ids", "name")
        .populate("createdby", "name email")
        .populate("updatedby", "name email")
        .sort(listSort)
        .lean();

      if (!products.length) return res.status(200).json([]);

      const variants = await Variant.find({
        product_id: { $in: products.map((p) => p._id) },
        is_deleted: { $ne: true },
        // ✅ _id tie-break taake [0] hamesha agg $first jaisa ho
      }).sort({ created_at: 1, _id: 1 }).lean();

      const variantsMap = {};
      variants.forEach((v) => {
        const pid = String(v.product_id);
        (variantsMap[pid] = variantsMap[pid] || []).push(v);
      });

      const result = products.map((p) => ({
        ...p,
        variants: variantsMap[String(p._id)] || [],
        price: Number((variantsMap[String(p._id)] || [])[0]?.selling_price) || 0,
      }));

      return res.status(200).json(result);
    }

    // ---- PAGINATED MODE ----
    const total = await Product.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const skip = (safePage - 1) * limit;

    // ✅ API OPTIMIZATION: Summary stats ki heavy aggregation ab list request se
    //     hata di gayi hai — stat cards apne dedicated endpoint (/products/stats) se
    //     load hote hain, taake list fast rahe aur table/summary dono independent ho jayein.
    //     Backward compatibility: ?include_stats=1 bhejne par stats pehle ki tarah
    //     isi response mein bhi mil jayenge.
    const stats = String(req.query.include_stats || "") === "1" ? await computeProductStats(filter, total) : null;

    let pageIds = [];

    if (isDiscountSort) {
      // ✅ Discount % desc — % sab matched products par compute hota hai (engine parity)
      const matched = await Product.find(filter).select("category_id brand_id").lean();
      const docMap = new Map(matched.map((d) => [String(d._id), d]));
      const midList = matched.map((d) => d._id);
      const stats = await variantStatsMap(midList);
      const discounts = await activePublicDiscounts();
      const scored = midList
        .map((id) => {
          const pid = String(id);
          const doc = docMap.get(pid);
          const price = stats.get(pid)?.price || 0;
          const cid = String(doc?.category_id?._id || doc?.category_id || "");
          const bid = String(doc?.brand_id?._id || doc?.brand_id || "");
          return { id, pct: discountPercentFor(price, pid, cid, bid, discounts) };
        })
        .filter((s) => (shop.minDiscountBand !== null ? s.pct >= shop.minDiscountBand : true));
      // ✅ Deterministic order (_id tie-break)
      scored.sort((a, b) => b.pct - a.pct || (String(a.id) < String(b.id) ? -1 : 1));
      // ✅ total/safePage isi sorted set par (filter count nahi)
      const dTotal = scored.length;
      const dPages = Math.max(1, Math.ceil(dTotal / limit));
      const dSafe = Math.min(page, dPages);
      pageIds = scored.slice((dSafe - 1) * limit, dSafe * limit).map((s) => s.id);
      const dProducts = pageIds.length
        ? await Product.find({ _id: { $in: pageIds } })
            .populate("category_id", "name")
            .populate("brand_id", "name")
            .populate("tag_ids", "name")
            .populate("createdby", "name email")
            .populate("updatedby", "name email")
            .lean()
        : [];
      const dOrder = new Map(pageIds.map((id, i) => [String(id), i]));
      dProducts.sort((a, b) => dOrder.get(String(a._id)) - dOrder.get(String(b._id)));
      const dVariants = await Variant.find({
        product_id: { $in: pageIds },
        is_deleted: { $ne: true },
      })
        .sort({ created_at: 1, _id: 1 })
        .lean();
      const dMap = {};
      dVariants.forEach((v) => {
        const pid = String(v.product_id);
        (dMap[pid] = dMap[pid] || []).push(v);
      });
      return res.status(200).json({
        products: dProducts.map((p) => ({
          ...p,
          variants: dMap[String(p._id)] || [],
          price: Number((dMap[String(p._id)] || [])[0]?.selling_price) || 0,
        })),
        pagination: {
          total: dTotal,
          page: dSafe,
          limit,
          pages: dPages,
          hasNext: dSafe < dPages,
          hasPrev: dSafe > 1,
        },
      });
    }

    if (isPriceSort) {
      // ✅ Base order deterministic (_id tie-break) — JS sort stable hai, is liye
      //    equal price wale products bhi har request par same order me rahenge.
      const idDocs = await Product.find(filter).select("_id").sort(listSort).lean();
      const ids = idDocs.map((d) => d._id);
      if (ids.length) {
        const priceDocs = await Variant.aggregate([
          { $match: { is_deleted: { $ne: true }, product_id: { $in: ids } } },
          { $sort: { created_at: 1, _id: 1 } },
          { $group: { _id: "$product_id", p: { $first: "$selling_price" } } },
        ]);
        const priceMap = new Map(priceDocs.map((d) => [String(d._id), Number(d.p) || 0]));
        // ✅ Price sort bhi FINAL (discounted) price par — filter se consistency.
        const sortRefs = await productRefsMap(ids);
        const sortDiscounts = await activePublicDiscounts();
        const sortDiscountIdx = buildDiscountIndex(sortDiscounts);
        const finalOf = (id) => {
          const pid = String(id);
          const price = priceMap.get(pid) || 0;
          const refs = sortRefs.get(pid) || { cid: "", bid: "" };
          return finalPriceIndexed(price, pid, refs.cid, refs.bid, sortDiscountIdx);
        };
        ids.sort((a, b) => {
          const pa = finalOf(a);
          const pb = finalOf(b);
          return sort === "price-asc" ? pa - pb : pb - pa;
        });
        pageIds = ids.slice(skip, skip + limit);
      }
    } else {
      // ✅ Pages overlap na hon — is liye same deterministic total order + _id tie-break.
      const idDocs = await Product.find(filter)
        .select("_id")
        .sort(listSort)
        .skip(skip)
        .limit(limit)
        .lean();
      pageIds = idDocs.map((d) => d._id);
    }

    if (!pageIds.length) {
      return res.status(200).json({
        products: [],
        ...(stats ? { stats } : {}),
        pagination: { total, page: safePage, limit, pages, hasNext: false, hasPrev: safePage > 1 },
      });
    }

    const products = await Product.find({ _id: { $in: pageIds } })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .populate("tag_ids", "name")
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    // page order preserve karo
    const orderMap = new Map(pageIds.map((id, i) => [String(id), i]));
    products.sort((a, b) => orderMap.get(String(a._id)) - orderMap.get(String(b._id)));

    const variants = await Variant.find({
      product_id: { $in: pageIds },
      is_deleted: { $ne: true },
    }).sort({ created_at: 1, _id: 1 }).lean();

    const variantsMap = {};
    variants.forEach((v) => {
      const pid = String(v.product_id);
      (variantsMap[pid] = variantsMap[pid] || []).push(v);
    });

    const result = products.map((p) => ({
      ...p,
      variants: variantsMap[String(p._id)] || [],
      price: Number((variantsMap[String(p._id)] || [])[0]?.selling_price) || 0,
    }));

    return res.status(200).json({
      products: result,
      ...(stats ? { stats } : {}),
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    console.error(" [getProducts] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to fetch products" });
  }
};
// ======================================================
// GET PRODUCT SUMMARY STATS (stat cards ke liye)
// ✅ Products list se ALAG endpoint — table aur summary cards independently
//     load/refresh hote hain (ek doosre ko block nahi karte).
// ✅ Same filters support karta hai: search / category_id / brand_id / status
// ✅ Response: { success: true, stats: { totalProducts, activeProducts, inactiveProducts, totalVariants, totalStock } }
// ======================================================
const getProductStats = async (req, res) => {
  try {
    const { filter } = await buildProductFilter(req.query);
    const stats = await computeProductStats(filter);
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error("❌ [getProductStats] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to fetch product stats" });
  }
};
// ======================================================
// 🛍️ SHOP FACETS (storefront sidebar + counts)
// Same filter params as grid; leave-one-out per group (client parity):
// stock/discount/deals apne group ko exclude karke, categories/brands/bounds global.
// ======================================================
const DISCOUNT_BANDS = [10, 20, 30, 50];

const getProductFacets = async (req, res) => {
  try {
    const { filter } = await buildProductFilter(req.query);
    const shop = parseShopParams(req.query);

    // ✅ GLOBAL groups (client parity — full catalog, no filters)
    const globalBase = { is_deleted: { $ne: true } };
    const [catGroups, brandGroups, allIdsDocs, categories] = await Promise.all([
      Product.aggregate([
        { $match: globalBase },
        { $group: { _id: "$category_id", count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: globalBase },
        { $group: { _id: "$brand_id", count: { $sum: 1 } } },
      ]),
      Product.find(globalBase).select("_id").lean(),
      Category.find({ is_deleted: false }).select("_id parent_category_id").lean(),
    ]);
    const allIds = allIdsDocs.map((d) => d._id);
    const globalStats = await variantStatsMap(allIds);
    // ✅ Bounds FINAL (discounted) price par — neeche discounts load hone ke
    // baad compute hota hai (globalRefs + globalDiscountIdx se).
    // ✅ Subtree sums (client getCategorySubtreeCounts parity)
    const directCat = new Map(catGroups.map((g) => [String(g._id), g.count]));
    const childrenOf = new Map();
    categories.forEach((c) => {
      const pid = String(c.parent_category_id?._id || c.parent_category_id || "");
      if (!pid) return;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(String(c._id));
    });
    const subtreeCount = (id, seen = new Set()) => {
      if (seen.has(id)) return 0;
      seen.add(id);
      let sum = directCat.get(id) || 0;
      (childrenOf.get(id) || []).forEach((child) => {
        sum += subtreeCount(child, seen);
      });
      return sum;
    };
    const categoryCounts = categories.map((c) => ({
      _id: c._id,
      count: subtreeCount(String(c._id)),
    }));
    const brandCounts = brandGroups.map((g) => ({ _id: g._id, count: g.count }));

    // ✅ Shared pieces (ek baar fetch) + indexed counting (single pass)
    const baseIdDocs = await Product.find(filter).select("_id").lean();
    const baseIds = baseIdDocs.map((d) => d._id);
    const [statsAll, refsAll, discountDocs, activeDeals] = await Promise.all([
      variantStatsMap(baseIds),
      productRefsMap(baseIds),
      activePublicDiscounts(),
      allActiveDeals(),
    ]);
    const pre = { stats: statsAll, refsMap: refsAll, discountDocs, dealDocs: activeDeals };
    const discountIdx = buildDiscountIndex(discountDocs);
    const dealIdx = buildDealIndex(activeDeals);

    // ✅ Global bounds — FINAL price ka min/max (discount ke baad wali qeemat).
    // Koi discount na ho to original hi final hai.
    let bounds = { min: 0, max: 0 };
    {
      const globalRefs = await productRefsMap(allIds);
      let lo = Infinity;
      let hi = 0;
      globalStats.forEach(({ price }, key) => {
        if (!(price > 0)) return;
        const refs = globalRefs.get(String(key)) || { cid: "", bid: "" };
        const final = finalPriceIndexed(price, String(key), refs.cid, refs.bid, discountIdx);
        if (!(final > 0)) return;
        if (final < lo) lo = final;
        if (final > hi) hi = final;
      });
      if (hi > 0) bounds = { min: Math.floor(lo), max: Math.ceil(hi) };
    }

    // ✅ Grid total (saare filters)
    const totalIds = await applyShopFacets(filter, shop, null, pre);
    const total = totalIds === null ? await Product.countDocuments(filter) : totalIds.length;

    // ✅ LEAVE-ONE-OUT groups (baaki filters applied)
    const looIds = async (exclude) => {
      const ids = await applyShopFacets(filter, shop, exclude, pre);
      return ids !== null ? ids : baseIds;
    };
    const [stockIds, discountIds, dealIds] = await Promise.all([
      looIds("stock"),
      looIds("discount"),
      looIds("deal"),
    ]);

    const stock = [
      { id: "in", count: 0 },
      { id: "low", count: 0 },
      { id: "out", count: 0 },
    ];
    stockIds.forEach((id) => {
      const state = stockStateOf(statsAll.get(String(id))?.stock || 0);
      stock.find((s) => s.id === state).count += 1;
    });

    const bandCounts = DISCOUNT_BANDS.map((band) => ({ band, count: 0 }));
    discountIds.forEach((id) => {
      const pid = String(id);
      const price = statsAll.get(pid)?.price || 0;
      const refs = refsAll.get(pid) || { cid: "", bid: "" };
      const pct = discountPctIndexed(price, pid, refs.cid, refs.bid, discountIdx);
      bandCounts.forEach((b) => {
        if (pct >= b.band) b.count += 1;
      });
    });

    // ✅ Per-deal counts — single pass (candidates only)
    const dealHits = new Map(activeDeals.map((d) => [String(d._id), 0]));
    dealIds.forEach((id) => {
      const pid = String(id);
      const refs = refsAll.get(pid) || { cid: "", bid: "" };
      matchingDealsIndexed(dealIdx, pid, refs.cid, refs.bid).forEach((deal) => {
        const key = String(deal._id);
        dealHits.set(key, (dealHits.get(key) || 0) + 1);
      });
    });
    const deals = activeDeals.map((deal) => ({ _id: deal._id, count: dealHits.get(String(deal._id)) || 0 }));

    return res.status(200).json({
      success: true,
      total,
      bounds,
      categories: categoryCounts,
      // ✅ Direct (non-subtree) counts — nav sorting parity ke liye
      categoryDirect: catGroups.map((g) => ({ _id: g._id, count: g.count })),
      brands: brandCounts,
      stock,
      discounts: bandCounts,
      deals,
    });
  } catch (error) {
    console.error("❌ [getProductFacets] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch facets" });
  }
};

// ======================================================
// 🛍️ CATEGORY TILES (PopularCategories + HomeCategories)
// Top-level categories: count + fromPrice + sample image. Sirf limit tak.
// ======================================================
const getCategoryTiles = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 12;
    const categories = await Category.find({ is_deleted: false })
      .select("name description parent_category_id sort_order")
      .sort({ sort_order: 1, name: 1 })
      .lean();
    const isTop = (c) => !c.parent_category_id;
    const topCats = categories.filter(isTop);
    if (!topCats.length) return res.status(200).json({ success: true, data: [] });

    const childrenOf = new Map();
    categories.forEach((c) => {
      const pid = String(c.parent_category_id?._id || c.parent_category_id || "");
      if (!pid) return;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(String(c._id));
    });
    const subtreeOf = (id) => {
      const set = new Set([String(id)]);
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

    const subtrees = new Map(topCats.map((c) => [String(c._id), subtreeOf(c._id)]));
    const allSubIds = [...new Set([...subtrees.values()].flat())];
    const [directGroups, recent] = await Promise.all([
      Product.aggregate([
        { $match: { is_deleted: { $ne: true }, category_id: { $in: allSubIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: "$category_id", count: { $sum: 1 } } },
      ]),
      Product.find({ is_deleted: { $ne: true }, category_id: { $in: allSubIds } })
        .select("category_id")
        .sort({ created_at: -1 })
        .limit(200)
        .lean(),
    ]);
    const directMap = new Map(directGroups.map((g) => [String(g._id), g.count]));
    const recentVariantMap = new Map();
    if (recent.length) {
      const vs = await Variant.find({
        product_id: { $in: recent.map((p) => p._id) },
        is_deleted: { $ne: true },
      })
        .select("product_id images")
        .lean();
      vs.forEach((v) => {
        const pid = String(v.product_id);
        if (!recentVariantMap.has(pid) && v.images?.length) {
          recentVariantMap.set(pid, v.images[0]?.img_url || null);
        }
      });
    }

    const tiles = topCats
      .map((c) => {
        const sub = subtrees.get(String(c._id)) || [];
        let count = 0;
        sub.forEach((sid) => {
          count += directMap.get(sid) || 0;
        });
        return { ...c, count, fromPrice: 0, image: null, _sub: sub };
      })
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)))
      .slice(0, limit);

    // ✅ fromPrice + image (tiles tak mehdood — bounded queries)
    for (const t of tiles) {
      const inSub = await Product.find({
        is_deleted: { $ne: true },
        category_id: { $in: t._sub },
      })
        .select("_id")
        .lean();
      const pstats = await variantStatsMap(inSub.map((p) => p._id));
      let lo = Infinity;
      pstats.forEach(({ price }) => {
        if (price > 0 && price < lo) lo = price;
      });
      t.fromPrice = lo === Infinity ? 0 : Math.round(lo);
      const cand = recent.find(
        (p) => t._sub.includes(String(p.category_id?._id || p.category_id)) && recentVariantMap.has(String(p._id)),
      );
      t.image = cand ? recentVariantMap.get(String(cand._id)) : null;
      delete t._sub;
    }

    return res.status(200).json({ success: true, data: tiles });
  } catch (error) {
    console.error("❌ [getCategoryTiles] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch category tiles" });
  }
};

// ======================================================
// GET PRODUCT BY ID
// ======================================================
const getProductById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    })
      .populate("category_id", "name category_code description is_active")
      .populate("brand_id", "name brand_code description country is_active logo")
      .populate("tag_ids", "name")
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // ⭐ Populate audit users so the Activity tab can show WHO created /
    // updated each variant by name (instead of a raw ObjectId).
    const variants = await Variant.find({
      product_id: product._id,
      is_deleted: { $ne: true },
    })
      .sort({ created_at: 1 })
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    // ⭐ LEGACY TAG HEALING: variant tags used to be saved as plain strings
    // without a Tag document, so the Tags tab showed "—" for Created By.
    // Create any missing Tag docs, attributing them to the user who last
    // updated the variant (most plausible assigner).
    try {
      const tagCreatorByName = new Map();
      // Audit users are populated objects now, so unwrap the id before it is
      // stored as a Tag's createdby (otherwise Mongoose casting fails).
      const auditUserId = (user) =>
        (user && typeof user === "object" ? user._id : user) || null;
      variants.forEach(v => {
        (Array.isArray(v.tags) ? v.tags : []).forEach(t => {
          const name = String(t || "").trim().toLowerCase();
          if (name && !tagCreatorByName.has(name)) {
            tagCreatorByName.set(
              name,
              auditUserId(v.updatedby) || auditUserId(v.createdby)
            );
          }
        });
      });

      if (tagCreatorByName.size > 0) {
        const nameRegexes = [...tagCreatorByName.keys()].map(n => new RegExp(`^${escapeRegex(n)}$`, "i"));
        const existingTagDocs = await Tag.find({ name: { $in: nameRegexes } }).select("name").lean();
        const existingLowerNames = new Set(existingTagDocs.map(t => String(t.name).trim().toLowerCase()));

        for (const [lowerName, creator] of tagCreatorByName) {
          if (existingLowerNames.has(lowerName)) continue;
          try {
            await Tag.create({ name: lowerName, createdby: creator, updatedby: creator });
          } catch (createErr) {
            // Unique index race (tag created concurrently) — safe to ignore
          }
        }
      }
    } catch (healErr) {
      console.error("⚠️ [getProductById] Variant tag healing skipped:", healErr?.message || healErr);
    }

    // ⭐ Rating summary — for the stars + count on the detail page (reviews come from a separate endpoint)
    let ratingSummary = { avg: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    try {
      const Review = require("../models/Review");
      const ratings = await Review.find({
        product_id: product._id,
        status: "active",
        is_deleted: { $ne: true },
      })
        .select("rating")
        .lean();
      let sum = 0;
      ratings.forEach((r) => {
        const rating = Number(r.rating) || 0;
        sum += rating;
        if (ratingSummary.distribution[rating] !== undefined) ratingSummary.distribution[rating] += 1;
      });
      ratingSummary.count = ratings.length;
      ratingSummary.avg = ratings.length ? Math.round((sum / ratings.length) * 10) / 10 : 0;
    } catch (summaryErr) {
      console.error("⚠️ [getProductById] Rating summary skipped:", summaryErr?.message || summaryErr);
    }

    return res.status(200).json({
      ...product,
      variants,
      ratingSummary,
    });
  } catch (error) {
    console.error("❌ [getProductById] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch product",
    });
  }
};

// ======================================================
// CREATE PRODUCT
// ======================================================
const createProduct = async (req, res) => {
  let createdProduct = null;

  try {
    const productName = String(req.body.name || "").trim();

    if (!productName) {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (!req.body.category_id) {
      return res.status(400).json({ message: "Category is required" });
    }

    if (!req.body.brand_id) {
      return res.status(400).json({ message: "Brand is required" });
    }

    const variants = parseJSON(req.body.variants, []);

    // Variants are optional — can be empty (will be created later from Product Detail)
    // if (!Array.isArray(variants) || !variants.length) {
    //   return res.status(400).json({ message: "At least one variant is required" });
    // }

    const tagNames = parseJSON(req.body.tag_names, []);
    const tagIds = await resolveTags(tagNames, req.user?._id);

    // ✅ Validate and process specifications
    let specifications = {};
    if (req.body.specifications) {
      try {
        const rawSpecs = typeof req.body.specifications === 'string' 
          ? JSON.parse(req.body.specifications) 
          : req.body.specifications;
        
        specifications = await validateSpecifications(
          req.body.category_id,
          rawSpecs,
          req.user?.tenant_id
        );
      } catch (error) {
        return res.status(400).json({ message: error.message || "Invalid specifications" });
      }
    }

    const productData = {
      name: productName,
      category_id: req.body.category_id,
      brand_id: req.body.brand_id,
      tag_ids: tagIds,
      specifications,
      description: String(req.body.description || "").trim(),
      tax: toNumber(req.body.tax, 0),
      status: req.body.status === "inactive" ? "inactive" : "active",
      // ✅ Featured — create form se bhi mark ho sakta hai (default false)
      is_featured: req.body.is_featured === true,
      createdby: req.user?._id || null,
      updatedby: null,
      is_deleted: false,
      deleted_at: null,
      deletedby: null,
    };

    if (req.productId) {
      productData._id = req.productId;
    }

    createdProduct = await Product.create(productData);

    const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);
    const imagesByVariant = {};

    (req.savedImages || []).forEach((image, fileIndex) => {
      const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
      if (!imagesByVariant[variantIndex]) {
        imagesByVariant[variantIndex] = [];
      }
      imagesByVariant[variantIndex].push(image);
    });

    const createdVariants = [];
    const usedSkus = new Set();

    for (let index = 0; index < variants.length; index++) {
      const item = variants[index] || {};
      let sku = normalizeSku(item.sku);

      if (!sku) {
        sku = await getNextSku();
      }

      const skuKey = sku.toLowerCase();

      if (usedSkus.has(skuKey)) {
        throw new Error(`Duplicate SKU in request: ${sku}`);
      }

      const existingSku = await Variant.findOne({
        sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
      }).lean();

      if (existingSku) {
        throw new Error(`SKU ${sku} already exists`);
      }

      usedSkus.add(skuKey);

      const variantTags = Array.isArray(item.tags) ? item.tags : [];
      if (variantTags.length > 0) {
        // Ensure Tag docs exist so Created By is tracked for variant tags too
        await resolveTags(variantTags, req.user?._id);
      }

      const variant = await Variant.create({
        product_id: createdProduct._id,
        sku,
        title: item.title || item.variant_title || sku,
        description: item.description || "",
        cost_price: toNumber(item.cost_price, 0),
        selling_price: toNumber(item.selling_price, 0),
        // ✅ Variant stock sirf whole units (decimal point truncate)
        quantity: Math.trunc(toNumber(item.quantity, 0)),
        min_qnt: toNumber(item.min_qnt, 0),
        max_qnt: toNumber(item.max_qnt, 0),
        attributes: item.option_values || item.attributes || {},
        tags: variantTags,
        images: imagesByVariant[index] || [],
        createdby: req.user?._id || null,
        updatedby: req.user?._id || null,
      });

      createdVariants.push(variant);
    }

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} created product "${createdProduct.name}"`,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: {
          productId: createdProduct._id,
          variantCount: createdVariants.length,
          tagCount: tagIds.length,
        },
      },
      performerId
    );

    const populatedProduct = await Product.findById(createdProduct._id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    emitSocketEvent("productCreated", {
      _id: createdProduct._id,
      name: createdProduct.name,
      tag_ids: createdProduct.tag_ids,
      variants: createdVariants,
      createdby: populatedProduct?.createdby || null,
      updatedby: populatedProduct?.updatedby || null,
      created_at: populatedProduct?.created_at || createdProduct.created_at,
      updated_at: populatedProduct?.updated_at || createdProduct.updated_at,
    });

    return res.status(201).json({
      message: "Product created successfully",
      product: createdProduct,
      variants: createdVariants,
    });
  } catch (error) {
    console.error("❌ [createProduct] Error:", error);

    if (createdProduct) {
      await Variant.deleteMany({ product_id: createdProduct._id }).catch(() => {});
      await Product.findByIdAndDelete(createdProduct._id).catch(() => {});
      await deleteProductUploadFolder(createdProduct._id).catch(() => {});
    }

    return res.status(400).json({
      message: error.message || "Failed to create product",
    });
  }
};

// ======================================================
// UPDATE PRODUCT
// ======================================================
const updateProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ message: "Product name is required" });
      }
      product.name = name;
    }

    if (req.body.category_id !== undefined) {
      if (!req.body.category_id) {
        return res.status(400).json({ message: "Category is required" });
      }
      product.category_id = req.body.category_id;
    }

    if (req.body.brand_id !== undefined) {
      if (!req.body.brand_id) {
        return res.status(400).json({ message: "Brand is required" });
      }
      product.brand_id = req.body.brand_id;
    }

    if (req.body.tag_names !== undefined) {
      const tagNames = parseJSON(req.body.tag_names, []);
      const tagIds = await resolveTags(tagNames, req.user?._id);
      // ✅ FIX: Tags wahi hain to product ko "modified" mark na karo, warna
      // sirf Save dabane par bhi "Product Updated" event ban jata tha.
      if (!isSameList(product.tag_ids, tagIds)) {
        product.tag_ids = tagIds;
      }
    }

    // ✅ Update specifications
    if (req.body.specifications !== undefined) {
      try {
        const rawSpecs = typeof req.body.specifications === 'string' 
          ? JSON.parse(req.body.specifications) 
          : req.body.specifications;
        
        const nextSpecifications = await validateSpecifications(
          product.category_id,
          rawSpecs,
          req.user?.tenant_id
        );
        // ✅ FIX: Specifications same hain to "modified" mark na karo
        if (!isSameValue(product.specifications, nextSpecifications)) {
          product.specifications = nextSpecifications;
        }
      } catch (error) {
        return res.status(400).json({ message: error.message || "Invalid specifications" });
      }
    }

    if (req.body.description !== undefined) {
      product.description = String(req.body.description || "").trim();
    }

    if (req.body.tax !== undefined) {
      product.tax = toNumber(req.body.tax, 0);
    }

    if (req.body.status !== undefined) {
      product.status = req.body.status === "inactive" ? "inactive" : "active";
    }

    if (req.body.is_featured !== undefined) {
      product.is_featured = req.body.is_featured === true;
    }

    // ✅ FIX (ROOT CAUSE): Product ke audit fields (updated_at / updatedby) sirf
    // tab update hote hain jab product-level field waqai badla ho. Pehle ye
    // unconditional tha, is liye "Add variant" / "Edit variant" page (jo
    // PUT /products/:id call karta hai) product ka updated_at + updatedby bump kar
    // deta tha aur Activity timeline mein ghalat "Product Updated" event +
    // Overview tab mein "Updated By" card aa jata tha, halanke product mein kuch
    // bhi nahi badla hota tha.
    const productActuallyChanged = product.isModified();

    if (productActuallyChanged) {
      product.updatedby = req.user?._id || null;
      await product.save();
    }

    const variants = parseJSON(req.body.variants, null);
    let addedVariantCount = 0;
    let updatedVariantCount = 0;

    if (Array.isArray(variants)) {
      const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);
      const imagesByVariant = {};

      (req.savedImages || []).forEach((image, fileIndex) => {
        const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
        if (!imagesByVariant[variantIndex]) {
          imagesByVariant[variantIndex] = [];
        }
        imagesByVariant[variantIndex].push(image);
      });

      const existingVariants = await Variant.find({
        product_id: product._id,
        is_deleted: { $ne: true },
      });

      const existingVariantMap = new Map();
      existingVariants.forEach((variant) => {
        existingVariantMap.set(String(variant._id), variant);
      });

      for (let index = 0; index < variants.length; index++) {
        const item = variants[index] || {};

        if (item._id) {
          const variantId = String(item._id);
          const variant = existingVariantMap.get(variantId);

          if (!variant) {
            return res.status(400).json({
              message: "Invalid variant or variant does not belong to this product",
            });
          }

          if (item.sku !== undefined) {
            const sku = normalizeSku(item.sku);
            if (!sku) {
              return res.status(400).json({ message: "Variant SKU is required" });
            }

            const duplicateSku = await Variant.findOne({
              _id: { $ne: variant._id },
              sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
            }).lean();

            if (duplicateSku) {
              return res.status(400).json({ message: `SKU ${sku} already exists` });
            }
            variant.sku = sku;
          }

          if (item.title !== undefined || item.variant_title !== undefined) {
            variant.title = item.title || item.variant_title || variant.sku;
          }

          if (item.description !== undefined) {
            variant.description = item.description;
          }

          if (item.cost_price !== undefined) {
            variant.cost_price = toNumber(item.cost_price, 0);
          }

          if (item.selling_price !== undefined) {
            variant.selling_price = toNumber(item.selling_price, 0);
          }

          if (item.quantity !== undefined) {
            // ✅ Stock whole units mein hi rakhein (0.09 jaise decimals na aayein)
            variant.quantity = Math.trunc(toNumber(item.quantity, 0));
          }

          if (item.min_qnt !== undefined) {
            variant.min_qnt = toNumber(item.min_qnt, 0);
          }

          if (item.max_qnt !== undefined) {
            variant.max_qnt = toNumber(item.max_qnt, 0);
          }

          if (item.option_values !== undefined || item.attributes !== undefined) {
            const nextAttributes = item.option_values || item.attributes || {};
            // ✅ FIX: same attributes dobara assign karne se variant "modified" ho
            // jata tha -> ghalat "Variant Updated" event
            if (!isSameValue(variant.attributes ?? {}, nextAttributes)) {
              variant.attributes = nextAttributes;
            }
          }

          if (item.tags !== undefined) {
            const variantTagList = Array.isArray(item.tags) ? item.tags : [];
            if (variantTagList.length > 0) {
              // Ensure Tag docs exist so Created By is tracked for variant tags too
              await resolveTags(variantTagList, req.user?._id);
            }
            // ✅ FIX: tags waqai badle hon to hi assign karo
            if (!isSameList(variant.tags, variantTagList)) {
              variant.tags = variantTagList;
            }
          }

          if (item.status !== undefined) {
            variant.status = item.status === "inactive" ? "inactive" : "active";
          }

          // ✅ FIX: Variant image removal ab save par persist hoti hai.
          // Frontend existing_images (bachi hui images ke objects) bhejta hai —
          // purani images jo is list mein NAHI hain = user ne remove ki hui, unhe hatao.
          // Nayi uploaded files (imagesByVariant[index]) remaining ke saath append karo.
          // NOTE: Agar existing_images field hi na bheji ho (e.g. tag-only updates),
          // to purana append behavior rakha gaya hai — koi accidental image loss nahi.
          if (Array.isArray(item.existing_images)) {
            const keptUrls = new Set(
              item.existing_images
                .map((img) => (typeof img === "string" ? img : img?.img_url))
                .filter(Boolean)
                .map(String)
            );
            const oldImages = Array.isArray(variant.images) ? variant.images : [];
            const remaining = oldImages.filter((img) => keptUrls.has(String(img?.img_url)));
            const nextImages = imagesByVariant[index]
              ? [...remaining, ...imagesByVariant[index]]
              : remaining;
            // ✅ FIX: image list same hai to naya array assign na karo (warna
            // variant "modified" ho kar ghalat "Variant Updated" event ban jata tha)
            if (
              !isSameValue(
                oldImages.map((img) => String(img?.img_url)),
                nextImages.map((img) => String(img?.img_url))
              )
            ) {
              variant.images = nextImages;
            }
          } else if (imagesByVariant[index]) {
            const oldImages = Array.isArray(variant.images) ? variant.images : [];
            variant.images = [...oldImages, ...imagesByVariant[index]];
          }

          // ✅ FIX: Variant ke audit fields sirf tab update karo jab kuch waqai
          // badla ho — warna "Edit variant" page khol kar bina kuch badle Save
          // karne par bhi Activity timeline mein "Variant Updated" aa jata tha.
          if (variant.isModified()) {
            variant.updatedby = req.user?._id || null;
            await variant.save();
            updatedVariantCount += 1;
          }
        } else {
          let sku = normalizeSku(item.sku);
          if (!sku) {
            sku = await getNextSku();
          }

          const duplicateSku = await Variant.findOne({
            sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
          }).lean();

          if (duplicateSku) {
            return res.status(400).json({ message: `SKU ${sku} already exists` });
          }

          const newVariantTags = Array.isArray(item.tags) ? item.tags : [];
          if (newVariantTags.length > 0) {
            // Ensure Tag docs exist so Created By is tracked for variant tags too
            await resolveTags(newVariantTags, req.user?._id);
          }

          await Variant.create({
            product_id: product._id,
            sku,
            title: item.title || item.variant_title || sku,
            description: item.description || "",
            cost_price: toNumber(item.cost_price, 0),
            selling_price: toNumber(item.selling_price, 0),
            // ✅ Variant stock sirf whole units (decimal point truncate)
            quantity: Math.trunc(toNumber(item.quantity, 0)),
            min_qnt: toNumber(item.min_qnt, 0),
            max_qnt: toNumber(item.max_qnt, 0),
            attributes: item.option_values || item.attributes || {},
            tags: newVariantTags,
            status: item.status === "inactive" ? "inactive" : "active",
            images: imagesByVariant[index] || [],
            createdby: req.user?._id || null,
            updatedby: req.user?._id || null,
          });
          addedVariantCount += 1;
        }
      }

      // ✅ Live stock sync — product edit se variant quantity change hone par manage-stock
      //    page socket se refresh ho jata hai (manual page refresh ki zaroorat nahi).
      if (Array.isArray(variants) && variants.some((v) => v && Object.prototype.hasOwnProperty.call(v, "quantity"))) {
        emitSocketEvent("stockUpdated", {
          product_id: product._id,
          source: "product_variant_update",
        });
      }

      // ⚠️ REMOVED (bug fix): Pehle yahan "jo variants payload mein nahi aaye unhe
      // is_deleted = true karke save kar do" wala soft-delete loop tha. Variant
      // model mein `is_deleted` / `deleted_at` fields maujood hi nahi hain, is liye:
      //   • variant delete hota kuch bhi nahi tha (is_deleted silently ignore),
      //   • magar `deletedby` (jo schema mein hai) mark modified ho jata tha aur
      //     save() har bache hue variant ka `updated_at` bump kar deta tha —
      //     nateeja: Activity timeline mein un variants ka ghalat "Variant Updated"
      //     event, aur live variant par dangling `deletedby` audit value.
      // (Add/Edit variant page sirf apna variant bhejta hai, is liye ye loop har
      // baar baaki sab variants ko "delete" karne ki koshish karta tha.)
      // Variant delete karne ka official rasta: DELETE /variants/:id
      // (frontend: variantApi.delete) — wo hard delete karta hai aur images bhi
      // remove karta hai.
      // NOTE: Future mein agar soft-delete chahiye to pehle Variant schema mein
      // is_deleted/deleted_at add karo aur add-variant page ko saare variants
      // (purane + naya) bhejne ke liye update karo, warna baaki variants delete
      // ho jayenge.
    }

    const updatedVariants = await Variant.find({
      product_id: product._id,
      is_deleted: { $ne: true },
    })
      .sort({ created_at: 1 })
      .lean();

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    // ✅ FIX: Activity feed ka message sach bole. Sirf variant change par
    // "updated product" likhna misleading tha (aur audit trail bhi ghalat lagta tha).
    const variantChangeSummary = [
      addedVariantCount > 0
        ? `${addedVariantCount} variant${addedVariantCount > 1 ? "s" : ""} added`
        : "",
      updatedVariantCount > 0
        ? `${updatedVariantCount} variant${updatedVariantCount > 1 ? "s" : ""} updated`
        : "",
    ]
      .filter(Boolean)
      .join(" & ");

    const actionMessage =
      !productActuallyChanged && variantChangeSummary
        ? `${performerName} ${variantChangeSummary} in product "${product.name}"`
        : `${performerName} updated product "${product.name}"`;

    await pushGlobalActivity(
      io,
      {
        action: actionMessage,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: {
          productId: product._id,
          variantCount: updatedVariants.length,
          addedVariants: addedVariantCount,
          changedVariants: updatedVariantCount,
          tagCount: product.tag_ids ? product.tag_ids.length : 0,
        },
      },
      performerId
    );

    const populatedProduct = await Product.findById(product._id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    emitSocketEvent("productUpdated", {
      _id: product._id,
      name: product.name,
      status: product.status,
      tag_ids: product.tag_ids,
      variants: updatedVariants,
      createdby: populatedProduct?.createdby || null,
      updatedby: populatedProduct?.updatedby || null,
      created_at: populatedProduct?.created_at,
      updated_at: populatedProduct?.updated_at,
    });

    return res.status(200).json({
      message: "Product updated successfully",
      product,
      variants: updatedVariants,
    });
  } catch (error) {
    console.error("❌ [updateProduct] Error:", error);
    return res.status(400).json({
      message: error.message || "Failed to update product",
    });
  }
};

// ======================================================
// DELETE PRODUCT
// ======================================================
const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.is_deleted = true;
    product.deleted_at = new Date();
    product.deletedby = req.user?._id || null;
    await product.save();

    await Variant.updateMany(
      {
        product_id: product._id,
        is_deleted: { $ne: true },
      },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
          deletedby: req.user?._id || null,
        },
      }
    );

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} deleted product "${product.name}"`,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: { productId: product._id },
      },
      performerId
    );

    emitSocketEvent("productDeleted", product._id);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("❌ [deleteProduct] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to delete product",
    });
  }
};

// ======================================================
// TOGGLE PRODUCT STATUS
// ======================================================
// ✅ PERFORMANCE FIX (activate/deactivate slow tha):
//    1) Pehle poora document load + validate + save hota tha → ab sirf status flip
//       ka ek ATOMIC update (aggregation pipeline) — 1 round-trip, zero validation.
//    2) Activity log + populated read + socket broadcast pehle RESPONSE bhejne se
//       pehle await hote the → ab background me (fire & forget) chalte hain,
//       is liye button ka response foran milta hai.
const toggleProductStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    // ✅ Sirf status flip ka atomic update (aggregation pipeline) — poora document
    //    load/validate/save nahi hota, is liye ek hi round-trip me response.
    //    "updatePipeline: true" ZAROORI hai (Mongoose >= 7), warna mongoose
    //    "Cannot pass an array to query updates..." error de kar 500 return karta hai.
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, is_deleted: { $ne: true } },
      [
        {
          $set: {
            status: {
              $cond: [
                { $eq: [{ $ifNull: ["$status", "active"] }, "active"] },
                "inactive",
                "active",
              ],
            },
            updatedby: req.user?._id || null,
            updated_at: new Date(),
          },
        },
      ],
      // "returnDocument: 'after'" (Mongoose 9 me 'new: true' deprecated hai)
      { returnDocument: "after", updatePipeline: true, runValidators: false }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Flip deterministic hai → naya status milte hi purana bhi pata hai
    // (listeners stats counts accurately adjust kar sakein)
    const previousStatus = product.status === "active" ? "inactive" : "active";

    // ✅ Client ko turant jawaab — UI turant update ho jaata hai
    res.status(200).json({
      message: `Product status updated to ${product.status}`,
      product,
    });

    // ---- Background task (await nahi hota → request latency par asar nahi) ----
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();
    const productId = product._id;
    const productName = product.name;
    const nextStatus = product.status;
    const tagIds = product.tag_ids;

    setImmediate(async () => {
      try {
        await pushGlobalActivity(
          io,
          {
            action: `${performerName} ${nextStatus === "active" ? "activated" : "deactivated"} product "${productName}"`,
            category: "Product Management",
            performedBy: performerId,
            performedByName: performerName,
            details: { productId, status: nextStatus },
          },
          performerId
        );
      } catch (activityErr) {
        console.error("⚠️ [toggleProductStatus] activity log failed:", activityErr?.message || activityErr);
      }

      try {
        const populatedProduct = await Product.findById(productId)
          .populate("createdby", "name email")
          .populate("updatedby", "name email")
          .lean();

        emitSocketEvent("productUpdated", {
          _id: productId,
          name: productName,
          status: nextStatus,
          previousStatus,
          // ✅ statusOnly: sirf status badla hai → listeners full list refetch ke
          //    bajaye cache me targeted patch kar sakte hain
          statusOnly: true,
          tag_ids: tagIds,
          createdby: populatedProduct?.createdby || null,
          updatedby: populatedProduct?.updatedby || null,
          created_at: populatedProduct?.created_at,
          updated_at: populatedProduct?.updated_at,
        });
      } catch (socketErr) {
        console.error("⚠️ [toggleProductStatus] socket broadcast failed:", socketErr?.message || socketErr);
      }
    });
  } catch (error) {
    console.error("❌ [toggleProductStatus] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to update product status",
    });
  }
};

// ======================================================
// TOGGLE PRODUCT FEATURED
// ======================================================
// ✅ "Featured Products" page ke liye — same atomic pattern as toggleProductStatus
//    (single round-trip, aggregation pipeline, no full document validation).
// ✅ Inactive product featured nahi ho sakta — sirf ACTIVE products feature ho
//    sakte hain, warna storefront par inactive item show hota.
const toggleProductFeatured = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    // ✅ Guard PEHLE check karte hain, aggregation pipeline se pehle. Pehle pipeline
    //    khud is_featured = false chhor deta tha (status active nahi hone par), is liye
    //    niche wala guard kabhi trigger hi nahi hota tha aur API galti se
    //    "Product removed from featured" (200) bhej deti thi — jabki kuch hua hi nahi.
    const current = await Product.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
      .select("is_featured status")
      .lean();

    if (!current) {
      return res.status(404).json({ message: "Product not found" });
    }

    // ✅ Sirf ACTIVE product ko featured mark kar sakte hain (unmark hamesha allowed).
    if (current.is_featured !== true && current.status !== "active") {
      return res.status(400).json({
        message: "This product is inactive. Please activate it before marking it as featured.",
      });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, is_deleted: { $ne: true } },
      [
        {
          $set: {
            is_featured: {
              $cond: [
                { $eq: [{ $ifNull: ["$is_featured", false] }, true] },
                false,
                // Feature karte waqt product ACTIVE hona zaroori hai
                { $eq: [{ $ifNull: ["$status", "active"] }, "active"] },
              ],
            },
            // ✅ "Recent upar" order ka source — featured mark karne ka timestamp.
            //    Logic is_featured se exactly mirror karti hai: abhi featured tha
            //    → unmark (null), warna mark (ab ka time). Is se jo product abhi
            //    feature hua wo Featured page par sabse upar aata hai.
            featured_at: {
              $cond: [
                { $eq: [{ $ifNull: ["$is_featured", false] }, true] },
                null,
                new Date(),
              ],
            },
            updatedby: req.user?._id || null,
            updated_at: new Date(),
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true, runValidators: false }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: product.is_featured
        ? "Product marked as featured"
        : "Product removed from featured",
      product,
    });
  } catch (error) {
    console.error("❌ [toggleProductFeatured] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to update featured status",
    });
  }
};

// ======================================================
// BULK UPDATE PRODUCT FEATURED
// ======================================================
// ✅ "Manage Products" popup (Featured Products page) ke liye — multi-select
//    ke saath ek hi request me kai products featured/unfeatured karne deta hai.
//    Body: { ids: [...], is_featured: true|false }
// ✅ Same rule jo single toggle par hai: sirf ACTIVE products feature ho sakte
//    hain. Inactive products silently skip ho jaate hain aur count response me
//    aata hai (frontend toast me dikhata hai). Unfeature hamesha allowed.
// ✅ featured_at bhi set karte hain (feature → ab ka time, unfeature → null),
//    taake Featured page ka "recent upar" order sahi rahe.
const bulkProductFeatured = async (req, res) => {
  try {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const isFeatured = req.body?.is_featured === true || req.body?.is_featured === "true";

    // ✅ Sirf valid, unique ObjectIds
    const ids = [
      ...new Set(
        rawIds
          .map((id) => String(id || "").trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id)),
      ),
    ];

    if (!ids.length) {
      return res.status(400).json({ success: false, message: "No valid product ids provided" });
    }
    if (ids.length > 100) {
      return res.status(400).json({ success: false, message: "Too many products selected (max 100)" });
    }

    const now = new Date();
    const actor = req.user?._id || null;

    if (isFeatured) {
      // ✅ Feature karte waqt sirf ACTIVE products — baaki skip.
      const activeIds = await Product.find({
        _id: { $in: ids },
        is_deleted: { $ne: true },
        status: "active",
      })
        .select("_id")
        .lean()
        .then((docs) => docs.map((d) => d._id));

      if (activeIds.length) {
        await Product.updateMany(
          { _id: { $in: activeIds }, is_deleted: { $ne: true } },
          { $set: { is_featured: true, featured_at: now, updatedby: actor, updated_at: now } },
        );
      }

      return res.status(200).json({
        success: true,
        message:
          activeIds.length === ids.length
            ? `${activeIds.length} product${activeIds.length === 1 ? "" : "s"} marked as featured`
            : `${activeIds.length} product${activeIds.length === 1 ? "" : "s"} marked as featured · ${ids.length - activeIds.length} inactive skipped`,
        modified: activeIds.length,
        skipped: ids.length - activeIds.length,
      });
    }

    // Unfeature — hamesha allowed (status se koi farq nahi)
    const result = await Product.updateMany(
      { _id: { $in: ids }, is_deleted: { $ne: true } },
      { $set: { is_featured: false, featured_at: null, updatedby: actor, updated_at: now } },
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount || 0} product${(result.modifiedCount || 0) === 1 ? "" : "s"} removed from featured`,
      modified: result.modifiedCount || 0,
      skipped: 0,
    });
  } catch (error) {
    console.error("❌ [bulkProductFeatured] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update featured products",
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================
module.exports = {
  createProduct,
  getProducts,
  getProductStats,
  getProductFacets,
  getCategoryTiles,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleProductFeatured,
  bulkProductFeatured,
};