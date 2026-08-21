import axiosInstance from "../axiosInstance"; // Same instance as other APIs

export const dealApi = {
  // ==========================================
  // GET ALL DEALS
  // ==========================================

  getAll: (params = {}) =>
    axiosInstance
      .get("/deals", {
        params,
      })
      .then((res) => res.data),

  // ==========================================
  // GET SINGLE DEAL
  // ==========================================

  getById: (id) =>
    axiosInstance
      .get(`/deals/${id}`)
      .then((res) => res.data),

  // ==========================================
  // CREATE NEW DEAL
  // ==========================================

  create: (data) =>
    axiosInstance
      .post("/deals", data)
      .then((res) => res.data),

  // ==========================================
  // UPDATE EXISTING DEAL
  // ==========================================

  update: (id, data) =>
    axiosInstance
      .put(`/deals/${id}`, data)
      .then((res) => res.data),

  // ==========================================
  // DELETE DEAL
  // ==========================================

  delete: (id) =>
    axiosInstance
      .delete(`/deals/${id}`)
      .then((res) => res.data),

  // ==========================================
  // TOGGLE DEAL STATUS
  // ==========================================

  toggleStatus: (id) =>
    axiosInstance
      .patch(`/deals/${id}/toggle-status`)
      .then((res) => res.data),
};