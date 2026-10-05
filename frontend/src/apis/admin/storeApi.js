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
};