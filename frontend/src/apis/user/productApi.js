import { userHttp } from "../axiosInstance";
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.products)) return d.products;
  return [];
};

const paginated = (res, fallbackLimit) => {
  const d = res.data;
  if (Array.isArray(d)) {
    return {
      products: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    products: Array.isArray(d?.products) ? d.products : Array.isArray(d?.data) ? d.data : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const productApi = {
  // ✅ PUBLIC — bina login (User GUI) — legacy full list (purane callers ke liye)
  getAll: () => userHttp.get("/products").then(list),

  // ✅ Server-side paginated list (User GUI shop/facets/search/brand/related)
  // Backend: ?page&limit&search&sort&brand_id&category_id&minPrice&maxPrice
  //   &stock=&deal=&discount=&minDiscount=&featured=&ids=
  //   sort: "featured" (default order) | "newest" | "price-asc" | "price-desc" | "discount-desc"
  // Response: { products: [...], pagination: { total, page, limit, pages, hasNext, hasPrev } }
  getAllPaginated: ({
    page = 1,
    limit = 12,
    search = "",
    sort = "featured",
    brand_id,
    category_id,
    minPrice = null,
    maxPrice = null,
    stock = [],
    deal = [],
    discount = [],
    minDiscount = null,
    featured = "",
    ids = [],
  } = {}) =>
    userHttp
      .get("/products", {
        params: {
          page,
          limit,
          search: search || undefined,
          sort: sort && sort !== "featured" ? sort : undefined,
          brand_ids: brand_id || undefined,
          category_ids: category_id || undefined,
          minPrice: minPrice ?? undefined,
          maxPrice: maxPrice ?? undefined,
          stockStates: (stock || []).length ? stock.join(",") : undefined,
          dealIds: (deal || []).length ? deal.join(",") : undefined,
          discount: (discount || []).length ? discount.join(",") : undefined,
          minDiscount: minDiscount ?? undefined,
          featured: featured || undefined,
          ids: (ids || []).length ? ids.join(",") : undefined,
        },
      })
      .then((res) => paginated(res, limit)),

  // ✅ Shop facets (sidebar counts + bounds + grid total) — same filter params
  // Response: { success, total, bounds, categories, brands, stock, discounts, deals }
  getFacets: ({
    search = "",
    brand_id,
    category_id,
    minPrice = null,
    maxPrice = null,
    stock = [],
    deal = [],
    discount = [],
  } = {}) =>
    userHttp
      .get("/products/facets", {
        params: {
          search: search || undefined,
          brand_id: brand_id || undefined,
          category_id: category_id || undefined,
          minPrice: minPrice ?? undefined,
          maxPrice: maxPrice ?? undefined,
          stockStates: (stock || []).length ? stock.join(",") : undefined,
          dealIds: (deal || []).length ? deal.join(",") : undefined,
          discount: (discount || []).length ? discount.join(",") : undefined,
        },
      })
      .then((res) => res.data),

  // ✅ Category tiles (PopularCategories + HomeCategories) — count + fromPrice + image
  getCategoryTiles: ({ limit = 12 } = {}) =>
    userHttp
      .get("/products/category-tiles", { params: { limit } })
      .then((res) => res.data?.data || []),

  getById: (id) =>
    userHttp.get(`/products/${id}`).then((res) => res.data?.data || res.data),

  getByBrand: (brandId) =>
    userHttp.get(`/products?brand_id=${brandId}`).then(list),
};