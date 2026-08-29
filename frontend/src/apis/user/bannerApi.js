import axiosInstance from "../axiosInstance";

export const bannerApi = {
  getActive: () =>
    axiosInstance.get("/banners/active").then((res) => {
      const d = res.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d)) return d;
      return [];
    }),

  getAll: () =>
    axiosInstance.get("/banners").then((res) => {
      const d = res.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d)) return d;
      return [];
    }),
};