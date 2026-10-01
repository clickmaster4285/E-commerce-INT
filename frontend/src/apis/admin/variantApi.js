import axiosInstance from "../axiosInstance";

export const variantApi = {
  getNextSku: () =>
    axiosInstance.get("/variants/next-sku").then((res) => res.data?.data || res.data),

  getAll: () =>
    axiosInstance.get("/variants").then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),

  getById: (id) =>
    axiosInstance.get(`/variants/${id}`).then((res) => res.data?.data || res.data),

  create: (data) =>
    axiosInstance.post("/variants", data).then((res) => res.data?.data || res.data),

  update: (id, data) =>
    axiosInstance.put(`/variants/${id}`, data).then((res) => res.data?.data || res.data),

  delete: (id) =>
    axiosInstance.delete(`/variants/${id}`).then((res) => res.data),
};