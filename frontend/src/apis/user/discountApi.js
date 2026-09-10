import axiosInstance from "../axiosInstance";

export const discountApi = {
  getPublic: async () => {
    const response = await axiosInstance.get("/discounts/public");
    return response.data?.data || response.data || [];
  },
};