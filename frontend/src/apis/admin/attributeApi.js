import axiosInstance from "../axiosInstance";

const unwrap = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

const unwrapObject = (res) => res?.data?.data || res?.data;

export const attributeApi = {
  getAll: (search = "") =>
    axiosInstance.get("/attributes", { params: { search } }).then(unwrap),

  getByCategory: (categoryId) =>
    axiosInstance
      .get(`/categories/${categoryId}/attributes`)
      .then(unwrap),

  create: (data) =>
    axiosInstance.post("/attributes", data).then(unwrapObject),

  update: (id, data) =>
    axiosInstance.put(`/attributes/${id}`, data).then(unwrapObject),
};
