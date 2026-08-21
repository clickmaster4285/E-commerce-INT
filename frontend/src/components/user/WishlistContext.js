"use client";

import { createContext, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/apis/axiosInstance";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const queryClient = useQueryClient();

  // ✅ Wishlist from database (logged-in user)
  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/wishlist");
      return res.data?.wishlist || [];
    },
    retry: false,
  });

  // ✅ Toggle (add/remove) in database
  const toggleMutation = useMutation({
    mutationFn: async (productId) => {
      const res = await axiosInstance.put("/users/wishlist/toggle", {
        product_id: productId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const isWishlisted = (id) =>
    wishlist.some((w) => (w._id || w.id)?.toString() === id?.toString());

  const toggleWishlist = (productId) => toggleMutation.mutate(productId);

  const value = useMemo(
    () => ({
      wishlist,
      count: wishlist.length,
      loading: isLoading,
      isWishlisted,
      toggleWishlist,
    }),
    [wishlist, isLoading, toggleMutation],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}