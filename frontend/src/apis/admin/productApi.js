import axiosInstance from "../axiosInstance";

// ==========================================
// 🛡️ ADMIN PRODUCT API — /admin endpoints
// ==========================================
export const adminProductApi = {
  // ✅ Admin list — active + inactive (deleted nahi)
  getAll: () =>
    axiosInstance.get("/products/admin/all").then((res) => res.data),

  getById: (id) =>
    axiosInstance.get(`/products/${id}`).then((res) => res.data),

  create: (data) =>
    axiosInstance.post("/products", data).then((res) => res.data),

  update: (id, data) =>
    axiosInstance.put(`/products/${id}`, data).then((res) => res.data),

  delete: (id) =>
    axiosInstance.delete(`/products/${id}`).then((res) => res.data),

  toggleStatus: (id) =>
    axiosInstance.patch(`/products/${id}/toggle-status`).then((res) => res.data),
};