import axios from "axios";

// Dedicated axios instance for the Super Admin panel.
// Deliberately separate from the seller/admin/customer HTTP clients:
// the superadmin session is a separate httpOnly cookie whose name/TTL come
// from backend env vars; backend mount path is /api/super-admin. No refresh-token dance —
// single-session login, re-login when it expires.
const API_BASE_URL =
  (process.env.NEXT_PUBLIC_SERVERURL || "").trim().replace(/\/+$/, "") || null;

const http = axios.create({
  withCredentials: true,
  timeout: 20000,
});

http.interceptors.request.use(
  (config) => {
    config.baseURL = API_BASE_URL;
    return config;
  },
  (error) => Promise.reject(error),
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
  setStoreStatus: (id, status) =>
    superAdminHttp.patch(`/super-admin/stores/${id}/status`, { status }).then((r) => r.data),

  // Users
  listUsers: (params = {}) =>
    superAdminHttp.get("/super-admin/users", { params }).then((r) => r.data),
  setUserStatus: (id, status) =>
    superAdminHttp.patch(`/super-admin/users/${id}/status`, { status }).then((r) => r.data),
};
