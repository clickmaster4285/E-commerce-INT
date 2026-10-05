"use client";

/* ==========================================================
   useHomeCatalog — User GUI (Home page) ka data + filter layer

   - categories / brands / deals: chhoti master lists (full, small).
   - products grid + sidebar facet counts: SERVER (paginated /facets).
     Poora catalog ab browser me nahi ata.
   - Sidebar filter state (URL sync page.js me) yahin rehti hai.
   ========================================================== */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { dealApi } from "@/apis/user/dealApi";
import { productApi } from "@/apis/user/productApi";
import {
  EMPTY_HOME_FILTERS,
  hasActiveFilters,
  countActiveFilters,
  idOf,
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

/* Filters → facets API params (server leave-one-out khud karta hai).
   search sirf /shop se aata hai (?q=) — home hamesha undefined bhejta hai. */
export function filtersToFacetParams(filters, extra = {}) {
  const bands = [
    ...((filters?.discountBands || []).map(Number).filter((n) => Number.isFinite(n))),
    ...((filters?.discountBand ?? null) !== null ? [Number(filters.discountBand)] : []),
  ].filter((n) => Number.isFinite(n) && n > 0);
  return {
    search: String(extra?.search || "").trim() || undefined,
    brand_id: (filters?.brandIds || []).map(String).filter(Boolean).join(",") || undefined,
    category_id: (filters?.categoryIds || []).map(String).filter(Boolean).join(",") || undefined,
    minPrice: filters?.minPrice ?? undefined,
    maxPrice: filters?.maxPrice ?? undefined,
    stock: [...(filters?.stockStates || [])],
    deal: (filters?.dealIds || []).map(String).filter(Boolean),
    discount: [...new Set(bands)],
  };
}

export function useHomeCatalog(initialFilters = {}, opts = {}) {
  const search = String(opts?.search || "").trim();
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

  // ✅ Active deals (sidebar "Deals" filter + counts merge).
  const { data: deals = [], isPending: dealsPending } = useQuery({
    queryKey: ["activeDeals"],
    queryFn: dealApi.getActive,
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

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

  // ✅ Sidebar counts + bounds + grid total — SERVER (leave-one-out included)
  // react-query keys ko stable hash karta hai, is liye object seedha key me.
  // search (?q=) key me shamil hai taake shop par counts query-aware hon.
  const facetParams = useMemo(() => filtersToFacetParams(filters, { search }), [filters, search]);
  const {
    data: facets = null,
    isPending: facetsPending,
    isError: facetsError,
    refetch: refetchFacets,
  } = useQuery({
    queryKey: ["shopFacets", facetParams],
    queryFn: () => productApi.getFacets(facetParams),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const emptyFacets = useMemo(
    () => ({
      success: true,
      total: 0,
      bounds: { min: 0, max: 0 },
      categories: [],
      brands: [],
      stock: [
        { id: "in", count: 0 },
        { id: "low", count: 0 },
        { id: "out", count: 0 },
      ],
      discounts: [],
      deals: [],
    }),
    [],
  );
  const safeFacets = facets || emptyFacets;

  // ✅ Deal list with counts (master deals + facet counts merge)
  const dealFacet = useMemo(() => {
    const counts = new Map((safeFacets.deals || []).map((d) => [String(d._id), d.count || 0]));
    return (deals || []).map((deal) => ({ ...deal, count: counts.get(idOf(deal?._id)) || 0 }));
  }, [deals, safeFacets]);

  return {
    categories,
    brands,
    deals,
    dealFacet,
    filters,
    updateFilter,
    clearFilters,
    resetFacet,
    facets: safeFacets,
    matchCount: safeFacets.total || 0,
    bounds: safeFacets.bounds || { min: 0, max: 0 },
    stockFacet: safeFacets.stock || [],
    discountFacet: safeFacets.discounts || [],
    filtersActive: hasActiveFilters(filters),
    activeFilterCount: countActiveFilters(filters),
    isLoading: categoriesPending || brandsPending,
    facetsLoading: facetsPending,
    facetsError,
    refetchFacets,
    dealsLoading: dealsPending,
  };
}
