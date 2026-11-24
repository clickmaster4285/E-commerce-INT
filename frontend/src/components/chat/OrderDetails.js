"use client";

import { ChevronDown, Package2 } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;
const humanize = (value) => String(value || "—").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value, locale = "en") => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
};
const statusTone = (value) => {
  const status = String(value || "").toLowerCase();
  if (["delivered", "completed"].includes(status)) return "bg-success-soft text-success ring-1 ring-inset ring-success/20";
  if (["pending", "on_hold"].includes(status)) return "bg-warning-soft text-warning ring-1 ring-inset ring-warning/20";
  if (["processing", "confirmed", "shipped", "in_transit"].includes(status)) return "bg-info-soft text-info ring-1 ring-inset ring-info/20";
  if (["cancelled", "canceled", "failed", "refunded"].includes(status)) return "bg-danger-soft text-danger ring-1 ring-inset ring-danger/20";
  return "bg-subtle text-fg-secondary ring-1 ring-inset ring-line";
};

export default function OrderDetails({ order, compact = false }) {
  const { t, locale } = useTranslation();
  if (!order) return null;
  const address = order.address_snapshot || {};
  const addressLines = [
    address.street_address1,
    address.street_address2,
    [address.city, address.state, address.zip_code].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);
  const paymentMethod = { cod: "Cash on delivery", bank: "Bank transfer", card: "Card" }[order.payment?.method] || humanize(order.payment?.method);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <details className="group shrink-0 border-b border-line bg-card-alt">
      <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2" : "flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <Package2 size={18} className="shrink-0 text-warning" />
          <span className="min-w-0"><span className="block truncate text-[13px] font-bold text-fg">{t("chat.customer.orderNumber", { number: order.order_number || "—" })}</span><span className="mt-0.5 block text-[11px] text-fg-muted">{items.length} {items.length === 1 ? t("chat.order.item") : t("chat.order.itemsPlural")} · {dateLabel(order.created_at, locale)}</span></span>
          {!compact && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusTone(order.status)}`}>{humanize(order.status)}</span>}
        </span>
        {compact ? <span className="flex flex-col items-end gap-1"><span className="text-[13px] font-bold text-fg">{money(order.total)}</span><span className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${statusTone(order.status)}`}>{humanize(order.status)}</span><span className="flex items-center gap-0.5 text-[10px] font-medium text-info">{t("chat.order.details")}<ChevronDown size={13} className="transition-transform group-open:rotate-180" /></span></span></span> : <span className="flex items-center gap-3"><span className="text-[13px] font-bold text-fg">{money(order.total)}</span><span className="flex items-center gap-1 text-[11px] font-semibold text-info">{t("chat.order.details")}<ChevronDown size={14} className="transition-transform group-open:rotate-180" /></span></span>}
      </summary>

      {compact ? <div className="space-y-2 px-3 pb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-line pb-2 text-[10px]">
          <p className="truncate text-fg-muted">{t("chat.order.payment")} <span className="font-semibold text-fg">{paymentMethod}</span> · {humanize(order.payment?.status)}</p>
          <p className="truncate text-fg-muted">{t("chat.order.delivery")} <span className="font-semibold text-fg">{humanize(order.shipping_method)}</span> · {money(order.shipping)}</p>
          <p className="truncate text-fg-muted">{t("chat.order.subtotal")} <span className="font-semibold text-fg">{money(order.subtotal)}</span></p>
          <p className="truncate text-fg-muted">{t("chat.order.tax")} <span className="font-semibold text-fg">{money(order.tax)}</span></p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold text-fg-muted">{t("chat.order.items")}</p>
          {items.length ? <div className="divide-y divide-line">{items.map((item, index) => <div key={`${item.product_id || item.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-1.5"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-fg">{item.name || "Product"}</p><p className="truncate text-[10px] text-fg-muted">{[item.brand, item.variantTitle].filter(Boolean).join(" · ") || t("chat.order.item")}</p></div><div className="shrink-0 text-right"><p className="text-[10px] text-fg-muted">{item.qty || 0} × {money(item.price)}</p><p className="text-[11px] font-semibold text-fg">{money(Number(item.qty || 0) * Number(item.price || 0))}</p></div></div>)}</div> : <p className="text-[11px] text-fg-muted">{t("chat.order.noItems")}</p>}
        </div>
        <details className="group/address border-t border-line pt-1.5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-medium text-fg-secondary [&::-webkit-details-marker]:hidden"><span>{t("chat.order.address")} · {address.full_name || t("chat.order.addressUnavailable")}</span><ChevronDown size={13} className="shrink-0 transition-transform group-open/address:rotate-180" /></summary>
          <div className="mt-1 space-y-0.5 text-[10px] text-fg-muted">{addressLines.length ? addressLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Address details unavailable</p>}{address.phone && <p>{address.phone}</p>}</div>
        </details>
      </div> : <>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
        <div className="rounded-lg border border-line bg-card-alt px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Payment</p><p className="mt-1 text-xs font-semibold text-fg">{paymentMethod}</p><p className="mt-0.5 text-[11px] capitalize text-fg-muted">{humanize(order.payment?.status)}</p></div>
        <div className="rounded-lg border border-line bg-card-alt px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Delivery</p><p className="mt-1 text-xs font-semibold text-fg">{humanize(order.shipping_method)}</p><p className="mt-0.5 text-[11px] text-fg-muted">Shipping {money(order.shipping)}</p></div>
        <div className="rounded-lg border border-line bg-card-alt px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Items subtotal</p><p className="mt-1 text-xs font-semibold text-fg">{money(order.subtotal)}</p><p className="mt-0.5 text-[11px] text-fg-muted">Tax {money(order.tax)}</p></div>
        <div className="rounded-lg border border-line bg-card-alt px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Deliver to</p><p className="mt-1 truncate text-xs font-semibold text-fg">{address.full_name || "Address unavailable"}</p><p className="mt-0.5 truncate text-[11px] text-fg-muted">{address.phone || ""}</p></div>
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
        <div className="overflow-hidden rounded-lg border border-line bg-card-alt">
          <div className="flex items-center justify-between border-b border-line px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{t("chat.order.items")}</p><p className="text-[10px] text-fg-muted">{items.length} {items.length === 1 ? t("chat.order.item") : t("chat.order.itemsPlural")}</p></div>
          {items.length ? <div className="max-h-36 divide-y divide-line overflow-y-auto">{items.map((item, index) => <div key={`${item.product_id || item.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-fg">{item.name || "Product"}</p><p className="mt-0.5 truncate text-[10px] text-fg-muted">{[item.brand, item.variantTitle].filter(Boolean).join(" · ") || t("chat.order.item")}</p></div><div className="shrink-0 text-right"><p className="text-[11px] font-medium text-fg-secondary">{item.qty || 0} × {money(item.price)}</p><p className="mt-0.5 text-xs font-semibold text-fg">{money(Number(item.qty || 0) * Number(item.price || 0))}</p></div></div>)}</div> : <p className="px-3 py-3 text-xs text-fg-muted">{t("chat.order.noItems")}</p>}
        </div>
        <div className="rounded-lg border border-line bg-card-alt px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{t("chat.order.address")}</p><p className="mt-1 text-xs font-semibold text-fg">{address.full_name || t("chat.order.addressUnavailable")}</p><div className="mt-0.5 space-y-0.5 text-[11px] text-fg-secondary">{addressLines.length ? addressLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>{t("chat.order.addressUnavailable")}</p>}{address.phone && <p>{address.phone}</p>}</div></div>
      </div>
      </>}
    </details>
  );
}
