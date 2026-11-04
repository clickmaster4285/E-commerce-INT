"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Loader2, Package, Plus, X } from "lucide-react";
import OrderDetails from "@/components/chat/OrderDetails";
import InquiryTopicPicker from "@/components/chat/InquiryTopicPicker";
import FallbackImage from "@/components/common/FallbackImage";
import { useTranslation } from "@/i18n/LanguageProvider";

const QUICK_REPLY_KEYS = ["chat.quick.order", "chat.quick.payment", "chat.quick.delivery", "chat.quick.return"];
const dateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};
const INQUIRY_LABELS = { general: "General support", product: "Product question", cart: "Cart question", order: "Order question" };
const contextMoney = (value) => `Rs. ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const CHAT_MEDIA_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
const chatImageUrl = (source) => {
  const value = typeof source === "string" ? source : source?.img_url || source?.url || source?.src || "";
  if (!value || /^(https?:|blob:|data:)/i.test(value)) return value;
  return CHAT_MEDIA_ORIGIN ? `${CHAT_MEDIA_ORIGIN}${value.startsWith("/") ? value : `/${value}`}` : value;
};

function ProductVariantThumbnail({ item, compact = false, interactive = true, showTooltip = true, isAdmin = false }) {
  const { t } = useTranslation();
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const productName = item.productName || item.product_name || "Product";
  const variantName = item.variantName || item.variant_name || item.variant || "Variant";
  const sku = item.sku || "";
  const price = item.price ?? item.unit_price;
  const image = chatImageUrl(item.image || item.variant_image || item.images?.[0]);
  const productId = item.productId || item.product_id?._id || item.product_id;
  const href = item.href || (isAdmin && productId
      ? `/admin/products/${encodeURIComponent(productId)}?tab=variants`
      : productId ? `/product/${encodeURIComponent(productId)}` : "/shop");
  const thumbnailClass = `flex items-center justify-center overflow-hidden border border-slate-200 bg-white shadow-sm outline-none transition hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-[#16233b] ${compact ? "h-9 w-9" : "h-12 w-12"}`;
  const placeTooltip = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const above = rect.top > 132;
    setTooltipPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      transform: above ? "translateY(-100%)" : "none",
    });
  };
  return <div className="group relative">
    {interactive ? <Link href={href} onPointerEnter={placeTooltip} onFocus={placeTooltip} aria-label={`${item.href ? "View order details for" : "View"} ${productName}, variant ${variantName}${price != null ? `, ${contextMoney(price)}` : ""}`} title={item.href ? `View order item · ${productName} · ${variantName}` : `View ${productName} · ${variantName}`} className={thumbnailClass}>
      <FallbackImage src={image} alt={`${productName} ${variantName}`} className="h-full w-full object-cover" />
    </Link> : <span aria-label={`${productName}, ${variantName}`} className={thumbnailClass}>
      <FallbackImage src={image} alt={`${productName} ${variantName}`} className="h-full w-full object-cover" />
    </span>}
    {showTooltip && <div role="tooltip" style={tooltipPosition || undefined} className={`fixed z-[200] w-56 border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-600 dark:bg-[#16233b] hidden group-hover:block group-focus-within:block ${tooltipPosition ? "" : "invisible"}`}>
      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{productName}</p>
      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{variantName}</p>
      {sku && <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400">SKU {sku}</p>}
      {price != null && <p className="mt-2 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">{contextMoney(price)}</p>}
      {item.qty != null && <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{t("chat.ui.quantity")}: {item.qty}</p>}
    </div>}
  </div>;
}

function OrderMessageLink({ message, className, children, isAdmin = false }) {
  const { t } = useTranslation();
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const context = message.context_snapshot || {};
  const orderId = context.order_id?._id || context.order_id;
  const orderHref = orderId ? `${isAdmin ? "/admin/orders" : "/orders"}/${encodeURIComponent(orderId)}` : "";
  const items = Array.isArray(context.items) ? context.items : [];
  const placeTooltip = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const above = rect.top > 190;
    setTooltipPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)), top: above ? rect.top - 8 : rect.bottom + 8, transform: above ? "translateY(-100%)" : "none" });
  };
  const details = orderId && <Link href={orderHref} role="tooltip" aria-label={`View order ${context.order_number || orderId} details`} style={tooltipPosition || undefined} className={`fixed z-[200] w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl transition hover:border-blue-400 dark:border-slate-600 dark:bg-[#16233b] ${tooltipPosition ? "hidden group-hover:block group-focus-within:block" : "invisible"}`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">Order #{context.order_number || orderId || "Order"}</p>{context.order_status && <p className="mt-0.5 text-[10px] capitalize text-slate-500 dark:text-slate-400">{context.order_status}</p>}</div>{context.total != null && <span className="shrink-0 text-xs font-bold text-slate-900 dark:text-slate-100">{contextMoney(context.total)}</span>}</div>
    {items.length > 0 && <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">{items.slice(0, 6).map((item, index) => <div key={`${item.variant_id || item.product_id || index}`} className="flex items-start justify-between gap-3 text-[10px]"><div className="min-w-0"><p className="truncate font-semibold text-slate-800 dark:text-slate-200">{item.product_name || "Product"}</p><p className="truncate text-slate-500 dark:text-slate-400">{item.variant_name || "Variant"}{item.qty != null ? ` · Qty ${item.qty}` : ""}</p></div><span className="shrink-0 font-semibold text-slate-700 dark:text-slate-300">{contextMoney(item.line_total ?? item.unit_price)}</span></div>)}</div>}
    <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-medium text-blue-700 dark:border-slate-700 dark:text-blue-300">{t("chat.ui.clickOrderDetails")}</p>
  </Link>;
  if (!orderId) return <div className={className}>{children}</div>;
  return <div className="group relative inline-flex max-w-[88%] flex-col sm:max-w-[72%]">
    <Link href={orderHref} onPointerEnter={placeTooltip} onFocus={placeTooltip} aria-label={`View order ${context.order_number || orderId} details`} className={`block w-full ${className}`}>
      {children}
    </Link>
    {details}
  </div>;
}

function ProductReferencePreview({ items, onClear, label, canClear = true, isAdmin = false }) {
  const { t } = useTranslation();
  return <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-[#101b2e]">
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {label && <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {items.map((item, index) => <ProductVariantThumbnail key={item.variantId || item.variant_id || index} item={item} isAdmin={isAdmin} />)}
      </div>
    </div>
    {canClear && <button type="button" onClick={onClear} aria-label={t("chat.ui.removeReference")} title={t("chat.ui.removeReference")} className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"><X size={14} /></button>}
  </div>;
}

function MessageContextDetails({ context }) {
  const { t } = useTranslation();
  if (!context || ["product", "cart", "order"].includes(context.kind)) return null;
  const count = Number(context.item_count) || context.items?.length || 0;
  const title = context.kind === "cart" ? `Cart details · ${count} ${count === 1 ? "item" : "items"}` : context.kind === "product" ? "Product details" : `Order details · #${context.order_number || ""}`;
  return <details className="mt-2 border-t border-slate-300/70 pt-1.5 text-[11px] dark:border-slate-600/70">
    <summary className="cursor-pointer select-none font-semibold text-blue-700 marker:text-blue-600 dark:text-blue-300 dark:marker:text-blue-300">{context.label || title}</summary>
    {context.kind === "product" && <div className="mt-2 space-y-2 text-slate-700 dark:text-slate-200">
      {(context.items?.length ? context.items : [{ product_name: context.product_name, variant_name: context.variant_name, sku: context.sku, unit_price: context.unit_price, product_description: context.product_description }]).map((item, index) => <div key={`${item.variant_id || index}`} className="border-t border-slate-300/50 pt-1.5 first:border-0 first:pt-0 dark:border-slate-600/50">
        <p className="font-semibold">{item.product_name}</p>
        {item.variant_name && <p>Variant: {item.variant_name}</p>}
        {item.sku && <p>SKU: {item.sku}</p>}
        {item.unit_price != null && <p>Unit price: {contextMoney(item.unit_price)}</p>}
        {item.product_description && <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{item.product_description}</p>}
      </div>)}
      {context.items?.length > 1 && <div className="flex justify-between border-t border-slate-300/70 pt-1.5 font-semibold dark:border-slate-600/70"><span>Selected variants · {context.items.length}</span><span>{contextMoney(context.total)}</span></div>}
    </div>}
    {(context.kind === "cart" || context.kind === "order") && <div className="mt-2 space-y-2 text-slate-700 dark:text-slate-200">
      {context.kind === "order" && <p>Status: <span className="font-semibold capitalize">{context.order_status}</span></p>}
      {(context.items || []).map((item, index) => <div key={`${item.variant_id || item.product_id || "item"}-${index}`} className="flex justify-between gap-3 border-t border-slate-300/50 pt-1.5 dark:border-slate-600/50">
        <div className="min-w-0"><p className="truncate font-medium">{item.product_name || "Product"}</p><p className="truncate text-slate-500 dark:text-slate-400">{[item.variant_name, item.sku ? `SKU ${item.sku}` : ""].filter(Boolean).join(" · ")}</p><p className="text-slate-500 dark:text-slate-400">{item.qty} × {contextMoney(item.unit_price)}</p></div>
        <span className="shrink-0 font-semibold">{contextMoney(item.line_total)}</span>
      </div>)}
      <div className="flex justify-between border-t border-slate-300/70 pt-1.5 font-semibold dark:border-slate-600/70"><span>{context.kind === "cart" ? "Cart total" : "Order total"}</span><span>{contextMoney(context.total)}</span></div>
    </div>}
  </details>;
}

export default function ChatThread({ conversation: initialConversation, api, socket, isAdmin = false, compact = false, guestToken = "", cartItems = [], orders = [], allowOrder = true, onTopic, onProducts, contextBusy = false }) {
  const { t } = useTranslation();
  const id = initialConversation?._id;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sendError, setSendError] = useState("");
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [clearedReferenceKey, setClearedReferenceKey] = useState(null);
  const [productSelectionDraft, setProductSelectionDraft] = useState(null);
  const [contextMenuMaxHeight, setContextMenuMaxHeight] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [typingSender, setTypingSender] = useState(false);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);
  const composerRef = useRef(null);
  const textareaRef = useRef(null);
  const preserveScrollRef = useRef(null);
  const localTypingTimerRef = useRef(null);
  const remoteTypingTimerRef = useRef(null);
  const conversationQuery = useQuery({ queryKey: ["chat-conversation-details", id], queryFn: () => api.details(id), enabled: Boolean(id && api.details), refetchOnWindowFocus: true, retry: false });
  const conversation = conversationQuery.data || initialConversation;
  const productReferenceItems = productSelectionDraft !== null
    ? productSelectionDraft
    : conversation.inquiry_context?.products?.length
      ? conversation.inquiry_context.products
      : conversation.inquiry_type === "product" && (conversation.inquiry_context?.product_id || conversation.inquiry_product_id)
        ? [{ product_id: conversation.inquiry_context?.product_id || conversation.inquiry_product_id, product_name: conversation.inquiry_context?.label || "Product", variant_name: conversation.inquiry_context?.variant || "Variant", sku: conversation.inquiry_context?.sku, price: conversation.inquiry_context?.price, image: conversation.inquiry_context?.image || conversation.inquiry_context?.variant_image }]
        : [];
  const cartReferenceItems = (conversation.inquiry_context?.items || []).map((item) => {
    const cartMatch = cartItems.find((cartItem) => {
      const sameVariant = item.variant_id && String(cartItem.variant_id?._id || cartItem.variant_id) === String(item.variant_id);
      const sameNames = String(cartItem.name || "").trim() === String(item.product_name || item.name || "").trim()
        && String(cartItem.variantTitle || "").trim() === String(item.variant_name || item.variant || "").trim();
      return sameVariant || sameNames;
    });
    return {
      ...item,
      productId: item.productId || item.product_id || cartMatch?.productId || cartMatch?.product_id,
      variantId: item.variantId || item.variant_id || cartMatch?.variant_id?._id || cartMatch?.variant_id,
      productName: item.productName || item.product_name || item.name || cartMatch?.name || "Product",
      variantName: item.variantName || item.variant_name || item.variant || cartMatch?.variantTitle || "Variant",
      image: item.image || item.variant_image || cartMatch?.image || "",
      price: item.price ?? item.unit_price ?? cartMatch?.price,
    };
  });
  const orderSourceItems = conversation.inquiry_context?.items?.length
    ? conversation.inquiry_context.items
    : conversation.order?.items || [];
  const orderReferenceItems = orderSourceItems.map((item) => ({
    ...item,
    productId: item.productId || item.product_id?._id || item.product_id,
    variantId: item.variantId || item.variant_id?._id || item.variant_id,
    productName: item.productName || item.product_name || item.name || "Product",
    variantName: item.variantName || item.variant_name || item.variantTitle || item.variant || "Variant",
    image: item.image || item.variant_image || "",
    price: item.price ?? item.unit_price,
    href: (conversation.inquiry_context?.order_id || conversation.order?._id || conversation.order_id)
      ? `/orders/${encodeURIComponent(conversation.inquiry_context?.order_id || conversation.order?._id || conversation.order_id)}`
      : undefined,
  }));
  const orderReferenceLabel = `Order #${conversation.inquiry_context?.order_number || conversation.order?.order_number || conversation.order?.orderNumber || conversation.order_id || ""}`;
  const referenceCleared = clearedReferenceKey === `${id}:${conversation?.inquiry_type}`;
  const contactName = conversation.customer?.name || conversation.guest_name || conversation.customer?.email || "Customer";
  const contactEmail = conversation.customer?.email || conversation.guest_email || "";
  const messagesQuery = useQuery({ queryKey: ["chat-messages", id], queryFn: () => api.messages(id), enabled: Boolean(id), refetchOnWindowFocus: true, retry: false });
  const messages = useMemo(() => messagesQuery.data?.items || [], [messagesQuery.data]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const maxHeight = 184;
    textarea.style.height = "44px";
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    if (!id || !socket) return undefined;
    const join = () => socket.emit(guestToken ? "chat:guest:join" : "chat:conversation:join", guestToken ? { conversationId: id, guestToken } : { conversationId: id }, (result) => setSocketReady(Boolean(result?.success)));
    const onMessage = (event) => {
      if (String(event?.conversation_id) !== String(id)) return;
      queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
      if (event.message?.sender_type !== (isAdmin ? "admin" : "customer")) api.markRead(id).catch(() => {});
    };
    const onUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversation-details", id] });
      queryClient.invalidateQueries({ queryKey: ["chat-order"] });
      queryClient.invalidateQueries({ queryKey: ["customer-chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };
    const onTyping = (event) => {
      if (String(event?.conversation_id) !== String(id)) return;
      const ownType = isAdmin ? "admin" : "customer";
      if (event.sender_type === ownType) return;
      if (remoteTypingTimerRef.current) window.clearTimeout(remoteTypingTimerRef.current);
      if (!event.isTyping) {
        setTypingSender(false);
        remoteTypingTimerRef.current = null;
        return;
      }
      setTypingSender(true);
      remoteTypingTimerRef.current = window.setTimeout(() => {
        setTypingSender(false);
        remoteTypingTimerRef.current = null;
      }, 1800);
    };
    socket.on("connect", join);
    socket.on("chat:message", onMessage);
    socket.on("chat:read", onUpdate);
    socket.on("chat:conversation-updated", onUpdate);
    socket.on("chat:typing", onTyping);
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off("chat:message", onMessage);
      socket.off("chat:read", onUpdate);
      socket.off("chat:conversation-updated", onUpdate);
      socket.off("chat:typing", onTyping);
      if (localTypingTimerRef.current) window.clearTimeout(localTypingTimerRef.current);
      if (remoteTypingTimerRef.current) window.clearTimeout(remoteTypingTimerRef.current);
      socket.emit("chat:typing", { conversationId: id, isTyping: false });
      socket.emit("chat:conversation:leave", { conversationId: id });
    };
  }, [id, socket, queryClient, api, isAdmin, guestToken]);

  useEffect(() => {
    if (!id) return;
    api.markRead(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["customer-chat-conversations"] });
        queryClient.invalidateQueries({ queryKey: ["guest-chat-conversation"] });
      })
      .catch(() => {});
  }, [id, api, queryClient]);
  useEffect(() => {
    const saved = preserveScrollRef.current;
    if (saved && messageListRef.current) {
      messageListRef.current.scrollTop = saved.top + messageListRef.current.scrollHeight - saved.height;
      preserveScrollRef.current = null;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setRateLimitSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [rateLimitSeconds]);

  useEffect(() => {
    if (!contextMenuOpen) return undefined;
    const updateMenuHeight = () => {
      const thread = composerRef.current?.closest(".user-chat-thread");
      if (!thread) return;
      const available = thread.getBoundingClientRect().height - (compact ? 12 : 16);
      setContextMenuMaxHeight(Math.max(160, Math.min(480, Math.floor(available))));
    };
    updateMenuHeight();
    window.addEventListener("resize", updateMenuHeight);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateMenuHeight);
    if (observer && composerRef.current?.closest(".user-chat-thread")) observer.observe(composerRef.current.closest(".user-chat-thread"));
    return () => {
      window.removeEventListener("resize", updateMenuHeight);
      observer?.disconnect();
    };
  }, [contextMenuOpen, compact]);

  const stopTyping = () => {
    if (localTypingTimerRef.current) window.clearTimeout(localTypingTimerRef.current);
    localTypingTimerRef.current = null;
    if (socketReady) socket?.emit("chat:typing", { conversationId: id, isTyping: false });
  };

  const send = async (value = draft) => {
    const text = value.trim();
    if (!text || sending || conversation?.status !== "open" || rateLimitSeconds > 0) return;
    setSending(true);
    setSendError("");
    stopTyping();
    try {
      const kind = isAdmin
        ? (productSelectionDraft?.length ? "product" : "general")
        : referenceCleared ? "general" : ["general", "cart", "product", "order"].includes(conversation?.inquiry_type) ? conversation.inquiry_type : "general";
      const messageContext = { kind };
      if (kind === "product") {
        const selectedProducts = isAdmin ? productSelectionDraft : conversation.inquiry_context?.products;
        messageContext.products = Array.isArray(selectedProducts) && selectedProducts.length
          ? selectedProducts.map((item) => ({ productId: item.product_id || item.productId, variantId: item.variant_id || item.variantId }))
          : [{ productId: conversation.inquiry_product_id || conversation.inquiry_context?.product_id, variantId: conversation.inquiry_variant_id || conversation.inquiry_context?.variant_id }];
      } else if (kind === "order") {
        messageContext.orderId = conversation.inquiry_context?.order_id || conversation.order_id || conversation.order?._id;
      } else if (kind === "cart" && guestToken) {
        messageContext.items = cartItems.slice(0, 30).map((item) => ({ productId: item.productId || item.product_id?._id || item.product_id || item.id, variant_id: item.variant_id?._id || item.variant_id || item.variantId, qty: Number(item.qty) }));
      }
      await api.send(id, text, messageContext);
      setDraft("");
      if (isAdmin) setProductSelectionDraft(null);
      if (!isAdmin && kind !== "general" && onTopic) {
        setClearedReferenceKey(`${id}:${conversation?.inquiry_type}`);
        setProductSelectionDraft(null);
        const cleared = await onTopic("general");
        if (!cleared) setSendError("Message sent, but its reference could not be cleared.");
      }
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    } catch (error) {
      const response = error.response;
      const retryAfter = Number(response?.data?.retryAfter || response?.headers?.["retry-after"] || 0);
      if (response?.status === 429 && retryAfter > 0) {
        setRateLimitSeconds(retryAfter);
      }
      setSendError(response?.data?.message || "Message could not be sent. Please try again.");
    } finally { setSending(false); }
  };

  const handleDraftChange = (value) => {
    setDraft(value.slice(0, 4000));
    if (!value.trim()) {
      stopTyping();
      return;
    }
    if (!socketReady || !socket) return;
    socket.emit("chat:typing", { conversationId: id, isTyping: true });
    if (localTypingTimerRef.current) window.clearTimeout(localTypingTimerRef.current);
    localTypingTimerRef.current = window.setTimeout(() => {
      socket.emit("chat:typing", { conversationId: id, isTyping: false });
      localTypingTimerRef.current = null;
    }, 1400);
  };

  const clearInquiryReference = async () => {
    if (!onTopic || contextBusy || sending) return;
    const success = await onTopic("general");
    if (success) {
      setClearedReferenceKey(`${id}:${conversation?.inquiry_type}`);
      setProductSelectionDraft(null);
      setContextMenuOpen(false);
    }
  };

  const applyInquiryTopic = async (...args) => {
    const success = await onTopic?.(...args);
    if (success && args[0] !== "general") setClearedReferenceKey(null);
    return success;
  };

  const loadOlder = async () => {
    const before = messagesQuery.data?.nextCursor;
    if (!before || loadingOlder) return;
    const currentList = messageListRef.current;
    if (currentList) preserveScrollRef.current = { top: currentList.scrollTop, height: currentList.scrollHeight };
    setLoadingOlder(true);
    try {
      const older = await api.messages(id, before);
      queryClient.setQueryData(["chat-messages", id], (current) => ({
        ...current,
        items: [...(older.items || []), ...(current?.items || [])],
        hasMore: older.hasMore,
        nextCursor: older.nextCursor,
      }));
    } catch {
      setSendError("Older messages could not be loaded.");
    } finally { setLoadingOlder(false); }
  };

  if (!id) return <div className="flex h-full items-center justify-center text-sm text-slate-500">{t("chat.customer.selectConversation")}</div>;

  return (
    <section className={`user-chat-thread flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-[#101b2e] ${compact || isAdmin ? "rounded-none border border-slate-200 shadow-none dark:border-slate-700" : "rounded-xl border border-slate-200 shadow-sm dark:border-slate-700"}`}>
      {!(compact && !isAdmin) && <header className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-[#101b2e] ${compact ? "px-3 py-2" : "px-4 py-3.5 sm:px-5"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">{isAdmin ? contactName : t("chat.ui.orderSupport")}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${conversation.status === "open" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{conversation.status === "open" ? t("chat.ui.open") : t("chat.ui.closed")}</span></div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{conversation.order ? `Order #${conversation.order.order_number || conversation.order_id}` : conversation.inquiry_context?.label || INQUIRY_LABELS[conversation.inquiry_type] || "General support"}{isAdmin && contactEmail ? ` · ${contactEmail}` : ""}</p>
          </div>
        </div>
        {!isAdmin && <span className="text-xs text-slate-500 dark:text-slate-400">{socketReady ? t("chat.ui.live") : t("chat.ui.chatReady")}</span>}
      </header>}
      <OrderDetails order={conversation.order} compact={compact} />
      <div ref={messageListRef} style={isAdmin ? { backgroundImage: "radial-gradient(circle at 1px 1px, rgba(100,116,139,0.11) 1px, transparent 1.5px), radial-gradient(circle at 15px 15px, rgba(100,116,139,0.06) 1px, transparent 1.5px)", backgroundSize: "32px 32px" } : undefined} className={`min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain ${isAdmin ? "bg-slate-50 dark:bg-[#0e1626]" : "bg-white dark:bg-[#0e1626]"} ${compact ? "px-3 py-3" : "px-4 py-4 sm:px-5 sm:py-5"}`}>
        {messagesQuery.data?.hasMore && <div className="text-center"><button onClick={loadOlder} disabled={loadingOlder} className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950">{loadingOlder ? t("chat.ui.loadingOlder") : t("chat.ui.loadOlder")}</button></div>}
        {messagesQuery.isLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("chat.ui.loading")}</div>
          : messagesQuery.isError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{t("chat.ui.loadMessagesError")}</div>
          : messages.length === 0 ? <div className="flex min-h-48 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">{t("chat.ui.emptyMessages")}</div>
          : messages.map((message) => {
            const own = message.sender_type === (isAdmin ? "admin" : "customer");
            const isOrderMessage = message.context_snapshot?.kind === "order";
            const bubbleClass = `rounded-2xl ${compact ? "px-3 py-2" : "px-3.5 py-2.5"} ${own ? "rounded-br-md bg-blue-100 text-slate-900 dark:bg-blue-900/70 dark:text-blue-50" : "rounded-bl-md bg-slate-100 text-slate-900 dark:bg-[#1c2941] dark:text-slate-100"}`;
            const bubbleContent = <>{isOrderMessage && <div className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-blue-200/70 px-2 py-1 text-[10px] font-semibold text-blue-900 dark:bg-blue-800/60 dark:text-blue-100"><Package size={12} className="shrink-0" /><span className="truncate">Order #{message.context_snapshot.order_number || message.context_snapshot.order_id || "Order"}</span>{message.context_snapshot.order_status && <span className="shrink-0 font-medium capitalize opacity-75">· {message.context_snapshot.order_status}</span>}</div>}{["product", "cart", "order"].includes(message.context_snapshot?.kind) && <div className="mb-2 flex flex-wrap gap-1.5">{(message.context_snapshot.items?.length ? message.context_snapshot.items : [message.context_snapshot]).map((item, index) => <ProductVariantThumbnail key={item.variant_id || item.variantId || index} item={item} compact interactive={!isOrderMessage} showTooltip={!isOrderMessage} isAdmin={isAdmin} />)}</div>}<p className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.text}</p><MessageContextDetails context={message.context_snapshot} /><div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400">{dateLabel(message.created_at)}{own && <span title={message.read_at ? "Read by recipient" : "Sent; not read yet"} aria-label={message.read_at ? "Read by recipient" : "Sent; not read yet"}><CheckCheck size={13} className={message.read_at ? "text-emerald-500 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"} /></span>}</div></>;
            return <div key={message._id} className={`flex items-end ${compact ? "gap-2" : "gap-2.5"} ${own ? "justify-end" : "justify-start"}`}>
              {isOrderMessage ? <OrderMessageLink message={message} className={bubbleClass} isAdmin={isAdmin}>{bubbleContent}</OrderMessageLink> : <div className={`max-w-[88%] sm:max-w-[72%] ${bubbleClass}`}>{bubbleContent}</div>}
            </div>;
          })}
        {typingSender && <div role="status" aria-label={t("chat.ui.typing")} className="flex justify-start"><div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-slate-500 dark:bg-[#1c2941] dark:text-slate-300"><span className="text-xs">{t("chat.ui.typing")}</span><span className="flex items-center gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" /></span></div></div>}
        <div ref={bottomRef} />
      </div>
      {!isAdmin && conversation.status === "open" && messages.length === 0 && <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-[#101b2e]">{QUICK_REPLY_KEYS.map((key) => { const reply = t(key); return <button key={key} onClick={() => send(reply)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-600 dark:bg-[#16233b] dark:text-slate-300">{reply}</button>; })}</div>}
      {sendError && <p role="alert" className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{sendError}{rateLimitSeconds > 0 && !/\b\d+\s+seconds?\b/i.test(sendError) && ` Try again in ${rateLimitSeconds} second${rateLimitSeconds === 1 ? "" : "s"}.`}</p>}
      {conversation.status === "open" ? <div className="shrink-0">
        {!referenceCleared && (isAdmin || !["cart", "order"].includes(conversation.inquiry_type)) && productReferenceItems.length > 0 && <ProductReferencePreview items={productReferenceItems} onClear={isAdmin ? () => setProductSelectionDraft([]) : clearInquiryReference} canClear isAdmin={isAdmin} />}
        {!referenceCleared && conversation.inquiry_type === "cart" && cartReferenceItems.length > 0 && <ProductReferencePreview items={cartReferenceItems} onClear={clearInquiryReference} canClear={!isAdmin} isAdmin={isAdmin} />}
        {!referenceCleared && conversation.inquiry_type === "order" && orderReferenceItems.length > 0 && <ProductReferencePreview items={orderReferenceItems} label={`${orderReferenceLabel} · ${conversation.inquiry_context?.order_status || conversation.order?.status || ""} · ${orderReferenceItems.length} ${orderReferenceItems.length === 1 ? "item" : "items"} · ${contextMoney(conversation.inquiry_context?.total ?? conversation.order?.total)}`} onClear={clearInquiryReference} canClear={!isAdmin} isAdmin={isAdmin} />}
        {!referenceCleared && conversation.inquiry_type === "order" && orderReferenceItems.length === 0 && <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-[#101b2e]"><div className="flex min-w-0 items-center gap-2.5"><Package size={15} className="shrink-0 text-blue-600 dark:text-blue-300" /><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{orderReferenceLabel}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">Loading order items…</p></div></div>{!isAdmin && <button type="button" onClick={clearInquiryReference} disabled={contextBusy || sending} aria-label="Remove order reference" title="Remove reference" className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"><X size={14} /></button>}</div>}
        <div ref={composerRef} className="relative">
        {contextMenuOpen ? <InquiryTopicPicker menuMode compact={compact} maxMenuHeight={contextMenuMaxHeight} conversation={conversation} orders={orders} cartItems={cartItems} allowOrder={allowOrder} adminMode={isAdmin} busy={contextBusy || sending} onTopic={applyInquiryTopic} onProducts={onProducts} draftProducts={isAdmin ? productSelectionDraft || [] : productSelectionDraft} onSelectionChange={(products) => { if (products !== null) setClearedReferenceKey(null); setProductSelectionDraft(products); }} onDismiss={() => setContextMenuOpen(false)} /> : <form className={`shrink-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-[#101b2e] ${compact ? "flex items-end gap-2 p-3" : "flex items-end gap-2.5 p-3.5 sm:gap-3 sm:p-4"}`} onSubmit={(event) => { event.preventDefault(); send(); }}>

        <div className="relative min-w-0 flex-1">
          <textarea ref={textareaRef} value={draft} onChange={(event) => handleDraftChange(event.target.value)} onBlur={stopTyping} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} maxLength={4000} rows={1} placeholder={isAdmin ? t("chat.ui.typeReply") : t("chat.ui.writeMessage")} className={`block min-h-11 max-h-[11.5rem] w-full border border-slate-200 bg-white text-[13px] leading-5 text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-[#16233b] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-900 rounded-2xl pl-4 pr-12 ${compact ? "resize-none overflow-y-hidden py-2.5" : "resize-none overflow-y-hidden py-2.5"}`} />
          <button type="button" data-chat-context-trigger aria-label={contextMenuOpen ? t("chat.ui.closeReferences") : isAdmin ? t("chat.ui.addReferences") : t("chat.ui.chooseTopic")} title={contextMenuOpen ? t("chat.ui.closeReferences") : isAdmin ? t("chat.ui.addReferences") : t("chat.ui.chooseTopic")} aria-expanded={contextMenuOpen} onClick={() => { setContextMenuOpen((value) => !value); }} className={`absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full transition ${contextMenuOpen ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-300"}`}><Plus size={18} className={`transition-transform ${contextMenuOpen ? "rotate-45" : ""}`} /></button>
        </div>
        <button type="submit" aria-label={t("chat.ui.sendMessage")} title={t("chat.ui.sendMessage")} disabled={!draft.trim() || sending || rateLimitSeconds > 0} className={`inline-flex h-11 shrink-0 items-center justify-center bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700 disabled:opacity-100 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-200 ${!isAdmin ? "rounded-full px-5" : "rounded-xl"} ${compact ? "w-11 min-w-11 px-0" : "gap-2 px-4 text-[13px] font-semibold"}`}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 min-h-5 min-w-5 shrink-0"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" /></svg>{!compact && <span>{t("chat.ui.send")}</span>}</button>
        </form>}
        </div>
      </div> : <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#16233b] dark:text-slate-300">This conversation is closed. {!isAdmin && "Contact support if you need more help."}</div>}
    </section>
  );
}
