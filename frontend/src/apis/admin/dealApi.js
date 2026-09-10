import axiosInstance from "../axiosInstance";

export const dealApi = {
  getAll: (params = {}) =>
    axiosInstance.get("/deals", { params }).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),

  getById: (id) =>
    axiosInstance.get(`/deals/${id}`).then((res) => res.data?.data || res.data),

  create: (data) =>
    axiosInstance.post("/deals", data).then((res) => res.data?.data || res.data),

  update: (id, data) =>
    axiosInstance.put(`/deals/${id}`, data).then((res) => res.data?.data || res.data),

  delete: (id) =>
    axiosInstance.delete(`/deals/${id}`).then((res) => res.data),

  toggleStatus: (id) =>
    axiosInstance.patch(`/deals/${id}/toggle-status`).then((res) => res.data?.data || res.data),
};