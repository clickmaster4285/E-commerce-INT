"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

export function useStoreSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    // Socket available nahi ya connected nahi hai
    if (!socket || !isConnected) {
      return;
    }

    // =========================================================
    // STORE UPDATED EVENT
    // =========================================================

    const handleStoreUpdated = (data) => {

      if (!data) {
        console.warn(
          "⚠️ useStoreSocketSync → storeUpdated received empty data"
        );
        return;
      }

      // ---------------------------------------------------------
      // Update ["storeInfo"] cache immediately
      // ---------------------------------------------------------

      queryClient.setQueryData(["storeInfo"], (oldData) => {
        // Existing TanStack Query data exists
        if (oldData?.success && oldData?.data) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              ...data,
            },
          };
        }

        // No previous cache
        return {
          success: true,
          data,
        };
      });

      // ---------------------------------------------------------
      // If application also uses ["store"] query,
      // mark it stale so it can refetch when required.
      // ---------------------------------------------------------

      queryClient.invalidateQueries({
        queryKey: ["store"],
      });

      // ---------------------------------------------------------
      // Optional browser event
      // Useful for components that directly listen to
      // "storeUpdated".
      // ---------------------------------------------------------

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("storeUpdated", {
            detail: data,
          })
        );
      }
    };

    // =========================================================
    // STORE INFO EVENT
    // =========================================================

    const handleStoreInfo = (response) => {

      // Backend response expected:
      //
      // {
      //   success: true,
      //   data: {
      //     store_name: "...",
      //     ...
      //   }
      // }

      if (!response?.success || !response?.data) {
        console.warn(
          "⚠️ useStoreSocketSync → Invalid storeInfo response:",
          response
        );
        return;
      }

      // ---------------------------------------------------------
      // Save complete response in TanStack Query cache
      // ---------------------------------------------------------

      queryClient.setQueryData(
        ["storeInfo"],
        response
      );

      // ---------------------------------------------------------
      // Optional browser event
      // ---------------------------------------------------------

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("storeUpdated", {
            detail: response.data,
          })
        );
      }
    };

    // =========================================================
    // ATTACH SOCKET LISTENERS
    // =========================================================

    socket.on(
      "storeUpdated",
      handleStoreUpdated
    );

    socket.on(
      "storeInfo",
      handleStoreInfo
    );


    // =========================================================
    // REQUEST CURRENT STORE INFO
    // =========================================================

    socket.emit("getStoreInfo");


    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      socket.off(
        "storeUpdated",
        handleStoreUpdated
      );

      socket.off(
        "storeInfo",
        handleStoreInfo
      );

    };
  }, [socket, isConnected, queryClient]);

  // =========================================================
  // RETURN
  // =========================================================

  return {
    isConnected,
  };
}