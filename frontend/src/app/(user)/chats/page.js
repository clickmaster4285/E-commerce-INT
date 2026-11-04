"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle, MessageSquareText, Package, RefreshCw } from "lucide-react";
import { customerChatApi, guestChatApi } from "@/apis/chatApi";
import { userHttp } from "@/apis/axiosInstance";
import { orderApi } from "@/apis/user/orderApi";
import { useCart } from "@/components/user/CartContext";
import { useUserSocket } from "@/hooks/user/useUserSocket";
import { useTranslation } from "@/i18n/LanguageProvider";
import ChatThread from "@/components/chat/ChatThread";

const GUEST_TOKEN_KEY = "support-chat-guest-token";
const subscribeGuestToken = (callback) => {
  window.addEventListener("storage", callback);
  window.addEventListener("support-chat:guest-token", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("support-chat:guest-token", callback);
  };
};
const getGuestToken = () => {
  try { return window.localStorage.getItem(GUEST_TOKEN_KEY) || ""; } catch { return ""; }
};
const getServerGuestToken = () => "";
export default function CustomerChatsPage({ initialConversationId = null }) {
  const [selectedId, setSelectedId] = useState(initialConversationId || undefined);
  const [switchingOrder, setSwitchingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [guestConversation, setGuestConversation] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [customerAccessDenied, setCustomerAccessDenied] = useState(false);
  const guestToken = useSyncExternalStore(subscribeGuestToken, getGuestToken, getServerGuestToken);
  const queryClient = useQueryClient();
  const { socket } = useUserSocket();
  const cartState = useCart();
  const cartItems = Array.isArray(cartState?.cart) ? cartState.cart : [];
  const { t } = useTranslation();
  const profileQuery = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const response = await userHttp.get("/users/profile", { timeout: 15000 });
      return response.data?.user || response.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const query = useQuery({
    queryKey: ["customer-chat-conversations"],
    queryFn: async () => {
      try { return await customerChatApi.listMine(); }
      catch (error) {
        if ([401, 403].includes(error.response?.status || error.status)) setCustomerAccessDenied(true);
        throw error;
      }
    },
    enabled: Boolean(profileQuery.data) && !customerAccessDenied,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const ordersQuery = useQuery({ queryKey: ["myOrders"], queryFn: orderApi.myOrders, staleTime: 60_000, retry: false });
  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : [];
  const guestMode = !profileQuery.isLoading && (!profileQuery.data || customerAccessDenied);
  const unauthorized = guestMode;
  const guestQuery = useQuery({ queryKey: ["guest-chat-conversation", guestToken], queryFn: () => guestChatApi.mine(guestToken), enabled: Boolean(guestMode && guestToken), retry: false });
  const guestActiveConversation = guestConversation || guestQuery.data?.conversation || null;
  const guestApi = useMemo(() => guestToken ? ({
    details: (id) => guestChatApi.details(id, guestToken),
    messages: (id, before) => guestChatApi.messages(id, before, guestToken),
    send: (id, text, context) => guestChatApi.send(id, text, guestToken, context),
    markRead: (id) => guestChatApi.markRead(id, guestToken),
    setInquiryContext: (id, context) => guestChatApi.setInquiryContext(id, context, guestToken),
  }) : null, [guestToken]);
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
    if (!socket || !profileQuery.data || customerAccessDenied || query.isError) return undefined;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["customer-chat-conversations"] });
    socket.on("connect", refresh);
    socket.on("chat:conversation-created", refresh);
    socket.on("chat:conversation-updated", refresh);
    return () => {
      socket.off("connect", refresh);
      socket.off("chat:conversation-created", refresh);
      socket.off("chat:conversation-updated", refresh);
    };
  }, [socket, queryClient, profileQuery.data, customerAccessDenied, query.isError]);

  const unreadCount = conversations.reduce((sum, item) => sum + (Number(item.unread_customer_count) || 0), 0);
  const startGuestChat = async (event) => {
    event.preventDefault();
    setGuestBusy(true);
    setGuestError("");
    try {
      const result = await guestChatApi.start(guestName, guestEmail, guestToken);
      window.localStorage.setItem(GUEST_TOKEN_KEY, result.token);
      setGuestConversation(result.conversation);
      setGuestName(result.conversation?.guest_name || guestName.trim());
      setGuestEmail(result.conversation?.guest_email || guestEmail.trim());
      window.dispatchEvent(new Event("support-chat:guest-token"));
      await queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation", result.token] });
    } catch (error) {
      setGuestError(error.response?.data?.message || "Could not open chat. Please try again.");
    } finally { setGuestBusy(false); }
  };

  const reopenGuestChat = async () => {
    if (!guestActiveConversation) return;
    setGuestBusy(true);
    setGuestError("");
    try {
      const result = await guestChatApi.start(guestActiveConversation.guest_name, guestActiveConversation.guest_email, guestToken);
      setGuestConversation(result.conversation);
      await queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation", guestToken] });
    } catch (error) {
      setGuestError(error.response?.data?.message || "Could not reopen chat. Please try again.");
    } finally { setGuestBusy(false); }
  };

  const updateGuestInquiry = async (type, context = {}) => {
    if (!guestActiveConversation || !guestToken || type === "order") return false;
    try {
      const cartSnapshot = cartItems.slice(0, 30).map((item) => ({ productId: item.productId || item.product_id?._id || item.product_id || item.id, variant_id: item.variant_id?._id || item.variant_id || item.variantId, qty: Number(item.qty) }));
      const updated = await guestChatApi.setInquiryContext(guestActiveConversation._id, { type, ...context, ...(type === "cart" ? { items: cartSnapshot } : {}) }, guestToken);
      setGuestConversation(updated);
      await queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation", guestToken] });
      return true;
    } catch (error) {
      setGuestError(error.response?.data?.message || "Could not update this inquiry. Please try again.");
      return false;
    }
  };

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
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3.5 py-2 text-xs font-semibold text-[var(--user-text)]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span><span><span className="block">{t("chat.ui.onlineSupport")}</span><span className="block text-[10px] font-normal text-[var(--user-text-muted)]">{t("chat.ui.hereToHelp")}</span></span></span>
        </div>
      </header>

      {profileQuery.isLoading || (Boolean(profileQuery.data) && query.isLoading) || (guestMode && guestToken && guestQuery.isLoading) ? (
        <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm text-[var(--user-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" />{t("chat.customer.loading")}</div>
      ) : guestMode ? (
        <section className={`flex ${unauthorized && guestActiveConversation ? "min-h-0 flex-1 p-0 text-left" : "min-h-72 p-6 text-center"} flex-col items-center justify-center rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]`}>
          {!(unauthorized && guestActiveConversation) && <MessageCircle className="mb-3 text-[var(--user-accent)]" size={28} />}
          {unauthorized ? guestQuery.isLoading ? <div className="flex flex-col items-center gap-3 text-sm text-[var(--user-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" />Loading your guest conversation…</div> : guestActiveConversation && guestApi ? <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-left"><div className="min-h-0 flex-1 overflow-hidden"><ChatThread key={guestActiveConversation._id} conversation={guestActiveConversation} api={guestApi} socket={socket} guestToken={guestToken} cartItems={cartItems} allowOrder={false} onTopic={updateGuestInquiry} onProducts={(products) => updateGuestInquiry("product", { products })} /></div>{guestActiveConversation.status === "closed" && <button onClick={reopenGuestChat} disabled={guestBusy} className="m-3 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] disabled:opacity-60">{guestBusy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}Start a new chat</button>}</div> : <form onSubmit={startGuestChat} className="w-full max-w-md rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-6 text-left shadow-sm sm:p-8"><h2 className="text-base font-semibold text-[var(--user-text)]">Start a support chat</h2><p className="mt-1 text-sm leading-5 text-[var(--user-text-muted)]">Enter your name and email and our team will help you here.</p><div className="mt-5 space-y-4"><label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--user-text-secondary)]">Name<input required minLength={1} maxLength={80} autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-sm text-[var(--user-text)] outline-none transition focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15" placeholder="Your name" /></label><label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--user-text-secondary)]">Email<input required type="email" maxLength={254} autoComplete="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-sm text-[var(--user-text)] outline-none transition focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15" placeholder="you@example.com" /></label></div>{guestError && <p role="alert" className="mt-3 text-xs text-[var(--user-danger)]">{guestError}</p>}<button type="submit" disabled={guestBusy} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] transition hover:brightness-95 disabled:opacity-60">{guestBusy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}Continue to chat</button></form> : <>
            <h2 className="text-base font-semibold text-[var(--user-text)]">{t("chat.customer.loadError")}</h2>
            <p className="mt-1 max-w-md text-sm text-[var(--user-text-muted)]">{t("chat.customer.loadErrorBody")}</p>
            <button onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)]"><RefreshCw size={16} />{t("chat.customer.tryAgain")}</button>
          </>}
        </section>
      ) : query.isError ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-6 text-center">
          <MessageCircle className="mb-3 text-[var(--user-accent)]" size={28} />
          <h2 className="text-base font-semibold text-[var(--user-text)]">{t("chat.customer.loadError")}</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--user-text-muted)]">{t("chat.customer.loadErrorBody")}</p>
          <button onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)]"><RefreshCw size={16} />{t("chat.customer.tryAgain")}</button>
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
