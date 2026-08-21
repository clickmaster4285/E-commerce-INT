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
    console.log("👤 Self Deal Action:", action);
    
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
      // Agar stats alag query hain to unhein bhi refresh karein
      // queryClient.invalidateQueries({ queryKey: ["deal-stats"] }); 
    };

    // -------------------------------------------------------
    // SOCKET EVENT HANDLERS
    // -------------------------------------------------------
    
    const handleDealCreated = (result) => {
      console.log("🟢 Socket: dealCreated", result);
      invalidateDeals();
      
      if (selfActionRef.current === "create") {
        console.log("✅ Self create action handled");
        selfActionRef.current = null;
      }
    };

    const handleDealUpdated = (result) => {
      const data = result?.data || result;
      console.log("✏️ Socket: dealUpdated", data);
      
      // Agar specific ID mil rahi hai to usay update karein
      if (data?._id) {
        const dealKey = data._id.toString();
        
        // Single deal cache update
        queryClient.setQueryData(["deal", dealKey], data);
        
        // List cache update (purane employee wale pattern se)
        queryClient.setQueryData(["deals"], (oldData) => {
          if (!oldData) return oldData;
          
          // Array check karein
          if (Array.isArray(oldData)) {
            return oldData.map((deal) => 
              deal?._id?.toString() === dealKey ? data : deal
            );
          }
          
          // Nested array check karein ({ deals: [] } ya { data: [] })
          if (Array.isArray(oldData.deals)) {
            return {
              ...oldData,
              deals: oldData.deals.map((deal) => 
                deal?._id?.toString() === dealKey ? data : deal
              )
            };
          }
          
          if (Array.isArray(oldData.data)) {
            return {
              ...oldData,
              data: oldData.data.map((deal) => 
                deal?._id?.toString() === dealKey ? data : deal
              )
            };
          }
          
          return oldData;
        });
      } else {
        // Agar ID nahi mili to puri list refresh karein
        invalidateDeals();
      }

      if (selfActionRef.current === "update" || selfActionRef.current === "toggle") {
        console.log("✅ Self update/toggle action handled");
        selfActionRef.current = null;
      }
    };

    const handleDealDeleted = (result) => {
      const id = result?.data?.id || result?.id || result;
      console.log("🗑️ Socket: dealDeleted", id);
      
      invalidateDeals();
      
      if (id) {
        // Cache se remove karein
        queryClient.removeQueries({ queryKey: ["deal", String(id)] });
      }
      
      if (selfActionRef.current === "delete") {
        console.log("✅ Self delete action handled");
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