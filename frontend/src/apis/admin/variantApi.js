import adminHttp from "../axiosInstance";
export const variantApi = {
  getNextSku: () =>
    adminHttp.get("/variants/next-sku").then((res) => res.data?.data || res.data),

  getAll: () =>
    adminHttp.get("/variants").then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),

  getById: (id) =>
    adminHttp.get(`/variants/${id}`).then((res) => res.data?.data || res.data),

  create: (data) =>
    adminHttp.post("/variants", data).then((res) => res.data?.data || res.data),

  update: (id, data) =>
    adminHttp.put(`/variants/${id}`, data).then((res) => res.data?.data || res.data),

  delete: (id) =>
    adminHttp.delete(`/variants/${id}`).then((res) => res.data),
};