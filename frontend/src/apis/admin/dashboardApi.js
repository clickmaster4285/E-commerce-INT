import axiosInstance from "../axiosInstance";

export const dashboardApi = {
  getStats: (range) =>
    axiosInstance
      .get("/dashboard/stats", { params: { range } })
      .then((res) => res.data?.data || res.data),
};
