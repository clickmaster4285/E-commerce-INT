import axiosInstance from "../axiosInstance";

export const tagApi = {
  getAll: () => axiosInstance.get("/tags").then((res) => res.data),
  create: (data) => axiosInstance.post("/tags", data).then((res) => res.data),
  update: (id, data) => axiosInstance.put(`/tags/${id}`, data).then((res) => res.data),
  delete: (id) => axiosInstance.delete(`/tags/${id}`).then((res) => res.data),
};