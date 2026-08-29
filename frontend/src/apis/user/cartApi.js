import axiosInstance from "@/apis/axiosInstance";

export const cartApi = {
  get: async () => {
    const res = await axiosInstance.get("/cart");
    return res.data?.data || [];
  },

  set: async (items) => {
    const res = await axiosInstance.put("/cart", { items });
    return res.data;
  },
};
