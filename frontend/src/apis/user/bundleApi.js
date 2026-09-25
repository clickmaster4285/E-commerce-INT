import axiosInstance from "../axiosInstance";

// ✅ Smart list unwrap
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

// ==========================================
// 🌐 PUBLIC BUNDLE API (Storefront)
// ==========================================
export const bundleApi = {
  // Sirf active bundles (storefront)
  getAllActive: ({ limit, page } = {}) =>
    axiosInstance
      .get("/bundles/active", {
        params: { limit: limit || undefined, page: page || undefined },
      })
      .then(list),
};

export default bundleApi;
