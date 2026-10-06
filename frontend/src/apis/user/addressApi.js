import { userHttp } from "../axiosInstance";
export const addressApi = {
  getAll: () => userHttp.get("/addresses").then((res) => res.data?.data || []),
  create: (data) => userHttp.post("/addresses", data).then((res) => res.data?.data),
  update: (id, data) => userHttp.put(`/addresses/${id}`, data).then((res) => res.data?.data),
  remove: (id) => userHttp.delete(`/addresses/${id}`).then((res) => res.data),
  setDefault: (id) => userHttp.put(`/addresses/${id}/default`).then((res) => res.data?.data),
};
