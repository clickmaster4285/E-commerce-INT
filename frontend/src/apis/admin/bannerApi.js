import axiosInstance from "../axiosInstance";

export const bannerAPI = {
  list: (params) => 
    axiosInstance.get("/banners", { params }).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),
  
  active: (page) => 
    axiosInstance.get("/banners/active", { params: { page } }).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),
  
  get: (id) => axiosInstance.get(`/banners/${id}`).then((res) => res.data?.data || res.data),
  
  create: (data) => 
    axiosInstance.post("/banners", data, { 
      headers: { "Content-Type": "multipart/form-data" } 
    }).then((res) => res.data?.data || res.data),
  
  update: (id, data) => 
    axiosInstance.put(`/banners/${id}`, data, { 
      headers: { "Content-Type": "multipart/form-data" } 
    }).then((res) => res.data?.data || res.data),
  
  toggle: (id) => 
    axiosInstance.patch(`/banners/${id}/toggle`).then((res) => res.data?.data || res.data),
  
  duplicate: (id) => 
    axiosInstance.post(`/banners/${id}/duplicate`).then((res) => res.data?.data || res.data),
  
  delete: (id) => axiosInstance.delete(`/banners/${id}`).then((res) => res.data),
};