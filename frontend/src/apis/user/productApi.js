import axiosInstance from "../axiosInstance";

const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.products)) return d.products;
  return [];
};

export const productApi = {
  // ✅ PUBLIC — bina login (User GUI)
  getAll: () => axiosInstance.get("/products").then(list),

  getById: (id) =>
    axiosInstance.get(`/products/${id}`).then((res) => res.data?.data || res.data),

  getByBrand: (brandId) =>
    axiosInstance.get(`/products?brand_id=${brandId}`).then(list),
};