"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { discountApi } from "@/apis/user/discountApi";
import { useSocket } from "@/hooks/useSocket";

// ✅ Fetch active public discounts (no auth)
export function useDiscounts() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["publicDiscounts"],
    queryFn: () => discountApi.getPublic(),
    staleTime: 30 * 1000,        // 30 sec (socket fast karega)
    refetchInterval: 5 * 60 * 1000, // ✅ Fallback: 5 min mein refetch
    retry: 1,
  });

  // ✅ SOCKET LISTENERS — Admin changes ko live reflect karo
  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["publicDiscounts"] });
    };

    // Backend yeh 3 events emit karta hai discountController se
    socket.on("discount:created", refresh);
    socket.on("discount:updated", refresh);
    socket.on("discount:deleted", refresh);

    // Fallback event names (agar colon wale na milein)
    socket.on("discountCreated", refresh);
    socket.on("discountUpdated", refresh);
    socket.on("discountDeleted", refresh);

    return () => {
      socket.off("discount:created", refresh);
      socket.off("discount:updated", refresh);
      socket.off("discount:deleted", refresh);
      socket.off("discountCreated", refresh);
      socket.off("discountUpdated", refresh);
      socket.off("discountDeleted", refresh);
    };
  }, [socket, queryClient]);

  // ✅ Calculate best discount for a product
  const calculateProductDiscount = useCallback(
    (product, variantPrice) => {
      const originalPrice = Number(
        variantPrice ?? product?.price ?? product?.selling_price ?? 0,
      );

      // Product ka apna discount (percentage stored on product)
      const productDiscountPct = Number(product?.discount || 0);
      let bestPrice =
        productDiscountPct > 0
          ? originalPrice * (1 - productDiscountPct / 100)
          : originalPrice;
      let bestSource = productDiscountPct > 0 ? "product" : null;
      let bestName = productDiscountPct > 0 ? "Product Sale" : null;
      let bestType = productDiscountPct > 0 ? "percentage" : null;
      let bestValue = productDiscountPct;

      if (!discounts || !Array.isArray(discounts) || discounts.length === 0) {
        const hasDiscount = bestPrice < originalPrice;
        return {
          hasDiscount,
          originalPrice,
          discountedPrice: Math.round(hasDiscount ? bestPrice : originalPrice),
          savings: hasDiscount ? Math.round(originalPrice - bestPrice) : 0,
          discountName: bestName,
          discountType: bestType,
          discountValue: bestValue,
        };
      }

      const productId = String(product?._id || product?.id || "");
      const categoryId = String(
        product?.category_id?._id || product?.category_id || "",
      );
      const brandId = String(
        product?.brand_id?._id || product?.brand_id || "",
      );

      for (const discount of discounts) {
        if (!discount.isActive) continue;

        let applies = false;

        if (discount.applyTo === "all") {
          applies = true;
        } else if (discount.applyTo === "specific_products") {
          applies = (discount.selectedProducts || []).some(
            (p) => String(p?._id || p) === productId,
          );
        } else if (discount.applyTo === "specific_categories") {
          applies =
            categoryId &&
            (discount.selectedCategories || []).some(
              (c) => String(c?._id || c) === categoryId,
            );
        } else if (discount.applyTo === "specific_brands") {
          applies =
            brandId &&
            (discount.selectedBrands || []).some(
              (b) => String(b?._id || b) === brandId,
            );
        } else if (discount.applyTo === "price_range") {
          applies =
            discount.priceMin != null &&
            discount.priceMax != null &&
            originalPrice >= discount.priceMin &&
            originalPrice <= discount.priceMax;
        }

        if (!applies) continue;

        let finalPrice = originalPrice;
        if (discount.type === "percentage") {
          finalPrice = originalPrice * (1 - Number(discount.value) / 100);
          if (discount.maxDiscountAmount && originalPrice - finalPrice > discount.maxDiscountAmount) {
            finalPrice = originalPrice - discount.maxDiscountAmount;
          }
        } else if (discount.type === "fixed") {
          finalPrice = Math.max(0, originalPrice - Number(discount.value));
        } else if (discount.type === "fixed_price") {
          finalPrice = Number(discount.value);
        }

        if (finalPrice < bestPrice) {
          bestPrice = finalPrice;
          bestSource = "admin";
          bestName = discount.name || discount.code;
          bestType = discount.type;
          bestValue = discount.value;
        }
      }

      const hasDiscount = bestPrice < originalPrice;
      return {
        hasDiscount,
        originalPrice,
        discountedPrice: Math.round(hasDiscount ? bestPrice : originalPrice),
        savings: hasDiscount ? Math.round(originalPrice - bestPrice) : 0,
        discountName: bestName,
        discountType: bestType,
        discountValue: bestValue,
      };
    },
    [discounts],
  );

  return { discounts, isLoading, calculateProductDiscount };
}