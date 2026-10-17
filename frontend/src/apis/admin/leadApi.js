import adminHttp from "../axiosInstance";

export const leadApi = {
  list: (params = {}) => adminHttp.get("/leads", { params }).then((res) => res.data),
  getById: (id) => adminHttp.get(`/leads/${id}`).then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/leads", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/leads/${id}`, data).then((res) => res.data),
  updateStatus: (id, data) => adminHttp.patch(`/leads/${id}/status`, data).then((res) => res.data),
  addActivity: (id, data) => adminHttp.post(`/leads/${id}/activities`, data).then((res) => res.data),
  delete: (id) => adminHttp.delete(`/leads/${id}`).then((res) => res.data),
};
