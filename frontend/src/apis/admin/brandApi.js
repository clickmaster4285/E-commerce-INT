import axiosInstance from "../axiosInstance";

// ✅ Server-side pagination response unwrap — baaki modules (stock/discounts)
// ke pattern ke mutabiq { items, counts, countries, pagination }
const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      counts: { total: d.length, active: 0, inactive: 0, withLogo: 0 },
      countries: [],
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : [],
    counts: d?.counts || { total: 0, active: 0, inactive: 0, withLogo: 0 },
    countries: Array.isArray(d?.countries) ? d.countries : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const adminBrandApi = {
  getAll: () => 
    axiosInstance.get("/brands/admin/all").then((res) => {
      const data = res.data;
      if (data?.success && Array.isArray(data.data)) return data.data;
      if (Array.isArray(data)) return data;
      return [];
    }),

  // ✅ Server side pagination — page/limit/search/status/country + sorting
  getAllPaginated: ({ page = 1, limit = 20, search = "", status = "all", country = "all", sort = "", order = "" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (country && country !== "all") params.country = country;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return axiosInstance.get("/brands/admin/all", { params }).then((res) => paginated(res, limit));
  },
  
  getById: (id) => axiosInstance.get(`/brands/${id}`).then((res) => res.data?.data || res.data),
  
  getNextCode: () => axiosInstance.get("/brands/next-code").then((res) => res.data?.data || res.data),
  
  create: (formData) => axiosInstance.post("/brands", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data),
  
  update: (id, formData) => axiosInstance.put(`/brands/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data),
  
  delete: (id) => axiosInstance.delete(`/brands/${id}`).then((res) => res.data),
};

export const brandApi = adminBrandApi;