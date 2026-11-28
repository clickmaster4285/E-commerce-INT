import { userHttp } from "../axiosInstance";

export const loyaltyApi = {
  /** Public program rules — banners, checkout, product page. */
  program: () => userHttp.get("/loyalty/program").then((res) => res.data?.data),
  /** Logged-in customer's balance + history. */
  me: (params = {}) => userHttp.get("/loyalty/me", { params }).then((res) => res.data?.data),
  /** Idempotent welcome-bonus claim (bonus already credited; server marks it claimed). */
  claimWelcome: () => userHttp.post("/loyalty/me/welcome/claim").then((res) => res.data?.data),
  referrals: () => userHttp.get("/loyalty/referrals/me").then((res) => res.data?.data),
};
