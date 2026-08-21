import axiosInstance from "./axiosInstance";

export const orderApi = {
  place: (data) => axiosInstance.post("/orders", data).then((res) => res.data?.data),
  myOrders: () => axiosInstance.get("/orders/my").then((res) => res.data?.data || []),
  getById: (id) => axiosInstance.get(`/orders/${id}`).then((res) => res.data?.data),
};