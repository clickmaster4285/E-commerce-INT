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

// ✅ Server-side pagination response unwrap — baaki modules (brands/stock) ke
// same pattern ke mutabiq { items, counts, options, pagination }
const getPaginated = (response, fallbackLimit) => {
  const payload = response?.data;

  if (Array.isArray(payload)) {
    return {
      items: payload,
      counts: { total: payload.length, root: 0, child: 0, withAttributes: 0 },
      options: [],
      pagination: { total: payload.length, page: 1, limit: payload.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }

  return {
    items: Array.isArray(payload?.data) ? payload.data : [],
    counts: payload?.counts || { total: 0, root: 0, child: 0, withAttributes: 0 },
    options: Array.isArray(payload?.options) ? payload.options : [],
    pagination: payload?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
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

  // ✅ Server side pagination — page/limit/search/parent + sorting
  getAllPaginated: ({ page = 1, limit = 20, search = "", parent = "all", sort = "", order = "" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (parent && parent !== "all") params.parent = parent;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return axiosInstance
      .get("/categories/admin/all", { params })
      .then((response) => getPaginated(response, limit));
  },

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

  getAttributesHierarchy: (categoryId) =>
    axiosInstance
      .get(`/categories/${categoryId}/attributes-hierarchy`)
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