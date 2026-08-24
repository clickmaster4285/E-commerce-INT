import axiosInstance from "../axiosInstance";

const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.categories)) return d.categories;
  return [];
};

export const categoryApi = {
  // ✅ PUBLIC — bina login (User GUI)
  getAll: () => axiosInstance.get("/categories").then(list),

  getById: (id) =>
    axiosInstance.get(`/categories/${id}`).then((res) => res.data?.data || res.data),
};