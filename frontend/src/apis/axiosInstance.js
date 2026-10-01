import axios from "axios";
import { toast } from "sonner";

// ==========================================
// 🔥 DYNAMIC BASE URL — Current hostname use karta hai
// ==========================================
const getBaseURL = () => {
  if (typeof window === "undefined") {
    // SSR (server-side render) — env se lo
    return process.env.NEXT_PUBLIC_SERVERURL ;
  }
  // Client — jis host par frontend khula hai, wahi use karo
  const hostname = window.location.hostname;
  return `http://${hostname}:5000/api`;
};

const axiosInstance = axios.create({
  withCredentials: true, // 🔥 Cookies bhejne ke liye zaroori
});

// ==========================================
// 📤 Request Interceptor — baseURL dynamically set karo
// ==========================================
axiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getBaseURL(); // ✅ Har request mein current host use hoga
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================
// 🔐 HELPER: Sirf Admin pages par redirect kare
// ==========================================
const redirectToLogin = () => {
  if (typeof window === "undefined") return;

  const path = window.location.pathname;

  if (path === "/login" || path === "/register" || path === "/admin/login") {
    return;
  }

  if (path.startsWith("/admin")) {
    localStorage.clear();
    window.location.href = "/admin/login";
    return;
  }
};

// ==========================================
// 📥 Response Interceptor
// ==========================================
axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // 🚦 429 — rate limit: global toast (OTP card ka apna retryAfter cooldown flow alag se chalta rehta hai)
    if (error.response?.status === 429) {
      const retryAfter = Number(error.response?.data?.retryAfter);
      toast.error(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? `${retryAfter} seconds baad try karein`
          : "Too many requests. Please try again later.",
      );
    }

    // 🛑 Public auth requests par refresh-token logic skip karo
    // (OTP verify endpoints 400/429 dete hain — unpar redirect nahi hona chahiye)
    const publicAuthPaths = [
      "/users/login",
      "/users/admin/login",
      "/users/register",
      "/users/logout",
      "/users/send-email-otp",
      "/users/verify-email-otp",
      "/users/forgot-password",
      "/users/verify-reset-otp",
      "/users/reset-password",
    ];
    const isLoginRequest = publicAuthPaths.some((path) =>
      originalRequest.url?.includes(path),
    );

    if (isLoginRequest) {
      return Promise.reject(error);
    }

    // 401 Unauthorized — refresh token try karo
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url === "/users/refresh-token") {
        redirectToLogin();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        await axiosInstance.post("/users/refresh-token");
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;