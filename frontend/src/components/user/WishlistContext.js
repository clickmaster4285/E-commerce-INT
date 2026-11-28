"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userHttp } from "@/apis/axiosInstance";
import { hasAuthSession } from "@/lib/authSession";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const queryClient = useQueryClient();
  const loggedIn = typeof window !== "undefined" && hasAuthSession("user");

  // Ids only on every page (§9.2) — full products load on /wishlist only
  const { data: ids = [], isLoading } = useQuery({
    queryKey: ["wishlist", "ids"],
    queryFn: async () => {
      const res = await userHttp.get("/users/wishlist/ids");
      return Array.isArray(res.data?.ids) ? res.data.ids.map(String) : [];
    },
    enabled: loggedIn,
    retry: false,
    staleTime: 60 * 1000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (productId) => {
      const res = await userHttp.put("/users/wishlist/toggle", {
        product_id: productId,
      });
      return { ...res.data, productId: String(productId) };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["wishlist", "ids"], (prev = []) => {
        const id = String(data.productId);
        if (data.added) return prev.includes(id) ? prev : [...prev, id];
        return prev.filter((x) => x !== id);
      });
      queryClient.invalidateQueries({ queryKey: ["wishlist", "products"] });
    },
  });

  const isWishlisted = useCallback(
    (id) => ids.some((wid) => String(wid) === String(id)),
    [ids],
  );

  const toggleWishlist = useCallback((productId) => toggleMutation.mutate(productId), [toggleMutation]);

  const value = useMemo(
    () => ({
      // Back-compat: pages that still expect `wishlist` as product docs get ids;
      // WishlistPage fetches products itself via ["wishlist","products"].
      wishlist: ids,
      ids,
      count: ids.length,
      loading: loggedIn ? isLoading : false,
      isWishlisted,
      toggleWishlist,
    }),
    [ids, isLoading, loggedIn, isWishlisted, toggleWishlist],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
