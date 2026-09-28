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

export const getProductCreatedAt = (product) => {
  const time = Date.parse(product?.createdAt || "");
  return Number.isFinite(time) ? time : 0;
};

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

/* ---------- Sidebar filters ---------- */
export const EMPTY_HOME_FILTERS = {
  categoryId: "",
  brandIds: [],
  minPrice: null,
  maxPrice: null,
};

export const hasActiveFilters = (filters) =>
  Boolean(idOf(filters?.categoryId)) ||
  (filters?.brandIds || []).length > 0 ||
  (filters?.minPrice ?? null) !== null ||
  (filters?.maxPrice ?? null) !== null;

export const countActiveFilters = (filters) => {
  let total = 0;
  if (idOf(filters?.categoryId)) total += 1;
  total += (filters?.brandIds || []).length;
  if ((filters?.minPrice ?? null) !== null || (filters?.maxPrice ?? null) !== null) total += 1;
  return total;
};

export const filterProducts = (products, filters, categories) => {
  const categoryId = idOf(filters?.categoryId);
  const subtree = categoryId ? categorySubtreeIds(categories, categoryId) : null;
  const brandIds = (filters?.brandIds || []).map(idOf).filter(Boolean);
  const minPrice = filters?.minPrice ?? null;
  const maxPrice = filters?.maxPrice ?? null;

  return (products || []).filter((product) => {
    if (subtree && !subtree.has(idOf(product?.category_id))) return false;
    if (brandIds.length && !brandIds.includes(idOf(product?.brand_id))) return false;
    const price = getProductPrice(product);
    if (minPrice !== null && price < Number(minPrice)) return false;
    if (maxPrice !== null && price > Number(maxPrice)) return false;
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

export const pickDiverse = (products, limit, { maxPerCategory = 2, maxPerBrand = 2 } = {}) => {
  const pool = shuffled(products);
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

export const getBrandCounts = (products) => countByRef(products, (p) => p.brand_id);

export const isTopLevelCategory = (category) => idOf(category?.parent_category_id) === "";

export const sortByPopularity = (list, counts) =>
  [...(list || [])].sort((a, b) => {
    const diff = (counts[idOf(b?._id)] || 0) - (counts[idOf(a?._id)] || 0);
    if (diff !== 0) return diff;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
