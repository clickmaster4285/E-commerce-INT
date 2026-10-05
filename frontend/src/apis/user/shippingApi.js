import userHttp from "../userHttp";
// ✅ USER-SIDE Shipping API
export const shippingApi = {
  // Public — standard/express fees, days, free threshold
  getConfig: () =>
    userHttp.get("/shipping/config").then((res) => res.data?.data || res.data),

  // ✅ Public — active shipping rules (free/fixed by brand/category/product/all)
  getRules: () =>
    userHttp.get("/shipping/rules").then((res) => res.data?.data || res.data || []),

  // Auth — cart items ke hisab se exact quote
  quote: (payload) =>
    userHttp.post("/shipping/quote", payload).then((res) => res.data?.data || res.data),

  // ✅ Public — admin ke custom shipping methods (active only)
  getMethods: () =>
    userHttp.get("/shipping/methods").then((res) => res.data?.data || res.data || []),
};