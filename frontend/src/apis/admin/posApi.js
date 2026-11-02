import adminHttp from "../axiosInstance";

export const posApi = {
  getProducts: (params = {}) =>
    adminHttp.get("/pos/products", { params }).then((res) => {
      const payload = res.data || {};
      return {
        data: Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [],
        pagination: payload.pagination || { total: 0, page: 1, limit: 30, totalPages: 1 },
        filters: payload.filters || { categories: [], brands: [] },
      };
    }),
  getSales: (params = {}) => adminHttp.get("/pos/sales", { params }).then((res) => res.data || {}),
  getSale: (id) => adminHttp.get(`/pos/sales/${id}`).then((res) => res.data?.data || res.data),
  createSale: (data) => adminHttp.post("/pos/sales", data).then((res) => res.data),
  updateSale: (id, data) => adminHttp.put(`/pos/sales/${id}`, data).then((res) => res.data),
  returnSale: (id, data) => adminHttp.post(`/pos/sales/${id}/returns`, data).then((res) => res.data),
  getCustomerHistory: (customerId) => adminHttp.get(`/pos/customers/${customerId}/history`).then((res) => res.data?.data || res.data || { sales: [], total_spent: 0, total_sales: 0 }),
};
