import axiosInstance from "../axiosInstance";

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
  // ✅ PUBLIC — bina login (User GUI) — legacy full list
  getAll: () => axiosInstance.get("/products").then(list),

  // ✅ NEW — server-side paginated list (User GUI)
  getAllPaginated: ({ page = 1, limit = 12, search = "", sort = "newest", brand_id, category_id } = {}) =>
    axiosInstance
      .get("/products", {
        params: {
          page,
          limit,
          search: search || undefined,
          sort,
          brand_id: brand_id || undefined,
          category_id: category_id || undefined,
        },
      })
      .then((res) => paginated(res, limit)),

  getById: (id) =>
    axiosInstance.get(`/products/${id}`).then((res) => res.data?.data || res.data),

  getByBrand: (brandId) =>
    axiosInstance.get(`/products?brand_id=${brandId}`).then(list),
};