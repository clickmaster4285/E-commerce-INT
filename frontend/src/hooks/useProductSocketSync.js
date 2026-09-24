"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

export function useProductSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // ✅ Helper: Invalidate all related queries at once
    function invalidateAll() {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // ✅ Detail page queries ["product", id] — PREFIX invalidation se saari
      // ids match hoti hain, is liye detail page har socket update pe fresh
      // ho jata hai (socket _id vs URL id ke mismatch ka chance hi khatam).
      queryClient.invalidateQueries({ queryKey: ["product"] });
    }

    const handleCreated = (data) => {
      invalidateAll();
    };

    const handleUpdated = (data) => {
      invalidateAll();
      // Individual product query bhi invalidate karein
      const productId = data?._id || data?.product?._id || data?.id;
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      }
    };

    const handleDeleted = (data) => {
      invalidateAll();
      // Deleted product ki individual query remove karein
      const productId = typeof data === "string" ? data : (data?.id || data?._id);
      if (productId) {
        queryClient.removeQueries({ queryKey: ["product", productId] });
      }
    };

    socket.on("productCreated", handleCreated);
    socket.on("productUpdated", handleUpdated);
    socket.on("productDeleted", handleDeleted);


    return () => {
      socket.off("productCreated", handleCreated);
      socket.off("productUpdated", handleUpdated);
      socket.off("productDeleted", handleDeleted);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}