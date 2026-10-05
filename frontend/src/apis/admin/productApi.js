import adminHttp from "../axiosInstance";
// ✅ Smart list unwrap
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.products)) return d.products;
  return [];
};

// ==========================================
// 🛡️ ADMIN PRODUCT API
// ==========================================
export const adminProductApi = {
  // ✅ Ab /products use karo (admin/all exist nahi karta)
  getAll: () => adminHttp.get("/products").then(list),

  // ✅ Server-side pagination (Admin Products list)
  // Backend: ?page&limit&search&category_id&brand_id&status&sort&featured
  //   sort: "newest" (default) | "featured-recent" (Featured page) | "price-asc" | "price-desc"
  // Response: { products: [...], stats: {...}, pagination: { total, page, limit, pages, hasNext, hasPrev } }
  // Note: limit bina legacy full-array response milta hai (getAll wala behavior).
  getPaginated: ({ page = 1, limit = 20, search = "", category_id = "", brand_id = "", status = "", featured = "", sort = "" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (category_id && category_id !== "all") params.category_id = category_id;
    if (brand_id && brand_id !== "all") params.brand_id = brand_id;
    if (status && status !== "all") params.status = status;
    if (featured === true || featured === "true" || featured === "1") params.featured = "true";
    // "newest" backend ka default hai → bhejne ki zaroorat nahi
    if (sort && sort !== "newest") params.sort = sort;
    return adminHttp.get("/products", { params }).then((res) => res.data);
  },

  // ✅ Summary stats (stat cards) — alag API, taake cards table se independently load hon.
  // Backend: ?search&category_id&brand_id&status
  // Response: { success: true, stats: { totalProducts, activeProducts, inactiveProducts, totalVariants, totalStock } }
  getStats: ({ search = "", category_id = "", brand_id = "", status = "" } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (category_id && category_id !== "all") params.category_id = category_id;
    if (brand_id && brand_id !== "all") params.brand_id = brand_id;
    if (status && status !== "all") params.status = status;
    return adminHttp
      .get("/products/stats", { params })
      .then((res) => (res.data?.stats ? res.data.stats : (res.data?.data || res.data || {})));
  },

  getByBrand: (brandId) =>
    adminHttp.get("/products", { params: { brand_id: brandId } }).then(list),

  getById: (id) =>
    adminHttp.get(`/products/${id}`).then((res) => res.data?.data || res.data),

  create: (data) =>
    adminHttp.post("/products", data).then((res) => res.data),

  update: (id, data) =>
    adminHttp.put(`/products/${id}`, data).then((res) => res.data),

  delete: (id) =>
    adminHttp.delete(`/products/${id}`).then((res) => res.data),

  toggleStatus: (id) =>
    adminHttp.patch(`/products/${id}/toggle-status`).then((res) => res.data),

  // ✅ Featured Products page — mark / unmark (PATCH, atomic backend flip)
  toggleFeatured: (id) =>
    adminHttp.patch(`/products/${id}/toggle-featured`).then((res) => res.data),

  // ✅ "Manage Products" popup — bulk mark / unmark (multi-select)
  //    Body: { ids: [...], is_featured: true|false }
  //    Response: { success, message, modified, skipped }
  bulkFeatured: ({ ids = [], is_featured = true } = {}) =>
    adminHttp
      .patch("/products/bulk-featured", { ids, is_featured })
      .then((res) => res.data),
};

// ✅ ALIAS
export const productApi = adminProductApi;
