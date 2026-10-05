import axios from "axios";
import { toast } from "sonner";

// ==========================================
// 🔥 DYNAMIC BASE URL — Current hostname use karta hai
// (purana axiosInstance jaisa — behavior same)
// ==========================================
const getBaseURL = () => {
  if (typeof window === "undefined") {
    // SSR (server-side render) — env se lo
    return process.env.NEXT_PUBLIC_SERVERURL;
  }
  // Client — jis host par frontend khula hai, wahi use karo (port sirf env se)
  const hostname = window.location.hostname;
  const serverPort = process.env.NEXT_PUBLIC_SERVER_PORT;
  return `http://${hostname}:${serverPort}/api`;
};

// User-facing messages are always English (no Roman Urdu in toasts/messages).
// Guests (not logged in) get silent 401s — no session toast on refresh;
// the layout only resets to logged-out state via "user-session-expired".
export const FRIENDLY_SESSION_EXPIRED = "Session expired. Please log in again.";

/* ==========================================================
   createAuthHttp — user/admin ke liye alag-alag instance
   - Har instance ka APNA single-flight refreshPromise (F1): pehla 401
     refresh chalata hai, concurrent 401s usi ka wait karte hain.
   - mode "user": koi admin logic nahi (na redirect, na
     localStorage.clear, na /users/admin/login). Refresh fail ya
     retry-ke-baad-401 → friendly message + "user-session-expired"
     event (user layout ["userProfile"] invalidate karta hai).
   - mode "admin": purana behavior 1:1 (redirect + clear + raw reject).
   ========================================================== */

export function createAuthHttp({ refreshUrl, publicAuthPaths, mode }) {
  const http = axios.create({
    withCredentials: true, // 🔥 Cookies bhejne ke liye zaroori
  });

  let refreshPromise = null;

  const startRefresh = () => {
    if (!refreshPromise) {
      refreshPromise = http
        .post(refreshUrl)
        .catch((err) => {
          // Caller apna handle karega — yahan sirf propagate
          throw err;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  };

  const withFriendlyMessage = (error) => {
    try {
      if (error?.response?.data && typeof error.response.data === "object") {
        error.response.data = {
          ...error.response.data,
          message: FRIENDLY_SESSION_EXPIRED,
        };
        return error;
      }
    } catch {
      // ignore — neeche fallback
    }
    const friendly = new Error(FRIENDLY_SESSION_EXPIRED);
    friendly.response = error?.response;
    friendly.status = error?.response?.status;
    return friendly;
  };

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

  // 📤 Request Interceptor — baseURL dynamically set karo
  http.interceptors.request.use(
    (config) => {
      config.baseURL = getBaseURL(); // ✅ Har request mein current host use hoga
      return config;
    },
    (error) => Promise.reject(error),
  );

  // 📥 Response Interceptor
  http.interceptors.response.use(
    (response) => response,

    async (error) => {
      const originalRequest = error.config;

      // 🚦 429 — rate limit: global toast (OTP card ka apna retryAfter cooldown flow alag se chalta rehta hai)
      if (error.response?.status === 429) {
        const retryAfter = Number(error.response?.data?.retryAfter);
        toast.error(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? `Please try again in ${retryAfter} seconds.`
            : "Too many requests. Please try again later.",
        );
      }

      // 🛑 Public auth requests par refresh-token logic skip karo
      // (OTP verify endpoints 400/429 dete hain — unpar redirect nahi hona chahiye)
      const isLoginRequest = publicAuthPaths.some((path) =>
        originalRequest.url?.includes(path),
      );

      if (isLoginRequest) {
        return Promise.reject(error);
      }

      // 401 Unauthorized — refresh token try karo (single-flight)
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (originalRequest.url === refreshUrl) {
          if (mode === "admin") {
            redirectToLogin();
            return Promise.reject(error);
          }
          // Guest / expired session: stay silent (no toast on refresh).
          // Layout listens for this event and switches to logged-out state.
          try {
            window.dispatchEvent(new CustomEvent("user-session-expired"));
          } catch {
            // ignore (SSR)
          }
          return Promise.reject(withFriendlyMessage(error));
        }

        originalRequest._retry = true;

        try {
          await startRefresh();
          return http(originalRequest);
        } catch (refreshError) {
          if (mode === "admin") {
            redirectToLogin();
            return Promise.reject(refreshError);
          }
          // Silent for guests — no "session expired" toast on page refresh.
          try {
            window.dispatchEvent(new CustomEvent("user-session-expired"));
          } catch {
            // ignore (SSR)
          }
          return Promise.reject(withFriendlyMessage(refreshError));
        }
      }

      // User: retry ke baad dobara 401 aaye to bhi raw message caller
      // tak na jaye (stuck "Token expired" toast ka doosra rasta band).
      // Admin: purana behavior (raw reject).
      if (mode === "user" && error.response?.status === 401 && originalRequest?._retry) {
        return Promise.reject(withFriendlyMessage(error));
      }

      return Promise.reject(error);
    },
  );

  return http;
}
