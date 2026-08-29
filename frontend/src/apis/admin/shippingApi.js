import axiosInstance from "../axiosInstance";

export const shippingApi = {
  getConfig: () => axiosInstance.get("/shipping/config").then((r) => r.data?.data || r.data),
  quote: (payload) => axiosInstance.post("/shipping/quote", payload).then((r) => r.data?.data || r.data),
  updateConfig: (data) => axiosInstance.put("/shipping/admin/config", data).then((r) => r.data),
  getRules: () => axiosInstance.get("/shipping/admin/rules").then((r) => r.data?.data || r.data || []),
  createRule: (data) => axiosInstance.post("/shipping/admin/rules", data).then((r) => r.data),
  updateRule: (id, data) => axiosInstance.put(`/shipping/admin/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id) => axiosInstance.delete(`/shipping/admin/rules/${id}`).then((r) => r.data),
  toggleRule: (id) => axiosInstance.patch(`/shipping/admin/rules/${id}/toggle`).then((r) => r.data),
};