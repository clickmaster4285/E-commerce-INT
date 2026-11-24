import adminHttp from "../axiosInstance";

// ==========================================================
// STORE EDITOR API (backend routes/themeRoutes.js + pageRoutes.js)
// ==========================================================
const data = (res) => res?.data?.data;

export const themeApi = {
  getSchema: () => adminHttp.get("/theme/schema").then(data),
  getTheme: () => adminHttp.get("/theme").then(data),
  // 409 → { code: "THEME_REVISION_CONFLICT" } (doosre admin ne save kiya)
  saveDraft: ({ data: theme, baseRevision }) =>
    adminHttp.put("/theme/draft", { data: theme, baseRevision }).then(data),
  publish: (note = "") => adminHttp.post("/theme/publish", { note }).then(data),
  discard: () => adminHttp.post("/theme/discard").then(data),
  listVersions: () => adminHttp.get("/theme/versions").then(data),
  restoreVersion: (version) => adminHttp.post(`/theme/versions/${version}/restore`).then(data),
  // Scheduled publish — draft ka snapshot "at" (ISO) par live
  schedule: ({ at, note = "" }) => adminHttp.post("/theme/schedule", { at, note }).then(data),
  cancelSchedule: () => adminHttp.delete("/theme/schedule").then(data),
  // Shareable preview link → { token, expiresAt, theme } (token sirf isi response me)
  createPreviewLink: (hours = 24) => adminHttp.post("/theme/preview-links", { hours }).then(data),
  revokePreviewLinks: () => adminHttp.delete("/theme/preview-links").then(data),
  uploadImage: (file) => {
    const form = new FormData();
    form.append("image", file);
    return adminHttp.post("/theme/upload-image", form).then(data);
  },
};

export const pageApi = {
  list: () => adminHttp.get("/pages/admin").then(data),
  get: (id) => adminHttp.get(`/pages/admin/${id}`).then(data),
  create: (body) => adminHttp.post("/pages/admin", body).then(data),
  update: (id, body) => adminHttp.put(`/pages/admin/${id}`, body).then(data),
  remove: (id) => adminHttp.delete(`/pages/admin/${id}`).then(data),
};

/** Axios error → backend code / message */
export const apiError = (error) => ({
  status: error?.response?.status || 0,
  code: error?.response?.data?.code || null,
  message: error?.response?.data?.message || error?.message || "Request failed",
  errors: error?.response?.data?.errors || null,
});
