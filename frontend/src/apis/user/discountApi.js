import { userHttp } from "../axiosInstance";
export const discountApi = {
  getPublic: async () => {
    const response = await userHttp.get("/discounts/public");
    return response.data?.data || response.data || [];
  },
};