import axios from "axios";
import { toast } from "sonner";

const getBaseURL = () => {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_SERVERURL;
  return `http://${window.location.hostname}:${process.env.NEXT_PUBLIC_SERVER_PORT}/api`;
};

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
