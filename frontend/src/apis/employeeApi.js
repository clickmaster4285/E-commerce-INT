import axiosInstance from "./axiosInstance";

// ✅ Helper: Unwrap API response — { success, data } se actual data nikalo
const unwrap = (response) => {
  if (!response) return null;
  // Backend returns: { success: true, data: {...} }
  // response.data from axios = { success: true, data: {...} }
  if (response.success !== undefined && response.data !== undefined) {
    return response.data;
  }
  // Already unwrapped
  return response;
};

// ✅ Helper: Get current user ID from cookie (not localStorage)
const getCurrentUserId = () => {
  if (typeof window === "undefined") return null;
  
  // Try reading from cookie first
  const cookies = document.cookie.split(";").reduce((acc, cookie) => {
    const [key, ...val] = cookie.trim().split("=");
    if (key) acc[key] = val.join("=");
    return acc;
  }, {});
  
  // Check common cookie names for user ID
  const userId = cookies.current_staff_id || cookies.userId || cookies.user_id;
  if (userId) return userId;
  
  // Fallback: try localStorage (for backward compatibility during transition)
  const stored = localStorage.getItem("current_staff_id");
  if (stored) return stored;
  
  return null;
};

export const employeeApi = {
  getAll: async () => {
    const response = await axiosInstance.get("/employees");
    return unwrap(response.data);
  },

  getById: async (id) => {
    const response = await axiosInstance.get(`/employees/${id}`);
    return unwrap(response.data);
  },

  create: async (data) => {
    const response = await axiosInstance.post("/employees", data);
    return unwrap(response.data);
  },

  update: async (id, data) => {
    const currentUserId = getCurrentUserId();

    // 🛑 SECURITY CHECK: Block self-permission edits
    if (currentUserId && currentUserId === id && data.permissions) {
      throw new Error(
        "SECURITY_RESTRICTION: You cannot modify your own permissions. Please contact an administrator."
      );
    }

    try {
      const response = await axiosInstance.put(`/employees/${id}`, data);
      return unwrap(response.data);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to update employee";
      throw new Error(message);
    }
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/employees/${id}`);
    return unwrap(response.data);
  },

  toggleStatus: async (id) => {
    const response = await axiosInstance.patch(`/employees/${id}/toggle-status`);
    return unwrap(response.data);
  },
};