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

    const handleStockAdjusted = () => {
      queryClient.invalidateQueries({
        queryKey: ["stock"],
      });

      queryClient.invalidateQueries({
        queryKey: ["stock-history"],
      });
    };

    socket.on("stockAdjusted", handleStockAdjusted);
    socket.on("stockUpdated", handleStockAdjusted);

    return () => {
      socket.off("stockAdjusted", handleStockAdjusted);
      socket.off("stockUpdated", handleStockAdjusted);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}
