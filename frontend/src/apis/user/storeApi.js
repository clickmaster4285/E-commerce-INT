import axiosInstance from "../axiosInstance";

export const storeApi = {
  getPublic: async () => {
    const res = await axiosInstance.get("/store/public");
    return res.data?.data || null;
  },
};