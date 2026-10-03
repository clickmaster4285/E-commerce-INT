import axiosInstance from "../axiosInstance";

export const dealApi = {
  getAll: (params = {}) =>
    axiosInstance.get("/deals", { params }).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),

  // ✅ SERVER-SIDE PAGINATION — { deals, stats, pagination } poora response deta hai
  //    (banners page ke deal picker ko getAll chahiye, is liye woh hataya nahi gaya).
  getPaginated: (params = {}) =>
    axiosInstance.get("/deals", { params }).then((res) => ({
      deals: Array.isArray(res.data?.data) ? res.data.data : [],
      stats: res.data?.stats || null,
      pagination: res.data?.pagination || {
        total: 0,
        page: 1,
        limit: params.limit || 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })),

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

  // ✅ Bundle deal image upload (multipart) → returns { url }
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return axiosInstance
      .post("/deals/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => res.data?.data?.url || res.data?.url || "");
  },
};