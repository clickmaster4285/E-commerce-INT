import adminHttp from "../axiosInstance";

export const financeApi = {
  getOverview: (params = {}) => adminHttp.get("/finance/overview", { params }).then((response) => response.data?.data || response.data),
};
