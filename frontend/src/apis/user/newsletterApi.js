import { userHttp } from "../axiosInstance";

// Storefront newsletter section → backend routes/subscriberRoutes.js (guest allowed)
export const newsletterApi = {
  // source: "newsletter_section" (default) | "popup"
  subscribe: ({ email, locale, source }) => userHttp.post("/newsletter/subscribe", { email, locale, source }).then((res) => res.data),
};
