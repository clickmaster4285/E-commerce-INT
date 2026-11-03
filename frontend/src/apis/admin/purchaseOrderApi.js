import adminHttp from "../axiosInstance";

export const purchaseOrderApi = {
  // ✅ Server side pagination — page/limit/search/status/vendor/payment_status/range
  //    + sorting + locale; strict meta check (brands pattern)
  getAll: ({ page = 1, limit = 20, search = "", status = "all", vendor = "all", payment_status = "all", range = "all", sort = "", order = "", locale = "en" } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (vendor && vendor !== "all") params.vendor = vendor;
    if (payment_status && payment_status !== "all") params.payment_status = payment_status;
    if (range && range !== "all") params.range = range;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return adminHttp.get("/purchase-orders/admin/all", { params }).then((res) => {
      const d = res?.data;
      if (!Array.isArray(d?.data) || !d?.pagination) {
        throw new Error("Purchase orders list API did not return server-side pagination data.");
      }
      return d;
    });
  },
  // ✅ Slim detail (selected locale translations) — edit form base text ke liye locale na pass karein
  getById: (id, locale = "en") => adminHttp.get(`/purchase-orders/admin/${id}`, { params: { locale } }).then((res) => res.data),
  getNextCode: () => adminHttp.get("/purchase-orders/next-code").then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/purchase-orders", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/purchase-orders/${id}`, data).then((res) => res.data),
  confirm: (id) => adminHttp.patch(`/purchase-orders/admin/${id}/confirm`).then((res) => res.data),
  cancel: (id, cancel_reason) => adminHttp.patch(`/purchase-orders/admin/${id}/cancel`, { cancel_reason }).then((res) => res.data),
  close: (id) => adminHttp.patch(`/purchase-orders/admin/${id}/close`).then((res) => res.data),
  deliver: (id, payload) => adminHttp.post(`/purchase-orders/admin/${id}/deliver`, payload).then((res) => res.data),
  receive: (id, payload) => adminHttp.post(`/purchase-orders/admin/${id}/deliver`, payload).then((res) => res.data),
  recordPayment: (id, payload) => adminHttp.patch(`/purchase-orders/admin/${id}/payment`, payload).then((res) => res.data),
};
