import axiosInstance from "../axiosInstance";

// ✅ Smart list unwrap
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.products)) return d.products;
  return [];
};

// ==========================================
// 🛡️ ADMIN PRODUCT API
// ==========================================
export const adminProductApi = {
  // ✅ Ab /products use karo (admin/all exist nahi karta)
  getAll: () => axiosInstance.get("/products").then(list),

  getById: (id) =>
    axiosInstance.get(`/products/${id}`).then((res) => res.data?.data || res.data),

  create: (data) =>
    axiosInstance.post("/products", data).then((res) => res.data),

  update: (id, data) =>
    axiosInstance.put(`/products/${id}`, data).then((res) => res.data),

  delete: (id) =>
    axiosInstance.delete(`/products/${id}`).then((res) => res.data),

  toggleStatus: (id) =>
    axiosInstance.patch(`/products/${id}/toggle-status`).then((res) => res.data),
};

// ✅ ALIAS
export const productApi = adminProductApi;