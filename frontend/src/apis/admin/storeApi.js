import adminHttp from "../axiosInstance";
export const storeApi = {
  getPublic: async () => {
    const res = await adminHttp.get("/store/public");
    return res.data?.data || res.data || null;
  },

  get: async () => {
    const res = await adminHttp.get("/store");
    return res.data?.data || res.data || null;
  },

  update: async (data) => {
    const res = await adminHttp.put("/store", data);
    return res.data?.data || res.data;
  },

  /** Multipart logo upload — field name `logo` (§5.6 / REST cutover) */
  uploadLogo: async (file) => {
    const body = new FormData();
    body.append("logo", file);
    const res = await adminHttp.post("/store/logo", body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.data || res.data;
  },

  /** Clear store logo via REST (socket deleteStoreLogo deprecated) */
  deleteLogo: async () => {
    const res = await adminHttp.delete("/store/logo");
    return res.data?.data || res.data;
  },
};