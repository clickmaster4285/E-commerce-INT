import adminHttp from "../axiosInstance";

// Newsletter subscribers (backend routes/subscriberRoutes.js — "customers" permission)
export const subscriberApi = {
  list: ({ page = 1, limit = 20, search = "", status = "all" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    return adminHttp.get("/newsletter/admin", { params }).then((res) => res.data);
  },
  setStatus: (id, status) => adminHttp.patch(`/newsletter/admin/${id}`, { status }).then((res) => res.data?.data),
  remove: (id) => adminHttp.delete(`/newsletter/admin/${id}`).then((res) => res.data?.data),
  // CSV blob → browser download
  exportCsv: async ({ search = "", status = "all" } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    const res = await adminHttp.get("/newsletter/admin/export", { params, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
