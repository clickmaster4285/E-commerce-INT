import adminHttp from "../axiosInstance";

const unwrap = (response) => response.data?.data ?? response.data;

export const quoteApi = {
  list: () => adminHttp.get("/quotes").then(unwrap),
  getById: (id) => adminHttp.get(`/quotes/${id}`).then(unwrap),
  create: (payload) => adminHttp.post("/quotes", payload).then(unwrap),
  update: (id, payload) => adminHttp.put(`/quotes/${id}`, payload).then(unwrap),
  updateStatus: (id, status) => adminHttp.patch(`/quotes/${id}/status`, { status }).then(unwrap),
};
