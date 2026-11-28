// ==========================================================
// queryKeys — React Query key factory (optimizeplan.md §9.3)
// ----------------------------------------------------------
// ⚠️ Keys wahi hain jo pehle string literals me thin ("products", "categories"
// ...) — is liye socket sync (invalidateQueries) aur purane call sites ke saath
// compatible. Naya code yahan se key le; tab typo / mismatch nahi hota.
// `.all` = prefix (invalidate ke liye), baaki = specific query.
// ==========================================================

export const queryKeys = {
  products: {
    all: ["products"],
    paginated: (...parts) => ["products", "paginated", ...parts],
    stats: (...parts) => ["products", "stats", ...parts],
    detail: (id) => ["product", String(id)],
    stock: (id) => ["productStock", String(id)],
    featured: ["featuredProducts"],
    related: (id, categoryId) => ["relatedProducts", id, categoryId],
  },
  categories: {
    all: ["categories"],
    detail: (id) => ["category", String(id)],
    tiles: ["categoryTiles"],
    facets: (params) => (params ? ["shopFacets", params] : ["shopFacets", "global"]),
  },
  store: {
    info: ["storeInfo"],
    admin: ["store"],
  },
  deals: {
    all: ["deals"],
    active: ["activeDeals"],
    featured: ["featuredDeals"],
    detail: (id) => ["deal", String(id)],
  },
  discounts: {
    all: ["discounts"],
    active: ["activeDiscounts"],
    detail: (id) => ["discount", String(id)],
  },
  brands: {
    all: ["brands"],
  },
};

export default queryKeys;
