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
      const changedId = data?._id ? data._id.toString() : null;

      // ✅ Socket payload ko cache mein direct likhna band kiya — update event ka
      // payload raw doc hota hai (updatedBy sirf ObjectId), jise detail cache
      // mein likhne se "Updated By" adhoora/purana reh jata tha aur page refresh
      // karna padta tha. Ab list + khuli hui detail dono invalidate karte hain,
      // taake backend ka resolved GET payload aaye.
      invalidateDiscounts();

      const detailId = discountId ? String(discountId) : changedId;
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["discount", detailId] });
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