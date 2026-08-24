import axiosInstance from "../axiosInstance";

export const addressApi = {
  getAll: () => axiosInstance.get("/addresses").then((res) => res.data?.data || []),
  create: (data) => axiosInstance.post("/addresses", data).then((res) => res.data?.data),
  update: (id, data) => axiosInstance.put(`/addresses/${id}`, data).then((res) => res.data?.data),
  remove: (id) => axiosInstance.delete(`/addresses/${id}`).then((res) => res.data),
  setDefault: (id) => axiosInstance.put(`/addresses/${id}/default`).then((res) => res.data?.data),
};
