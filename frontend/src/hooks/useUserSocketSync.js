"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

/**
 * ✅ MASTER SOCKET SYNC HOOK FOR USER GUI
 *
 * Admin panel mein koi bhi change ho (product, deal, banner, stock, discount,
 * category, brand, store info, shipping) → ye hook turant user GUI ko refresh
 * kar dega bina page reload ke.
 */
export function useUserSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // ==========================================
    // HELPER: Batch Invalidate
    // ==========================================
    const invalidate = (...keys) => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
    };

    // ==========================================
    // 1. PRODUCTS
    // ==========================================
    const onProductCreated = () => invalidate(["products"], ["featuredProducts"], ["categories"]);
    const onProductUpdated = (data) => {
      invalidate(["products"], ["featuredProducts"], ["categories"]);
      const id = data?._id || data?.product?._id || data?.id;
      if (id) invalidate(["product", id], ["productStock", id]);
    };
    const onProductDeleted = (data) => {
      invalidate(["products"], ["featuredProducts"], ["categories"]);
      const id = typeof data === "string" ? data : data?.id || data?._id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["product", id] });
        queryClient.removeQueries({ queryKey: ["productStock", id] });
      }
    };

    socket.on("productCreated", onProductCreated);
    socket.on("productUpdated", onProductUpdated);
    socket.on("productDeleted", onProductDeleted);

    // ==========================================
    // 2. DEALS
    // ==========================================
    const onDealChanged = () => invalidate(["deals"], ["activeDeals"], ["featuredDeals"], ["products"]);

    socket.on("deal:created", onDealChanged);
    socket.on("deal:updated", onDealChanged);
    socket.on("deal:deleted", onDealChanged);

    // ==========================================
    // 3. DISCOUNTS (price changes)
    // ==========================================
    const onDiscountActivity = () =>
      invalidate(["discounts"], ["activeDiscounts"], ["products"], ["deals"]);

    socket.on("discount:activity", onDiscountActivity);
    socket.on("discountCreated", onDiscountActivity);
    socket.on("discountUpdated", onDiscountActivity);
    socket.on("discountDeleted", onDiscountActivity);

    // ==========================================
    // 4. STORE INFO (logo, name, footer data)
    // ==========================================
    const onStoreUpdated = () => invalidate(["storeInfo"], ["store"]);

    socket.on("storeUpdated", onStoreUpdated);
    socket.on("storeInfoChangedForProfile", onStoreUpdated);

    // ==========================================
    // 5. SHIPPING CONFIG & RULES (cart/checkout)
    // ==========================================
    const onShippingChanged = () =>
      invalidate(["shippingConfig"], ["shippingRules"], ["shippingQuote"]);

    socket.on("shippingConfigUpdated", onShippingChanged);
    socket.on("shippingRuleCreated", onShippingChanged);
    socket.on("shippingRuleUpdated", onShippingChanged);
    socket.on("shippingRuleDeleted", onShippingChanged);
    socket.on("shippingRuleToggled", onShippingChanged);

    // ==========================================
    // 6. STOCK UPDATES (add to cart validation)
    // ==========================================
    const onStockUpdated = (data) => {
      invalidate(["products"]);
      const id = data?.productId || data?.variantId || data?._id;
      if (id) {
        invalidate(["productStock", id], ["product", id]);
      }
    };
    socket.on("stockUpdated", onStockUpdated);

    // ==========================================
    // 7. BANNERS (homepage carousel)
    // ==========================================
    const onBannerChanged = () => invalidate(["banners"], ["activeBanners"]);

    socket.on("banner:created", onBannerChanged);
    socket.on("banner:updated", onBannerChanged);
    socket.on("banner:deleted", onBannerChanged);
    socket.on("bannerCreated", onBannerChanged);
    socket.on("bannerUpdated", onBannerChanged);
    socket.on("bannerDeleted", onBannerChanged);

    // ==========================================
    // 8. CATEGORIES (footer + listings)
    // ==========================================
    const onCategoryChanged = () =>
      invalidate(["categories"], ["allCategories"], ["products"]);

    socket.on("category:created", onCategoryChanged);
    socket.on("category:updated", onCategoryChanged);
    socket.on("category:deleted", onCategoryChanged);
    socket.on("categoryCreated", onCategoryChanged);
    socket.on("categoryUpdated", onCategoryChanged);
    socket.on("categoryDeleted", onCategoryChanged);

    // ==========================================
    // 9. BRANDS (listings)
    // ==========================================
    const onBrandChanged = () => invalidate(["brands"], ["allBrands"], ["products"]);

    socket.on("brand:created", onBrandChanged);
    socket.on("brand:updated", onBrandChanged);
    socket.on("brand:deleted", onBrandChanged);
    socket.on("brandCreated", onBrandChanged);
    socket.on("brandUpdated", onBrandChanged);
    socket.on("brandDeleted", onBrandChanged);

    // ==========================================
    // 10. ORDERS (user-side orders + admin status changes)
    // ==========================================
    const onOrderChanged = (payload) => {
      invalidate(["myOrders"], ["orders"]);
      const id =
        payload?.data?._id ||
        payload?.data?.id ||
        payload?._id ||
        payload?.id ||
        payload?.orderId;
      if (id) invalidate(["order", String(id)]);
    };

    socket.on("order:created", onOrderChanged);
    socket.on("order:updated", onOrderChanged);
    socket.on("order:deleted", onOrderChanged);
    socket.on("order:statusChanged", onOrderChanged);
    socket.on("order:paymentUpdated", onOrderChanged);

    // ==========================================
    // CLEANUP
    // ==========================================
    return () => {
      // Products
      socket.off("productCreated", onProductCreated);
      socket.off("productUpdated", onProductUpdated);
      socket.off("productDeleted", onProductDeleted);
      // Deals
      socket.off("deal:created", onDealChanged);
      socket.off("deal:updated", onDealChanged);
      socket.off("deal:deleted", onDealChanged);
      // Discounts
      socket.off("discount:activity", onDiscountActivity);
      socket.off("discountCreated", onDiscountActivity);
      socket.off("discountUpdated", onDiscountActivity);
      socket.off("discountDeleted", onDiscountActivity);
      // Store
      socket.off("storeUpdated", onStoreUpdated);
      socket.off("storeInfoChangedForProfile", onStoreUpdated);
      // Shipping
      socket.off("shippingConfigUpdated", onShippingChanged);
      socket.off("shippingRuleCreated", onShippingChanged);
      socket.off("shippingRuleUpdated", onShippingChanged);
      socket.off("shippingRuleDeleted", onShippingChanged);
      socket.off("shippingRuleToggled", onShippingChanged);
      // Stock
      socket.off("stockUpdated", onStockUpdated);
      // Banners
      socket.off("banner:created", onBannerChanged);
      socket.off("banner:updated", onBannerChanged);
      socket.off("banner:deleted", onBannerChanged);
      socket.off("bannerCreated", onBannerChanged);
      socket.off("bannerUpdated", onBannerChanged);
      socket.off("bannerDeleted", onBannerChanged);
      // Categories
      socket.off("category:created", onCategoryChanged);
      socket.off("category:updated", onCategoryChanged);
      socket.off("category:deleted", onCategoryChanged);
      socket.off("categoryCreated", onCategoryChanged);
      socket.off("categoryUpdated", onCategoryChanged);
      socket.off("categoryDeleted", onCategoryChanged);
      // Brands
      socket.off("brand:created", onBrandChanged);
      socket.off("brand:updated", onBrandChanged);
      socket.off("brand:deleted", onBrandChanged);
      socket.off("brandCreated", onBrandChanged);
      socket.off("brandUpdated", onBrandChanged);
      socket.off("brandDeleted", onBrandChanged);
      // Orders
      socket.off("order:created", onOrderChanged);
      socket.off("order:updated", onOrderChanged);
      socket.off("order:deleted", onOrderChanged);
      socket.off("order:statusChanged", onOrderChanged);
      socket.off("order:paymentUpdated", onOrderChanged);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}