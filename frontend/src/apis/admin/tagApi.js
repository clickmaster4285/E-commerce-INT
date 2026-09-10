import axiosInstance from "../axiosInstance";

export const tagApi = {
  getAll: () => 
    axiosInstance.get("/tags").then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),
  
  create: (data) => axiosInstance.post("/tags", data).then((res) => res.data?.data || res.data),
  
  update: (id, data) => axiosInstance.put(`/tags/${id}`, data).then((res) => res.data?.data || res.data),
  
  delete: (id) => axiosInstance.delete(`/tags/${id}`).then((res) => res.data),
};