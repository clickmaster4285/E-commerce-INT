import userHttp from "../userHttp";
export const bannerApi = {
  // ✅ ?limit= bhejo to server utne hi bhejta hai (600+ fetch band); na bhejo to legacy full
  getActive: ({ limit = 12 } = {}) =>
    userHttp.get("/banners/active", { params: { limit: limit || undefined } }).then((res) => {
      const d = res.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d)) return d;
      return [];
    }),

  getAll: () =>
    userHttp.get("/banners").then((res) => {
      const d = res.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d)) return d;
      return [];
    }),
};