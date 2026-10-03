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
  if (!d) return { items: [], summary: {}, counts: { all: 0, in: 0, low: 0, out: 0 }, pagination: { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false } };
  if (Array.isArray(d)) {
    return {
      items: d,
      summary: {},
      counts: { all: d.length, in: 0, low: 0, out: 0 },
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : Array.isArray(d?.items) ? d.items : [],
    summary: d?.summary || {},
    counts: d?.counts || { all: 0, in: 0, low: 0, out: 0 },
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
