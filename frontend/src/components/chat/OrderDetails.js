"use client";

import { ChevronDown, Package2 } from "lucide-react";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;
const humanize = (value) => String(value || "—").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};
const statusTone = (value) => {
  const status = String(value || "").toLowerCase();
  if (["delivered", "completed"].includes(status)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 dark:ring-1 dark:ring-inset dark:ring-emerald-800";
  if (["pending", "on_hold"].includes(status)) return "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 dark:ring-1 dark:ring-inset dark:ring-amber-800";
  if (["processing", "confirmed", "shipped", "in_transit"].includes(status)) return "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-200 dark:ring-1 dark:ring-inset dark:ring-sky-800";
  if (["cancelled", "canceled", "failed", "refunded"].includes(status)) return "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 dark:ring-1 dark:ring-inset dark:ring-rose-800";
  return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:ring-1 dark:ring-inset dark:ring-slate-600";
};

export default function OrderDetails({ order, compact = false }) {
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
    <details className="group shrink-0 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#101b2e]">
      <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2" : "flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <Package2 size={18} className="shrink-0 text-amber-700 dark:text-amber-400" />
          <span className="min-w-0"><span className="block truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">Order #{order.order_number || "—"}</span><span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{items.length} {items.length === 1 ? "item" : "items"} · {dateLabel(order.created_at)}</span></span>
          {!compact && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusTone(order.status)}`}>{humanize(order.status)}</span>}
        </span>
        {compact ? <span className="flex flex-col items-end gap-1"><span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{money(order.total)}</span><span className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${statusTone(order.status)}`}>{humanize(order.status)}</span><span className="flex items-center gap-0.5 text-[10px] font-medium text-blue-700 dark:text-sky-300">Details<ChevronDown size={13} className="transition-transform group-open:rotate-180" /></span></span></span> : <span className="flex items-center gap-3"><span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{money(order.total)}</span><span className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-sky-300">Details<ChevronDown size={14} className="transition-transform group-open:rotate-180" /></span></span>}
      </summary>

      {compact ? <div className="space-y-2 px-3 pb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-slate-200 pb-2 text-[10px] dark:border-slate-700">
          <p className="truncate text-slate-500 dark:text-slate-400">Payment <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentMethod}</span> · {humanize(order.payment?.status)}</p>
          <p className="truncate text-slate-500 dark:text-slate-400">Delivery <span className="font-semibold text-slate-800 dark:text-slate-200">{humanize(order.shipping_method)}</span> · {money(order.shipping)}</p>
          <p className="truncate text-slate-500 dark:text-slate-400">Subtotal <span className="font-semibold text-slate-800 dark:text-slate-200">{money(order.subtotal)}</span></p>
          <p className="truncate text-slate-500 dark:text-slate-400">Tax <span className="font-semibold text-slate-800 dark:text-slate-200">{money(order.tax)}</span></p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">Items in this order</p>
          {items.length ? <div className="divide-y divide-slate-200 dark:divide-slate-700">{items.map((item, index) => <div key={`${item.product_id || item.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-1.5"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-200">{item.name || "Product"}</p><p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{[item.brand, item.variantTitle].filter(Boolean).join(" · ") || "Item"}</p></div><div className="shrink-0 text-right"><p className="text-[10px] text-slate-500 dark:text-slate-400">{item.qty || 0} × {money(item.price)}</p><p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">{money(Number(item.qty || 0) * Number(item.price || 0))}</p></div></div>)}</div> : <p className="text-[11px] text-slate-500 dark:text-slate-400">No item details available.</p>}
        </div>
        <details className="group/address border-t border-slate-200 pt-1.5 dark:border-slate-700">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-medium text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden"><span>Delivery address · {address.full_name || "Unavailable"}</span><ChevronDown size={13} className="shrink-0 transition-transform group-open/address:rotate-180" /></summary>
          <div className="mt-1 space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">{addressLines.length ? addressLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Address details unavailable</p>}{address.phone && <p>{address.phone}</p>}</div>
        </details>
      </div> : <>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#16233b]"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Payment</p><p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{paymentMethod}</p><p className="mt-0.5 text-[11px] capitalize text-slate-500 dark:text-slate-400">{humanize(order.payment?.status)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#16233b]"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery</p><p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{humanize(order.shipping_method)}</p><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Shipping {money(order.shipping)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#16233b]"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Items subtotal</p><p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{money(order.subtotal)}</p><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Tax {money(order.tax)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#16233b]"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Deliver to</p><p className="mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{address.full_name || "Address unavailable"}</p><p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{address.phone || ""}</p></div>
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#16233b]">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order items</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{items.length} {items.length === 1 ? "item" : "items"}</p></div>
          {items.length ? <div className="max-h-36 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">{items.map((item, index) => <div key={`${item.product_id || item.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name || "Product"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{[item.brand, item.variantTitle].filter(Boolean).join(" · ") || "Item"}</p></div><div className="shrink-0 text-right"><p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{item.qty || 0} × {money(item.price)}</p><p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">{money(Number(item.qty || 0) * Number(item.price || 0))}</p></div></div>)}</div> : <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">No item details available.</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-[#16233b]"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery address</p><p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{address.full_name || "Address unavailable"}</p><div className="mt-0.5 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">{addressLines.length ? addressLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Address details unavailable</p>}{address.phone && <p>{address.phone}</p>}</div></div>
      </div>
      </>}
    </details>
  );
}
