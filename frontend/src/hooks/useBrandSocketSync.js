"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

export function useBrandSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {

    if (!socket || !isConnected) return;

    const handleUpdated = (data) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      const brandId = data?._id || data?.id;
      if (brandId) {
        queryClient.invalidateQueries({ queryKey: ["brand", brandId] });
      }
    };

    const handleCreated = (data) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      const brandId = data?._id || data?.id;
      if (brandId) {
        queryClient.invalidateQueries({ queryKey: ["brand", brandId] });
      }
    };

    const handleDeleted = (data) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      const brandId = data?._id || data?.id || (typeof data === "string" ? data : null);
      if (brandId) {
        queryClient.invalidateQueries({ queryKey: ["brand", brandId] });
        queryClient.removeQueries({ queryKey: ["brand", brandId] });
      }
    };

    socket.on("brandCreated", handleCreated);
    socket.on("brandUpdated", handleUpdated);
    socket.on("brandDeleted", handleDeleted);

    return () => {
      socket.off("brandCreated", handleCreated);
      socket.off("brandUpdated", handleUpdated);
      socket.off("brandDeleted", handleDeleted);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}