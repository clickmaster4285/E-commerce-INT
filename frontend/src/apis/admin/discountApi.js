import axiosInstance from "../axiosInstance";

export const discountApi = {
  getAll: () => 
    axiosInstance.get("/discounts").then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),

  getById: (id) => 
    axiosInstance.get(`/discounts/${id}`).then((res) => res.data?.data || res.data),

  create: (data) => 
    axiosInstance.post("/discounts", data).then((res) => res.data?.data || res.data),

  update: (id, data) => 
    axiosInstance.put(`/discounts/${id}`, data).then((res) => res.data?.data || res.data),

  delete: (id) => 
    axiosInstance.delete(`/discounts/${id}`).then((res) => res.data),

  getPublic: () => 
    axiosInstance.get("/discounts/public").then((res) => res.data?.data || res.data || []),
};