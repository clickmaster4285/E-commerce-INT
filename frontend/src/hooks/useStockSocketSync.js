"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

/*
 * Real-time stock sync:
 * Browser A mein stock adjust hone par
 * Browser B mein table, summary aur history
 * automatically refresh ho jaye.
 */
export function useStockSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // ✅ Stock change (adjust / order place-delete / variant edit) — list + history dono refresh
    const handleStockChange = () => {
      queryClient.invalidateQueries({
        queryKey: ["stock"],
      });

      queryClient.invalidateQueries({
        queryKey: ["stock-history"],
      });
    };

    // ✅ Product create/update/delete bhi manage-stock list badalta hai (names, variants,
    //    "Deleted" badge) — is liye un events par bhi list refresh hoti hai.
    const handleProductChange = () => {
      queryClient.invalidateQueries({
        queryKey: ["stock"],
      });
    };

    socket.on("stockAdjusted", handleStockChange);
    socket.on("stockUpdated", handleStockChange);
    socket.on("productCreated", handleProductChange);
    socket.on("productUpdated", handleProductChange);
    socket.on("productDeleted", handleProductChange);

    return () => {
      socket.off("stockAdjusted", handleStockChange);
      socket.off("stockUpdated", handleStockChange);
      socket.off("productCreated", handleProductChange);
      socket.off("productUpdated", handleProductChange);
      socket.off("productDeleted", handleProductChange);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}
