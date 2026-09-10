import axiosInstance from "../axiosInstance";

const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.categories)) return d.categories;
  return [];
};

export const categoryApi = {
  // ✅ PUBLIC — naye /public endpoint pe (bina login)
  getAll: () => axiosInstance.get("/categories/public").then(list),

  // Admin-only — abhi bhi auth ke saath
  getById: (id) =>
    axiosInstance.get(`/categories/${id}`).then((res) => res.data?.data || res.data),
};