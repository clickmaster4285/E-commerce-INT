"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserSocket } from "./useUserSocket";

/**
 * ✅ MASTER SOCKET SYNC HOOK FOR USER GUI
 *
 * Admin panel mein koi bhi change ho (product, deal, banner, stock, discount,
 * category, brand, store info, shipping) → ye hook turant user GUI ko refresh
 * kar dega bina page reload ke.
 */
export function useUserSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useUserSocket();

  useEffect(() => {
    if (!socket) return;

    // ==========================================
    // HELPER: Batch Invalidate
    // ==========================================
    const invalidate = (...keys) => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
    };

    // ==========================================
    // RECONNECTION SYNC — Jab socket reconnect hota hai,
    // missed events ke liye key queries invalidate karke fresh data fetch karo.
    // ==========================================
    const onReconnect = () => {
      invalidate(
        ["categories"],
        ["allCategories"],
        ["products"],
        ["featuredProducts"],
        ["brands"],
        ["allBrands"],
        ["deals"],
        ["activeDeals"],
        ["featuredDeals"],
        ["discounts"],
        ["activeDiscounts"],
        ["banners"],
        ["activeBanners"],
        ["categoryTiles", 100],
        ["shopFacets"],
        ["storeInfo"],
        ["store"]
      );
    };

    // ==========================================
    // CONNECTION STATE HANDLERS
    // ==========================================
    const onConnect = () => {
      // Reconnection par missed events ke liye sync karo
      onReconnect();
    };

    socket.on("connect", onConnect);

    // Cleanup connection handler
    const cleanupConnection = () => {
      socket.off("connect", onConnect);
    };

    // ==========================================
    // 1. PRODUCTS
    // ==========================================
    const onProductCreated = (data) => {
      // Update cache with new product data instead of just invalidating
      if (data?._id) {
        queryClient.setQueryData(["product", data._id], data);
        queryClient.setQueryData(["products"], (old) => {
          if (!Array.isArray(old)) return [data];
          if (old.some((p) => p._id === data._id)) return old;
          return [data, ...old];
        });
        queryClient.setQueryData(["featuredProducts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.some((p) => p._id === data._id) ? old : [data, ...old];
        });
      }
      invalidate(["categories"], ["categoryTiles"]);
    };
    const onProductUpdated = (data) => {
      const product = extractData(data);
      // Only update cache if we have meaningful product data (not just { _id, variantUpdated: true })
      if (product?._id && (product.name || product.status || product.variants)) {
        // Update individual product cache
        queryClient.setQueryData(["product", product._id], (old) => product || old);
        queryClient.setQueryData(["productStock", product._id], (old) => {
          if (!old || !product.variants) return old;
          const firstVariant = product.variants[0];
          return { ...old, stock: firstVariant?.quantity ?? 0, price: firstVariant?.selling_price ?? 0 };
        });
        // Update products list cache
        queryClient.setQueryData(["products"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((p) => (p._id === product._id ? { ...p, ...product } : p));
        });
        queryClient.setQueryData(["featuredProducts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((p) => (p._id === product._id ? { ...p, ...product } : p));
        });
      } else if (product?._id) {
        // Minimal update (e.g., variantUpdated: true) - just invalidate to refetch
        invalidate(["product", product._id], ["productStock", product._id], ["products"], ["featuredProducts"]);
      }
      invalidate(["categories"], ["categoryTiles"]);
    };
    const onProductDeleted = (data) => {
      const id = typeof data === "string" ? data : data?._id || data?.id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["product", id] });
        queryClient.removeQueries({ queryKey: ["productStock", id] });
        queryClient.setQueryData(["products"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((p) => p._id !== id);
        });
        queryClient.setQueryData(["featuredProducts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((p) => p._id !== id);
        });
      }
      invalidate(["categories"], ["categoryTiles"]);
    };

    socket.on("productCreated", onProductCreated);
    socket.on("productUpdated", onProductUpdated);
    socket.on("productDeleted", onProductDeleted);

    // Helper to extract data from backend socket event (handles both wrapped and unwrapped formats)
    const extractData = (payload) => {
      if (!payload) return null;
      // If wrapped in { success: true, data: ... }
      if (payload.success === true && payload.data) return payload.data;
      // Otherwise assume it's the data directly
      return payload;
    };

    // ==========================================
    // 2. DEALS
    // ==========================================
    const onDealCreated = (data) => {
      const deal = extractData(data);
      if (deal?._id) {
        queryClient.setQueryData(["deal", deal._id], deal);
        queryClient.setQueryData(["deals"], (old) => {
          if (!Array.isArray(old)) return [deal];
          if (old.some((d) => d._id === deal._id)) return old;
          return [deal, ...old];
        });
        queryClient.setQueryData(["activeDeals"], (old) => {
          if (!Array.isArray(old)) return [deal];
          return old.some((d) => d._id === deal._id) ? old : [deal, ...old];
        });
        queryClient.setQueryData(["featuredDeals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.some((d) => d._id === deal._id) ? old : [deal, ...old];
        });
      }
      invalidate(["products"]);
    };
    const onDealUpdated = (data) => {
      const deal = extractData(data);
      if (deal?._id) {
        queryClient.setQueryData(["deal", deal._id], deal);
        queryClient.setQueryData(["deals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((d) => (d._id === deal._id ? { ...d, ...deal } : d));
        });
        queryClient.setQueryData(["activeDeals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((d) => (d._id === deal._id ? { ...d, ...deal } : d));
        });
        queryClient.setQueryData(["featuredDeals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((d) => (d._id === deal._id ? { ...d, ...deal } : d));
        });
      }
      invalidate(["products"]);
    };
    const onDealDeleted = (data) => {
      const id = typeof data === "string" ? data : extractData(data)?._id || data?._id || data?.id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["deal", id] });
        queryClient.setQueryData(["deals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((d) => d._id !== id);
        });
        queryClient.setQueryData(["activeDeals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((d) => d._id !== id);
        });
        queryClient.setQueryData(["featuredDeals"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((d) => d._id !== id);
        });
      }
      invalidate(["products"]);
    };

    socket.on("deal:created", onDealCreated);
    socket.on("deal:updated", onDealUpdated);
    socket.on("deal:deleted", onDealDeleted);

    // ==========================================
    // 3. DISCOUNTS (price changes)
    // ==========================================
    const onDiscountCreated = (data) => {
      const discount = extractData(data);
      if (discount?._id) {
        queryClient.setQueryData(["discount", discount._id], discount);
        queryClient.setQueryData(["discounts"], (old) => {
          if (!Array.isArray(old)) return [discount];
          if (old.some((d) => d._id === discount._id)) return old;
          return [discount, ...old];
        });
        queryClient.setQueryData(["activeDiscounts"], (old) => {
          if (!Array.isArray(old)) return [discount];
          return old.some((d) => d._id === discount._id) ? old : [discount, ...old];
        });
      }
      invalidate(["products"], ["deals"]);
    };
    const onDiscountUpdated = (data) => {
      const discount = extractData(data);
      if (discount?._id) {
        queryClient.setQueryData(["discount", discount._id], discount);
        queryClient.setQueryData(["discounts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((d) => (d._id === discount._id ? { ...d, ...discount } : d));
        });
        queryClient.setQueryData(["activeDiscounts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((d) => (d._id === discount._id ? { ...d, ...discount } : d));
        });
      }
      invalidate(["products"], ["deals"]);
    };
    const onDiscountDeleted = (data) => {
      const id = typeof data === "string" ? data : extractData(data)?._id || data?._id || data?.id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["discount", id] });
        queryClient.setQueryData(["discounts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((d) => d._id !== id);
        });
        queryClient.setQueryData(["activeDiscounts"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((d) => d._id !== id);
        });
      }
      invalidate(["products"], ["deals"]);
    };

    socket.on("discount:activity", (data) => {
      // Handle generic activity event
      const payload = extractData(data);
      if (data?.action === "created") onDiscountCreated(payload || data);
      else if (data?.action === "updated") onDiscountUpdated(payload || data);
      else if (data?.action === "deleted") onDiscountDeleted(payload || data);
    });
    socket.on("discountCreated", onDiscountCreated);
    socket.on("discountUpdated", onDiscountUpdated);
    socket.on("discountDeleted", onDiscountDeleted);

    // ==========================================
    // 4. STORE INFO (logo, name, footer data)
    // ==========================================
    const onStoreUpdated = (data) => {
      if (data) {
        queryClient.setQueryData(["storeInfo"], data);
        queryClient.setQueryData(["store"], data);
      } else {
        invalidate(["storeInfo"], ["store"]);
      }
    };

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
      const productId = data?.productId || data?.product_id;
      const variantId = data?.variantId || data?.variant_id;
      const quantity = data?.quantity;

      if (productId) {
        // Update product stock cache
        queryClient.setQueryData(["productStock", productId], (old) => {
          const newStock = typeof quantity === "number" ? quantity : (old?.stock ?? 0);
          return { ...old, stock: newStock };
        });
        // Update product cache with new stock
        queryClient.setQueryData(["product", productId], (old) => {
          if (!old) return old;
          return { ...old, stock: typeof quantity === "number" ? quantity : (old?.stock ?? 0) };
        });
      }
      if (variantId) {
        // Update variant-specific stock if needed
        queryClient.setQueryData(["variant", variantId], (old) => {
          if (!old) return old;
          return { ...old, quantity: typeof quantity === "number" ? quantity : (old?.quantity ?? 0) };
        });
      }
      invalidate(["products"]);
    };
    socket.on("stockUpdated", onStockUpdated);

    // ==========================================
    // 7. BANNERS (homepage carousel)
    // ==========================================
    const onBannerCreated = (data) => {
      const banner = extractData(data);
      if (banner?._id) {
        queryClient.setQueryData(["banner", banner._id], banner);
        queryClient.setQueryData(["banners"], (old) => {
          if (!Array.isArray(old)) return [banner];
          if (old.some((b) => b._id === banner._id)) return old;
          return [banner, ...old];
        });
        queryClient.setQueryData(["activeBanners"], (old) => {
          if (!Array.isArray(old)) return [banner];
          return old.some((b) => b._id === banner._id) ? old : [banner, ...old];
        });
      }
    };
    const onBannerUpdated = (data) => {
      const banner = extractData(data);
      if (banner?._id) {
        queryClient.setQueryData(["banner", banner._id], banner);
        queryClient.setQueryData(["banners"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((b) => (b._id === banner._id ? { ...b, ...banner } : b));
        });
        queryClient.setQueryData(["activeBanners"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((b) => (b._id === banner._id ? { ...b, ...banner } : b));
        });
      }
    };
    const onBannerDeleted = (data) => {
      const id = typeof data === "string" ? data : extractData(data)?._id || data?._id || data?.id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["banner", id] });
        queryClient.setQueryData(["banners"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((b) => b._id !== id);
        });
        queryClient.setQueryData(["activeBanners"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((b) => b._id !== id);
        });
      }
    };

    socket.on("banner:created", onBannerCreated);
    socket.on("banner:updated", onBannerUpdated);
    socket.on("banner:deleted", onBannerDeleted);
    socket.on("bannerCreated", onBannerCreated);
    socket.on("bannerUpdated", onBannerUpdated);
    socket.on("bannerDeleted", onBannerDeleted);

    // ==========================================
    // 8. CATEGORIES (footer + listings + shop filters)
    // ==========================================
    // ⚠️ ["shopFacets"] bhi zaroori — sidebar counts + price bounds
    //    facets endpoint se aate hain. Bina iske disable ki gayi
    //    category ka filter option 60s tak purana dikhta rehta tha.
    const onCategoryCreated = (data) => {
      const category = extractData(data);
      if (category?._id) {
        queryClient.setQueryData(["category", category._id], category);
        // ⚠️ Public API sirf active categories return karta hai.
        // Nayi category agar active hai to cache mein add karo.
        const isActive = category.is_active !== false;
        if (isActive) {
          queryClient.setQueryData(["categories"], (old) => {
            if (!Array.isArray(old)) return [category];
            if (old.some((c) => c._id === category._id)) return old;
            return [...old, category];
          });
          queryClient.setQueryData(["allCategories"], (old) => {
            if (!Array.isArray(old)) return [category];
            return old.some((c) => c._id === category._id) ? old : [...old, category];
          });
          // ✅ categoryTiles cache bhi update karo (Explore Our Categories section)
          queryClient.setQueryData(["categoryTiles", 100], (old) => {
            if (!Array.isArray(old)) return [category];
            if (old.some((c) => c._id === category._id)) return old;
            return [...old, category];
          });
        }
      }
      invalidate(["products"], ["categoryTiles"], ["shopFacets"]);
    };
    const onCategoryUpdated = (data) => {
      const category = extractData(data);
      if (category?._id) {
        queryClient.setQueryData(["category", category._id], category);
        // ⚠️ Public API sirf active categories return karta hai.
        // Agar category disable hui to cache arrays se nikaal do
        // taake storefront UI (jo API pe depend karta hai) sahi dikhe.
        const isActive = category.is_active !== false;
        queryClient.setQueryData(["categories"], (old) => {
          if (!Array.isArray(old)) return old;
          if (!isActive) return old.filter((c) => c._id !== category._id);
          return old.map((c) => (c._id === category._id ? { ...c, ...category } : c));
        });
        queryClient.setQueryData(["allCategories"], (old) => {
          if (!Array.isArray(old)) return old;
          if (!isActive) return old.filter((c) => c._id !== category._id);
          return old.map((c) => (c._id === category._id ? { ...c, ...category } : c));
        });
        // ✅ categoryTiles cache bhi update karo (Explore Our Categories section)
        queryClient.setQueryData(["categoryTiles", 100], (old) => {
          if (!Array.isArray(old)) return old;
          if (!isActive) return old.filter((c) => c._id !== category._id);
          return old.map((c) => (c._id === category._id ? { ...c, ...category } : c));
        });
      }
      invalidate(["products"], ["categoryTiles"], ["shopFacets"]);
    };
    const onCategoryDeleted = (data) => {
      const id = typeof data === "string" ? data : extractData(data)?._id || data?._id || data?.id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["category", id] });
        queryClient.setQueryData(["categories"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((c) => c._id !== id);
        });
        queryClient.setQueryData(["allCategories"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((c) => c._id !== id);
        });
        // ✅ categoryTiles cache se bhi hatao
        queryClient.setQueryData(["categoryTiles", 100], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((c) => c._id !== id);
        });
      }
      invalidate(["products"], ["categoryTiles"], ["shopFacets"]);
    };

    socket.on("category:created", onCategoryCreated);
    socket.on("category:updated", onCategoryUpdated);
    socket.on("category:deleted", onCategoryDeleted);
    socket.on("categoryCreated", onCategoryCreated);
    socket.on("categoryUpdated", onCategoryUpdated);
    socket.on("categoryDeleted", onCategoryDeleted);

    // ==========================================
    // 9. BRANDS (listings)
    // ==========================================
    const onBrandCreated = (data) => {
      const brand = extractData(data);
      if (brand?._id) {
        queryClient.setQueryData(["brand", brand._id], brand);
        queryClient.setQueryData(["brands"], (old) => {
          if (!Array.isArray(old)) return [brand];
          if (old.some((b) => b._id === brand._id)) return old;
          return [brand, ...old];
        });
        queryClient.setQueryData(["allBrands"], (old) => {
          if (!Array.isArray(old)) return [brand];
          return old.some((b) => b._id === brand._id) ? old : [brand, ...old];
        });
      }
      invalidate(["products"]);
    };
    const onBrandUpdated = (data) => {
      const brand = extractData(data);
      if (brand?._id) {
        queryClient.setQueryData(["brand", brand._id], brand);
        queryClient.setQueryData(["brands"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((b) => (b._id === brand._id ? { ...b, ...brand } : b));
        });
        queryClient.setQueryData(["allBrands"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((b) => (b._id === brand._id ? { ...b, ...brand } : b));
        });
      }
      invalidate(["products"]);
    };
    const onBrandDeleted = (data) => {
      const id = typeof data === "string" ? data : extractData(data)?._id || data?._id || data?.id;
      if (id) {
        queryClient.removeQueries({ queryKey: ["brand", id] });
        queryClient.setQueryData(["brands"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((b) => b._id !== id);
        });
        queryClient.setQueryData(["allBrands"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((b) => b._id !== id);
        });
      }
      invalidate(["products"]);
    };

    socket.on("brand:created", onBrandCreated);
    socket.on("brand:updated", onBrandUpdated);
    socket.on("brand:deleted", onBrandDeleted);
    socket.on("brandCreated", onBrandCreated);
    socket.on("brandUpdated", onBrandUpdated);
    socket.on("brandDeleted", onBrandDeleted);

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
      cleanupConnection();
      // Products
      socket.off("productCreated", onProductCreated);
      socket.off("productUpdated", onProductUpdated);
      socket.off("productDeleted", onProductDeleted);
      // Deals
      socket.off("deal:created", onDealCreated);
      socket.off("deal:updated", onDealUpdated);
      socket.off("deal:deleted", onDealDeleted);
      // Discounts
      socket.off("discount:activity", onDiscountCreated);
      socket.off("discountCreated", onDiscountCreated);
      socket.off("discountUpdated", onDiscountUpdated);
      socket.off("discountDeleted", onDiscountDeleted);
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
      socket.off("banner:created", onBannerCreated);
      socket.off("banner:updated", onBannerUpdated);
      socket.off("banner:deleted", onBannerDeleted);
      socket.off("bannerCreated", onBannerCreated);
      socket.off("bannerUpdated", onBannerUpdated);
      socket.off("bannerDeleted", onBannerDeleted);
      // Categories
      socket.off("category:created", onCategoryCreated);
      socket.off("category:updated", onCategoryUpdated);
      socket.off("category:deleted", onCategoryDeleted);
      socket.off("categoryCreated", onCategoryCreated);
      socket.off("categoryUpdated", onCategoryUpdated);
      socket.off("categoryDeleted", onCategoryDeleted);
      // Brands
      socket.off("brand:created", onBrandCreated);
      socket.off("brand:updated", onBrandUpdated);
      socket.off("brand:deleted", onBrandDeleted);
      socket.off("brandCreated", onBrandCreated);
      socket.off("brandUpdated", onBrandUpdated);
      socket.off("brandDeleted", onBrandDeleted);
      // Orders
      socket.off("order:created", onOrderChanged);
      socket.off("order:updated", onOrderChanged);
      socket.off("order:deleted", onOrderChanged);
      socket.off("order:statusChanged", onOrderChanged);
      socket.off("order:paymentUpdated", onOrderChanged);
    };
  }, [socket, queryClient]); // isConnected hata diya — connect handler socket object pe depend karta hai

  return { isConnected };
}