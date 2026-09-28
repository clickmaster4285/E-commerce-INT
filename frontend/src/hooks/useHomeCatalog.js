"use client";

/* ==========================================================
   useHomeCatalog — User GUI (Home page) ka data + filter layer
   - products / categories / brands real public APIs se (same
     queryKeys jo baaki user components use karte hain, isliye
     network par sirf ek hi request jati hai).
   - Sidebar ke filters (category, brands, price range) yahin
     manage hote hain aur featured products par apply hote hain.
   ========================================================== */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { productApi } from "@/apis/user/productApi";
import {
  EMPTY_HOME_FILTERS,
  countActiveFilters,
  filterProducts,
  hasActiveFilters,
  priceBounds,
} from "@/utils/homeCatalog";

export function useHomeCatalog() {
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const [filters, setFilters] = useState(EMPTY_HOME_FILTERS);

  const updateFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...EMPTY_HOME_FILTERS, brandIds: [] });
  }, []);

  const filteredProducts = useMemo(
    () => filterProducts(products, filters, categories),
    [products, filters, categories],
  );

  const bounds = useMemo(() => priceBounds(products), [products]);

  return {
    products,
    categories,
    brands,
    filters,
    updateFilter,
    clearFilters,
    filteredProducts,
    bounds,
    filtersActive: hasActiveFilters(filters),
    activeFilterCount: countActiveFilters(filters),
    isLoading: productsLoading || categoriesLoading || brandsLoading,
  };
}
