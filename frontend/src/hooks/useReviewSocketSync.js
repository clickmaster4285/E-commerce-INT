"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

/**
 * ✅ Reviews — admin panels ka live socket sync (baqi modules ki tarah).
 *
 * Backend `reviewUpdated` emit karta hai jab koi staff review hide/unhide
 * kare ya store response publish/delete kare. Ye hook sunte hi
 * ["adminReviews"] lists invalidate kar deta hai — taake dusre tabs ya
 * dusre staff members ke panels bina refresh ke fresh ho jayein.
 */
export function useReviewSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["adminReviews"] });
    };

    socket.on("reviewUpdated", handleUpdated);

    return () => {
      socket.off("reviewUpdated", handleUpdated);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}
