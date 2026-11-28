import axios from "axios";
import { toast } from "sonner";
import { notifySellerPendingLocked } from "@/apis/sellerPendingToast";
import { alignBackendUrl } from "@/lib/tenantHost";
import { hasAuthSession } from "@/lib/authSession";
import { toUserMessage } from "@/lib/toUserMessage";

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
  console.error(
    "[api] NEXT_PUBLIC_SERVERURL missing hai — API requests fail hongi. " +
      "frontend/.env me set karo, e.g. NEXT_PUBLIC_SERVERURL=http://<host>:5000/api",
  );
}

// Local development: API ko PAGE ke hostname par call karo (sirf port alag).
// localhost:3000 → localhost:5000, 192.168.88.35:3000 → 192.168.88.35:5000,
// alistore.192.168.88.35.nip.io:3000 → alistore.192.168.88.35.nip.io:5000
// Is se HttpOnly auth cookies dono apps ko jaati hain aur backend Host se
// store pehchanta hai. Logic: src/lib/tenantHost.js → alignBackendUrl
const getBaseURL = () => alignBackendUrl(API_BASE_URL);

const PUBLIC_AUTH_PATHS = [
  "/users/login",
  "/users/admin/login",
  "/users/google-login",
  "/users/admin/handoff/exchange",
  "/users/register",
  "/users/logout",
  "/users/send-email-otp",
  "/users/verify-email-otp",
  "/users/forgot-password",
  "/users/verify-reset-otp",
  "/users/reset-password",
];

const USER_PUBLIC_AUTH_PATHS = PUBLIC_AUTH_PATHS.filter((path) => path !== "/users/admin/login");

// Sirf logged-in customer ke endpoints. Guest (u_sess marker nahi) par request
// bheji hi nahi jati — pehle har page par profile/wishlist 401 + refresh 401 aate the.
const USER_ONLY_PATHS = [
  "/users/profile",
  "/users/me",
  "/users/wishlist",
  "/users/phone",
  "/users/password",
  "/users/change-password",
  "/users/checkout-drafts",
  "/cart",
  "/orders/my",
  "/addresses",
  "/reviews/my",
];
const pathOf = (url) => String(url || "").split("?")[0];
const isUserOnlyPath = (url) =>
  USER_ONLY_PATHS.some((path) => pathOf(url) === path || pathOf(url).startsWith(`${path}/`));

// Network ke baghair 401 jaisa error — callers pehle se 401 (guest) handle karte hain
const guestError = (config) => {
  const error = new Error("Not logged in");
  error.config = config;
  error.isGuest = true;
  error.response = { status: 401, data: { success: false, message: "Not logged in" }, config };
  return error;
};
const FRIENDLY_SESSION_EXPIRED = "Session expired. Please log in again.";

const notifyUserSessionExpired = () => {
  try {
    window.dispatchEvent(new CustomEvent("user-session-expired"));
  } catch {
    // Ignore when requests fail during server rendering.
  }
};

function createAuthHttp({ refreshUrl, publicAuthPaths, mode, guestBlockedPaths = null }) {
  const http = axios.create({ withCredentials: true, timeout: 15000 });
  let refreshPromise = null;

  const startRefresh = () => {
    if (!refreshPromise) {
      refreshPromise = http
        .post(refreshUrl, undefined, { timeout: 15000 })
        .then((response) => {
          // Sockets naye access token ke saath reconnect karein (lib/socketAuthSync.js)
          try {
            window.dispatchEvent(new CustomEvent("auth-refreshed", { detail: { mode } }));
          } catch {
            // server rendering
          }
          return response;
        })
        .finally(() => {
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
      // Backend ko batao kaun sa session (a_at admin / u_at customer) use kare —
      // ek hi browser me customer + admin dono logged-in reh sakte hain
      config.headers = config.headers || {};
      config.headers["X-Auth-Aud"] = mode;
      if (guestBlockedPaths?.(config.url) && !hasAuthSession(mode)) return Promise.reject(guestError(config));
      return config;
    },
    (error) => Promise.reject(error),
  );

  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      // Friendly text callers use karein: toast.error(err.userMessage)
      try { if (error && typeof error === "object") error.userMessage = toUserMessage(error); } catch { /* ignore */ }

      if (error.response?.status === 403 && error.response?.data?.code === "SELLER_PENDING") {
        notifySellerPendingLocked();
        return Promise.reject(error);
      }

      const isChatRequest = originalRequest?.url?.includes("/chats/");
      if (error.response?.status === 429 && error.response?.data?.code !== "CHAT_MESSAGE_RATE_LIMIT" && !isChatRequest) {
        const retryAfter = Number(error.response?.data?.retryAfter);
        toast.error(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? `Please try again in ${retryAfter} seconds.`
            : "Too many requests. Please try again later.",
        );
      }

      if (error?.isGuest) return Promise.reject(error);

      const isPublicAuthRequest = publicAuthPaths.some((path) => originalRequest?.url?.includes(path));
      if (isPublicAuthRequest) return Promise.reject(error);

      // Koi session hi nahi (marker nahi) → refresh ka fayda nahi, seedha 401
      if (error.response?.status === 401 && !hasAuthSession(mode)) {
        if (mode === "admin") redirectToAdminLogin();
        return Promise.reject(error);
      }

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
            const status = refreshError.response?.status;
            // A temporary network/API failure is not proof that the session
            // expired. Keep the admin page and allow the request to be retried.
            if (status === 401 || status === 403) redirectToAdminLogin();
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
  guestBlockedPaths: isUserOnlyPath,
});

export default axiosInstance;
