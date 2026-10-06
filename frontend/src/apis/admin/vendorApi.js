import adminHttp from "../adminHttp";

export const vendorApi = {
  getAll: () => adminHttp.get("/vendors/admin/all").then((res) => res.data?.data || res.data || []),
  getAllPaginated: ({ page = 1, limit = 20, search = "", status = "all", city = "all" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (city && city !== "all") params.city = city;
    return adminHttp.get("/vendors/admin/all", { params }).then((res) => res.data);
  },
  getById: (id) => adminHttp.get(`/vendors/${id}`).then((res) => res.data?.data || res.data),
  getWithPOs: (id) => adminHttp.get(`/vendors/${id}/details`).then((res) => res.data?.data || res.data),
  getNextCode: () => adminHttp.get("/vendors/next-code").then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/vendors", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/vendors/${id}`, data).then((res) => res.data),
  delete: (id) => adminHttp.delete(`/vendors/${id}`).then((res) => res.data),
  restore: (id) => adminHttp.post(`/vendors/${id}/restore`).then((res) => res.data),
};
