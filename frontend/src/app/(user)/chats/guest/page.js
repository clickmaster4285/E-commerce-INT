"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { guestChatApi } from "@/apis/chatApi";
import { useCart } from "@/components/user/CartContext";
import { useUserSocket } from "@/hooks/user/useUserSocket";
import ChatThread from "@/components/chat/ChatThread";

import {
  subscribeGuestToken,
  getGuestToken,
  getGuestTokenServerSnapshot,
} from "@/lib/guestChatToken";

export default function GuestFullChatPage() {
  const token = useSyncExternalStore(subscribeGuestToken, getGuestToken, getGuestTokenServerSnapshot);
  const { socket } = useUserSocket();
  const cartState = useCart();
  const cartItems = Array.isArray(cartState?.cart) ? cartState.cart : [];
  const query = useQuery({ queryKey: ["guest-chat-conversation", token], queryFn: () => guestChatApi.mine(token), enabled: Boolean(token), retry: false });
  const conversation = useMemo(() => query.data?.conversation || null, [query.data]);
  const api = useMemo(() => token ? ({
    details: (id) => guestChatApi.details(id, token),
    messages: (id, before) => guestChatApi.messages(id, before, token),
    send: (id, text, context) => guestChatApi.send(id, text, token, context),
    markRead: (id) => guestChatApi.markRead(id, token),
    setInquiryContext: (id, context) => guestChatApi.setInquiryContext(id, context, token),
  }) : null, [token]);
  const updateTopic = async (type, context = {}) => {
    if (!conversation || !token || type === "order") return false;
    try {
      const items = cartItems.slice(0, 30).map((item) => ({ productId: item.productId || item.product_id?._id || item.product_id || item.id, variant_id: item.variant_id?._id || item.variant_id || item.variantId, qty: Number(item.qty) }));
      const updated = await guestChatApi.setInquiryContext(conversation._id, { type, ...context, ...(type === "cart" ? { items } : {}) }, token);
      await query.refetch();
      return Boolean(updated);
    } catch { return false; }
  };

  return <main className="mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full max-w-[1200px] flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-7">
    <header className="mb-3 flex shrink-0 items-center gap-3 sm:mb-4">
      <Link href="/" aria-label="Back to store" className="flex h-9 w-9 items-center justify-center rounded-lg border border-user-line bg-user-card text-user-fg-muted transition hover:bg-user-hover"><ArrowLeft size={17} /></Link>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-user-accent/10 text-user-accent"><MessageCircle size={19} /></span>
      <div className="min-w-0"><h1 className="text-lg font-semibold text-user-fg">Chat support</h1><p className="truncate text-xs text-user-fg-muted">{conversation?.guest_name || "Guest conversation"} · Secure guest chat</p></div>
    </header>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-user-line bg-user-card shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
      {query.isLoading ? <div className="flex flex-1 items-center justify-center gap-2 text-sm text-user-fg-muted"><Loader2 className="h-5 w-5 animate-spin" />Loading your conversation…</div>
        : query.isError || !conversation || !api ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><MessageCircle size={26} className="mb-3 text-user-accent" /><h2 className="text-sm font-semibold text-user-fg">Guest chat unavailable</h2><p className="mt-1 max-w-sm text-xs leading-5 text-user-fg-muted">Open Chat support from the store and enter your name and email to continue.</p><Link href="/" className="mt-4 rounded-lg bg-user-accent px-4 py-2 text-xs font-semibold text-user-accent-fg">Return to store</Link></div>
          : <div className="min-h-0 flex-1 overflow-hidden"><ChatThread conversation={conversation} api={api} socket={socket} guestToken={token} cartItems={cartItems} allowOrder={false} onTopic={updateTopic} onProducts={(products) => updateTopic("product", { products })} /></div>}
    </section>
  </main>;
}
