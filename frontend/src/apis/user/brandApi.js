import { userHttp } from "../axiosInstance";
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.brands)) return d.brands;
  return [];
};

export const brandApi = {
  // ✅ PUBLIC — bina login (slim=1: storefront ko _id/name/logo hi chahiye)
  getAll: () => userHttp.get("/brands", { params: { slim: 1 } }).then(list),
  getById: (id) =>
    userHttp.get(`/brands/${id}`).then((res) => res.data?.data || res.data),
  getWithProducts: (id) =>
    userHttp.get(`/brands/${id}/details`).then((res) => res.data?.data || res.data),
};