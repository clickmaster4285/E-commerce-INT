import axiosInstance from "../axiosInstance";

// ✅ Smart list unwrap — existing API pattern follow karta hai
const list = (res) => {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

// ==========================================
// 📦 MANAGE STOCK API
// ==========================================

export const stockApi = {
  // Variant-level stock items (quantity/min_qnt/max_qnt reuse)
  getAll: () => axiosInstance.get("/stock").then(list),

  adjust: (data) =>
    axiosInstance.post("/stock/adjust", data).then((res) => res.data),

  getHistory: (variantId) =>
    axiosInstance
      .get("/stock/history", {
        params: variantId ? { variant_id: variantId } : undefined,
      })
      .then(list),
};
