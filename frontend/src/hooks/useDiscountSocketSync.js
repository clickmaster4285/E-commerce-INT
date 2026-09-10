"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "./useSocket";

export default function useDiscountSocketSync(discountId) {
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

    // ================================
    // Discount List Refresh
    // ================================
    const invalidateDiscounts = () => {
      queryClient.invalidateQueries({
        queryKey: ["discounts"],
      });
    };

    // ================================
    // Discount Created
    // ================================
    const handleDiscountCreated = () => {
      invalidateDiscounts();

      if (selfActionRef.current === "create") {
        selfActionRef.current = null;
      }
    };

    // ================================
    // Discount Updated
    // ================================
    const handleDiscountUpdated = (result) => {
      const data = result?.data || result;

      if (data?._id) {
        const id = data._id.toString();

        // Update Discounts List Cache
        queryClient.setQueryData(
          ["discounts"],
          (oldData) => {
            if (!oldData) return oldData;

            // If API returns array directly
            if (Array.isArray(oldData)) {
              return oldData.map((discount) =>
                discount?._id?.toString() === id
                  ? data
                  : discount
              );
            }

            // If API returns { data: [] }
            if (Array.isArray(oldData.data)) {
              return {
                ...oldData,
                data: oldData.data.map((discount) =>
                  discount?._id?.toString() === id
                    ? data
                    : discount
                ),
              };
            }

            return oldData;
          }
        );

        // Update Specific Discount Detail Cache
        if (discountId && id === String(discountId)) {
          queryClient.setQueryData(
            ["discount", String(discountId)],
            data
          );
        }
      } else {
        // If updated event doesn't contain full discount data
        invalidateDiscounts();

        if (discountId) {
          queryClient.invalidateQueries({
            queryKey: ["discount", String(discountId)],
          });
        }
      }

      if (selfActionRef.current === "update") {
        selfActionRef.current = null;
      }
    };

    // ================================
    // Discount Deleted
    // ================================
    const handleDiscountDeleted = (result) => {
      const id =
        result?.data?.id ||
        result?.data?._id ||
        result?.id ||
        result?._id ||
        result;

      // Refresh Discount List
      invalidateDiscounts();

      // Remove deleted discount detail cache
      if (id) {
        queryClient.removeQueries({
          queryKey: ["discount", String(id)],
        });
      }

      if (selfActionRef.current === "delete") {
        selfActionRef.current = null;
      }
    };

    // ================================
    // Discount Activity
    // ================================
    const handleDiscountActivity = (event) => {
      // If this is a specific discount page,
      // ignore activity events belonging to another discount.
      if (
        discountId &&
        event?.discountId &&
        String(event.discountId) !== String(discountId)
      ) {
        return;
      }

      // Refresh discount list
      invalidateDiscounts();

      // Refresh current discount detail
      if (discountId) {
        queryClient.invalidateQueries({
          queryKey: ["discount", String(discountId)],
        });
      }
    };

    // ================================
    // Register Socket Events
    // ================================

    // Main event names
    socket.on("discount:created", handleDiscountCreated);
    socket.on("discount:updated", handleDiscountUpdated);
    socket.on("discount:deleted", handleDiscountDeleted);

    // Old / alternative event names
    socket.on("discountCreated", handleDiscountCreated);
    socket.on("discountUpdated", handleDiscountUpdated);
    socket.on("discountDeleted", handleDiscountDeleted);

    // Activity events
    socket.on("discount:activity", handleDiscountActivity);
    socket.on("discountActivity", handleDiscountActivity);

    // ================================
    // Cleanup
    // ================================
    return () => {
      socket.off("discount:created", handleDiscountCreated);
      socket.off("discount:updated", handleDiscountUpdated);
      socket.off("discount:deleted", handleDiscountDeleted);

      socket.off("discountCreated", handleDiscountCreated);
      socket.off("discountUpdated", handleDiscountUpdated);
      socket.off("discountDeleted", handleDiscountDeleted);

      socket.off("discount:activity", handleDiscountActivity);
      socket.off("discountActivity", handleDiscountActivity);
    };
  }, [queryClient, discountId]);

  return {
    markSelfAction,
  };
}