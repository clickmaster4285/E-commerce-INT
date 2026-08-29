import axiosInstance from "../axiosInstance";

const getList = (response) => {
  const payload = response?.data;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const getObject = (response) => {
  return response?.data?.data || response?.data;
};

export const adminCategoryApi = {
  getAll: () =>
    axiosInstance
      .get("/categories")
      .then(getList),

  getAllAdmin: () =>
    axiosInstance
      .get("/categories/admin/all")
      .then(getList),

  getById: (id) =>
    axiosInstance
      .get(`/categories/${id}`)
      .then(getObject),

  getNextCode: () =>
    axiosInstance
      .get("/categories/next-code")
      .then((response) => {
        const payload = response?.data;

        return (
          payload?.nextCode ||
          payload?.data?.nextCode ||
          payload
        );
      }),

  getAttributes: (categoryId) =>
    axiosInstance
      .get(`/categories/${categoryId}/attributes`)
      .then(getList),

  create: (data) =>
    axiosInstance
      .post("/categories", data)
      .then(getObject),

  update: (id, data) =>
    axiosInstance
      .put(`/categories/${id}`, data)
      .then(getObject),

  updateAttributes: (id, attributes) =>
    axiosInstance
      .put(`/categories/${id}/attributes`, {
        attributes,
      })
      .then(getObject),

  delete: (id) =>
    axiosInstance
      .delete(`/categories/${id}`)
      .then(getObject),
};

export const categoryApi = adminCategoryApi;