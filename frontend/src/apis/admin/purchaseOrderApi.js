import adminHttp from "../axiosInstance";

export const purchaseOrderApi = {
  getAll: (params) => adminHttp.get("/purchase-orders/admin/all", { params }).then((res) => res.data),
  getById: (id) => adminHttp.get(`/purchase-orders/admin/${id}`).then((res) => res.data),
  getNextCode: () => adminHttp.get("/purchase-orders/next-code").then((res) => res.data?.data || res.data),
  create: (data) => adminHttp.post("/purchase-orders", data).then((res) => res.data),
  update: (id, data) => adminHttp.put(`/purchase-orders/${id}`, data).then((res) => res.data),
  send: (id) => adminHttp.patch(`/purchase-orders/admin/${id}/send`).then((res) => res.data),
  confirm: (id) => adminHttp.patch(`/purchase-orders/admin/${id}/confirm`).then((res) => res.data),
  cancel: (id, cancel_reason) => adminHttp.patch(`/purchase-orders/admin/${id}/cancel`, { cancel_reason }).then((res) => res.data),
  close: (id) => adminHttp.patch(`/purchase-orders/admin/${id}/close`).then((res) => res.data),
  receive: (id, payload) => adminHttp.post(`/purchase-orders/admin/${id}/receive`, payload).then((res) => res.data),
  recordPayment: (id, payload) => adminHttp.patch(`/purchase-orders/admin/${id}/payment`, payload).then((res) => res.data),
};
