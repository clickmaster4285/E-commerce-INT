import axiosInstance from "../axiosInstance";

export const bannerAPI = {
  list: (params) =>
    axiosInstance.get("/banners", { params }),

  active: (page) =>
    axiosInstance.get("/banners/active", {
      params: { page },
    }),

  get: (id) =>
    axiosInstance.get(`/banners/${id}`),

  create: (data) =>
    axiosInstance.post("/banners", data),

  update: (id, data) =>
    axiosInstance.put(`/banners/${id}`, data),

  toggle: (id) =>
    axiosInstance.patch(`/banners/${id}/toggle`),

  duplicate: (id) =>
    axiosInstance.post(`/banners/${id}/duplicate`),

  delete: (id) =>
    axiosInstance.delete(`/banners/${id}`),
};

export default bannerAPI;