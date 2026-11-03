"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, MessageSquareText, Package, RefreshCw } from "lucide-react";
import { customerChatApi } from "@/apis/chatApi";
import { orderApi } from "@/apis/user/orderApi";
import { useCart } from "@/components/user/CartContext";
import { useUserSocket } from "@/hooks/user/useUserSocket";
import { useTranslation } from "@/i18n/LanguageProvider";
import ChatThread from "@/components/chat/ChatThread";

export default function CustomerChatsPage({ initialConversationId = null }) {
  const [selectedId, setSelectedId] = useState(initialConversationId || undefined);
  const [switchingOrder, setSwitchingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const queryClient = useQueryClient();
  const { socket } = useUserSocket();
  const cartState = useCart();
  const cartItems = Array.isArray(cartState?.cart) ? cartState.cart : [];
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["customer-chat-conversations"],
    queryFn: customerChatApi.listMine,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const ordersQuery = useQuery({ queryKey: ["myOrders"], queryFn: orderApi.myOrders, staleTime: 60_000, retry: false });
  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : [];
  const conversations = query.data || [];
  const active = selectedId === null ? null : conversations.find((item) => String(item._id) === String(selectedId)) || conversations[0] || null;

  const updateInquiry = async (type, context = {}) => {
    if (!active) return false;
    setSwitchingOrder(true);
    setOrderError("");
    try {
      let target = active;
      if (target.order_id || target.order?._id) target = await customerChatApi.openGeneral();
      const updatedConversation = await customerChatApi.setInquiryContext(target._id, { type, ...context });
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["customer-chat-conversations"] }),
        queryClient.cancelQueries({ queryKey: ["chat-conversation-details", target._id] }),
      ]);
      queryClient.setQueryData(["chat-conversation-details", target._id], updatedConversation);
      queryClient.setQueryData(["customer-chat-conversations"], (current = []) => {
        const list = Array.isArray(current) ? current : [];
        const exists = list.some((item) => String(item._id) === String(updatedConversation._id));
        return exists
          ? list.map((item) => String(item._id) === String(updatedConversation._id) ? updatedConversation : item)
          : [updatedConversation, ...list];
      });
      setSelectedId(target._id);
      return true;
    } catch (error) {
      setOrderError(error.response?.data?.message || "Could not update this inquiry. Please try again.");
      return false;
    } finally { setSwitchingOrder(false); }
  };

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["customer-chat-conversations"] });
    socket.on("connect", refresh);
    socket.on("chat:conversation-created", refresh);
    socket.on("chat:conversation-updated", refresh);
    return () => {
      socket.off("connect", refresh);
      socket.off("chat:conversation-created", refresh);
      socket.off("chat:conversation-updated", refresh);
    };
  }, [socket, queryClient]);

  const unreadCount = conversations.reduce((sum, item) => sum + (Number(item.unread_customer_count) || 0), 0);

  return (
    <main className="mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full max-w-[1600px] flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-7">
      <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-5 py-4 shadow-sm sm:mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--user-accent)] text-white shadow-sm"><MessageSquareText size={23} /></span>
          <div>
            <h1 className="text-xl font-semibold text-[var(--user-text)] sm:text-2xl">{t("chat.customer.title")}</h1>
            <p className="mt-0.5 text-sm text-[var(--user-text-muted)]">{t("chat.customer.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && <span className="rounded-full bg-[var(--user-accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--user-accent)]">{t("chat.customer.unread", { count: unreadCount })}</span>}
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3.5 py-2 text-xs font-semibold text-[var(--user-text)]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span><span><span className="block">Online Support</span><span className="block text-[10px] font-normal text-[var(--user-text-muted)]">We’re here to help!</span></span></span>
        </div>
      </header>

      {query.isLoading ? (
        <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm text-[var(--user-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" />{t("chat.customer.loading")}</div>
      ) : query.isError ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-6 text-center">
          <MessageCircle className="mb-3 text-[var(--user-accent)]" size={28} />
          {[401, 403].includes(query.error?.response?.status) ? <>
            <h2 className="text-base font-semibold text-[var(--user-text)]">{t("chat.customer.signInTitle")}</h2>
            <p className="mt-1 max-w-md text-sm text-[var(--user-text-muted)]">{t("chat.customer.signInBody")}</p>
            <Link href="/account" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)]"><MessageCircle size={16} />{t("chat.customer.signIn")}</Link>
          </> : <>
            <h2 className="text-base font-semibold text-[var(--user-text)]">{t("chat.customer.loadError")}</h2>
            <p className="mt-1 max-w-md text-sm text-[var(--user-text-muted)]">{t("chat.customer.loadErrorBody")}</p>
            <button onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)]"><RefreshCw size={16} />{t("chat.customer.tryAgain")}</button>
          </>}
        </section>
      ) : conversations.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] p-6 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"><MessageCircle size={23} /></span>
          <h2 className="text-base font-semibold text-[var(--user-text)]">{t("chat.customer.emptyTitle")}</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--user-text-muted)]">{t("chat.customer.emptyBody")}</p>
          <Link href="/orders" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)]"><Package size={16} />{t("chat.customer.viewOrders")}</Link>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {active ? <>
              {orderError && <p role="alert" className="border-b border-[var(--user-border)] px-4 py-2 text-xs text-[var(--user-danger)]">{orderError}</p>}
              <div className="min-h-0 flex-1 overflow-hidden"><ChatThread key={active._id} conversation={active} api={customerChatApi} socket={socket} orders={orders} cartItems={cartItems} contextBusy={switchingOrder} onTopic={updateInquiry} onProducts={(products) => updateInquiry("product", { products })} /></div>
            </> : <div className="flex flex-1 items-center justify-center text-sm text-[var(--user-text-muted)]">{t("chat.customer.selectConversation")}</div>}
          </div>
        </section>
      )}
    </main>
  );
}
