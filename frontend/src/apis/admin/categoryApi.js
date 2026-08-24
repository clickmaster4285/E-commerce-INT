import axiosInstance from "../axiosInstance";

export const adminCategoryApi = {
  getAll: () => 
    axiosInstance.get("/categories").then((res) => {
      // Backend { success: true, data: [...] } return karta hai
      const data = res.data;
      if (data?.success && Array.isArray(data.data)) return data.data;
      if (Array.isArray(data)) return data;
      return [];
    }),
  
  getById: (id) => axiosInstance.get(`/categories/${id}`).then((res) => res.data?.data || res.data),
  
  getNextCode: () => axiosInstance.get("/categories/next-code").then((res) => res.data?.data || res.data),
  
  create: (data) => axiosInstance.post("/categories", data).then((res) => res.data),
  
  update: (id, data) => axiosInstance.put(`/categories/${id}`, data).then((res) => res.data),
  
  delete: (id) => axiosInstance.delete(`/categories/${id}`).then((res) => res.data),
};

export const categoryApi = adminCategoryApi;