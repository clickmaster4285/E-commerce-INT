import axiosInstance from "../axiosInstance";

const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.brands)) return d.brands;
  return [];
};

export const brandApi = {
  // ✅ PUBLIC — bina login
  getAll: () => axiosInstance.get("/brands").then(list),
  getById: (id) =>
    axiosInstance.get(`/brands/${id}`).then((res) => res.data?.data || res.data),
  getWithProducts: (id) =>
    axiosInstance.get(`/brands/${id}/details`).then((res) => res.data?.data || res.data),
};