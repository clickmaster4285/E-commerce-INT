import { userHttp } from "../axiosInstance";

// Storefront newsletter section → backend routes/subscriberRoutes.js (guest allowed)
export const newsletterApi = {
  subscribe: ({ email, locale }) => userHttp.post("/newsletter/subscribe", { email, locale }).then((res) => res.data),
};
