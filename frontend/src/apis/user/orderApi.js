import axiosInstance from "../axiosInstance";

const paginated = (res, fallbackLimit) => {
  const d = res.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
      counts: {},
      totalOrders: d.length,
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
    counts: d?.counts || {},
    totalOrders: d?.totalOrders ?? d?.pagination?.total ?? 0,
  };
};

export const orderApi = {
  place: (data) => axiosInstance.post("/orders", data).then((res) => res.data?.data),

  myOrders: () => axiosInstance.get("/orders/my").then((res) => res.data?.data || []),

  // ✅ NEW — server-side paginated list with filters
  getMyOrdersPaginated: ({ page = 1, limit = 10, status = "all", search = "", sort = "newest", timeRange = "all" } = {}) =>
    axiosInstance
      .get("/orders/my", {
        params: {
          page,
          limit,
          status: status || undefined,
          search: search || undefined,
          sort,
          timeRange: timeRange !== "all" ? timeRange : undefined,
        },
      })
      .then((res) => paginated(res, limit)),

  getById: (id) => axiosInstance.get(`/orders/${id}`).then((res) => res.data?.data),
};
