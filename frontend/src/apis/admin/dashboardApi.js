import adminHttp from "../axiosInstance";
export const dashboardApi = {
  getStats: (range) =>
    adminHttp
      .get("/dashboard/stats", { params: { range } })
      .then((res) => res.data?.data || res.data),
};
