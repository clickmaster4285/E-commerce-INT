import axiosInstance from "../axiosInstance";

// ✅ Smart list unwrap — existing API pattern follow karta hai
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

// ==========================================
// 📦 MANAGE STOCK API
// ==========================================

const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (!d) return { items: [], pagination: { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false } };
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  if (d?.success !== undefined && Array.isArray(d?.data)) {
    return {
      items: d.data,
      pagination: d.pagination || { total: d.data.length, page: 1, limit: d.data.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.items) ? d.items : Array.isArray(d?.data) ? d.data : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const stockApi = {
  // Variant-level stock items (quantity/min_qnt/max_qnt reuse)
  getAll: () => axiosInstance.get("/stock").then(list),

  getAllPaginated: ({ page = 1, limit = 20, search = "", status = "all" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    return axiosInstance.get("/stock", { params }).then((res) => paginated(res, limit));
  },

  getHistoryPaginated: ({ page = 1, limit = 20, variantId = "" } = {}) => {
    const params = { page, limit };
    if (variantId) params.variant_id = variantId;
    return axiosInstance.get("/stock/history", { params }).then((res) => paginated(res, limit));
  },

  adjust: (data) =>
    axiosInstance.post("/stock/adjust", data).then((res) => res.data),

  getHistory: (variantId) =>
    axiosInstance
      .get("/stock/history", {
        params: variantId ? { variant_id: variantId } : undefined,
      })
      .then(list),
};
