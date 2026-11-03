"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, MessageCircle, Package, ShoppingCart, X } from "lucide-react";
import { productApi } from "@/apis/user/productApi";
import FallbackImage from "@/components/common/FallbackImage";

const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
const getImageUrl = (url) => {
  const value = typeof url === "string" ? url : url?.img_url || url?.url || url?.src || "";
  if (!value) return "";
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  return API_ORIGIN ? `${API_ORIGIN}${value.startsWith("/") ? value : `/${value}`}` : value;
};

const options = [
  { value: "general", label: "General question" },
  { value: "product", label: "A product" },
  { value: "cart", label: "My cart" },
  { value: "order", label: "An order" },
];

export default function InquiryTopicPicker({ conversation, orders = [], cartItems = [], allowOrder = true, busy = false, onTopic, onProducts, actions, fullPage = false, summary, menuMode = false, compact = false, maxMenuHeight, onDismiss, onSelectionChange, draftProducts = null, adminMode = false }) {
  const initial = adminMode ? "product" : conversation?.inquiry_type || (conversation?.order_id || conversation?.order?._id ? "order" : "general");
  const [pendingType, setPendingType] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [productListOpen, setProductListOpen] = useState(() => menuMode && initial === "product");
  const [orderListOpen, setOrderListOpen] = useState(false);
  const [selectionOverride, setSelectionOverride] = useState(null);
  const menuRef = useRef(null);
  const conversationProducts = useMemo(() => {
    const saved = conversation?.inquiry_context?.products;
    if (Array.isArray(saved) && saved.length) return saved.map((item) => ({
      productId: String(item.product_id || item.productId || ""),
      variantId: String(item.variant_id || item.variantId || ""),
      productName: item.product_name || item.productName || "Product",
      variantName: item.variant_name || item.variantName || item.variant || "Variant",
      sku: item.sku || "",
      price: item.price ?? item.unit_price ?? null,
      image: getImageUrl(item.image || item.variant_image || ""),
    })).filter((item) => item.productId && item.variantId);
    const productId = String(conversation?.inquiry_context?.product_id || conversation?.inquiry_product_id || "");
    const variantId = String(conversation?.inquiry_context?.variant_id || conversation?.inquiry_variant_id || "");
    return productId && variantId ? [{ productId, variantId, productName: conversation?.inquiry_context?.label || "Product", variantName: conversation?.inquiry_context?.variant || "Variant", sku: conversation?.inquiry_context?.sku || "", price: conversation?.inquiry_context?.price ?? null, image: getImageUrl(conversation?.inquiry_context?.image || conversation?.inquiry_context?.variant_image || "") }] : [];
  }, [conversation?.inquiry_context?.products, conversation?.inquiry_context?.product_id, conversation?.inquiry_context?.variant_id, conversation?.inquiry_context?.label, conversation?.inquiry_context?.variant, conversation?.inquiry_context?.sku, conversation?.inquiry_context?.price, conversation?.inquiry_context?.image, conversation?.inquiry_context?.variant_image, conversation?.inquiry_product_id, conversation?.inquiry_variant_id]);
  const signatureOf = (products) => products.map((item) => `${item.productId}:${item.variantId}`).join("|");
  const selectedProducts = adminMode
    ? draftProducts || []
    : draftProducts !== null
    ? draftProducts
    : selectionOverride?.conversationId === conversation?._id && selectionOverride.signature !== signatureOf(conversationProducts)
      ? selectionOverride.products
      : conversationProducts;
  const pickerRef = useRef(null);
  const orderPickerRef = useRef(null);
  const type = pendingType || initial;
  const selectedValue = type === "order" ? String(conversation?.inquiry_context?.order_id || conversation?.order_id || conversation?.order?._id || "") : type === "product" ? String(conversation?.inquiry_context?.product_id || "") : type;
  const availableOrders = orders.length ? orders : conversation?.order ? [conversation.order] : [];
  const selectedOrder = availableOrders.find((order) => String(order._id || order.id) === selectedValue) || null;
  const cartQuantity = cartItems.reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(productSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [productSearch]);
  const catalogQuery = useQuery({ queryKey: ["chat-product-picker", debouncedSearch], queryFn: () => productApi.getAllPaginated({ page: 1, limit: 20, search: debouncedSearch, slim: 1 }), enabled: type === "product", staleTime: 60_000, retry: false });
  const productGroups = useMemo(() => {
    const groups = new Map();
    const addVariant = (productId, name, variant) => {
      const id = String(productId || "");
      const variantId = String(variant?._id || variant?.variant_id?._id || variant?.variant_id || variant?.variantId || "");
      if (!id || !variantId) return;
      const group = groups.get(id) || { id, name: name || "Product", variants: new Map() };
      const key = variantId;
      if (!group.variants.has(key)) group.variants.set(key, {
        id: variantId,
        title: variant.title || variant.variantTitle || variant.variant_name || variant.variant_title || variant.variant || "Variant",
        sku: variant.sku || "",
        price: Number.isFinite(Number(variant.selling_price ?? variant.price)) ? Number(variant.selling_price ?? variant.price) : null,
        image: variant.images?.[0]?.img_url || variant.images?.[0]?.url || (typeof variant.images?.[0] === "string" ? variant.images[0] : "") || variant.image || variant.product_image || variant.variant_id?.images?.[0]?.img_url || "",
      });
      groups.set(id, group);
    };
    (catalogQuery.data?.products || []).forEach((product) => {
      (Array.isArray(product.variants) ? product.variants : []).forEach((variant) => addVariant(product._id || product.id, product.name, variant));
    });
    [...cartItems, ...(conversation?.order?.items || [])].forEach((item) => {
      addVariant(item.productId || item.product_id?._id || item.product_id, item.product_name || item.name || item.title, item);
    });
    const term = debouncedSearch.toLowerCase();
    return [...groups.values()].map((group) => ({ ...group, variants: [...group.variants.values()].filter((variant) => !term || `${group.name} ${variant.title} ${variant.sku}`.toLowerCase().includes(term)) }))
      .filter((group) => group.variants.length && (!term || `${group.name} ${group.variants.map((variant) => `${variant.title} ${variant.sku}`).join(" ")}`.toLowerCase().includes(term)))
      .slice(0, 20);
  }, [cartItems, conversation?.order?.items, catalogQuery.data?.products, debouncedSearch]);
  const visibleOptions = options.filter((option) => {
    if (adminMode) return option.value === "product";
    if (option.value === "order") return allowOrder && (orders.length > 0 || conversation?.order_id || conversation?.order?._id);
    if (option.value === "product") return true;
    return true;
  });
  const menuOptions = visibleOptions.filter((option) => option.value !== "general");
  useEffect(() => {
    if (type !== "product" || !productListOpen) return undefined;
    const closeOutside = (event) => { if (!pickerRef.current?.contains(event.target)) setProductListOpen(false); };
    const closeEscape = (event) => { if (event.key === "Escape") setProductListOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [type, productListOpen]);

  useEffect(() => {
    if (type !== "order" || !orderListOpen) return undefined;
    const closeOutside = (event) => { if (!orderPickerRef.current?.contains(event.target)) setOrderListOpen(false); };
    const closeEscape = (event) => { if (event.key === "Escape") setOrderListOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [type, orderListOpen]);

  useEffect(() => {
    if (!menuMode) return undefined;
    const closeOutside = (event) => {
      if (event.target?.closest?.("[data-chat-context-trigger]")) return;
      if (!menuRef.current?.contains(event.target)) onDismiss?.();
    };
    const closeEscape = (event) => { if (event.key === "Escape") onDismiss?.(); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [menuMode, onDismiss]);

  const chooseType = async (event) => {
    const value = event.target.value;
    setPendingType(value);
    if (value === "general" || value === "cart") {
      const success = await onTopic?.(value);
      if (success) setPendingType(null);
    }
  };

  const chooseOrder = async (order) => {
    const id = order?._id || order?.id;
    if (!id) return;
    setPendingType("order");
    const success = await onTopic?.("order", { orderId: id });
    if (success) {
      setPendingType(null);
      setOrderListOpen(false);
      onSelectionChange?.(null);
      onDismiss?.();
    }
  };

  const chooseMenuTopic = async (value) => {
    if (value === "product") {
      onSelectionChange?.(null);
      setPendingType("product");
      setProductSearch("");
      setProductListOpen(true);
      setOrderListOpen(false);
      return;
    }
    if (value === "order") {
      onSelectionChange?.(null);
      setPendingType("order");
      setOrderListOpen(true);
      setProductListOpen(false);
      return;
    }
    setPendingType(value);
    if (value === "cart") {
      const cartSelection = cartItems.slice(0, 30).map((item) => ({
        productId: item.productId || item.product_id?._id || item.product_id || item.id,
        variantId: item.variant_id?._id || item.variant_id || item.variantId,
        productName: item.name || item.product_name || "Product",
        variantName: item.variantTitle || item.variant_name || item.variant || "Variant",
        sku: item.sku || "",
        price: Number(item.price ?? item.unit_price) || 0,
        qty: Number(item.qty) || 1,
        image: getImageUrl(item.image || item.variant_id?.images?.[0]?.img_url || ""),
      })).filter((item) => item.productId && item.variantId);
      onSelectionChange?.(cartSelection.length ? cartSelection : null);
    } else {
      onSelectionChange?.(null);
    }
    const success = await onTopic?.(value);
    if (success) {
      setPendingType(null);
      onDismiss?.();
    } else if (value === "cart") {
      onSelectionChange?.(null);
    }
  };

  const chooseProduct = async (product, variant) => {
    const exists = selectedProducts.some((item) => item.variantId === variant.id);
    const next = exists
      ? selectedProducts.filter((item) => item.variantId !== variant.id)
      : [...selectedProducts, { productId: product.id, variantId: variant.id, productName: product.name, variantName: variant.title, sku: variant.sku, price: variant.price, image: getImageUrl(variant.image) }];
    if (next.length > 20) return;
    const nextSelection = { conversationId: conversation?._id, signature: signatureOf(next), products: next };
    setSelectionOverride(nextSelection);
    if (menuMode) onSelectionChange?.(next);
    if (menuMode) {
      setPendingType("product");
      setProductListOpen(true);
      return;
    }
    const success = next.length ? await onProducts?.(next.map(({ productId, variantId }) => ({ productId, variantId }))) : await onTopic?.("general");
    if (success) setPendingType(next.length ? "product" : null);
    else setSelectionOverride({ conversationId: conversation?._id, signature: signatureOf(selectedProducts), products: selectedProducts });
  };
  const removeProduct = async (variantId) => {
    const next = selectedProducts.filter((item) => item.variantId !== variantId);
    const nextSelection = { conversationId: conversation?._id, signature: signatureOf(next), products: next };
    setSelectionOverride(nextSelection);
    if (menuMode) onSelectionChange?.(next);
    if (menuMode) {
      setPendingType(next.length ? "product" : "general");
      return;
    }
    const success = next.length ? await onProducts?.(next.map(({ productId, variantId: selectedVariantId }) => ({ productId, variantId: selectedVariantId }))) : await onTopic?.("general");
    if (success && !next.length) setPendingType(null);
    if (!success) setSelectionOverride({ conversationId: conversation?._id, signature: signatureOf(selectedProducts), products: selectedProducts });
  };
  const commitProducts = async () => {
    if (!selectedProducts.length) return;
    if (adminMode) {
      onDismiss?.();
      return;
    }
    const success = await onProducts?.(selectedProducts.map(({ productId, variantId }) => ({ productId, variantId })));
    if (success) onDismiss?.();
  };

  const menuStyle = {
    ...(maxMenuHeight ? { maxHeight: `${maxMenuHeight}px`, ...(type === "product" ? { height: `${maxMenuHeight}px` } : {}) } : {}),
    ...(adminMode ? {
      "--user-bg-card": "var(--bg-card)",
      "--user-bg-hover": "var(--bg-card-alt)",
      "--user-bg-input": "var(--bg-input)",
      "--user-border": "var(--border-color)",
      "--user-text": "var(--text-primary)",
      "--user-text-secondary": "var(--text-secondary)",
      "--user-text-muted": "var(--text-muted)",
      "--user-accent": "var(--accent)",
      "--user-accent-text": "var(--accent-text)",
      "--user-danger": "var(--danger)",
    } : {}),
  };

  if (menuMode) return <div ref={menuRef} role="dialog" aria-label="Choose message topic" style={menuStyle} className={`w-full max-h-[min(70dvh,30rem)] ${type === "product" ? "flex flex-col overflow-hidden" : "overflow-y-auto"} overscroll-contain border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3.5 shadow-[0_14px_38px_rgba(0,0,0,0.24)] sm:p-4`}>
    {type === "product" && <div className="mb-1 flex shrink-0 items-center justify-end gap-1">{selectedProducts.length > 0 && <button type="button" onClick={commitProducts} disabled={busy} className="h-7 border border-[var(--user-accent)] bg-[var(--user-accent)] px-2.5 text-[10px] font-semibold text-[var(--user-accent-text)] transition hover:brightness-105 disabled:opacity-60">Done</button>}<button type="button" onClick={onDismiss} aria-label="Close product picker" className="flex h-7 w-7 items-center justify-center text-[var(--user-text-muted)] transition hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)]"><X size={16} /></button></div>}
    {type !== "product" && <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0"><p className="text-sm font-semibold text-[var(--user-text)]">Add context</p><p className="mt-0.5 text-[11px] text-[var(--user-text-muted)]">Help support understand your question</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onDismiss} aria-label="Close context menu" className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--user-text-muted)] transition hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)]"><X size={16} /></button>
      </div>
    </div>}
    {type !== "product" && <div className={`grid gap-2.5 ${menuOptions.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
      {menuOptions.map((option) => {
        const selected = type === option.value;
        const Icon = option.value === "cart" ? ShoppingCart : Package;
        const detail = option.value === "cart" ? "My cart" : option.value === "product" ? "Product" : "Order";
        return <button key={option.value} type="button" aria-pressed={selected} onClick={() => chooseMenuTopic(option.value)} disabled={busy} className={`flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1.5 border px-2 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent)] disabled:opacity-60 ${selected ? "border-[var(--user-accent)] bg-[var(--user-accent)]/10 text-[var(--user-accent)] shadow-sm" : "border-[var(--user-border)] bg-[var(--user-bg-input)] text-[var(--user-text)] hover:border-[var(--user-accent)]/60 hover:bg-[var(--user-bg-hover)]"}`}><span className={`flex h-7 w-7 items-center justify-center ${selected ? "bg-[var(--user-accent)] text-white" : "bg-[var(--user-accent)]/10 text-[var(--user-accent)]"}`}><Icon size={15} /></span><span className="text-xs font-semibold leading-none">{detail}</span></button>;
      })}
    </div>}
    {type === "product" && <div ref={pickerRef} className={`relative min-w-0 ${menuMode ? "flex min-h-0 flex-1 flex-col" : "mt-3"}`}>
      <label className="block"><input aria-label="Search product variants" role="combobox" aria-expanded={productListOpen} aria-controls="chat-product-variant-options" aria-autocomplete="list" value={productListOpen ? productSearch : ""} onFocus={() => { setProductSearch(""); setProductListOpen(true); }} onChange={(event) => { setProductSearch(event.target.value); setProductListOpen(true); }} placeholder={selectedProducts.length ? "Search to add another variant" : "Search products or variants"} className="h-10 w-full min-w-0 border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-xs text-[var(--user-text)] outline-none placeholder:text-[var(--user-text-muted)] focus:border-[var(--user-accent)]" /></label>
      {selectedProducts.length > 0 && !menuMode && <div className={`mt-2 flex gap-1.5 ${fullPage ? "max-h-14 flex-wrap overflow-y-auto" : "flex-wrap"}`} aria-label="Selected product variants">{selectedProducts.map((item) => <span key={item.variantId} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--user-accent)]/25 bg-[var(--user-accent)]/10 py-1 pl-2.5 pr-1.5 text-[10px] font-medium text-[var(--user-text)]"><span className="truncate">{item.productName} · {item.variantName}</span><button type="button" aria-label={`Remove ${item.productName} ${item.variantName}`} disabled={busy} onClick={() => removeProduct(item.variantId)} className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[var(--user-text-muted)] hover:bg-[var(--user-bg-card)] hover:text-[var(--user-text)]"><X size={11} /></button></span>)}</div>}
      {productListOpen && <div id="chat-product-variant-options" role="listbox" aria-multiselectable="true" className={`${menuMode ? "relative mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border border-[var(--user-border)] bg-[var(--user-bg-input)] p-1.5" : "absolute bottom-full left-0 right-0 z-[95] mb-1 max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-1.5 shadow-xl"}`}>
        {catalogQuery.isLoading && <div className="flex items-center gap-2 px-3 py-3 text-xs text-[var(--user-text-muted)]"><Loader2 size={14} className="animate-spin" />Searching products…</div>}
        {catalogQuery.isError && <p role="alert" className="px-3 py-3 text-xs text-[var(--user-danger)]">Products could not be loaded. Please try searching again.</p>}
        {!catalogQuery.isLoading && !catalogQuery.isError && productGroups.length === 0 && <p className="px-3 py-3 text-xs text-[var(--user-text-muted)]">No matching product variants found.</p>}
        {productGroups.flatMap((product) => [...product.variants.values()].map((variant) => ({ product, variant }))).map(({ product, variant }) => {
          const selected = selectedProducts.some((item) => item.variantId === variant.id);
          return <button key={variant.id} type="button" role="option" aria-selected={selected} onClick={() => chooseProduct(product, variant)} disabled={busy || (!selected && selectedProducts.length >= 20)} className={`flex w-full items-center gap-3 border px-2 py-2 text-left transition disabled:opacity-50 ${selected ? "border-[var(--user-accent)] bg-[var(--user-accent)]/10" : "border-transparent hover:bg-[var(--user-bg-hover)]"}`}>
            <FallbackImage src={getImageUrl(variant.image)} alt={variant.title} className="h-11 w-11 shrink-0 border border-[var(--user-border)] bg-[var(--user-bg-hover)] object-cover" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 truncate text-[10px] font-medium text-[var(--user-text-muted)]">{product.name}</span>{variant.price != null && <span className="shrink-0 text-[10px] font-semibold text-[var(--user-text-secondary)]">Rs. {variant.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}</span>
              <span className="truncate text-xs font-semibold text-[var(--user-text)]">{variant.title}</span>
            </span>
          </button>;
        })}
      </div>}
    </div>}
    {type === "order" && <div ref={orderPickerRef} className="mt-3 max-h-52 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-input)] p-1.5">
      {availableOrders.length ? availableOrders.map((order) => { const orderId = String(order._id || order.id); const selected = orderId === selectedValue; return <button key={orderId} type="button" role="option" aria-selected={selected} onClick={() => chooseOrder(order)} disabled={busy} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--user-bg-hover)] disabled:opacity-60 ${selected ? "bg-[var(--user-accent)]/5" : ""}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[var(--user-accent)] text-white" : "bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"}`}><Package size={15} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[var(--user-text)]">Order #{order.order_number || order.orderNumber || "—"}</span><span className="shrink-0 text-[10px] font-semibold text-[var(--user-text-secondary)]">{order.total != null ? `Rs. ${Number(order.total).toLocaleString()}` : ""}</span></span><span className="mt-0.5 block truncate text-[10px] capitalize text-[var(--user-text-muted)]">{order.status || "Order"}</span></span></button>; }) : <p className="px-3 py-3 text-xs text-[var(--user-text-muted)]">No orders are available for this account.</p>}
    </div>}
    {type === "cart" && <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 py-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><ShoppingCart size={17} /></span><span className="min-w-0"><span className="block text-xs font-semibold text-[var(--user-text)]">{cartItems.length ? `${cartQuantity} ${cartQuantity === 1 ? "item" : "items"} ready to share` : "Your cart is empty"}</span><span className="block truncate text-[10px] text-[var(--user-text-muted)]">{cartItems.length ? "Cart products, quantities and verified prices will be attached." : "You can still ask support about your cart."}</span></span></div>}
  </div>;

  return <div className={fullPage ? "grid shrink-0 grid-cols-1 items-start gap-3 border-b border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-3 sm:px-5 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.3fr)_minmax(270px,0.95fr)] lg:gap-4" : "shrink-0 space-y-2 border-b border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-2.5"}>
    <div className={`flex min-w-0 items-center ${fullPage ? "gap-3 border-r border-[var(--user-border)] pr-4 max-lg:border-r-0 max-lg:pr-0" : "gap-2"}`}>
      {fullPage && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><MessageCircle size={18} /></span>}
      <label className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--user-text-muted)]">Ask about</span><select aria-label="What is your question about?" value={type} onChange={chooseType} disabled={busy} className="h-9 w-full min-w-0 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-xs font-medium text-[var(--user-text)] outline-none focus:border-[var(--user-accent)] disabled:opacity-60">
        {visibleOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {type === "order" && <div ref={orderPickerRef} className="relative min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--user-text-muted)]">Related order</span>
      <button type="button" aria-label="Choose an order" aria-haspopup="listbox" aria-expanded={orderListOpen} onClick={() => setOrderListOpen((value) => !value)} disabled={busy || !availableOrders.length} className="flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-left outline-none transition hover:border-[var(--user-accent)] focus:border-[var(--user-accent)] disabled:cursor-not-allowed disabled:opacity-60">
        <span className="flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><Package size={15} /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-[var(--user-text)]">{selectedOrder ? `#${selectedOrder.order_number || selectedOrder.orderNumber || "Order"}` : "Choose an order to ask about"}</span><span className="block truncate text-[10px] text-[var(--user-text-muted)]">{selectedOrder ? `${selectedOrder.status || "Order"}${selectedOrder.total != null ? ` · Rs. ${Number(selectedOrder.total).toLocaleString()}` : ""}` : "Select one of your recent orders"}</span></span></span><ChevronDown size={15} className={`shrink-0 text-[var(--user-text-muted)] transition-transform ${orderListOpen ? "rotate-180" : ""}`} />
      </button>
      {orderListOpen && <div role="listbox" aria-label="Your orders" className="absolute left-0 right-0 top-full z-[90] mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-1.5 shadow-xl">
        {availableOrders.length ? availableOrders.map((order) => {
          const orderId = String(order._id || order.id);
          const selected = orderId === selectedValue;
          return <button key={orderId} type="button" role="option" aria-selected={selected} onClick={() => chooseOrder(order)} disabled={busy} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--user-bg-hover)] disabled:opacity-60 ${selected ? "bg-[var(--user-accent)]/5" : ""}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[var(--user-accent)] text-white" : "bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"}`}><Package size={14} /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[var(--user-text)]">Order #{order.order_number || order.orderNumber || "—"}</span><span className="shrink-0 text-[10px] font-semibold text-[var(--user-text-secondary)]">{order.total != null ? `Rs. ${Number(order.total).toLocaleString()}` : ""}</span></span><span className="mt-0.5 block truncate text-[10px] capitalize text-[var(--user-text-muted)]">{order.status || "Order"}{order.created_at ? ` · ${new Date(order.created_at).toLocaleDateString()}` : ""}</span></span>
          </button>;
        }) : <p className="px-3 py-3 text-xs text-[var(--user-text-muted)]">No orders are available for this account.</p>}
      </div>}
    </div>}
    {type === "product" && <div ref={pickerRef} className="relative min-w-0">
      <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--user-text-muted)]">Product / variant · select up to 20</span><input aria-label="Search and select multiple product variants" role="combobox" aria-expanded={productListOpen} aria-controls="chat-product-variant-options" aria-autocomplete="list" value={productListOpen ? productSearch : ""} onFocus={() => { setProductSearch(""); setProductListOpen(true); }} onChange={(event) => { setProductSearch(event.target.value); setProductListOpen(true); }} placeholder={selectedProducts.length ? `${selectedProducts.length} selected · search to add more` : "Search products or variants"} className="h-9 w-full min-w-0 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 text-xs text-[var(--user-text)] outline-none placeholder:text-[var(--user-text-muted)] focus:border-[var(--user-accent)]" /></label>
      {selectedProducts.length > 0 && <div className={`flex max-h-14 flex-wrap gap-1.5 overflow-y-auto pt-1 ${fullPage ? "pr-1" : ""}`} aria-label="Selected product variants">{selectedProducts.map((item) => <span key={item.variantId} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-hover)] py-1 pl-2.5 pr-1.5 text-[10px] text-[var(--user-text)]"><span className="truncate">{item.productName} · {item.variantName}</span><button type="button" aria-label={`Remove ${item.productName} ${item.variantName}`} disabled={busy} onClick={() => removeProduct(item.variantId)} className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--user-text-muted)] hover:bg-[var(--user-bg-card)] hover:text-[var(--user-text)] disabled:opacity-50"><X size={11} /></button></span>)}</div>}
      {productListOpen && <div id="chat-product-variant-options" role="listbox" aria-multiselectable="true" className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-1.5 shadow-xl">
        {catalogQuery.isLoading && <div className="flex items-center gap-2 px-3 py-3 text-xs text-[var(--user-text-muted)]"><Loader2 size={14} className="animate-spin" />Searching products…</div>}
        {!catalogQuery.isLoading && productGroups.length === 0 && <p className="px-3 py-3 text-xs text-[var(--user-text-muted)]">No matching product variants found.</p>}
        {productGroups.map((product) => <div key={product.id} className="py-1">
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--user-text-muted)]">{product.name}</p>
          {product.variants.map((variant) => { const selected = selectedProducts.some((item) => item.variantId === variant.id); return <button key={variant.id} type="button" role="option" aria-selected={selected} onClick={() => chooseProduct(product, variant)} disabled={busy || (!selected && selectedProducts.length >= 20)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--user-bg-hover)] disabled:opacity-50"><span className="flex min-w-0 items-center gap-2"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-[var(--user-accent)] bg-[var(--user-accent)] text-white" : "border-[var(--user-border)] text-transparent"}`}><Check size={11} /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-[var(--user-text)]">{variant.title}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--user-text-muted)]">{variant.sku ? `SKU ${variant.sku}` : "Product variant"}</span></span></span><span className="shrink-0 text-[11px] font-semibold text-[var(--user-text-secondary)]">Rs. {variant.price.toLocaleString()}</span></button>; })}
        </div>)}
      </div>}
    </div>}
    {type === "cart" && <div className={`flex min-w-0 items-center gap-3 ${fullPage ? "rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 py-2" : ""}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><ShoppingCart size={17} /></span><span className="min-w-0"><span className="block text-xs font-semibold text-[var(--user-text)]">{cartItems.length ? `${cartQuantity} ${cartQuantity === 1 ? "item" : "items"} ready to share` : "Your cart is empty"}</span><span className="block truncate text-[10px] text-[var(--user-text-muted)]">{cartItems.length ? `From ${cartItems.length} cart ${cartItems.length === 1 ? "product" : "products"}; quantities and prices are included.` : "You can still ask a question about your cart."}</span></span></div>}
    {type === "general" && fullPage && <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-input)] px-3 py-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><MessageCircle size={17} /></span><span className="min-w-0"><span className="block text-xs font-semibold text-[var(--user-text)]">General support</span><span className="block truncate text-[10px] text-[var(--user-text-muted)]">Ask us anything—no order or product selection needed.</span></span></div>}
    {fullPage && <div className="min-w-0 lg:self-center">{summary}</div>}
    {!fullPage && actions}
    {!fullPage && busy && <Loader2 size={15} className="mb-2 shrink-0 animate-spin text-[var(--user-accent)]" />}
  </div>;
}
