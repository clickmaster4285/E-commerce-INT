"use client";

/* ==========================================================
   useHomeCatalog — User GUI (Home page) ka data + filter layer

   - products / categories / brands real public APIs se (wahi queryKeys
     jo baaki user components use karte hain → sirf ek hi network request).
   - Sidebar ke saare facets yahin compute hote hain:
       Category (subtree counts) · Price range · Brands ·
       Availability (real variant stock) · Discount (real active
       discounts/deals ke percentage)
   - Har facet ke counts "baaki active filters" ke hisaab se bante hain
     (jaisa e-commerce filters me hota hai).
   ========================================================== */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { productApi } from "@/apis/user/productApi";
import { dealApi } from "@/apis/user/dealApi";
import { useDiscounts } from "@/components/user/DiscountContext";
import {
  DISCOUNT_BANDS,
  EMPTY_HOME_FILTERS,
  STOCK_STATES,
  countActiveFilters,
  dealMatchesProduct,
  filterProducts,
  getProductPrice,
  getStockState,
  hasActiveFilters,
  idOf,
  priceBounds,
} from "@/utils/homeCatalog";

const createEmptyFilters = (initial = {}) => ({
  ...EMPTY_HOME_FILTERS,
  brandIds: initial.brandIds || [],
  stockStates: [],
  discountBands: [],
  discountBand: null,
  dealIds: [],
  categoryIds: initial.categoryIds || [],
  minPrice: initial.minPrice ?? null,
  maxPrice: initial.maxPrice ?? null,
});

export function useHomeCatalog(initialFilters = {}) {
  const { data: products = [], isPending: productsPending } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [], isPending: categoriesPending } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: brands = [], isPending: brandsPending } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Active deals (sidebar "Deals" filter + right-side deal products filtering).
  // Wahi queryKey jo DealsSection use karta hai → sirf ek hi network request.
  const { data: deals = [], isPending: dealsPending } = useQuery({
    queryKey: ["activeDeals"],
    queryFn: dealApi.getActive,
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  // ✅ Real discount engine (same jo ProductCard use karta hai)
  const { calculateProductDiscount } = useDiscounts();

  const [filters, setFilters] = useState(() => createEmptyFilters(initialFilters));

  const updateFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(createEmptyFilters());
  }, []);

  const resetFacet = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: [] }));
  }, []);

  // ---------- Per-product REAL discount % (ek hi pass me build) ----------
  const discountPercentOf = useCallback(
    (product) => {
      const price = getProductPrice(product);
      if (!(price > 0)) return 0;
      const info = calculateProductDiscount(product, price, false, null);
      const discounted = Number(info?.discountedPrice ?? price);
      if (!info?.hasDiscount || !(discounted < price)) return 0;
      return Math.round(((price - discounted) / price) * 100);
    },
    [calculateProductDiscount],
  );

  const discountMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((product) => {
      map.set(idOf(product?._id), discountPercentOf(product));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, calculateProductDiscount]);

  const getDiscountPercent = useCallback(
    (product) => discountMap.get(idOf(product?._id)) || 0,
    [discountMap],
  );

  const filteredProducts = useMemo(
    () => filterProducts(products, filters, categories, getDiscountPercent, deals),
    [products, filters, categories, getDiscountPercent, deals],
  );

  // ---------- Facet counts (baaki filters ke saath) ----------
  const stockFacet = useMemo(() => {
    const base = filterProducts(
      products,
      { ...filters, stockStates: [] },
      categories,
      getDiscountPercent,
      deals,
    );
    const counts = { in: 0, low: 0, out: 0 };
    base.forEach((product) => {
      counts[getStockState(product)] += 1;
    });
    return STOCK_STATES.map((state) => ({ ...state, count: counts[state.id] || 0 }));
  }, [products, filters, categories, getDiscountPercent, deals]);

  const discountFacet = useMemo(() => {
    const base = filterProducts(
      products,
      { ...filters, discountBands: [], discountBand: null },
      categories,
      getDiscountPercent,
      deals,
    );
    const counts = {};
    DISCOUNT_BANDS.forEach((band) => {
      counts[band] = 0;
    });
    base.forEach((product) => {
      const percent = getDiscountPercent(product);
      DISCOUNT_BANDS.forEach((band) => {
        if (percent >= band) counts[band] += 1;
      });
    });
    return DISCOUNT_BANDS.map((band) => ({ band, count: counts[band] || 0 }));
  }, [products, filters, categories, getDiscountPercent, deals]);

  // ---------- Deal facet: har active deal me kitne products (baaki filters ke saath) ----------
  const dealFacet = useMemo(() => {
    const base = filterProducts(
      products,
      { ...filters, dealIds: [] },
      categories,
      getDiscountPercent,
      deals,
    );
    return (deals || []).map((deal) => ({
      ...deal,
      count: base.filter((product) => dealMatchesProduct(deal, product)).length,
    }));
  }, [products, filters, categories, getDiscountPercent, deals]);

  const bounds = useMemo(() => priceBounds(products), [products]);

  return {
    products,
    categories,
    brands,
    deals,
    filters,
    updateFilter,
    clearFilters,
    resetFacet,
    filteredProducts,
    bounds,
    stockFacet,
    discountFacet,
    dealFacet,
    getDiscountPercent,
    filtersActive: hasActiveFilters(filters),
    activeFilterCount: countActiveFilters(filters),
    isLoading: productsPending || categoriesPending || brandsPending,
    dealsLoading: dealsPending,
  };
}
