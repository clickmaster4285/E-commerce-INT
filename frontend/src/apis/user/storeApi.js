import { userHttp } from "../axiosInstance";
export const storeApi = {
  getPublic: async () => {
    const res = await userHttp.get("/store/public");
    return res.data?.data || null;
  },
};