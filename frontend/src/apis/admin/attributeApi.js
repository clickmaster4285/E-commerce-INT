import axiosInstance from "../axiosInstance";

const unwrap = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

const unwrapObject = (res) => res?.data?.data || res?.data;

const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const attributeApi = {
  getAll: (params = "") => {
    const query = {};
    if (typeof params === "string") {
      if (params) query.search = params;
    } else if (params && typeof params === "object") {
      Object.assign(query, params);
    }
    return axiosInstance.get("/attributes", { params: query }).then(unwrap);
  },

  getAllPaginated: ({ page = 1, limit = 20, search = "", category = "" } = {}) => {
    const query = { page, limit };
    if (search) query.search = search;
    if (category && category !== "all") query.category = category;
    return axiosInstance.get("/attributes", { params: query }).then((res) => paginated(res, limit));
  },

  getById: (id) =>
    axiosInstance.get(`/attributes/${id}`).then(unwrapObject),

  getByCategory: (categoryId) =>
    axiosInstance
      .get(`/categories/${categoryId}/attributes`)
      .then(unwrap),

  create: (data) =>
    axiosInstance.post("/attributes", data).then(unwrapObject),

  update: (id, data) =>
    axiosInstance.put(`/attributes/${id}`, data).then(unwrapObject),

  getCategories: (id) =>
    axiosInstance.get(`/attributes/${id}/categories`).then(unwrap),

  updateCategories: (id, categoryIds) =>
    axiosInstance.put(`/attributes/${id}/categories`, { category_ids: categoryIds }).then(unwrapObject),
};