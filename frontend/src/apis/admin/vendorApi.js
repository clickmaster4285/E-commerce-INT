import adminHttp from "../axiosInstance";

// ✅ Server-side pagination must include pagination metadata; never fall back to
// rendering an unbounded legacy response in the admin vendors list.
// (adminBrandApi.getAllPaginated ka exact pattern)
const paginated = (res) => {
  const d = res?.data;
  if (!Array.isArray(d?.data) || !d?.pagination) {
    throw new Error("Vendors list API did not return server-side pagination data.");
  }
  return d;
};

export const vendorApi = {
  // ✅ Legacy full-list (purchase-orders pages ka vendor dropdown isi par depend hai)
  getAll: () => adminHttp.get("/vendors/admin/all").then((res) => res.data?.data || res.data || []),

  // ✅ Server side pagination — page/limit/search/status/city + sorting + locale
  getAllPaginated: ({ page = 1, limit = 20, search = "", status = "all", city = "all", sort = "", order = "", locale = "en" } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (city && city !== "all") params.city = city;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return adminHttp.get("/vendors/admin/all", { params }).then((res) => paginated(res));
  },

  // ✅ Slim detail (selected locale translations)
  getById: (id, locale = "en") => adminHttp.get(`/vendors/${id}`, { params: { locale } }).then((res) => res.data?.data || res.data),
  getWithPOs: (id, locale = "en") => adminHttp.get(`/vendors/${id}/details`, { params: { locale } }).then((res) => res.data?.data || res.data),
  getNextCode: () => adminHttp.get("/vendors/next-code").then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/vendors", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/vendors/${id}`, data).then((res) => res.data),
  delete: (id) => adminHttp.delete(`/vendors/${id}`).then((res) => res.data),
  restore: (id) => adminHttp.post(`/vendors/${id}/restore`).then((res) => res.data),
};
