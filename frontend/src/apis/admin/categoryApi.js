import axiosInstance from "../axiosInstance";

export const adminCategoryApi = {
  getAll: () => axiosInstance.get("/categories/admin/all").then((res) => res.data),
  getById: (id) => axiosInstance.get(`/categories/${id}`).then((res) => res.data),
  getNextCode: () => axiosInstance.get("/categories/next-code").then((res) => res.data),
  create: (data) => axiosInstance.post("/categories", data).then((res) => res.data),
  update: (id, data) => axiosInstance.put(`/categories/${id}`, data).then((res) => res.data),
  delete: (id) => axiosInstance.delete(`/categories/${id}`).then((res) => res.data),
};