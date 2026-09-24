import axiosInstance from "../axiosInstance"; // ✅ Curly braces {} ke baghair (Default Import)

const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

export const discountApi = {
  // ✅ GET ALL DISCOUNTS
  getAll: async () => {
    try {
      // Backend route: GET /discounts
      const response = await axiosInstance.get("/discounts");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching discounts:", error);
      throw error;
    }
  },

  getAllPaginated: async ({ page = 1, limit = 15, search = "", status = "all" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    return axiosInstance.get("/discounts", { params }).then((res) => paginated(res, limit));
  },

  // ✅ GET SINGLE DISCOUNT
  getById: async (id) => {
    try {
      if (!id) throw new Error("Discount ID is required");
      const response = await axiosInstance.get(`/discounts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching discount ${id}:`, error);
      throw error;
    }
  },

  // ✅ CREATE DISCOUNT
  create: async (data) => {
    try {
      const response = await axiosInstance.post("/discounts", data);
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
      const response = await axiosInstance.put(`/discounts/${id}`, data);
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
      const response = await axiosInstance.delete(`/discounts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error deleting discount ${id}:`, error);
      throw error;
    }
  },

  // ✅ PUBLIC DISCOUNTS
  getPublic: async () => {
    try {
      const response = await axiosInstance.get("/discounts/public");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching public discounts:", error);
      throw error;
    }
  },
};