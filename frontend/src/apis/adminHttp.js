import { createAuthHttp } from "./httpFactory";

// ==========================================
// 🛡️ ADMIN HTTP — admin panel (purana behavior 1:1)
// Refresh fail → localStorage.clear + /admin/login redirect.
// Endpoint: naya admin alias (type==='employee' check, shape same).
// ==========================================

const adminHttp = createAuthHttp({
  refreshUrl: "/users/admin/refresh-token",
  publicAuthPaths: [
    "/users/login",
    "/users/admin/login",
    "/users/register",
    "/users/logout",
    "/users/send-email-otp",
    "/users/verify-email-otp",
    "/users/forgot-password",
    "/users/verify-reset-otp",
    "/users/reset-password",
  ],
  mode: "admin",
});

export default adminHttp;
