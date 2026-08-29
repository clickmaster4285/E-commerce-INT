import axiosInstance from "../axiosInstance";

// ✅ USER-SIDE Shipping API
export const shippingApi = {
  // Public — standard/express fees, days, free threshold
  getConfig: () =>
    axiosInstance.get("/shipping/config").then((res) => res.data?.data || res.data),

  // Auth — cart items ke hisab se exact quote
  quote: (payload) =>
    axiosInstance.post("/shipping/quote", payload).then((res) => res.data?.data || res.data),
};