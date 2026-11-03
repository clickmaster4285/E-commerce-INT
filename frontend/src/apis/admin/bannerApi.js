import adminHttp from "../axiosInstance";
// Server-side pagination must include pagination metadata; never fall back to
// rendering an unbounded legacy response in the admin banner list.
// (adminBrandApi.getAllPaginated ka exact pattern)
const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (!Array.isArray(d?.data) || !d?.pagination) {
    throw new Error("Banner list API did not return server-side pagination data.");
  }
  return {
    items: d.data,
    counts: d?.counts || { total: 0, active: 0, inactive: 0, scheduled: 0, expired: 0, draft: 0 },
    bannerTypes: Array.isArray(d?.bannerTypes) ? d.bannerTypes : [],
    positions: Array.isArray(d?.positions) ? d.positions : [],
    pagination: d.pagination,
  };
};

export const bannerAPI = {
  getAllPaginated: ({ page = 1, limit = 20, search = "", status = "all", bannerType = "all", sort = "", order = "", locale = "en" } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (bannerType && bannerType !== "all") params.bannerType = bannerType;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return adminHttp.get("/banners", { params }).then((res) => paginated(res, limit));
  },

  list: (params) =>
    adminHttp.get("/banners", { params }),

  active: (page) =>
    adminHttp.get("/banners/active", {
      params: { page },
    }),

  get: (id, locale = "en") =>
    adminHttp.get(`/banners/${id}`, { params: { locale } }),

  create: (data) =>
    adminHttp.post("/banners", data),

  update: (id, data) =>
    adminHttp.put(`/banners/${id}`, data),

  toggle: (id) =>
    adminHttp.patch(`/banners/${id}/toggle`),

  duplicate: (id) =>
    adminHttp.post(`/banners/${id}/duplicate`),

  delete: (id) =>
    adminHttp.delete(`/banners/${id}`),
};

export default bannerAPI;