"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

export function useCategorySocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleCreated = (data) => {
      console.log("📥 categoryCreated received", data);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    };

    const handleUpdated = (data) => {
      console.log("📥 categoryUpdated received", data);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (data?._id) {
        queryClient.invalidateQueries({ queryKey: ["category", data._id] });
      }
    };

    const handleDeleted = (data) => {
      console.log("📥 categoryDeleted received", data);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (data?.id) {
        queryClient.removeQueries({ queryKey: ["category", data.id] });
      }
    };

    socket.on("categoryCreated", handleCreated);
    socket.on("categoryUpdated", handleUpdated);
    socket.on("categoryDeleted", handleDeleted);

    console.log("✅ Category socket listeners attached");

    return () => {
      socket.off("categoryCreated", handleCreated);
      socket.off("categoryUpdated", handleUpdated);
      socket.off("categoryDeleted", handleDeleted);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}