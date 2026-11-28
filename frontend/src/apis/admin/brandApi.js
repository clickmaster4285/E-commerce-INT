import adminHttp from "../axiosInstance";
// Server-side pagination must include pagination metadata; never fall back to
// rendering an unbounded legacy response in the admin brand list.
const paginated = (res) => {
  const d = res?.data;
  if (!Array.isArray(d?.data) || !d?.pagination) {
    throw new Error("Brand list API did not return server-side pagination data.");
  }
  return {
    items: d.data,
    counts: d?.counts || { total: 0, active: 0, inactive: 0, withLogo: 0 },
    countries: Array.isArray(d?.countries) ? d.countries : [],
    pagination: d.pagination,
  };
};

export const adminBrandApi = {
  getAll: () => 
    adminHttp.get("/brands/admin/all").then((res) => {
      const data = res.data;
      if (data?.success && Array.isArray(data.data)) return data.data;
      if (Array.isArray(data)) return data;
      return [];
    }),

  // Dropdown / picker — no product N+1 (§9.3)
  getOptions: ({ search = "", limit = 50, locale = "en" } = {}) =>
    adminHttp
      .get("/brands/admin/options", { params: { search: search || undefined, limit, locale } })
      .then((res) => (Array.isArray(res.data?.data) ? res.data.data : [])),

  // ✅ Server side pagination — page/limit/search/status/country + sorting
  getAllPaginated: ({ page = 1, limit = 10, search = "", status = "all", country = "all", sort = "", order = "", locale = "en" } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (country && country !== "all") params.country = country;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return adminHttp.get("/brands/admin/all", { params }).then(paginated);
  },
  
  getById: (id, locale = "en") => adminHttp.get(`/brands/${id}`, { params: { locale } }).then((res) => res.data?.data || res.data),
  
  getNextCode: () => adminHttp.get("/brands/next-code").then((res) => res.data?.data || res.data),
  
  create: (formData) => adminHttp.post("/brands", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data),
  
  update: (id, formData) => adminHttp.put(`/brands/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data),
  
  delete: (id) => adminHttp.delete(`/brands/${id}`).then((res) => res.data),
};

export const brandApi = adminBrandApi;
