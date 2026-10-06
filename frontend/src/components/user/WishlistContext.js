"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userHttp } from "@/apis/axiosInstance"
const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const queryClient = useQueryClient();

  // ✅ Wishlist from database (logged-in user)
  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await userHttp.get("/users/wishlist");
      return res.data?.wishlist || [];
    },
    retry: false,
  });

  // ✅ Toggle (add/remove) in database
  const toggleMutation = useMutation({
    mutationFn: async (productId) => {
      const res = await userHttp.put("/users/wishlist/toggle", {
        product_id: productId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const isWishlisted = useCallback(
    (id) => wishlist.some((w) => (w._id || w.id)?.toString() === id?.toString()),
    [wishlist],
  );

  const toggleWishlist = useCallback((productId) => toggleMutation.mutate(productId), [toggleMutation]);

  const value = useMemo(
    () => ({
      wishlist,
      count: wishlist.length,
      loading: isLoading,
      isWishlisted,
      toggleWishlist,
    }),
    [wishlist, isLoading, isWishlisted, toggleWishlist],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}