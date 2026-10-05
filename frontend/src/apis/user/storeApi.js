import userHttp from "../userHttp";
export const storeApi = {
  getPublic: async () => {
    const res = await userHttp.get("/store/public");
    return res.data?.data || null;
  },
};