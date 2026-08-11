"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";
import Cookies from "js-cookie";

export function useStoreSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleStoreUpdated = (data) => {
      console.log("📥 useStoreSocketSync → storeUpdated received:", data?.store_name);

      // ✅ TanStack Query cache invalidate
      queryClient.invalidateQueries({ queryKey: ["storeInfo"] });
      queryClient.invalidateQueries({ queryKey: ["store"] });

      // ✅ Direct cache update (instant UI)
      queryClient.setQueryData(["storeInfo"], (old) => {
        if (old && old.success) {
          return { ...old, data: { ...old.data, ...data } };
        }
        return { success: true, data };
      });

      // ✅ FIXED: localStorage → Cookies
      if (typeof window !== "undefined") {
        Cookies.set("storeName", data?.store_name || "", { expires: 365, path: "/" });
        Cookies.set("storeData", JSON.stringify(data), { expires: 365, path: "/" });

        // ✅ Custom event dispatch - Layout, Sidebar, Navbar sab sunenge
        window.dispatchEvent(new CustomEvent("storeUpdated", { detail: data }));
      }
    };

    const handleStoreInfo = (data) => {
      console.log("📥 useStoreSocketSync → storeInfo received:", data?.data?.store_name);
      if (data?.success && data?.data) {
        queryClient.setQueryData(["storeInfo"], data);

        // ✅ FIXED: localStorage → Cookies
        if (typeof window !== "undefined") {
          Cookies.set("storeName", data.data?.store_name || "", { expires: 365, path: "/" });
          Cookies.set("storeData", JSON.stringify(data.data), { expires: 365, path: "/" });
          window.dispatchEvent(new CustomEvent("storeUpdated", { detail: data.data }));
        }
      }
    };

    socket.on("storeUpdated", handleStoreUpdated);
    socket.on("storeInfo", handleStoreInfo);

    // ✅ Connect hote hi current store info maango
    socket.emit("getStoreInfo");

    console.log("✅ Store socket listeners attached in useStoreSocketSync");

    return () => {
      socket.off("storeUpdated", handleStoreUpdated);
      socket.off("storeInfo", handleStoreInfo);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}