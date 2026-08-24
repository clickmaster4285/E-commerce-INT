"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "./useSocket";

export default function useBannerSocketSync() {
  const queryClient = useQueryClient();
  const selfActionRef = useRef(null);

  const markSelfAction = (action) => {
    selfActionRef.current = action;
    setTimeout(() => {
      selfActionRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const invalidateBanners = () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
    };

    const handleBannerCreated = (result) => {
      invalidateBanners();
      if (selfActionRef.current === "create") {
        selfActionRef.current = null;
      }
    };

    const handleBannerUpdated = (result) => {
      const data = result?.data || result;
      if (data?._id) {
        const bannerKey = data._id.toString();
        queryClient.setQueryData(["adminBanners"], (oldData) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((b) => b?._id?.toString() === bannerKey ? data : b);
          }
          if (Array.isArray(oldData.data)) {
            return { ...oldData, data: oldData.data.map((b) => b?._id?.toString() === bannerKey ? data : b) };
          }
          return oldData;
        });
      } else {
        invalidateBanners();
      }
      if (selfActionRef.current === "update" || selfActionRef.current === "toggle") {
        selfActionRef.current = null;
      }
    };

    const handleBannerDeleted = (result) => {
      const id = result?.data?.id || result?.id || result;
      invalidateBanners();
      if (id) {
        queryClient.removeQueries({ queryKey: ["banner", String(id)] });
      }
      if (selfActionRef.current === "delete") {
        selfActionRef.current = null;
      }
    };

    socket.on("banner:created", handleBannerCreated);
    socket.on("banner:updated", handleBannerUpdated);
    socket.on("banner:deleted", handleBannerDeleted);
    socket.on("bannerCreated", handleBannerCreated);
    socket.on("bannerUpdated", handleBannerUpdated);
    socket.on("bannerDeleted", handleBannerDeleted);
    socket.on("bannerToggled", handleBannerUpdated);

    return () => {
      socket.off("banner:created", handleBannerCreated);
      socket.off("banner:updated", handleBannerUpdated);
      socket.off("banner:deleted", handleBannerDeleted);
      socket.off("bannerCreated", handleBannerCreated);
      socket.off("bannerUpdated", handleBannerUpdated);
      socket.off("bannerDeleted", handleBannerDeleted);
      socket.off("bannerToggled", handleBannerUpdated);
    };
  }, [queryClient]);

  return { markSelfAction };
}
