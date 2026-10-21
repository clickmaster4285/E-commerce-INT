import adminHttp from "../axiosInstance";

const unwrap = (response) => response.data?.data ?? response.data;

export const invoiceApi = {
  list: () => adminHttp.get("/invoices").then(unwrap),
  getById: (id) => adminHttp.get(`/invoices/${id}`).then(unwrap),
  create: (payload) => adminHttp.post("/invoices", payload).then(unwrap),
  send: (id) => adminHttp.post(`/invoices/${id}/send`).then(unwrap),
  recordPayment: (id, payment) => adminHttp.post(`/invoices/${id}/payments`, payment).then(unwrap),
  recordReturn: (id, payload) => adminHttp.post(`/invoices/${id}/returns`, payload).then(unwrap),
};
