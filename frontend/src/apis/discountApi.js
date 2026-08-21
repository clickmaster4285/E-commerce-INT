import axiosInstance from "./axiosInstance"; // Same instance as other APIs

export const discountApi = {
  // Get all discounts
  getAll: () =>
    axiosInstance.get("/discounts").then((res) => res.data),

  // Create new discount
  create: (data) =>
    axiosInstance.post("/discounts", data).then((res) => res.data),

  // Update existing discount
  update: (id, data) =>
    axiosInstance.put(`/discounts/${id}`, data).then((res) => res.data),

  // Delete/Disable discount
  delete: (id) =>
    axiosInstance.delete(`/discounts/${id}`).then((res) => res.data),

  // Optional: Get single discount by ID
  getById: (id) =>
    axiosInstance.get(`/discounts/${id}`).then((res) => res.data),
};