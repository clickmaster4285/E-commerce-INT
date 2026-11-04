import adminHttp from "../axiosInstance";

export const leadApi = {
  // ✅ Server side pagination — page/limit/search/filters + sorting + locale;
  //    strict meta check (brands pattern)
  list: ({ page = 1, limit = 10, search = "", status = "", lead_type = "", source = "", assigned_employee_id = "", sort = "", order = "", locale = "en" } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (status) params.status = status;
    if (lead_type) params.lead_type = lead_type;
    if (source) params.source = source;
    if (assigned_employee_id) params.assigned_employee_id = assigned_employee_id;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return adminHttp.get("/leads", { params }).then((res) => {
      const d = res?.data;
      if (!Array.isArray(d?.data) || !d?.pagination) {
        throw new Error("Leads list API did not return server-side pagination data.");
      }
      return d;
    });
  },
  // ✅ Slim detail (locale passed for API consistency)
  getById: (id, locale = "en") => adminHttp.get(`/leads/${id}`, { params: { locale } }).then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/leads", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/leads/${id}`, data).then((res) => res.data),
  updateStatus: (id, data) => adminHttp.patch(`/leads/${id}/status`, data).then((res) => res.data),
  addActivity: (id, data) => adminHttp.post(`/leads/${id}/activities`, data).then((res) => res.data),
  delete: (id) => adminHttp.delete(`/leads/${id}`).then((res) => res.data),
};
