"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

export function useBrandSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    console.log("🔌 Socket Sync → socket:", !!socket, "connected:", isConnected);

    if (!socket || !isConnected) return;

    const invalidateBrands = (eventName) => {
      console.log(`🔄 Socket event received: ${eventName} → Invalidating brands...`);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    };

    socket.on("brandCreated", () => invalidateBrands("brandCreated"));
    socket.on("brandUpdated", () => invalidateBrands("brandUpdated"));
    socket.on("brandDeleted", () => invalidateBrands("brandDeleted"));

    return () => {
      socket.off("brandCreated");
      socket.off("brandUpdated");
      socket.off("brandDeleted");
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}