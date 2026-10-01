"use client";

/* ==========================================================
   useShopProducts — storefront server-pagination hook
   (admin pattern jaisa: page+filters queryKey me, placeholderData
   se flicker nahi, filter badalne par page 1 caller reset karta hai)
   ========================================================== */

import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";

export const SHOP_PAGE_SIZE = 20;

export function useShopProducts({
  page = 1,
  limit = SHOP_PAGE_SIZE,
  search = "",
  sort = "featured",
  brandIds = [],
  categoryIds = [],
  minPrice = null,
  maxPrice = null,
  stockStates = [],
  dealIds = [],
  discountBands = [],
  minDiscount = null,
  enabled = true,
  staleTime = 60 * 1000,
} = {}) {
  const params = {
    page: Math.max(1, Number(page) || 1),
    limit,
    search: String(search || ""),
    sort,
    brandIds: (brandIds || []).map(String).filter(Boolean),
    categoryIds: (categoryIds || []).map(String).filter(Boolean),
    minPrice,
    maxPrice,
    stockStates: [...(stockStates || [])],
    dealIds: (dealIds || []).map(String).filter(Boolean),
    discountBands: [...(discountBands || [])].map(Number).filter((n) => Number.isFinite(n)),
    minDiscount,
  };

  const query = useQuery({
    queryKey: [
      "shopProducts",
      params.page,
      params.limit,
      params.search,
      params.sort,
      [...params.brandIds].sort().join(","),
      [...params.categoryIds].sort().join(","),
      params.minPrice,
      params.maxPrice,
      [...params.stockStates].sort().join(","),
      [...params.dealIds].sort().join(","),
      [...params.discountBands].sort((a, b) => a - b).join(","),
      params.minDiscount,
    ],
    queryFn: () =>
      productApi.getAllPaginated({
        page: params.page,
        limit: params.limit,
        search: params.search,
        sort: params.sort,
        brand_id: params.brandIds.join(",") || undefined,
        category_id: params.categoryIds.join(",") || undefined,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        stock: params.stockStates,
        deal: params.dealIds,
        discount: params.discountBands,
        minDiscount: params.minDiscount,
      }),
    enabled,
    retry: 1,
    staleTime,
    // ✅ Page change par purana page visible (admin jaisa, flicker nahi)
    placeholderData: (previousData) => previousData,
  });

  return {
    ...query,
    products: query.data?.products || [],
    pagination: query.data?.pagination || null,
    total: query.data?.pagination?.total ?? 0,
  };
}

/* Page badalne par list ke top par smooth scroll (spec Step 4.7) */
export function scrollToListTop(ref) {
  try {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {}
}
