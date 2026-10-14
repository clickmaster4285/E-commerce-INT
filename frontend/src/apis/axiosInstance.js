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

/* ==========================================================
   PROACTIVE REFRESH — "token bar bar expire" ka asli ilaj
   ---------------------------------------------------------
   Pehle sirf REACTIVE refresh tha: token expire → API 401 → phir refresh.
   Isi window me admin panel ka profile query fail hota tha aur user logout
   ho jata tha (har 10 minute).

   Ab access token apne expiry se PEHLE hi refresh ho jata hai:
     • interval timer (har N minute)
     • tab wapas foreground me aaye (visibilitychange) — idle time me
       token expire ho chuka hota hai, yahi sabse common trigger hai
   Isse 401 practically nahi aata, aur logout bilkul nahi hota.
   ========================================================== */

// 0 = proactive refresh off
const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 min (admin token 60 min ka hai)

const notifyUserSessionExpired = () => {
  try {
    window.dispatchEvent(new CustomEvent("user-session-expired"));
  } catch {
    // Ignore when requests fail during server rendering.
  }
};

function createAuthHttp({ refreshUrl, publicAuthPaths, mode, refreshIntervalMs }) {
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

  // Proactive call — fail ho to chup chap ignore (reactive 401 flow sambhal lega)
  const refreshSilently = () => {
    if (typeof window === "undefined") return;
    startRefresh().catch(() => {});
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

  // ==========================================================
  // Timer + visibility — sirf browser me (SSR pe kuch nahi)
  // ==========================================================
  if (typeof window !== "undefined" && refreshIntervalMs > 0) {
    setInterval(refreshSilently, refreshIntervalMs);

    document.addEventListener("visibilitychange", () => {
      // Sirf tab wapas aane par — background me refresh bekaar hai
      if (document.visibilityState === "visible") refreshSilently();
    });
  }

  return http;
}

const axiosInstance = createAuthHttp({
  refreshUrl: "/users/admin/refresh-token",
  publicAuthPaths: PUBLIC_AUTH_PATHS,
  mode: "admin",
  // Admin token 60 min → 50 min par refresh (10 min safety margin)
  refreshIntervalMs: REFRESH_INTERVAL_MS,
});

export const userHttp = createAuthHttp({
  refreshUrl: "/users/refresh-token",
  publicAuthPaths: USER_PUBLIC_AUTH_PATHS,
  mode: "user",
  // Customer token 7 din ka hai — har 6 ghante par refresh kaafi hai
  refreshIntervalMs: 6 * 60 * 60 * 1000,
});

export default axiosInstance;
