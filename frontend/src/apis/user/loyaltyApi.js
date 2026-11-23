import { userHttp } from "../axiosInstance";

export const loyaltyApi = {
  /** Public program rules — banners, checkout, product page. */
  program: () => userHttp.get("/loyalty/program").then((res) => res.data?.data),
  /** Logged-in customer's balance + history. */
  me: (params = {}) => userHttp.get("/loyalty/me", { params }).then((res) => res.data?.data),
};
