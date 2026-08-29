import axiosInstance from "../axiosInstance";

export const orderApi = {
  getAll: (params) => 
    axiosInstance.get("/orders/admin/all", { params }).then((res) => res.data),
  
  // ✅ NEW: Single order fetch for admin
  getById: (id) => 
    axiosInstance.get(`/orders/admin/${id}`).then((res) => res.data),
    
  updateStatus: (id, data) => 
    axiosInstance.patch(`/orders/admin/${id}/status`, data).then((res) => res.data),
};