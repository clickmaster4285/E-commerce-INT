import axios from "axios";
import { toast } from "sonner";

// ==========================================================
// API BASE URL — single source of truth (frontend/.env driven)
// ----------------------------------------------------------
// `NEXT_PUBLIC_SERVERURL` hi wo env var hai jo poore app me backend ka
// origin batati hai (images/uploads/pages bhi isi se derive karte hain).
//
// PEHLE yahan `process.env.NEXT_PUBLIC_API_URL || "/api"` tha. Wo env var
// kahin define hi nahi tha, is liye har request relative `/api/...` par jaati
// thi — yaani seedha Next.js dev server par, jahan koi /api route nahi hai.
// Wahan se HTML 404 aata tha (body JSON nahi → toast "Login failed. Please try
// again.") aur backend tak request kabhi pohunchti hi nahi thi.
//
// Ab: koi bhi hard-coded ya guess kiya hua fallback NAHI hai. Agar env missing
// hai to API_BASE_URL `null` rehta hai aur request fail hoti hai — saaf saaf,
// chup-chap se kisi aur host par bhaagne ke bajaye. Missing config ka clear
// message console me aata hai.
const API_BASE_URL =
  (process.env.NEXT_PUBLIC_SERVERURL || "").trim().replace(/\/+$/, "") || null;

if (!API_BASE_URL && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.error(
    "[api] NEXT_PUBLIC_SERVERURL missing hai — API requests fail hongi. " +
      "frontend/.env me set karo, e.g. NEXT_PUBLIC_SERVERURL=http://<host>:5000/api",
  );
}

const getBaseURL = () => API_BASE_URL;

const PUBLIC_AUTH_PATHS = [
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

const USER_PUBLIC_AUTH_PATHS = PUBLIC_AUTH_PATHS.filter((path) => path !== "/users/admin/login");
const FRIENDLY_SESSION_EXPIRED = "Session expired. Please log in again.";

const notifyUserSessionExpired = () => {
  try {
    window.dispatchEvent(new CustomEvent("user-session-expired"));
  } catch {
    // Ignore when requests fail during server rendering.
  }
};

function createAuthHttp({ refreshUrl, publicAuthPaths, mode }) {
  const http = axios.create({ withCredentials: true });
  let refreshPromise = null;

  const startRefresh = () => {
    if (!refreshPromise) {
      refreshPromise = http.post(refreshUrl).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  };

  const redirectToAdminLogin = () => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (["/login", "/register", "/admin/login"].includes(path)) return;
    if (path.startsWith("/admin")) {
      localStorage.clear();
      window.location.href = "/admin/login";
    }
  };

  const withFriendlyMessage = (error) => {
    if (error?.response?.data && typeof error.response.data === "object") {
      error.response.data = { ...error.response.data, message: FRIENDLY_SESSION_EXPIRED };
      return error;
    }
    const friendly = new Error(FRIENDLY_SESSION_EXPIRED);
    friendly.response = error?.response;
    friendly.status = error?.response?.status;
    return friendly;
  };

  http.interceptors.request.use(
    (config) => {
      config.baseURL = getBaseURL();
      return config;
    },
    (error) => Promise.reject(error),
  );

  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 429) {
        const retryAfter = Number(error.response?.data?.retryAfter);
        toast.error(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? `Please try again in ${retryAfter} seconds.`
            : "Too many requests. Please try again later.",
        );
      }

      const isPublicAuthRequest = publicAuthPaths.some((path) => originalRequest?.url?.includes(path));
      if (isPublicAuthRequest) return Promise.reject(error);

      if (error.response?.status === 401 && !originalRequest?._retry) {
        if (originalRequest?.url === refreshUrl) {
          if (mode === "admin") {
            redirectToAdminLogin();
            return Promise.reject(error);
          }
          notifyUserSessionExpired();
          return Promise.reject(withFriendlyMessage(error));
        }

        originalRequest._retry = true;
        try {
          await startRefresh();
          return http(originalRequest);
        } catch (refreshError) {
          if (mode === "admin") {
            redirectToAdminLogin();
            return Promise.reject(refreshError);
          }
          notifyUserSessionExpired();
          return Promise.reject(withFriendlyMessage(refreshError));
        }
      }

      if (mode === "user" && error.response?.status === 401 && originalRequest?._retry) {
        return Promise.reject(withFriendlyMessage(error));
      }
      return Promise.reject(error);
    },
  );

  return http;
}

const axiosInstance = createAuthHttp({
  refreshUrl: "/users/admin/refresh-token",
  publicAuthPaths: PUBLIC_AUTH_PATHS,
  mode: "admin",
});

export const userHttp = createAuthHttp({
  refreshUrl: "/users/refresh-token",
  publicAuthPaths: USER_PUBLIC_AUTH_PATHS,
  mode: "user",
});

export default axiosInstance;
