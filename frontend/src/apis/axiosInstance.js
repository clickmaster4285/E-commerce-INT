import axios from "axios";

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

    // 🛑 Login request par refresh token logic skip karo
    const isLoginRequest =
      originalRequest.url?.includes("/users/login") ||
      originalRequest.url?.includes("/users/admin/login") ||
      originalRequest.url?.includes("/users/register");

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