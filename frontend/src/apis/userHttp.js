import { createAuthHttp } from "./httpFactory";

// ==========================================
// 👤 USER HTTP — storefront (user GUI)
// Koi admin logic nahi: na /admin redirect, na localStorage.clear,
// na /users/admin/login. Refresh endpoint purana user wala.
// ==========================================

const userHttp = createAuthHttp({
  refreshUrl: "/users/refresh-token",
  publicAuthPaths: [
    "/users/login",
    "/users/register",
    "/users/logout",
    "/users/send-email-otp",
    "/users/verify-email-otp",
    "/users/forgot-password",
    "/users/verify-reset-otp",
    "/users/reset-password",
  ],
  mode: "user",
});

export default userHttp;
