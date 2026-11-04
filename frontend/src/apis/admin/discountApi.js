import adminHttp from "../axiosInstance"; // ✅ Curly braces {} ke baghair (Default Import)
const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      stats: null,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [],
    // ✅ Backend server-side stats bhejta hai (poora dataset) — inhe aage pass karo
    stats: d?.stats || null,
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const discountApi = {
  // ✅ GET ALL DISCOUNTS
  getAll: async () => {
    try {
      // Backend route: GET /discounts
      const response = await adminHttp.get("/discounts");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching discounts:", error);
      throw error;
    }
  },

  getAllPaginated: async ({ page = 1, limit = 15, search = "", status = "all", applyTo = "", locale = "en" } = {}) => {
    const params = { page, limit, admin_list: 1, locale };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (applyTo && applyTo !== "all") params.applyTo = applyTo;
    return adminHttp.get("/discounts", { params }).then((res) => paginated(res, limit));
  },

  // ✅ GET SINGLE DISCOUNT
  getById: async (id, { compact = false, locale = "en" } = {}) => {
    try {
      if (!id) throw new Error("Discount ID is required");
      const response = await adminHttp.get(`/discounts/${id}`, { params: compact ? { admin_detail: 1, locale } : undefined });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching discount ${id}:`, error);
      throw error;
    }
  },

  getTargetsPaginated: async (id, { type, page = 1, limit = 10, locale = "en" } = {}) => {
    const response = await adminHttp.get(`/discounts/${id}/targets`, { params: { type, page, limit, locale } });
    return {
      items: Array.isArray(response.data?.data) ? response.data.data : [],
      pagination: response.data?.pagination || { total: 0, page, limit, pages: 1, hasNext: false, hasPrev: false },
    };
  },

  // ✅ CREATE DISCOUNT
  create: async (data) => {
    try {
      const response = await adminHttp.post("/discounts", data);
      return response.data;
    } catch (error) {
      console.error("❌ Error creating discount:", error);
      throw error;
    }
  },

  // ✅ UPDATE DISCOUNT
  update: async (id, data) => {
    try {
      if (!id) throw new Error("Discount ID is required");
      const response = await adminHttp.put(`/discounts/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating discount ${id}:`, error);
      throw error;
    }
  },

  // ✅ DELETE DISCOUNT
  delete: async (id) => {
    try {
      if (!id) throw new Error("Discount ID is required");
      const response = await adminHttp.delete(`/discounts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error deleting discount ${id}:`, error);
      throw error;
    }
  },

  // ✅ PUBLIC DISCOUNTS
  getPublic: async () => {
    try {
      const response = await adminHttp.get("/discounts/public");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching public discounts:", error);
      throw error;
    }
  },
};
