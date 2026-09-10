"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

export function useAttributeSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["active-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    };

    const handleDeleted = (data) => {
      invalidate();
      if (data?.id) {
        queryClient.removeQueries({ queryKey: ["attribute", data.id] });
      }
    };

    socket.on("attributeCreated", invalidate);
    socket.on("attributeUpdated", invalidate);
    socket.on("attributeDeleted", handleDeleted);

    return () => {
      socket.off("attributeCreated", invalidate);
      socket.off("attributeUpdated", invalidate);
      socket.off("attributeDeleted", handleDeleted);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}
