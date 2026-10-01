import axiosInstance from "../axiosInstance";

const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const bannerAPI = {
  getAllPaginated: ({ page = 1, limit = 20, search = "", status = "all", bannerType = "all" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (bannerType && bannerType !== "all") params.bannerType = bannerType;
    return axiosInstance.get("/banners", { params }).then((res) => paginated(res, limit));
  },

  list: (params) =>
    axiosInstance.get("/banners", { params }),

  active: (page) =>
    axiosInstance.get("/banners/active", {
      params: { page },
    }),

  get: (id) =>
    axiosInstance.get(`/banners/${id}`),

  create: (data) =>
    axiosInstance.post("/banners", data),

  update: (id, data) =>
    axiosInstance.put(`/banners/${id}`, data),

  toggle: (id) =>
    axiosInstance.patch(`/banners/${id}/toggle`),

  duplicate: (id) =>
    axiosInstance.post(`/banners/${id}/duplicate`),

  delete: (id) =>
    axiosInstance.delete(`/banners/${id}`),
};

export default bannerAPI;