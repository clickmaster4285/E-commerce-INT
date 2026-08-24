import axiosInstance from "../axiosInstance";

const unwrap = (response) => {
  if (!response) return null;
  if (response.success !== undefined && response.data !== undefined) {
    return response.data;
  }
  return response;
};

export const employeeApi = {
  getAll: async () => {
    const response = await axiosInstance.get("/employees");
    return unwrap(response.data);
  },

  getById: async (id) => {
    if (!id) throw new Error("Employee ID is required");
    const response = await axiosInstance.get(`/employees/${id}`);
    return unwrap(response.data);
  },

  create: async (data) => {
    if (!data?.name || !data?.email || !data?.password) {
      throw new Error("Name, email and password are required");
    }
    const response = await axiosInstance.post("/employees", data);
    return unwrap(response.data);
  },

  update: async (id, data) => {
    if (!id) throw new Error("Employee ID is required");
    const response = await axiosInstance.put(`/employees/${id}`, data);
    return unwrap(response.data);
  },

  delete: async (id) => {
    if (!id) throw new Error("Employee ID is required");
    const response = await axiosInstance.delete(`/employees/${id}`);
    return unwrap(response.data);
  },

  toggleStatus: async (id) => {
    if (!id) throw new Error("Employee ID is required");
    const response = await axiosInstance.patch(`/employees/${id}/toggle-status`);
    return unwrap(response.data);
  },

  getByUserId: async (userId) => {
    if (!userId) throw new Error("User ID is required");
    const response = await axiosInstance.get(`/employees/by-user/${userId}`);
    return unwrap(response.data);
  },

  bulkDelete: async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("At least one employee ID is required");
    }
    const response = await axiosInstance.post("/employees/bulk-delete", { ids });
    return unwrap(response.data);
  },
};