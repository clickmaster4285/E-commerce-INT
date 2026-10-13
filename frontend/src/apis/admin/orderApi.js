import adminHttp from "../axiosInstance";
export const orderApi = {
  getAll: (params) => 
    adminHttp.get("/orders/admin/all", { params }).then((res) => res.data),
   
  // ✅ Product history summary (units/revenue/date range + status breakdown)
  getProductSummary: (params) =>
    adminHttp.get("/orders/admin/product-summary", { params }).then((res) => res.data),
  
  // ✅ NEW: Single order fetch for admin
  getById: (id) => 
    adminHttp.get(`/orders/admin/${id}`).then((res) => res.data),
    
  updateStatus: (id, data) => 
    adminHttp.patch(`/orders/admin/${id}/status`, data).then((res) => res.data),

    updatePayment: (id, data) =>
    adminHttp.patch(`/orders/admin/${id}/payment`, data).then((res) => res.data),
};