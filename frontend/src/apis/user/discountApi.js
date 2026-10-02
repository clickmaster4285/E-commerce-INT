import userHttp from "../userHttp";
export const discountApi = {
  getPublic: async () => {
    const response = await userHttp.get("/discounts/public");
    return response.data?.data || response.data || [];
  },
};