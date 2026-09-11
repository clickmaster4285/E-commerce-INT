import axiosInstance from "../axiosInstance";

const paginated = (res, fallbackLimit) => {
  const d = res.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const dealApi = {
  getActive: () =>
    axiosInstance.get("/deals/active").then((res) => res.data?.data || []),

  // ✅ NEW — server-side paginated active deals
  getActivePaginated: ({ page = 1, limit = 12 } = {}) =>
    axiosInstance
      .get("/deals/active", {
        params: { page, limit },
      })
      .then((res) => paginated(res, limit)),

  getById: (id, page = 1, limit = 20) =>
    axiosInstance.get(`/deals/active/${id}?page=${page}&limit=${limit}`).then((res) => res.data?.data),
};
