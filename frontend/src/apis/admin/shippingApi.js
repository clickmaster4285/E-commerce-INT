import adminHttp from "../axiosInstance";
export const shippingApi = {
  getConfig: () => adminHttp.get("/shipping/config").then((r) => r.data?.data || r.data),
  quote: (payload) => adminHttp.post("/shipping/quote", payload).then((r) => r.data?.data || r.data),
  updateConfig: (data) => adminHttp.put("/shipping/admin/config", data).then((r) => r.data),
  getRules: () => adminHttp.get("/shipping/admin/rules").then((r) => r.data?.data || r.data || []),
  createRule: (data) => adminHttp.post("/shipping/admin/rules", data).then((r) => r.data),
  updateRule: (id, data) => adminHttp.put(`/shipping/admin/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id) => adminHttp.delete(`/shipping/admin/rules/${id}`).then((r) => r.data),
  toggleRule: (id) => adminHttp.patch(`/shipping/admin/rules/${id}/toggle`).then((r) => r.data),

  // ✅ Custom shipping methods (admin "Add New")
  getMethods: () => adminHttp.get("/shipping/admin/methods").then((r) => r.data?.data || r.data || []),
  createMethod: (data) => adminHttp.post("/shipping/admin/methods", data).then((r) => r.data),
  updateMethod: (id, data) => adminHttp.put(`/shipping/admin/methods/${id}`, data).then((r) => r.data),
  deleteMethod: (id) => adminHttp.delete(`/shipping/admin/methods/${id}`).then((r) => r.data),
  toggleMethod: (id) => adminHttp.patch(`/shipping/admin/methods/${id}/toggle`).then((r) => r.data),
};