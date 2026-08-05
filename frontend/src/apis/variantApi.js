import axiosInstance from "./axiosInstance";

export const variantApi = {
  getNextSku: () =>
    axiosInstance
      .get("/variants/next-sku")
      .then((res) => res.data),

  getAll: () =>
    axiosInstance
      .get("/variants")
      .then((res) => res.data),

  getById: (id) =>
    axiosInstance
      .get(`/variants/${id}`)
      .then((res) => res.data),

  create: (data) =>
    axiosInstance
      .post("/variants", data)
      .then((res) => res.data),

  update: (id, data) =>
    axiosInstance
      .put(`/variants/${id}`, data)
      .then((res) => res.data),

  delete: (id) =>
    axiosInstance
      .delete(`/variants/${id}`)
      .then((res) => res.data),
};