import axiosInstance from "../axiosInstance"; // ✅ Curly braces {} ke baghair (Default Import)

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