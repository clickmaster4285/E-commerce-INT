import axiosInstance from "./axiosInstance";

export const storeApi = {
  // ✅ Public store info (bina login ke — user GUI ke liye)
  getPublic: async () => {
    const res = await axiosInstance.get("/store/public");
    return res.data?.data || null;
  },
};