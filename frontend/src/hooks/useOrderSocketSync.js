"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

/**
 * ✅ ADMIN ORDER SOCKET SYNC
 *
 * User-side actions (placeOrder / editOrder / deleteOrder) and
 * admin-side actions (updateOrderStatus / updatePaymentStatus) ko
 * realtime admin orders list aur single order detail pages pe
 * reflect karta hai — bina page refresh ke.
 */
export function useOrderSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const invalidateOrder = (payload) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });

      const id =
        payload?.data?._id ||
        payload?.data?.id ||
        payload?._id ||
        payload?.id ||
        payload?.orderId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["admin-order", String(id)] });
      }
    };

    socket.on("order:created", invalidateOrder);
    socket.on("order:updated", invalidateOrder);
    socket.on("order:deleted", invalidateOrder);
    socket.on("order:statusChanged", invalidateOrder);
    socket.on("order:paymentUpdated", invalidateOrder);

    return () => {
      socket.off("order:created", invalidateOrder);
      socket.off("order:updated", invalidateOrder);
      socket.off("order:deleted", invalidateOrder);
      socket.off("order:statusChanged", invalidateOrder);
      socket.off("order:paymentUpdated", invalidateOrder);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}

export default useOrderSocketSync;