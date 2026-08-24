import axiosInstance from "../axiosInstance";

export const adminBrandApi = {
  getAll: () => 
    axiosInstance.get("/brands").then((res) => {
      const data = res.data;
      if (data?.success && Array.isArray(data.data)) return data.data;
      if (Array.isArray(data)) return data;
      return [];
    }),
  
  getById: (id) => axiosInstance.get(`/brands/${id}`).then((res) => res.data?.data || res.data),
  
  getNextCode: () => axiosInstance.get("/brands/next-code").then((res) => res.data?.data || res.data),
  
  create: (formData) => axiosInstance.post("/brands", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data),
  
  update: (id, formData) => axiosInstance.put(`/brands/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data),
  
  delete: (id) => axiosInstance.delete(`/brands/${id}`).then((res) => res.data),
};

export const brandApi = adminBrandApi;