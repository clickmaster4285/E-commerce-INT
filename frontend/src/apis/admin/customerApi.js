import adminHttp from "../axiosInstance";

export const customerApi = {
  getAll: (params = {}) => adminHttp.get("/customers/admin/all", { params }).then((res) => res.data?.data || res.data || []),
  search: (search = "") => adminHttp.get("/customers/search", { params: { search } }).then((res) => res.data?.data || res.data || []),
  getById: (id) => adminHttp.get(`/customers/${id}`).then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/customers", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/customers/${id}`, data).then((res) => res.data),
  delete: (id) => adminHttp.delete(`/customers/${id}`).then((res) => res.data),
};
