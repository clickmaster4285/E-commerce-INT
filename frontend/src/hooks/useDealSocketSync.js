// src/hooks/useDealSocketSync.js
"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "./useSocket"; // Apne global socket helper ko import karein

export default function useDealSocketSync() {
  const queryClient = useQueryClient();
  
  // Self action track karne ke liye (taake duplicate refresh na ho)
  const selfActionRef = useRef(null);

  const markSelfAction = (action) => {
    selfActionRef.current = action;
    
    // 3 seconds baad reset kar dein
    setTimeout(() => {
      selfActionRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // -------------------------------------------------------
    // DEALS LIST REFRESH HELPER
    // -------------------------------------------------------
    const invalidateDeals = () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      // ✅ Mirror to the deals key the user GUI's DiscountContext reads,
      // so admin deal changes refresh the homepage deals strip + product page
      // deal-mode pricing immediately.
      queryClient.invalidateQueries({ queryKey: ["activeDeals"] });
      // Agar stats alag query hain to unhein bhi refresh karein
      // queryClient.invalidateQueries({ queryKey: ["deal-stats"] });
    };

    // -------------------------------------------------------
    // SOCKET EVENT HANDLERS
    // -------------------------------------------------------
    
    const handleDealCreated = (result) => {
      invalidateDeals();
      
      if (selfActionRef.current === "create") {
        selfActionRef.current = null;
      }
    };

    const handleDealUpdated = (result) => {
      const data = result?.data || result;
      const dealKey = data?._id ? data._id.toString() : null;

      // ✅ Socket payload ko cache mein likhna band kiya: wo GET se chhota
      // populate karta hai (cost_price / bundle rule waghera missing) aur
      // createdBy/updatedBy resolve na hone par "Updated by" blank aa jata tha —
      // page refresh karne par hi sahi data milta tha. Ab list + open deal
      // detail dono invalidate karte hain, taake fresh GET data aa jaye.
      invalidateDeals();

      if (dealKey) {
        queryClient.invalidateQueries({ queryKey: ["deal", dealKey] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["deal"] });
      }

      if (selfActionRef.current === "update" || selfActionRef.current === "toggle") {
        selfActionRef.current = null;
      }
    };

    const handleDealDeleted = (result) => {
      const id = result?.data?.id || result?.id || result;
      
      invalidateDeals();
      
      if (id) {
        // Cache se remove karein
        queryClient.removeQueries({ queryKey: ["deal", String(id)] });
      }
      
      if (selfActionRef.current === "delete") {
        selfActionRef.current = null;
      }
    };

    // -------------------------------------------------------
    // REGISTER LISTENERS
    // -------------------------------------------------------
    socket.on("deal:created", handleDealCreated);
    socket.on("deal:updated", handleDealUpdated);
    socket.on("deal:deleted", handleDealDeleted);

    // Cleanup function
    return () => {
      socket.off("deal:created", handleDealCreated);
      socket.off("deal:updated", handleDealUpdated);
      socket.off("deal:deleted", handleDealDeleted);
    };
  }, [queryClient]);

  return { markSelfAction };
}