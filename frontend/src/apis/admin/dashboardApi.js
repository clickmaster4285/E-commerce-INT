import adminHttp from "../axiosInstance";
export const dashboardApi = {
  getStats: (params = {}) =>
    adminHttp
      .get("/dashboard/stats", { params })
      .then((res) => res.data?.data || res.data),
};
