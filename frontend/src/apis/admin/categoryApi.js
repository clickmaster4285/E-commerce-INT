import adminHttp from "../axiosInstance";
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

// Server-side pagination unwrap; the list endpoint returns only page rows.
const getPaginated = (response, fallbackLimit) => {
  const payload = response?.data;

  return {
    items: Array.isArray(payload?.data) ? payload.data : [],
    counts: payload?.counts || { total: 0, root: 0, child: 0, withAttributes: 0 },
    pagination: payload?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const adminCategoryApi = {
  getAll: () =>
    adminHttp
      .get("/categories")
      .then(getList),

  getAllAdmin: () =>
    adminHttp
      .get("/categories/admin/all")
      .then(getList),

  // ✅ Server side pagination — page/limit/search/parent + sorting
  getAllPaginated: ({ page = 1, limit = 10, search = "", parent = "all", sort = "", order = "", locale = "en" } = {}) => {
    const params = { page, limit, locale };
    if (search) params.search = search;
    if (parent && parent !== "all") params.parent = parent;
    if (sort) {
      params.sort = sort;
      params.order = order || "asc";
    }
    return adminHttp
      .get("/categories/admin/all", { params })
      .then((response) => getPaginated(response, limit));
  },

  getOptions: (locale = "en") =>
    adminHttp
      .get("/categories/admin/options", { params: { locale } })
      .then(getList),

  getById: (id, locale = "en", includeAttributes = false) =>
    adminHttp
      .get(`/categories/${id}`, { params: { locale, ...(includeAttributes && { includeAttributes: "true" }) } })
      .then(getObject),

  getNextCode: () =>
    adminHttp
      .get("/categories/next-code")
      .then((response) => {
        const payload = response?.data;

        return (
          payload?.nextCode ||
          payload?.data?.nextCode ||
          payload
        );
      }),

  getAttributes: (categoryId, locale = "en") =>
    adminHttp
      .get(`/categories/${categoryId}/attributes`, { params: { locale } })
      .then(getList),

  getAttributesPaginated: (categoryId, { page = 1, limit = 10, locale = "en" } = {}) =>
    adminHttp
      .get(`/categories/${categoryId}/attributes`, { params: { page, limit, locale } })
      .then((response) => ({
        items: Array.isArray(response?.data?.data) ? response.data.data : [],
        pagination: response?.data?.pagination || { total: 0, page, limit, pages: 1, hasNext: false, hasPrev: false, variantAttributes: 0 },
      })),

  getAttributesHierarchy: (categoryId, locale = "en") =>
    adminHttp
      .get(`/categories/${categoryId}/attributes-hierarchy`, { params: { locale } })
      .then(getList),

  create: (data) =>
    adminHttp
      .post("/categories", data)
      .then(getObject),

  update: (id, data) =>
    adminHttp
      .put(`/categories/${id}`, data)
      .then(getObject),

  updateAttributes: (id, attributes) =>
    adminHttp
      .put(`/categories/${id}/attributes`, {
        attributes,
      })
      .then(getObject),

  delete: (id) =>
    adminHttp
      .delete(`/categories/${id}`)
      .then(getObject),
};

export const categoryApi = adminCategoryApi;
