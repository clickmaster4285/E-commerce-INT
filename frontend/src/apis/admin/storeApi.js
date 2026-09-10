import axiosInstance from "../axiosInstance";

export const storeApi = {
  getPublic: async () => {
    const res = await axiosInstance.get("/store/public");
    return res.data?.data || res.data || null;
  },

  get: async () => {
    const res = await axiosInstance.get("/store");
    return res.data?.data || res.data || null;
  },

  update: async (data) => {
    const res = await axiosInstance.put("/store", data);
    return res.data?.data || res.data;
  },
};