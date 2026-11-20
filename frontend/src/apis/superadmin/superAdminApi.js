import axios from "axios";
import { alignBackendUrl } from "@/lib/tenantHost";

// Super Admin HTTP client — same accessToken / refreshToken cookies as
// seller/customer auth. Backend mount path: /api/super-admin.
// Uses alignBackendUrl so nip.io pages hit the same hostname as the API
// (otherwise SameSite=Lax cookies never stick across IP vs nip.io).
const API_BASE_URL =
  (process.env.NEXT_PUBLIC_SERVERURL || "").trim().replace(/\/+$/, "") || null;

const getBaseURL = () => alignBackendUrl(API_BASE_URL);

const PUBLIC_AUTH_PATHS = [
  "/super-admin/auth/login",
  "/super-admin/auth/logout",
  "/super-admin/auth/refresh-token",
];

const REFRESH_URL = "/super-admin/auth/refresh-token";

const http = axios.create({
  withCredentials: true,
  timeout: 20000,
});

let refreshPromise = null;

const startRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = http.post(REFRESH_URL, undefined, { timeout: 15000 }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/super-admin/login" || path.startsWith("/super-admin/login/")) return;
  window.location.href = "/super-admin/login";
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
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((path) => originalRequest?.url?.includes(path));
    if (isPublicAuth) return Promise.reject(error);

    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest?.url === REFRESH_URL) {
        redirectToLogin();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        await startRefresh();
        return http(originalRequest);
      } catch (refreshError) {
        const status = refreshError.response?.status;
        if (status === 401 || status === 403) redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

const superAdminHttp = http;

export const superAdminApi = {
  // Auth
  login: (payload) => superAdminHttp.post("/super-admin/auth/login", payload).then((r) => r.data),
  logout: () => superAdminHttp.post("/super-admin/auth/logout").then((r) => r.data),
  me: () => superAdminHttp.get("/super-admin/auth/me").then((r) => r.data),

  // Dashboard
  getDashboard: () => superAdminHttp.get("/super-admin/dashboard").then((r) => r.data),

  // Requests
  listRequests: (params = {}) =>
    superAdminHttp.get("/super-admin/requests", { params }).then((r) => r.data),
  getRequest: (id) => superAdminHttp.get(`/super-admin/requests/${id}`).then((r) => r.data),
  approveRequest: (id) => superAdminHttp.post(`/super-admin/requests/${id}/approve`).then((r) => r.data),
  rejectRequest: (id, reason = "") =>
    superAdminHttp.post(`/super-admin/requests/${id}/reject`, { reason }).then((r) => r.data),
  requestInfo: (id, message) =>
    superAdminHttp.post(`/super-admin/requests/${id}/request-info`, { message }).then((r) => r.data),

  // Stores
  listStores: (params = {}) =>
    superAdminHttp.get("/super-admin/stores", { params }).then((r) => r.data),
  createStore: (payload) => superAdminHttp.post("/super-admin/stores", payload).then((r) => r.data),
  updateStore: (id, payload) => superAdminHttp.patch(`/super-admin/stores/${id}`, payload).then((r) => r.data),
  deleteStore: (id) => superAdminHttp.delete(`/super-admin/stores/${id}`).then((r) => r.data),
  setStoreStatus: (id, status) =>
    superAdminHttp.patch(`/super-admin/stores/${id}/status`, { status }).then((r) => r.data),

  // Users
  listUsers: (params = {}) =>
    superAdminHttp.get("/super-admin/users", { params }).then((r) => r.data),
  setUserStatus: (id, status) =>
    superAdminHttp.patch(`/super-admin/users/${id}/status`, { status }).then((r) => r.data),
};
