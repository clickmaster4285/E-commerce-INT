import axiosInstance from "./axiosInstance";

export const productApi = {
  getAll: () =>
    axiosInstance
      .get("/products")
      .then((res) => res.data),

  getByBrand: (brandId) =>
    axiosInstance
      .get(`/products?brand_id=${brandId}`)
      .then((res) => res.data),

  getById: (id) =>
    axiosInstance
      .get(`/products/${id}`)
      .then((res) => res.data),

  create: (data) =>
    axiosInstance
      .post("/products", data)
      .then((res) => res.data),

  update: (id, data) =>
    axiosInstance
      .put(`/products/${id}`, data)
      .then((res) => res.data),

  delete: (id) =>
    axiosInstance
      .delete(`/products/${id}`)
      .then((res) => res.data),

  // ✅ YEH NAYA FUNCTION ADD KIYA GAYA HAI
  toggleStatus: (id) =>
    axiosInstance
      .patch(`/products/${id}/toggle-status`)
      .then((res) => res.data),
};