import adminHttp from "../axiosInstance";

// ✅ Server-side pagination must include pagination metadata; never fall back to
// rendering an unbounded legacy response in the admin orders list.
// (adminBrandApi.getAllPaginated ka exact pattern)
const paginated = (res) => {
  const d = res?.data;
  if (!Array.isArray(d?.data) || !d?.pagination) {
    throw new Error("Orders list API did not return server-side pagination data.");
  }
  return d;
};

export const orderApi = {
  // ✅ Server side pagination — page/limit/search/status/payment/shipping/date +
  // product filter + sorting + locale (sab backend par jata hai)
  getAll: ({
    page = 1,
    limit = 15,
    search = "",
    status = "all",
    payment = "all",
    shipping = "all",
    dateRange = "all",
    productId,
    sort = "",
    order = "",
    locale = "en",
  } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (payment && payment !== "all") params.payment = payment;
    if (shipping && shipping !== "all") params.shipping = shipping;
    if (dateRange && dateRange !== "all") params.dateRange = dateRange;
    if (productId) params.productId = productId;
    if (sort) {
      params.sort = sort;
      params.order = order || "desc";
    }
    return adminHttp.get("/orders/admin/all", { params }).then((res) => paginated(res));
  },

  // ✅ Product history summary (units/revenue/date range + status breakdown)
  getProductSummary: (params) =>
    adminHttp.get("/orders/admin/product-summary", { params }).then((res) => res.data),

  // ✅ Single order fetch for admin (slim detail — selected locale translations)
  getById: (id, locale = "en") =>
    adminHttp.get(`/orders/admin/${id}`, { params: { locale } }).then((res) => res.data),

  updateStatus: (id, data) =>
    adminHttp.patch(`/orders/admin/${id}/status`, data).then((res) => res.data),

  updatePayment: (id, data) =>
    adminHttp.patch(`/orders/admin/${id}/payment`, data).then((res) => res.data),
};
