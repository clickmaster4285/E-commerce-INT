import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";

export function useShippingSocketSync() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["adminShippingConfig"] });
      queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] });
      queryClient.invalidateQueries({ queryKey: ["shippingConfig"] });
      queryClient.invalidateQueries({ queryKey: ["shippingQuote"] });
    };
    socket.on("shipping:updated", invalidate);
    socket.on("shippingRules:updated", invalidate);
    return () => {
      socket.off("shipping:updated", invalidate);
      socket.off("shippingRules:updated", invalidate);
    };
  }, [socket, queryClient]);
}