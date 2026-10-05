/* ==========================================================
   HOME CATALOG HELPERS — User GUI (Home page)
   Ye saare helpers sirf REAL API data par kaam karte hain
   (koi hardcoded product / category / brand / image nahi).
   Pricing logic wahi hai jo ProductCard use karta hai:
   variants[0].selling_price = current, variants[0].price = list
   ========================================================== */

export const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

/* ---------- ID helpers (string | ObjectId | populated { _id }) ---------- */
export const idOf = (ref) => {
  if (!ref) return "";
  if (typeof ref === "object") return String(ref._id || ref.id || "");
  return String(ref);
};

export const sameId = (a, b) => {
  const left = idOf(a);
  const right = idOf(b);
  return left !== "" && left === right;
};

/* ---------- Images ---------- */
export const imageUrl = (source) => {
  const raw = typeof source === "object" ? source?.img_url || source?.url : source;
  if (!raw) return null;
  if (/^(https?:|blob:|data:)/.test(raw)) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

export const getProductImage = (product) =>
  imageUrl(
    product?.variants?.[0]?.images?.[0]?.img_url ||
      product?.image ||
      product?.images?.[0]?.img_url,
  );

/* ---------- Pricing ---------- */
export const getProductPrice = (product) => {
  const variant = product?.variants?.[0];
  const value = Number(variant?.selling_price || product?.price || product?.selling_price || 0);
  return Number.isFinite(value) ? value : 0;
};

export const getProductListPrice = (product) => {
  const variant = product?.variants?.[0];
  const list = Number(variant?.price || 0) || 0;
  return Math.max(list, getProductPrice(product));
};

export const getProductDiscountPercent = (product) => {
  const price = getProductPrice(product);
  const list = Number(product?.variants?.[0]?.price || 0) || 0;
  if (list <= 0 || price <= 0 || list <= price) return 0;
  return Math.round(((list - price) / list) * 100);
};

/* API `created_at` bhejta hai (Product model ka timestamp), kuch jagah
   `createdAt` bhi aa sakta hai — dono handle karte hain. */
export const getProductCreatedAt = (product) => {
  const time = Date.parse(product?.created_at || product?.createdAt || "");
  return Number.isFinite(time) ? time : 0;
};

/* ---------- Stock (real variant quantities se) ---------- */
export const LOW_STOCK_THRESHOLD = 5;

export const getProductStock = (product) => {
  const variants = product?.variants || [];
  if (variants.length) {
    return variants.reduce((sum, variant) => sum + Number(variant?.quantity || 0), 0);
  }
  const fallback = Number(product?.quantity);
  return Number.isFinite(fallback) ? fallback : 0;
};

export const STOCK_STATES = [
  { id: "in", label: "In Stock", min: LOW_STOCK_THRESHOLD },
  { id: "low", label: "Low Stock", min: 1 },
  { id: "out", label: "Out of Stock", min: 0 },
];

export const getStockState = (product) => {
  const stock = getProductStock(product);
  if (stock < 1) return "out";
  if (stock < LOW_STOCK_THRESHOLD) return "low";
  return "in";
};

/* ---------- Discount bands (real active discounts se) ---------- */
export const DISCOUNT_BANDS = [10, 20, 30, 50];

export const formatPrice = (value) => `Rs. ${Math.round(Number(value) || 0).toLocaleString()}`;

/* ---------- Counts (real products se) ---------- */
export const countByRef = (items, getRef) => {
  const counts = {};
  (items || []).forEach((item) => {
    const id = idOf(getRef(item));
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
};

export const getCategoryCounts = (products) => countByRef(products, (p) => p.category_id);

export const getBrandCounts = (products) => countByRef(products, (p) => p.brand_id);

export const isTopLevelCategory = (category) => idOf(category?.parent_category_id) === "";

export const sortByPopularity = (list, counts) =>
  [...(list || [])].sort((a, b) => {
    const diff = (counts[idOf(b?._id)] || 0) - (counts[idOf(a?._id)] || 0);
    if (diff !== 0) return diff;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

/* ---------- Category tree: parent select ho to uske children bhi match hon ---------- */
export const categorySubtreeIds = (categories, rootId) => {
  const ids = new Set();
  const root = idOf(rootId);
  if (!root) return ids;
  ids.add(root);
  let grew = true;
  while (grew) {
    grew = false;
    (categories || []).forEach((category) => {
      const id = idOf(category?._id);
      const parent = idOf(category?.parent_category_id);
      if (id && !ids.has(id) && parent && ids.has(parent)) {
        ids.add(id);
        grew = true;
      }
    });
  }
  return ids;
};

/* Parent category ka total = us category + uske saare children ke products */
export const getCategorySubtreeCounts = (categories, products) => {
  const direct = getCategoryCounts(products);
  const counts = {};
  (categories || []).forEach((category) => {
    const id = idOf(category?._id);
    if (!id) return;
    let total = 0;
    categorySubtreeIds(categories, id).forEach((subId) => {
      total += direct[subId] || 0;
    });
    counts[id] = total;
  });
  return counts;
};

/* ---------- Sidebar filters ---------- */
export const EMPTY_HOME_FILTERS = {
  categoryIds: [],
  brandIds: [],
  minPrice: null,
  maxPrice: null,
  stockStates: [],
  discountBands: [],
  discountBand: null,
  dealIds: [],
};

/* ---------- Deals (sidebar "Deals" filter + right-side filtering) ----------
   Deal shape (real API): { _id, name, type, applyTo, productIds,
   categoryIds, brandIds }. IDs string / ObjectId / populated object ho sakte
   hain — is liye har comparison idOf se hoti hai (wahi logic jo DealsSection
   ka matchDealProducts use karta hai). */
export const dealMatchesProduct = (deal, product) => {
  if (!deal || !product) return false;
  const pid = idOf(product?._id);
  if (!pid) return false;
  const inList = (list, value) =>
    (list || []).some((entry) => idOf(entry) !== "" && idOf(entry) === value);
  switch (deal.applyTo) {
    case "product":
      return inList(deal.productIds, pid);
    case "category":
      return inList(deal.categoryIds, idOf(product?.category_id));
    case "brand":
      return inList(deal.brandIds, idOf(product?.brand_id));
    case "all":
    default:
      return (deal.productIds || []).length ? inList(deal.productIds, pid) : true;
  }
};

export const getDealBadgeText = (deal) => {
  if (!deal?.type) return null;
  if (deal.type === "percentage") return `${deal.discountValue}% OFF`;
  if (deal.type === "fixed_amount") return `Rs. ${deal.discountValue} OFF`;
  if (deal.type === "buy_x_get_y") {
    const b = deal.buyQuantity || 0;
    const g = deal.getQuantity || 0;
    return b > 0 && g > 0 ? `Buy ${b} Get ${g}` : "Buy X Get Y";
  }
  if (deal.type === "bundle") return "Bundle Deal";
  if (deal.type === "free_shipping") return "Free Shipping";
  return String(deal.type).replace(/_/g, " ").toUpperCase();
};

const priceFilterActive = (filters) =>
  (filters?.minPrice ?? null) !== null || (filters?.maxPrice ?? null) !== null;

export const hasActiveFilters = (filters) =>
  (filters?.categoryIds || []).length > 0 ||
  (filters?.brandIds || []).length > 0 ||
  priceFilterActive(filters) ||
  (filters?.stockStates || []).length > 0 ||
  (filters?.discountBands || []).length > 0 ||
  (filters?.discountBand ?? null) !== null ||
  (filters?.dealIds || []).length > 0;

export const countActiveFilters = (filters) => {
  let total = 0;
  total += (filters?.categoryIds || []).length;
  total += (filters?.brandIds || []).length;
  if (priceFilterActive(filters)) total += 1;
  total += (filters?.stockStates || []).length;
  total += (filters?.discountBands || []).length;
  if ((filters?.discountBand ?? null) !== null) total += 1;
  total += (filters?.dealIds || []).length;
  return total;
};

/**
 * @param discountPercentFor  optional (product) => number | null — real
 *                            discount % (publicDiscounts/deals se). Sirf tab
 *                            diya jata hai jab discount band filter active ho.
 * @param deals               optional active deals list — sidebar "Deals"
 *                            filter (filters.dealIds) isi se match hota hai.
 *                            Koi deal select ho to sirf us deal ke products
 *                            pass hote hain (multiple select = OR).
 */
export const filterProducts = (products, filters, categories, discountPercentFor, deals = []) => {
  const categoryIds = (filters?.categoryIds || []).map(idOf).filter(Boolean);
  const subtrees = categoryIds.map((cid) => categorySubtreeIds(categories, cid));
  const subtreeSet = new Set();
  subtrees.forEach((set) => set.forEach((id) => subtreeSet.add(id)));
  const subtree = subtreeSet.size ? subtreeSet : null;
  const brandIds = (filters?.brandIds || []).map(idOf).filter(Boolean);
  const minPrice = filters?.minPrice ?? null;
  const maxPrice = filters?.maxPrice ?? null;
  const stockStates = filters?.stockStates || [];
  const discountBands = filters?.discountBands || [];
  const legacyBand = filters?.discountBand ?? null;
  const allBands = legacyBand !== null ? [...discountBands, legacyBand] : discountBands;
  const minBand = allBands.length ? Math.min(...allBands) : null;
  const dealIds = (filters?.dealIds || []).map(idOf).filter(Boolean);
  const selectedDeals = dealIds.length
    ? (deals || []).filter((deal) => dealIds.includes(idOf(deal?._id)))
    : [];

  return (products || []).filter((product) => {
    if (subtree && !subtree.has(idOf(product?.category_id))) return false;
    if (brandIds.length && !brandIds.includes(idOf(product?.brand_id))) return false;
    const price = getProductPrice(product);
    if (minPrice !== null && price < Number(minPrice)) return false;
    if (maxPrice !== null && price > Number(maxPrice)) return false;
    if (stockStates.length && !stockStates.includes(getStockState(product))) return false;
    if (minBand !== null) {
      const percent = Number(discountPercentFor ? discountPercentFor(product) : 0) || 0;
      if (percent < minBand) return false;
    }
    if (selectedDeals.length && !selectedDeals.some((deal) => dealMatchesProduct(deal, product)))
      return false;
    return true;
  });
};

export const priceBounds = (products) => {
  const prices = (products || []).map(getProductPrice).filter((price) => price > 0);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
};

/* ---------- Diverse random picks (different categories + brands) ---------- */
export const shuffled = (list) => {
  const out = [...(list || [])];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const pickDiverse = (products, limit, { maxPerCategory = 2, maxPerBrand = 2, seed = 0 } = {}) => {
  const pool = shuffled(products);

  // seed tabhi badalta hai jab user "Shuffle" dabata hai — is se wahi
  // products dobara mix ho kar ek naya random set banate hain
  if (seed > 0 && pool.length > 1) {
    const offset = seed % pool.length;
    pool.push(...pool.splice(0, offset));
  }
  const picked = [];
  const perCategory = {};
  const perBrand = {};

  pool.forEach((product) => {
    if (picked.length >= limit) return;
    const categoryId = idOf(product?.category_id) || "__none__";
    const brandId = idOf(product?.brand_id) || "__none__";
    if ((perCategory[categoryId] || 0) >= maxPerCategory) return;
    if ((perBrand[brandId] || 0) >= maxPerBrand) return;
    picked.push(product);
    perCategory[categoryId] = (perCategory[categoryId] || 0) + 1;
    perBrand[brandId] = (perBrand[brandId] || 0) + 1;
  });

  if (picked.length < limit) {
    const used = new Set(picked.map((product) => idOf(product?._id)));
    for (const product of pool) {
      if (picked.length >= limit) break;
      const id = idOf(product?._id);
      if (used.has(id)) continue;
      used.add(id);
      picked.push(product);
    }
  }

  return picked;
};

/* ---------- Popular categories: real image + starting price + count ---------- */
export const popularCategories = (categories, products, limit = 6) => {
  const counts = getCategorySubtreeCounts(categories, products);
  return (categories || [])
    .filter((category) => isTopLevelCategory(category))
    .map((category) => {
      const ids = categorySubtreeIds(categories, category._id);
      const items = (products || []).filter((product) => ids.has(idOf(product?.category_id)));
      const priced = items.map(getProductPrice).filter((price) => price > 0);
      const withImage = items.find((product) => getProductImage(product));
      return {
        ...category,
        count: counts[idOf(category._id)] || items.length,
        fromPrice: priced.length ? Math.min(...priced) : 0,
        image: withImage ? getProductImage(withImage) : null,
      };
    })
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
};
