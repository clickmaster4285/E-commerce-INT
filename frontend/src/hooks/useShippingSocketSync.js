"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";

export function useShippingSocketSync() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["adminShippingConfig"] });
      queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] });
      queryClient.invalidateQueries({ queryKey: ["shippingConfig"] });
      queryClient.invalidateQueries({ queryKey: ["shippingRules"] });
      queryClient.invalidateQueries({ queryKey: ["shippingQuote"] });
    };

    socket.on("shippingConfigUpdated", invalidateAll);
    socket.on("shippingRuleCreated", invalidateAll);
    socket.on("shippingRuleUpdated", invalidateAll);
    socket.on("shippingRuleDeleted", invalidateAll);
    socket.on("shippingRuleToggled", invalidateAll);

    return () => {
      socket.off("shippingConfigUpdated", invalidateAll);
      socket.off("shippingRuleCreated", invalidateAll);
      socket.off("shippingRuleUpdated", invalidateAll);
      socket.off("shippingRuleDeleted", invalidateAll);
      socket.off("shippingRuleToggled", invalidateAll);
    };
  }, [socket, queryClient]);
}