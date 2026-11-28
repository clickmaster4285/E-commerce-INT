"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserSocket } from "./useUserSocket";

/**
 * ✅ MASTER SOCKET SYNC HOOK FOR USER GUI
 *
 * Admin panel mein koi bhi change ho (product, deal, banner, stock, discount,
 * category, brand, store info, shipping) → storefront ki related queries
 * invalidate hoti hain aur React Query apna data REST se dobara laata hai.
 *
 * ⚠️ Backend public room me ab sirf ids bhejta hai ({ _id } / { changed: true },
 *    optimizeplan.md §2.1/§9.2) — full documents (cost price, staff emails,
 *    customer address) kabhi storefront socket par nahi aate. Is liye yahan
 *    payload se cache LIKHTE nahi, sirf id ke hisaab se invalidate karte hain.
 *    (Pehle partial payload product detail cache ko overwrite kar deta tha.)
 */

const idOf = (payload) => {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  const inner = payload.success === true && payload.data ? payload.data : payload;
  const id = inner?._id || inner?.id || payload?._id || payload?.id || payload?.orderId;
  return id ? String(id) : null;
};

export function useUserSocketSync({ enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useUserSocket({ enabled });

  useEffect(() => {
    if (!enabled || !socket) return;

    const invalidate = (...keys) => {
      keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    };

    // ==========================================
    // RECONNECT SYNC — sirf ASLI reconnect par (missed events).
    // Pehle ye pehle "connect" par bhi chalta tha → har page load par saara
    // storefront data do baar fetch hota tha.
    // ==========================================
    const onReconnect = () => {
      invalidate(
        ["categories"], ["allCategories"], ["products"], ["featuredProducts"],
        ["brands"], ["allBrands"], ["deals"], ["activeDeals"], ["featuredDeals"],
        ["discounts"], ["activeDiscounts"], ["banners"], ["activeBanners"],
        ["categoryTiles"], ["shopFacets"], ["storeInfo"], ["store"],
      );
    };
    const manager = socket.io;
    manager?.on?.("reconnect", onReconnect);

    // Har event → [event, handler]; cleanup isi list se hota hai
    const handlers = [];
    const on = (events, handler) => {
      for (const event of events) {
        socket.on(event, handler);
        handlers.push([event, handler]);
      }
    };

    // 1. PRODUCTS
    on(["productCreated", "productUpdated", "productDeleted"], (payload) => {
      const id = idOf(payload);
      if (id) invalidate(["product", id], ["productStock", id]);
      invalidate(["products"], ["featuredProducts"], ["categoryTiles"]);
    });

    // 2. DEALS (product prices badalte hain)
    on(["deal:created", "deal:updated", "deal:deleted"], (payload) => {
      const id = idOf(payload);
      if (id) invalidate(["deal", id]);
      invalidate(["deals"], ["activeDeals"], ["featuredDeals"], ["products"]);
    });

    // 3. DISCOUNTS
    on(["discount:activity", "discount:created", "discount:updated", "discount:deleted"], (payload) => {
      const id = idOf(payload);
      if (id) invalidate(["discount", id]);
      invalidate(["discounts"], ["activeDiscounts"], ["products"], ["deals"]);
    });

    // 4. STORE INFO (logo, name, footer data)
    on(["storeUpdated", "storeInfoChangedForProfile"], () => invalidate(["storeInfo"], ["store"]));

    // 5. SHIPPING CONFIG & RULES (cart/checkout)
    on(
      ["shippingConfigUpdated", "shippingRuleCreated", "shippingRuleUpdated", "shippingRuleDeleted", "shippingRuleToggled"],
      () => invalidate(["shippingConfig"], ["shippingRules"], ["shippingQuote"]),
    );

    // 6. STOCK (add-to-cart validation) — public payload: { productId, variantId, quantity }
    on(["stockUpdated"], (data) => {
      const productId = data?.productId || data?.product_id;
      const variantId = data?.variantId || data?.variant_id;
      if (productId) invalidate(["product", String(productId)], ["productStock", String(productId)]);
      if (variantId) invalidate(["variant", String(variantId)]);
      invalidate(["products"]);
    });

    // 7. BANNERS
    on(["banner:created", "banner:updated", "banner:deleted"], (payload) => {
      const id = idOf(payload);
      if (id) invalidate(["banner", id]);
      invalidate(["banners"], ["activeBanners"]);
    });

    // 8. CATEGORIES (footer + listings + shop filters/facets)
    on(["category:created", "category:updated", "category:deleted", "categoryCreated", "categoryUpdated", "categoryDeleted"], (payload) => {
      const id = idOf(payload);
      if (id) invalidate(["category", id]);
      invalidate(["categories"], ["allCategories"], ["categoryTiles"], ["shopFacets"], ["products"]);
    });

    // 9. BRANDS
    on(["brand:created", "brand:updated", "brand:deleted", "brandCreated", "brandUpdated", "brandDeleted"], (payload) => {
      const id = idOf(payload);
      if (id) invalidate(["brand", id]);
      invalidate(["brands"], ["allBrands"], ["products"]);
    });

    // 10. ORDERS — backend sirf order ke maalik customer ko { _id } bhejta hai
    on(["order:created", "order:updated", "order:deleted", "order:statusChanged", "order:paymentUpdated"], (payload) => {
      invalidate(["myOrders"], ["orders"]);
      const id = idOf(payload);
      if (id) invalidate(["order", id]);
    });

    return () => {
      manager?.off?.("reconnect", onReconnect);
      for (const [event, handler] of handlers) socket.off(event, handler);
    };
  }, [enabled, socket, queryClient]);

  return { isConnected };
}
