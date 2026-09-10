"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { discountApi } from "@/apis/user/discountApi";
import { dealApi } from "@/apis/user/dealApi";
import { useSocket } from "@/hooks/useSocket";

export function useDiscounts() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: discounts = [], isLoading: isLoadingDiscounts } = useQuery({
    queryKey: ["publicDiscounts"],
    queryFn: () => discountApi.getPublic(),
    staleTime: 30 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: deals = [], isLoading: isLoadingDeals } = useQuery({
    queryKey: ["activeDeals"],
    queryFn: () => dealApi.getActive(),
    staleTime: 30 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const isLoading = isLoadingDiscounts || isLoadingDeals;

  useEffect(() => {
    if (!socket) return;
    const refreshDiscounts = () => queryClient.invalidateQueries({ queryKey: ["publicDiscounts"] });
    const refreshDeals = () => queryClient.invalidateQueries({ queryKey: ["activeDeals"] });
    const refreshBanners = () => queryClient.invalidateQueries({ queryKey: ["activeBanners"] });

    socket.on("discount:created", refreshDiscounts);
    socket.on("discount:updated", refreshDiscounts);
    socket.on("discount:deleted", refreshDiscounts);
    socket.on("deal:created", refreshDeals);
    socket.on("deal:updated", refreshDeals);
    socket.on("deal:deleted", refreshDeals);
    socket.on("banner:created", refreshBanners);
    socket.on("banner:updated", refreshBanners);
    socket.on("banner:deleted", refreshBanners);

    return () => {
      socket.off("discount:created", refreshDiscounts);
      socket.off("discount:updated", refreshDiscounts);
      socket.off("discount:deleted", refreshDiscounts);
      socket.off("deal:created", refreshDeals);
      socket.off("deal:updated", refreshDeals);
      socket.off("deal:deleted", refreshDeals);
      socket.off("banner:created", refreshBanners);
      socket.off("banner:updated", refreshBanners);
      socket.off("banner:deleted", refreshBanners);
    };
  }, [socket, queryClient]);

  const calculateProductDiscount = useCallback(
    (product, variantPrice, includeDeals = false, overrideDeal = null) => {
      const originalPrice = Number(variantPrice ?? product?.price ?? product?.selling_price ?? 0);
      
      // STEP 0: DEAL PRIORITY GUARD — if product belongs to any active deal,
      // skip ALL discounts and return the original selling price so the deal
      // price (applied separately by the deal system) is not further reduced.
      const productId = String(product?._id || product?.id || "");
      const categoryId = String(product?.category_id?._id || product?.category_id || "");
      const brandId = String(product?.brand_id?._id || product?.brand_id || "");
      const now = new Date();

      if (includeDeals && deals && Array.isArray(deals)) {
        // ✅ If the caller provides an override deal (e.g. the user picked a
        //    specific deal in a multi-deal product page), use it directly.
        if (overrideDeal && overrideDeal.type) {
          const deal = overrideDeal;
          const dealType = deal.type;
          const dealValue = Number(deal.discountValue || 0);

          let dealDiscountedPrice = originalPrice;
          let dealHasDiscount = false;
          let dealSavings = 0;
          let dealDisplayType = dealType;
          let dealDisplayValue = dealValue;

          if (dealType === "percentage") {
            dealDiscountedPrice = Math.round(originalPrice * (1 - dealValue / 100));
            dealHasDiscount = true;
            dealSavings = originalPrice - dealDiscountedPrice;
          } else if (dealType === "fixed_amount") {
            dealDiscountedPrice = Math.max(0, originalPrice - dealValue);
            dealHasDiscount = dealDiscountedPrice < originalPrice;
            dealSavings = originalPrice - dealDiscountedPrice;
          } else {
            dealDiscountedPrice = originalPrice;
            dealHasDiscount = false;
            dealSavings = 0;
            dealDisplayType = dealType;
            dealDisplayValue = dealValue;
          }

          return {
            hasDiscount: dealHasDiscount,
            originalPrice,
            discountedPrice: dealDiscountedPrice,
            savings: dealSavings,
            discountName: deal.name || "",
            discountType: dealDisplayType,
            discountValue: dealDisplayValue,
            matchedDeal: deal,
          };
        }

        for (const deal of deals) {
          if (!deal.isActive) continue;
          const startDate = new Date(deal.startDate);
          const endDate = new Date(deal.endDate);
          if (startDate > now || endDate < now) continue;

          let dealApplies = false;
          if (deal.applyTo === "all") {
            dealApplies = true;
          } else if (deal.applyTo === "product" || deal.applyTo === "specific_products") {
            const ids = deal.productIds || deal.selectedProducts || [];
            dealApplies = ids.some((p) => String(p?._id || p) === productId);
          } else if (deal.applyTo === "category" || deal.applyTo === "specific_categories") {
            const ids = deal.categoryIds || deal.selectedCategories || [];
            dealApplies = categoryId && ids.some((c) => String(c?._id || c) === categoryId);
          } else if (deal.applyTo === "brand" || deal.applyTo === "specific_brands") {
            const ids = deal.brandIds || deal.selectedBrands || [];
            dealApplies = brandId && ids.some((b) => String(b?._id || b) === brandId);
          }

          if (dealApplies) {
            const dealType = deal.type;
            const dealValue = Number(deal.discountValue || 0);

            // ✅ Apply the deal's OWN discount to the price.
            // Percentage / fixed_amount → reduce price. buy_x_get_y / bundle /
            // free_shipping → no price change (free items / shipping only).
            // Regular (non-deal) discounts are skipped entirely for this product.
            let dealDiscountedPrice = originalPrice;
            let dealHasDiscount = false;
            let dealSavings = 0;
            let dealDisplayType = dealType;
            let dealDisplayValue = dealValue;

            if (dealType === "percentage") {
              dealDiscountedPrice = Math.round(originalPrice * (1 - dealValue / 100));
              dealHasDiscount = true;
              dealSavings = originalPrice - dealDiscountedPrice;
            } else if (dealType === "fixed_amount") {
              dealDiscountedPrice = Math.max(0, originalPrice - dealValue);
              dealHasDiscount = dealDiscountedPrice < originalPrice;
              dealSavings = originalPrice - dealDiscountedPrice;
            } else {
              dealDiscountedPrice = originalPrice;
              dealHasDiscount = false;
              dealSavings = 0;
              dealDisplayType = dealType;
              dealDisplayValue = dealValue;
            }

            return {
              hasDiscount: dealHasDiscount,
              originalPrice,
              discountedPrice: dealDiscountedPrice,
              savings: dealSavings,
              discountName: deal.name || "",
              discountType: dealDisplayType,
              discountValue: dealDisplayValue,
              matchedDeal: deal,
            };
          }
        }
      }

      // STEP 1: Check Old System (Direct Product Discount)
      const productDiscountPct = Number(product?.discount || 0);
      let bestPrice = productDiscountPct > 0 ? originalPrice * (1 - productDiscountPct / 100) : originalPrice;
      let bestName = productDiscountPct > 0 ? "Product Sale" : null;
      let bestType = productDiscountPct > 0 ? "percentage" : null;
      let bestValue = productDiscountPct;
      let matchedDeal = null;

      const checkApplies = (item) => {
        if (item.applyTo === "all") return true;
        if (item.applyTo === "product" || item.applyTo === "specific_products") {
          const ids = item.productIds || item.selectedProducts || [];
          return ids.some((p) => String(p?._id || p) === productId);
        }
        if (item.applyTo === "category" || item.applyTo === "specific_categories") {
          const ids = item.categoryIds || item.selectedCategories || [];
          return categoryId && ids.some((c) => String(c?._id || c) === categoryId);
        }
        if (item.applyTo === "brand" || item.applyTo === "specific_brands") {
          const ids = item.brandIds || item.selectedBrands || [];
          return brandId && ids.some((b) => String(b?._id || b) === brandId);
        }
        return false;
      };

      // ✅ STEP 2: FIRST check for Buy X Get Y deals (special handling)
      if (includeDeals && deals && Array.isArray(deals)) {
        for (const deal of deals) {
          if (!deal.isActive) continue;
          if (deal.type !== "buy_x_get_y") continue; // Sirf buy_x_get_y pehle check karo
          
          const startDate = new Date(deal.startDate);
          const endDate = new Date(deal.endDate);
          if (startDate > now || endDate < now) continue;

          if (checkApplies(deal)) {
            // ✅ Buy X Get Y deal matched! Isko priority do
            matchedDeal = deal;
            bestName = deal.name || `Buy ${deal.buyQuantity || 2} Get ${deal.getQuantity || 1}`;
            bestType = "buy_x_get_y";
            bestValue = deal.discountValue || 0;
            // Price same rahega, lekin badge dikhayega
            break;
          }
        }
      }

      // ✅ STEP 3: Check regular discounts (percentage/fixed)
      if (!matchedDeal && discounts && Array.isArray(discounts)) {
        for (const disc of discounts) {
          if (!disc.isActive) continue;
          if (!checkApplies(disc)) continue;

          let finalPrice = originalPrice;
          if (disc.type === "percentage") {
            finalPrice = originalPrice * (1 - Number(disc.value || disc.discountValue) / 100);
          } else if (disc.type === "fixed" || disc.type === "fixed_amount") {
            finalPrice = Math.max(0, originalPrice - Number(disc.value || disc.discountValue));
          }

          if (finalPrice < bestPrice) {
            bestPrice = finalPrice;
            bestName = disc.name || "Discount";
            bestType = disc.type;
            bestValue = disc.value || disc.discountValue;
          }
        }
      }

      // ✅ STEP 4: Check other deals (percentage/fixed/free_shipping)
      if (includeDeals && !matchedDeal && deals && Array.isArray(deals)) {
        for (const deal of deals) {
          if (!deal.isActive) continue;
          if (deal.type === "buy_x_get_y") continue; // Already check kar liya
          
          const startDate = new Date(deal.startDate);
          const endDate = new Date(deal.endDate);
          if (startDate > now || endDate < now) continue;

          if (!checkApplies(deal)) continue;

          let finalPrice = originalPrice;
          if (deal.type === "percentage") {
            finalPrice = originalPrice * (1 - Number(deal.discountValue) / 100);
          } else if (deal.type === "fixed_amount") {
            finalPrice = Math.max(0, originalPrice - Number(deal.discountValue));
          }
          // free_shipping ka price same rahega

          if (finalPrice < bestPrice || deal.type === "free_shipping") {
            bestPrice = finalPrice;
            bestName = deal.name || `${deal.discountValue}${deal.type === "percentage" ? "%" : " Rs"} OFF`;
            bestType = deal.type;
            bestValue = deal.discountValue;
            matchedDeal = deal;
          }
        }
      }

      const hasDiscount = bestPrice < originalPrice || matchedDeal !== null;
      
      return {
        hasDiscount,
        originalPrice,
        discountedPrice: Math.round(hasDiscount ? bestPrice : originalPrice),
        savings: hasDiscount ? Math.round(originalPrice - bestPrice) : 0,
        discountName: bestName,
        discountType: bestType,
        discountValue: bestValue,
        matchedDeal: matchedDeal,
      };
    },
    [discounts, deals],
  );

  const getActiveDealForProduct = useCallback(
    (product) => {
      if (!product || !deals || !Array.isArray(deals)) return null;
      const productId = String(product._id || product.id || "");
      const categoryId = String(product.category_id?._id || product.category_id || "");
      const brandId = String(product.brand_id?._id || product.brand_id || "");
      const now = new Date();

      const checkApplies = (deal) => {
        if (deal.applyTo === "all") return true;
        if (deal.applyTo === "product" || deal.applyTo === "specific_products") {
          const ids = deal.productIds || deal.selectedProducts || [];
          return ids.some((p) => String(p?._id || p) === productId);
        }
        if (deal.applyTo === "category" || deal.applyTo === "specific_categories") {
          const ids = deal.categoryIds || deal.selectedCategories || [];
          return categoryId && ids.some((c) => String(c?._id || c) === categoryId);
        }
        if (deal.applyTo === "brand" || deal.applyTo === "specific_brands") {
          const ids = deal.brandIds || deal.selectedBrands || [];
          return brandId && ids.some((b) => String(b?._id || b) === brandId);
        }
        return false;
      };

      for (const deal of deals) {
        if (!deal.isActive) continue;
        const startDate = new Date(deal.startDate);
        const endDate = new Date(deal.endDate);
        if (startDate > now || endDate < now) continue;
        if (checkApplies(deal)) return deal;
      }
      return null;
    },
    [deals],
  );

  // ✅ Returns ALL active deals matching this product (same matching rules
  //    as getActiveDealForProduct but without the early-return).
  const getActiveDealsForProduct = useCallback(
    (product) => {
      if (!product || !deals || !Array.isArray(deals)) return [];
      const productId = String(product._id || product.id || "");
      const categoryId = String(product.category_id?._id || product.category_id || "");
      const brandId = String(product.brand_id?._id || product.brand_id || "");
      const now = new Date();

      const checkApplies = (deal) => {
        if (deal.applyTo === "all") return true;
        if (deal.applyTo === "product" || deal.applyTo === "specific_products") {
          const ids = deal.productIds || deal.selectedProducts || [];
          return ids.some((p) => String(p?._id || p) === productId);
        }
        if (deal.applyTo === "category" || deal.applyTo === "specific_categories") {
          const ids = deal.categoryIds || deal.selectedCategories || [];
          return categoryId && ids.some((c) => String(c?._id || c) === categoryId);
        }
        if (deal.applyTo === "brand" || deal.applyTo === "specific_brands") {
          const ids = deal.brandIds || deal.selectedBrands || [];
          return brandId && ids.some((b) => String(b?._id || b) === brandId);
        }
        return false;
      };

      return deals.filter((deal) => {
        if (!deal.isActive) return false;
        const startDate = new Date(deal.startDate);
        const endDate = new Date(deal.endDate);
        if (startDate > now || endDate < now) return false;
        return checkApplies(deal);
      });
    },
    [deals],
  );

  return { discounts, deals, isLoading, calculateProductDiscount, getActiveDealForProduct, getActiveDealsForProduct };
}