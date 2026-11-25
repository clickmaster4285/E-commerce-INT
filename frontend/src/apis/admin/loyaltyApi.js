import adminHttp from "../axiosInstance";

export const loyaltyApi = {
  overview: () => adminHttp.get("/loyalty/admin/overview").then((res) => res.data?.data),
  getSettings: () => adminHttp.get("/loyalty/admin/settings").then((res) => res.data?.data),
  saveSettings: (data) => adminHttp.put("/loyalty/admin/settings", data).then((res) => res.data),
  members: (params = {}) => adminHttp.get("/loyalty/admin/members", { params }).then((res) => res.data),
  member: (userId, params = {}) => adminHttp.get(`/loyalty/admin/members/${userId}`, { params }).then((res) => res.data?.data),
  adjust: (userId, data) => adminHttp.post(`/loyalty/admin/members/${userId}/adjust`, data).then((res) => res.data),
  transactions: (params = {}) => adminHttp.get("/loyalty/admin/transactions", { params }).then((res) => res.data),
  referrals: () => adminHttp.get("/loyalty/admin/referrals").then((res) => res.data?.data),
  saveReferrals: (data) => adminHttp.put("/loyalty/admin/referrals", data).then((res) => res.data),
};
