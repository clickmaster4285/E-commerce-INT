import axiosInstance from "../axiosInstance";

// ============================================================
// HELPER: UNWRAP API RESPONSE
// Backend response: { success: true, data: {...} }
// ============================================================
const unwrap = (response) => {
  if (!response) return null;
  if (response.success !== undefined && response.data !== undefined) {
    return response.data;
  }
  return response;
};

// ============================================================
// EMPLOYEE API
// ============================================================
export const employeeApi = {
  // ==========================================================
  // GET ALL EMPLOYEES
  // ==========================================================
  getAll: async () => {
    try {
      const response = await axiosInstance.get("/employees", { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error("❌ getAllEmployees error:", error);
      if (error.code === 'ECONNABORTED') throw new Error("Request timed out. Backend respond nahi kar raha.");
      throw new Error(error.response?.data?.message || "Failed to fetch employees");
    }
  },

  // ==========================================================
  // GET EMPLOYEE BY ID
  // ==========================================================
  getById: async (id) => {
    if (!id) throw new Error("Employee ID is required");

    try {
      const response = await axiosInstance.get(`/employees/${id}`, { timeout: 10000 }); // ✅ 10s Timeout Added
      return unwrap(response.data);
    } catch (error) {
      console.error(`❌ getEmployeeById (${id}) error:`, error);
      if (error.code === 'ECONNABORTED') throw new Error("Request timed out. Backend respond nahi kar raha.");
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch employee details");
    }
  },

  // ==========================================================
  // CREATE EMPLOYEE
  // ==========================================================
  create: async (data) => {
    if (!data?.name || !data?.email || !data?.password) {
      throw new Error("Name, email and password are required");
    }
    try {
      const response = await axiosInstance.post("/employees", data, { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error("❌ createEmployee error:", error);
      throw new Error(error.response?.data?.message || "Failed to create employee");
    }
  },

  // ==========================================================
  // UPDATE EMPLOYEE
  // ==========================================================
  update: async (id, data) => {
    if (!id) throw new Error("Employee ID is required");
    try {
      const response = await axiosInstance.put(`/employees/${id}`, data, { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error(`❌ updateEmployee (${id}) error:`, error);
      throw new Error(error.response?.data?.message || error.message || "Failed to update employee");
    }
  },

  // ==========================================================
  // DELETE EMPLOYEE
  // ==========================================================
  delete: async (id) => {
    if (!id) throw new Error("Employee ID is required");
    try {
      const response = await axiosInstance.delete(`/employees/${id}`, { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error(`❌ deleteEmployee (${id}) error:`, error);
      throw new Error(error.response?.data?.message || "Failed to delete employee");
    }
  },

  // ==========================================================
  // TOGGLE EMPLOYEE STATUS
  // ==========================================================
  toggleStatus: async (id) => {
    if (!id) throw new Error("Employee ID is required");
    try {
      const response = await axiosInstance.patch(`/employees/${id}/toggle-status`, { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error(`❌ toggleStatus (${id}) error:`, error);
      throw new Error(error.response?.data?.message || "Failed to toggle employee status");
    }
  },

  // ==========================================================
  // GET EMPLOYEE BY USER ID
  // ==========================================================
  getByUserId: async (userId) => {
    if (!userId) throw new Error("User ID is required");
    try {
      const response = await axiosInstance.get(`/employees/by-user/${userId}`, { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error(`❌ getEmployeeByUserId (${userId}) error:`, error);
      throw new Error(error.response?.data?.message || "Failed to fetch employee by user ID");
    }
  },

  // ==========================================================
  // BULK DELETE
  // ==========================================================
  bulkDelete: async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("At least one employee ID is required");
    }
    try {
      const response = await axiosInstance.post("/employees/bulk-delete", { ids }, { timeout: 10000 });
      return unwrap(response.data);
    } catch (error) {
      console.error("❌ bulkDelete error:", error);
      throw new Error(error.response?.data?.message || "Failed to delete employees");
    }
  },
};