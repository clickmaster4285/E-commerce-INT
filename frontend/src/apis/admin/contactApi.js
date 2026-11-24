import adminHttp from "../axiosInstance";

// Storefront contact form messages (backend routes/contactRoutes.js — "customers" permission)
export const contactApi = {
  list: ({ page = 1, limit = 20, status = "all", search = "" } = {}) => {
    const params = { page, limit };
    if (status && status !== "all") params.status = status;
    if (search) params.search = search;
    return adminHttp.get("/contact/admin", { params }).then((res) => res.data);
  },
  setStatus: (id, status) => adminHttp.patch(`/contact/admin/${id}`, { status }).then((res) => res.data?.data),
  remove: (id) => adminHttp.delete(`/contact/admin/${id}`).then((res) => res.data?.data),
};
