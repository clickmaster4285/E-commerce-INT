"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "./useSocket";

export default function useDiscountSocketSync() {
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

    const invalidateDiscounts = () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    };

    const handleDiscountCreated = (result) => {
      invalidateDiscounts();
      if (selfActionRef.current === "create") {
        selfActionRef.current = null;
      }
    };

    const handleDiscountUpdated = (result) => {
      const data = result?.data || result;
      if (data?._id) {
        const discountKey = data._id.toString();
        queryClient.setQueryData(["discounts"], (oldData) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((d) => d?._id?.toString() === discountKey ? data : d);
          }
          if (Array.isArray(oldData.data)) {
            return { ...oldData, data: oldData.data.map((d) => d?._id?.toString() === discountKey ? data : d) };
          }
          return oldData;
        });
      } else {
        invalidateDiscounts();
      }
      if (selfActionRef.current === "update") {
        selfActionRef.current = null;
      }
    };

    const handleDiscountDeleted = (result) => {
      const id = result?.data?.id || result?.id || result;
      invalidateDiscounts();
      if (id) {
        queryClient.removeQueries({ queryKey: ["discount", String(id)] });
      }
      if (selfActionRef.current === "delete") {
        selfActionRef.current = null;
      }
    };

    socket.on("discount:created", handleDiscountCreated);
    socket.on("discount:updated", handleDiscountUpdated);
    socket.on("discount:deleted", handleDiscountDeleted);
    socket.on("discountCreated", handleDiscountCreated);
    socket.on("discountUpdated", handleDiscountUpdated);
    socket.on("discountDeleted", handleDiscountDeleted);

    return () => {
      socket.off("discount:created", handleDiscountCreated);
      socket.off("discount:updated", handleDiscountUpdated);
      socket.off("discount:deleted", handleDiscountDeleted);
      socket.off("discountCreated", handleDiscountCreated);
      socket.off("discountUpdated", handleDiscountUpdated);
      socket.off("discountDeleted", handleDiscountDeleted);
    };
  }, [queryClient]);

  return { markSelfAction };
}
