import adminHttp from "../adminHttp";
export const dealApi = {
  getAll: (params = {}) =>
    adminHttp.get("/deals", { params }).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),

  // ✅ SERVER-SIDE PAGINATION — { deals, stats, pagination } poora response deta hai
  //    (banners page ke deal picker ko getAll chahiye, is liye woh hataya nahi gaya).
  getPaginated: (params = {}) =>
    adminHttp.get("/deals", { params }).then((res) => ({
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
    adminHttp.get(`/deals/${id}`).then((res) => res.data?.data || res.data),

  create: (data) =>
    adminHttp.post("/deals", data).then((res) => res.data?.data || res.data),

  update: (id, data) =>
    adminHttp.put(`/deals/${id}`, data).then((res) => res.data?.data || res.data),

  delete: (id) =>
    adminHttp.delete(`/deals/${id}`).then((res) => res.data),

  toggleStatus: (id) =>
    adminHttp.patch(`/deals/${id}/toggle-status`).then((res) => res.data?.data || res.data),

  // ✅ Bundle deal image upload (multipart) → returns { url }
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return adminHttp
      .post("/deals/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => res.data?.data?.url || res.data?.url || "");
  },
};