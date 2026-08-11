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
    }

    const handleCreated = (data) => {
      console.log("📥 productCreated received:", data);
      invalidateAll();
    };

    const handleUpdated = (data) => {
      console.log("📥 productUpdated received:", data);
      invalidateAll();
      // Individual product query bhi invalidate karein
      const productId = data?._id || data?.product?._id || data?.id;
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      }
    };

    const handleDeleted = (data) => {
      console.log("📥 productDeleted received:", data);
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

    console.log("✅ Product socket listeners attached");

    return () => {
      socket.off("productCreated", handleCreated);
      socket.off("productUpdated", handleUpdated);
      socket.off("productDeleted", handleDeleted);
      console.log("🧹 Product socket listeners cleaned up");
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}