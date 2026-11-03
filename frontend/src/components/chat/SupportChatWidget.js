"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Expand, Loader2, MessageCircle, X } from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";
import { customerChatApi, guestChatApi } from "@/apis/chatApi";
import { orderApi } from "@/apis/user/orderApi";
import { useCart } from "@/components/user/CartContext";
import { useUserSocket } from "@/hooks/user/useUserSocket";
import ChatThread from "@/components/chat/ChatThread";

const GUEST_TOKEN_KEY = "support-chat-guest-token";
const WIDGET_POSITION_KEY = "support-chat-widget-position";
let fallbackGuestToken = "";
const subscribeGuestToken = (callback) => {
  window.addEventListener("storage", callback);
  window.addEventListener("support-chat:guest-token", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("support-chat:guest-token", callback);
  };
};
const getGuestToken = () => {
  try { return window.localStorage.getItem(GUEST_TOKEN_KEY) || fallbackGuestToken; } catch { return fallbackGuestToken; }
};
const getGuestTokenServerSnapshot = () => "";
const subscribeWidgetPosition = (callback) => {
  window.addEventListener("storage", callback);
  window.addEventListener("support-chat:widget-position", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("support-chat:widget-position", callback);
  };
};
const getWidgetPosition = () => {
  try { return window.localStorage.getItem(WIDGET_POSITION_KEY); } catch { return null; }
};
const getWidgetPositionServerSnapshot = () => null;

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const guestToken = useSyncExternalStore(subscribeGuestToken, getGuestToken, getGuestTokenServerSnapshot);
  const savedPosition = useSyncExternalStore(subscribeWidgetPosition, getWidgetPosition, getWidgetPositionServerSnapshot);
  const [dragPosition, setDragPosition] = useState(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const dragRef = useRef(null);
  const widgetRef = useRef(null);
  const suppressClickRef = useRef(false);
  const creatingDefaultChatRef = useRef(false);
  const openingOrderChatRef = useRef(false);
  const userRef = useRef(null);
  const pendingOrderRef = useRef("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestConversation, setGuestConversation] = useState(null);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { socket } = useUserSocket();
  const cartState = useCart();
  const cartItems = Array.isArray(cartState?.cart) ? cartState.cart : [];
  const parsedPosition = useMemo(() => {
    try {
      const value = JSON.parse(savedPosition || "null");
      return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? value : null;
    } catch { return null; }
  }, [savedPosition]);
  const position = dragPosition || parsedPosition;
  // Don't apply a saved absolute point until the browser viewport has been
  // measured. The server snapshot starts without dimensions; using raw saved
  // coordinates in that window can place the launcher off-screen on first load.
  const visiblePosition = position && viewport.width && viewport.height ? {
    x: Math.max(8, Math.min(position.x, Math.max(8, viewport.width - 160))),
    y: Math.max(8, Math.min(position.y, Math.max(8, viewport.height - 64))),
  } : null;
  const positionStyle = visiblePosition ? { left: `${visiblePosition.x}px`, top: `${visiblePosition.y}px` } : undefined;
  const defaultPopupAnchor = viewport.width && viewport.height ? {
    x: Math.max(8, viewport.width - (viewport.width < 640 ? 60 : 160)),
    y: Math.max(8, viewport.height - (viewport.width < 640 ? 128 : 72)),
  } : null;
  const popupAnchor = visiblePosition || defaultPopupAnchor;
  const placePopupAbove = Boolean(popupAnchor && popupAnchor.y > viewport.height / 2);
  const popupWidth = viewport.width ? Math.min(384, viewport.width - 24) : 384;
  const alignPopupRight = Boolean(popupAnchor && viewport.width && popupAnchor.x > viewport.width - popupWidth - 150);
  const popupMaxHeight = viewport.height && popupAnchor
    ? Math.max(160, Math.min(608, placePopupAbove ? popupAnchor.y - 16 : viewport.height - popupAnchor.y - 76))
    : undefined;

  useLayoutEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!widgetRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const onLauncherPointerDown = (event) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onLauncherPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
    drag.moved = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, drag.originX + deltaX));
    const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, drag.originY + deltaY));
    setDragPosition({ x, y });
  };
  const onLauncherPointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, drag.originX + event.clientX - drag.startX));
    const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, drag.originY + event.clientY - drag.startY));
    const nextPosition = { x, y };
    setDragPosition(nextPosition);
    suppressClickRef.current = true;
    try { window.localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(nextPosition)); } catch {}
    window.dispatchEvent(new Event("support-chat:widget-position"));
  };

  const userQuery = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const response = await userHttp.get("/users/profile");
      return response.data?.user || response.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const user = userQuery.data || null;
  const ordersQuery = useQuery({ queryKey: ["myOrders"], queryFn: orderApi.myOrders, enabled: Boolean(user), staleTime: 60_000, retry: false });
  const customerChatsQuery = useQuery({
    queryKey: ["customer-chat-conversations"],
    queryFn: customerChatApi.listMine,
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
    retry: false,
  });

  const guestConversationQuery = useQuery({
    queryKey: ["guest-chat-conversation", guestToken],
    queryFn: () => guestChatApi.mine(guestToken),
    enabled: Boolean(guestToken && !user),
    retry: false,
  });

  const orders = useMemo(() => Array.isArray(ordersQuery.data) ? ordersQuery.data : [], [ordersQuery.data]);
  const customerConversations = useMemo(() => customerChatsQuery.data || [], [customerChatsQuery.data]);
  const customerConversation = customerConversations.find((item) => String(item._id) === String(activeCustomerId)) || customerConversations.find((item) => item.status === "open") || customerConversations[0] || null;
  const activeConversation = user ? customerConversation : (guestConversation || guestConversationQuery.data?.conversation || null);
  const isGuestSetup = !user && !guestToken && !activeConversation;
  const roomConversation = guestConversation || guestConversationQuery.data?.conversation;
  const unread = user
    ? customerConversations.reduce((count, item) => count + (Number(item.unread_customer_count) || 0), 0)
    : Number(activeConversation?.unread_customer_count) || 0;

  const guestApi = useMemo(() => ({
    details: (id) => guestChatApi.details(id, guestToken),
    messages: (id, before) => guestChatApi.messages(id, before, guestToken),
    send: (id, text, context) => guestChatApi.send(id, text, guestToken, context),
    markRead: (id) => guestChatApi.markRead(id, guestToken),
    setInquiryContext: (id, context) => guestChatApi.setInquiryContext(id, context, guestToken),
  }), [guestToken]);

  const openCustomerChat = useCallback(async (orderId = "") => {
    setBusy(true);
    setError("");
    try {
      let conversation = await customerChatApi.openGeneral();
      if (orderId) conversation = await customerChatApi.setInquiryContext(conversation._id, { type: "order", orderId: String(orderId) });
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["customer-chat-conversations"] }),
        queryClient.cancelQueries({ queryKey: ["chat-conversation-details", conversation._id] }),
      ]);
      queryClient.setQueryData(["chat-conversation-details", conversation._id], conversation);
      queryClient.setQueryData(["customer-chat-conversations"], (current = []) => {
        const list = Array.isArray(current) ? current : [];
        return list.some((item) => String(item._id) === String(conversation._id))
          ? list.map((item) => String(item._id) === String(conversation._id) ? conversation : item)
          : [conversation, ...list];
      });
      setActiveCustomerId(conversation._id);
      return conversation;
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not open chat. Please try again.");
      return null;
    } finally { setBusy(false); }
  }, [queryClient]);

  const updateInquiry = async (type, context = {}) => {
    setBusy(true);
    setError("");
    try {
      let target = activeConversation;
      if (user && (target?.order_id || target?.order?._id)) target = await openCustomerChat();
      if (!target?._id) throw new Error("Chat is not ready yet");
      const cartSnapshot = cartItems.slice(0, 30).map((item) => ({ productId: item.productId || item.product_id?._id || item.product_id || item.id, variant_id: item.variant_id?._id || item.variant_id || item.variantId, qty: Number(item.qty) }));
      if (!user && type === "cart") context = { ...context, items: cartSnapshot };
      const result = user
        ? await customerChatApi.setInquiryContext(target._id, { type, ...context })
        : await guestChatApi.setInquiryContext(target._id, { type, ...context, items: type === "cart" ? cartSnapshot : context.items }, guestToken);
      if (!user) setGuestConversation(result);
      await queryClient.invalidateQueries({ queryKey: ["customer-chat-conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-conversation-details", target._id] });
      if (user) setActiveCustomerId(target._id);
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Could not update the inquiry topic.");
      return false;
    } finally { setBusy(false); }
  };

  const selectInquiryProducts = (products) => updateInquiry("product", { products });

  useEffect(() => {
    const openWidget = (event) => {
      setOpen(true);
      setError("");
      const orderId = event.detail?.orderId;
      if (orderId) {
        pendingOrderRef.current = String(orderId);
        if (userRef.current) {
          openingOrderChatRef.current = true;
          openCustomerChat(String(orderId)).finally(() => { pendingOrderRef.current = ""; openingOrderChatRef.current = false; });
        }
      }
    };
    window.addEventListener("support-chat:open", openWidget);
    return () => window.removeEventListener("support-chat:open", openWidget);
  }, [openCustomerChat]);

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!open || !user || !pendingOrderRef.current) return;
    const orderId = pendingOrderRef.current;
    pendingOrderRef.current = "";
    openingOrderChatRef.current = true;
    queueMicrotask(() => openCustomerChat(orderId).finally(() => { pendingOrderRef.current = ""; openingOrderChatRef.current = false; }));
  }, [open, user, openCustomerChat]);

  useEffect(() => {
    const hasOpenConversation = customerConversations.some((conversation) => conversation.status === "open");
    if (!open || !user || pendingOrderRef.current || openingOrderChatRef.current || customerChatsQuery.isLoading || activeCustomerId || hasOpenConversation || creatingDefaultChatRef.current) return;
    creatingDefaultChatRef.current = true;
    queueMicrotask(() => openCustomerChat().finally(() => { creatingDefaultChatRef.current = false; }));
  }, [open, user, customerChatsQuery.isLoading, customerConversations, activeCustomerId, openCustomerChat]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["customer-chat-conversations"] });
      if (guestToken) queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation", guestToken] });
    };
    socket.on("chat:conversation-created", refresh);
    socket.on("chat:conversation-updated", refresh);
    return () => {
      socket.off("chat:conversation-created", refresh);
      socket.off("chat:conversation-updated", refresh);
    };
  }, [socket, queryClient, guestToken]);

  useEffect(() => {
    if (!socket || !guestToken || !roomConversation?._id) return undefined;
    const joinGuestRoom = () => socket.emit("chat:guest:join", { conversationId: roomConversation._id, guestToken });
    socket.on("connect", joinGuestRoom);
    if (socket.connected) joinGuestRoom();
    return () => socket.off("connect", joinGuestRoom);
  }, [socket, guestToken, roomConversation?._id]);

  const startChat = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await guestChatApi.start(guestName, guestEmail, guestToken);
      fallbackGuestToken = result.token;
      try { window.localStorage.setItem(GUEST_TOKEN_KEY, result.token); } catch {}
      window.dispatchEvent(new Event("support-chat:guest-token"));
      setGuestConversation(result.conversation);
      setGuestName(result.conversation?.guest_name || guestName.trim());
      setGuestEmail(result.conversation?.guest_email || guestEmail.trim());
      await queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation"] });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not open chat. Please try again.");
    } finally { setBusy(false); }
  };

  const reopenGuestChat = async () => {
    if (!activeConversation) return;
    setBusy(true);
    setError("");
    try {
      const result = await guestChatApi.start(activeConversation.guest_name, activeConversation.guest_email, guestToken);
      setGuestConversation(result.conversation);
      await queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation", guestToken] });
      await queryClient.invalidateQueries({ queryKey: ["chat-conversation-details", activeConversation._id] });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not reopen chat. Please try again.");
    } finally { setBusy(false); }
  };

  const triggerOpen = () => { setOpen((value) => !value); setError(""); };

  return (
    <div ref={widgetRef} style={positionStyle} className={`fixed z-50 ${visiblePosition ? "" : "bottom-20 right-3 sm:bottom-6 sm:right-6"}`}>
      {open && <section aria-label="Customer support chat" style={popupMaxHeight ? { maxHeight: `${popupMaxHeight}px` } : undefined} className={`absolute ${placePopupAbove ? "bottom-full mb-2" : "top-full mt-2"} ${alignPopupRight ? "right-0" : "left-0"} flex ${isGuestSetup ? "h-auto max-h-[calc(100dvh-2rem)]" : "h-[min(40rem,calc(100dvh-2rem))]"} w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-[0_18px_55px_rgba(0,0,0,0.28)]`}>
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-[var(--user-accent)] px-4 text-[var(--user-accent-text)]">
          <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"><MessageCircle size={18} /></span><span className="min-w-0"><span className="block text-sm font-semibold">Chat support</span><span className="block truncate text-[10px] opacity-80">{user ? user.name || "Your account" : "Guest support"}{activeConversation ? ` · ${activeConversation.status === "open" ? "Open" : "Closed"}` : ""}</span></span></div>
          <div className="flex shrink-0 items-center gap-1">
            {activeConversation && <Link href={user ? `/chats/${encodeURIComponent(activeConversation._id)}` : "/chats/guest"} onClick={() => setOpen(false)} title="View full page" aria-label="View full chat page" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition hover:bg-white/15"><Expand size={14} /><span>Full page</span></Link>}
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"><X size={18} /></button>
          </div>
        </header>

        {userQuery.isLoading ? <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--user-text-muted)]"><Loader2 size={18} className="animate-spin" />Loading support…</div>
          : user ? <>
            {customerChatsQuery.isLoading && !activeConversation ? <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--user-text-muted)]"><Loader2 size={18} className="animate-spin" />Loading your chats…</div> : activeConversation ? <>
              <div className="min-h-0 flex-1"><ChatThread key={activeConversation._id} conversation={activeConversation} api={customerChatApi} socket={socket} compact orders={orders} cartItems={cartItems} onTopic={updateInquiry} onProducts={selectInquiryProducts} contextBusy={busy} /></div>
              {ordersQuery.isError && <p className="shrink-0 px-3 py-1.5 text-[10px] text-[var(--user-danger)]">Orders could not be loaded. General support is still available.</p>}
            </> : <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center"><Loader2 size={20} className={`text-[var(--user-accent)] ${busy ? "animate-spin" : "hidden"}`} /><p className="text-xs text-[var(--user-text-muted)]">{error || "Open a support conversation to start messaging."}</p>{!busy && <button onClick={() => openCustomerChat()} className="rounded-lg bg-[var(--user-accent)] px-3 py-2 text-xs font-semibold text-[var(--user-accent-text)]">Try again</button>}</div>}
          </> : guestToken && guestConversationQuery.isLoading ? <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--user-text-muted)]"><Loader2 size={18} className="animate-spin" />Opening your chat…</div>
            : activeConversation ? <>
              <div className="min-h-0 flex-1"><ChatThread key={activeConversation._id} conversation={activeConversation} api={guestApi} socket={socket} compact guestToken={guestToken} cartItems={cartItems} allowOrder={false} onTopic={updateInquiry} onProducts={selectInquiryProducts} contextBusy={busy} /></div>
              {activeConversation.status === "closed" && <button onClick={reopenGuestChat} disabled={busy} className="m-3 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] disabled:opacity-60">Start a new chat</button>}
            </> : <form onSubmit={startChat} className="flex flex-col gap-4 overflow-y-auto p-5">
              <div><h2 className="text-base font-semibold text-[var(--user-text)]">Before you start</h2><p className="mt-1 text-xs leading-5 text-[var(--user-text-muted)]">Name and email are required so our support team can reply to you.</p></div>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--user-text-secondary)]">Name<input required minLength={1} maxLength={80} autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-sm text-[var(--user-text)] outline-none transition focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15" placeholder="Your name" /></label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--user-text-secondary)]">Email<input required type="email" maxLength={254} autoComplete="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-sm text-[var(--user-text)] outline-none transition focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15" placeholder="you@example.com" /></label>
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] shadow-sm transition hover:brightness-95 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}Continue to chat</button>
            </form>}

        {error && <p role="alert" className="shrink-0 border-t border-[var(--user-danger)]/20 bg-[var(--user-danger)]/10 px-3 py-2 text-xs text-[var(--user-danger)]">{error}</p>}
      </section>}

      <button onPointerDown={onLauncherPointerDown} onPointerMove={onLauncherPointerMove} onPointerUp={onLauncherPointerUp} onPointerCancel={onLauncherPointerUp} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } triggerOpen(); }} aria-label="Drag to move or click to open chat support" title="Drag to move · Click to chat" style={{ touchAction: "none" }} className={`relative flex h-12 cursor-grab items-center justify-center gap-2 rounded-full bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] shadow-lg transition hover:brightness-95 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--user-accent)]/30 ${open ? "pointer-events-none opacity-0" : ""}`}>
        {open ? <X size={19} /> : <MessageCircle size={19} strokeWidth={2.2} />}<span className="hidden sm:inline">{open ? "Close chat" : "Chat support"}</span>{unread > 0 && !open && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--user-bg)] bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
    </div>
  );
}
