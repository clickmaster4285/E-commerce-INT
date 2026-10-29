"use client";
import FallbackImage from "@/components/common/FallbackImage";
import React, { useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderApi } from "@/apis/admin/orderApi";
import { shippingApi } from "@/apis/admin/shippingApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { localizedStrictField, useLocalized } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";

/* ==================== ICONS ==================== */
const ArrowLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const XIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const ClockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const CheckCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const BoxIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const TruckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1h4a1 1 0 001-1v-3m-9 4a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>);
const HomeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h4" /></svg>);
const XCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const BanIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);
const AlertIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const LockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>);
const BanknoteIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 7h20v10H2V7zm10 5a2 2 0 100-4 2 2 0 000 4zm-6 0h.01M18 12h.01" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const ReceiptIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17h6M9 13h6M9 9h3m9 12V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16l3-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5z" /></svg>);

/* ==================== HELPERS ==================== */
const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-US" : locale;
const formatDate = (d, locale = "en") => d ? new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : "—";
const formatDateTime = (d, locale = "en") => d ? new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";
const formatCurrency = (value, locale = "en") => new Intl.NumberFormat(locale === "en" ? "en-PK" : intlLocale(locale), { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(value) || 0);

const API_BASE = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ;
const getImageUrl = (itemOrPath) => {
  const img = typeof itemOrPath === "string" ? itemOrPath : itemOrPath?.image || itemOrPath?.product_image || "";
  if (!img) return null;
  if (img.startsWith("http") || img.startsWith("blob:") || img.startsWith("data:")) return img;
  return `${API_BASE}/${img.replace(/^\/+/, "")}`;
};

const ORDER_STATUS_CONFIG = {
  pending:    { bg: "var(--warning-soft)",  color: "var(--warning-text)", border: "color-mix(in srgb, var(--warning) 28%, transparent)" },
  confirmed:  { bg: "var(--info-soft)",  color: "var(--info-text)", border: "color-mix(in srgb, var(--info) 28%, transparent)" },
  processing: { bg: "var(--purple-soft)",  color: "var(--purple-text)", border: "color-mix(in srgb, var(--purple) 28%, transparent)" },
  shipped:    { bg: "var(--info-soft)",  color: "var(--indigo-text)", border: "var(--info-soft)" },
  delivered:  { bg: "var(--success-soft)",  color: "var(--success-text)", border: "color-mix(in srgb, var(--success) 28%, transparent)" },
  cancelled:  { bg: "var(--danger-soft)",   color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
};

const PAYMENT_STATUS_CONFIG = {
  paid:     { labelKey: "admin.orders.status.paid", bg: "var(--success-soft)", color: "var(--success-text)", border: "color-mix(in srgb, var(--success) 28%, transparent)" },
  pending:  { labelKey: "admin.orders.status.unpaid", bg: "var(--warning-soft)", color: "var(--warning-text)", border: "color-mix(in srgb, var(--warning) 28%, transparent)" },
  failed:   { labelKey: "admin.orders.status.failed", bg: "var(--danger-soft)",  color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
  refunded: { labelKey: "admin.orders.status.refunded", bg: "rgba(100,116,139,0.10)", color: "var(--text-muted)", border: "rgba(100,116,139,0.25)" },
};

// Full payment method name (the order payload carries a short code: cod/bank/card)
const PAYMENT_METHOD_LABEL = {
  cod: "admin.orders.detail.cashOnDelivery",
  bank: "admin.orders.detail.bankTransfer",
  card: "admin.orders.detail.cardPayment",
};
const paymentMethodLabel = (method, t) => {
  const key = PAYMENT_METHOD_LABEL[method];
  return key ? t(key) : (method ? String(method).toUpperCase() : "—");
};

// ✅ Promo line = koi bhi deal ya bundle wali line
function isPromoLine(item) {
  return !!(item?.deal_id || item?.deal_type || item?.bundle_id || item?.bundle_name);
}

// ✅ Line-level savings — the deal/bundle discount for a deal line comes from
//    the deal engine, so `savings` (per-unit price drop) is NOT counted again there.
//    Checkout follows the same rule: dealActive ? dealSavings : savings * qty
function itemLineSavings(item) {
  if (isPromoLine(item)) {
    return (Number(item?.deal_savings) || 0) + (Number(item?.bundle_savings) || 0);
  }
  return (Number(item?.savings) || 0) * (Number(item?.qty) || 0);
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const item = ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.pending;
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      {t(`admin.orders.status.${status}`)}
    </span>
  );
}

function OrderItemImage({ item, size = 60 }) {
  const [failed, setFailed] = useState(false);
  const src = getImageUrl(item);
  if (!src || failed) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-lg font-bold"
        style={{ width: `${size}px`, height: `${size}px`, backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
        {(item?.name || "?").charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <FallbackImage src={src} alt={item?.name || ""} loading="lazy" onError={() => setFailed(true)}
      className="shrink-0 object-cover rounded-lg"
      style={{ width: `${size}px`, height: `${size}px`, border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }} />
  );
}

/* ==================== DEAL / BUNDLE HELPERS ==================== */
// Converts a deal type into a human-readable label (same wording as checkout/cart)
function dealLabel(item, t) {
  const type = item?.deal_type || "";
  if (type === "buy_x_get_y") {
    const b = Number(item.deal_buy_quantity) || 0;
    const g = Number(item.deal_get_quantity) || 0;
    return b > 0 && g > 0 ? t("admin.orders.detail.buyXGetY", { buy: b, get: g }) : t("admin.orders.detail.buyXGetYGeneric");
  }
  if (type === "free_shipping") return t("admin.orders.detail.freeShippingDeal");
  if (type === "percentage") return item.deal_name || item.discount_name || t("admin.orders.detail.percentageDeal");
  if (type === "fixed_amount") return item.deal_name || item.discount_name || t("admin.orders.detail.fixedAmountDeal");
  if (type === "bundle") return item.deal_name || t("admin.orders.detail.bundleDeal");
  return item.deal_name || "";
}

// All promos applied to one item (deal + bundle) — used for badges
function itemPromoBadges(item, t, locale) {
  const badges = [];
  const dl = dealLabel(item, t);
  if (dl) badges.push({ key: "deal", text: dl, tone: "warning" });
  if (Number(item.free_items) > 0) {
    badges.push({ key: "free", text: t("admin.orders.detail.freeUnitCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(item.free_items) }), tone: "success" });
  }
  if (item.bundle_id || item.bundle_name) {
    badges.push({ key: "bundle", text: item.bundle_name ? t("admin.orders.detail.comboName", { name: item.bundle_name }) : t("admin.orders.detail.combo"), tone: "info" });
  }
  if (!dl && !item.bundle_id) {
    const dn = item.discount_name || "";
    if (dn) badges.push({ key: "disc", text: dn, tone: "info" });
  }
  return badges;
}

function PromoTag({ children, tone = "warning" }) {
  const tones = {
    warning: { backgroundColor: "var(--warning-soft, var(--bg-tertiary))", color: "var(--warning-text)" },
    success: { backgroundColor: "var(--success-soft)", color: "var(--success-text)" },
    info: { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" },
  };
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={tones[tone] || tones.warning}>
      {children}
    </span>
  );
}

// ✅ "Why this deal applied" — a professional order view shows this explanation
function promoReason(group, t, locale) {
  const rows = group.items || [];
  const paid = rows.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const number = (n) => new Intl.NumberFormat(intlLocale(locale)).format(n);

  if (group.kind === "bundle") {
    return t("admin.orders.detail.reasonBundle", { units: number(paid), products: number(rows.length) });
  }
  if (group.type === "buy_x_get_y") {
    return t("admin.orders.detail.reasonBuyXGetY", { units: number(paid), buy: number(group.buyQty), get: number(group.getQty), minimum: number(group.buyQty), freeUnits: number(group.freeUnits) });
  }
  if (group.type === "free_shipping") {
    return t("admin.orders.detail.reasonFreeShipping");
  }
  if (group.type === "percentage") {
    return t("admin.orders.detail.reasonPercentage", { units: number(paid) });
  }
  if (group.type === "fixed_amount") {
    return t("admin.orders.detail.reasonFixedAmount", { units: number(paid) });
  }
  return t("admin.orders.detail.reasonGeneric", { units: number(paid) });
}

// One-line item-level reason (shown in the items table)
function itemPromoReason(item, t, locale) {
  const amount = (value) => formatCurrency(Number(value) || 0, locale);
  const type = item?.deal_type || "";
  if (type === "buy_x_get_y") {
    const b = Number(item.deal_buy_quantity) || 0;
    const g = Number(item.deal_get_quantity) || 0;
    return t("admin.orders.detail.itemReasonBuyXGetY", { buy: b, get: g, freeUnits: new Intl.NumberFormat(intlLocale(locale)).format(item.free_items || 0), amount: amount(item.deal_savings) });
  }
  if (item?.bundle_name) {
    return t("admin.orders.detail.itemReasonBundle", { amount: amount(item.bundle_savings) });
  }
  if (Number(item?.savings) > 0) {
    const dn = item.discount_name || t("admin.orders.detail.discount");
    return t("admin.orders.detail.itemReasonDiscount", { discount: dn, amount: amount(item.savings) });
  }
  if (type) return t("admin.orders.detail.itemReasonDeal");
  return "";
}

const STATUS_FLOW = ["pending", "confirmed", "shipped", "delivered"];
const ORDER_STEP_LABEL = {
  pending: "admin.orders.detail.placed",
  confirmed: "admin.orders.status.confirmed",
  processing: "admin.orders.status.processing",
  shipped: "admin.orders.status.shipped",
  delivered: "admin.orders.status.delivered",
};

// Vertical timeline — only timestamps actually recorded on the order
// (placed = created_at, current stage = updated_at). Other stages have no
// stored timestamps, so no time is shown for them.
function OrderTimeline({ order }) {
  const { t, locale } = useTranslation();
  const cancelled = order.status === "cancelled";
  const effective = order.status === "processing" ? "confirmed" : order.status;
  const currentIdx = STATUS_FLOW.indexOf(effective);

  const rows = [];
  if (cancelled) {
    rows.push({
      key: "cancelled", label: t("admin.orders.status.cancelled"), done: true, danger: true,
      note: order.cancel_reason || "", time: `${t("admin.orders.status.cancelled")} ${formatDateTime(order.updated_at, locale)}`,
    });
  } else {
    [...STATUS_FLOW].reverse().forEach((step) => {
      const i = STATUS_FLOW.indexOf(step);
      const done = currentIdx >= i;
      const isCurrent = currentIdx === i && step !== "pending";
      rows.push({
        key: step,
        label: t(isCurrent ? ORDER_STEP_LABEL[order.status] || ORDER_STEP_LABEL[step] : ORDER_STEP_LABEL[step]),
        done,
        current: isCurrent,
        time: step === "pending"
          ? formatDateTime(order.created_at, locale)
          : isCurrent ? `${t("admin.orders.detail.lastUpdate")} ${formatDateTime(order.updated_at, locale)}` : "",
      });
    });
  }

  return (
    <div className="space-y-0">
      {rows.map((row, idx) => (
        <div key={row.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0"
              style={{
                backgroundColor: row.done ? (row.danger ? "var(--danger)" : "var(--success)") : "transparent",
                borderColor: row.done ? (row.danger ? "var(--danger)" : "var(--success)") : "var(--border-color)",
                color: "#fff",
              }}>
              {row.done ? <CheckIcon className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--border-color)" }} />}
            </span>
            {idx < rows.length - 1 && <span className="w-0.5 flex-1 mt-1" style={{ backgroundColor: "var(--border-color)" }} />}
          </div>
          <div className={`flex-1 min-w-0 ${idx < rows.length - 1 ? "pb-4" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <span className="text-[13px] font-semibold" style={{ color: row.done ? "var(--text-primary)" : "var(--text-muted)" }}>{row.label}</span>
              {row.time && <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{row.time}</span>}
            </div>
            {row.note && <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{row.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==================== ACTION BUTTONS (Mobile Optimized) ==================== */
function OrderActions({ order, onUpdate, onCancel, onPaymentReceived, isPending, isPaymentPending }) {
  const { t } = useTranslation();
  const status = order.status;
  const payStatus = order.payment?.status || "pending";

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg w-full sm:w-auto"
        style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
        <LockIcon className="w-4 h-4" style={{ color: "var(--danger-text)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--danger-text)" }}>{t("admin.orders.detail.cancelled")}</span>
      </div>
    );
  }

  if (status === "delivered") {
    if (payStatus !== "paid") {
      return (
        <button
          onClick={onPaymentReceived}
          disabled={isPaymentPending}
          className="h-11 sm:h-10 w-full sm:w-auto px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
          style={{ backgroundColor: "var(--success)", color: "#fff" }}>
          {isPaymentPending ? <Spinner className="w-4 h-4" /> : <BanknoteIcon className="w-4 h-4" />}
          {t("admin.orders.detail.paymentReceived")}
        </button>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg w-full sm:w-auto"
        style={{ backgroundColor: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
        <CheckCircleIcon className="w-4 h-4" style={{ color: "var(--success-text)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--success-text)" }}>{t("admin.orders.detail.completed")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto">
      {status === "pending" && (
        <button onClick={() => onUpdate("confirmed")} disabled={isPending}
          className="h-11 sm:h-10 w-full sm:w-auto px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/10"
          style={{ backgroundColor: "var(--info)", color: "#fff" }}>
          {isPending ? <Spinner className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
          {t("admin.orders.detail.confirmOrder")}
        </button>
      )}

      {(status === "confirmed" || status === "processing") && (
        <button onClick={() => onUpdate("shipped")} disabled={isPending}
          className="h-11 sm:h-10 w-full sm:w-auto px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/10"
          style={{ backgroundColor: "var(--indigo)", color: "#fff" }}>
          {isPending ? <Spinner className="w-4 h-4" /> : <TruckIcon className="w-4 h-4" />}
          {t("admin.orders.detail.markShipped")}
        </button>
      )}

      {status === "shipped" && (
        <button onClick={() => onUpdate("delivered")} disabled={isPending}
          className="h-11 sm:h-10 w-full sm:w-auto px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
          style={{ backgroundColor: "var(--success)", color: "#fff" }}>
          {isPending ? <Spinner className="w-4 h-4" /> : <HomeIcon className="w-4 h-4" />}
          {t("admin.orders.detail.markDelivered")}
        </button>
      )}

      <button onClick={onCancel} disabled={isPending}
        className="h-11 sm:h-10 w-full sm:w-auto px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)", color: "var(--danger-text)" }}>
        <BanIcon className="w-4 h-4" />
        {t("admin.orders.detail.cancelOrder")}
      </button>
    </div>
  );
}

/* ==================== MAIN PAGE ==================== */
export default function OrderDetailPage({ params }) {
  const { t, locale } = useTranslation();
  const { contentOf, productNameOf } = useLocalized();
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const body = await orderApi.getById(id);
      return body?.data || null;
    },
    retry: 1,
  });
  usePageTranslations({ model: "Order", records: order ? [order] : [], locale, ready: !!order && !isLoading, queryKey: ["admin-order", id], queryClient });
  const { data: shippingMethods = [], isLoading: shippingMethodsLoading } = useQuery({ queryKey: ["adminShippingMethods"], queryFn: shippingApi.getMethods, retry: false });
  usePageTranslations({ model: "ShippingMethod", records: shippingMethods, locale, ready: !shippingMethodsLoading, queryKey: ["adminShippingMethods"], queryClient });
  const orderProducts = useMemo(() => (order?.items || []).map((item) => item.product_id).filter((product) => product && typeof product === "object" && product._id), [order]);
  usePageTranslations({ model: "Product", records: orderProducts, locale, ready: !!order && !isLoading, queryKey: ["admin-order", id], queryClient });
  const orderVariants = useMemo(() => (order?.items || []).map((item) => item.variant_id).filter((variant) => variant && typeof variant === "object" && variant._id), [order]);
  usePageTranslations({ model: "Variant", records: orderVariants, locale, ready: !!order && !isLoading, queryKey: ["admin-order", id], queryClient });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, cancel_reason }) => orderApi.updateStatus(id, { status, ...(cancel_reason ? { cancel_reason } : {}) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(t("admin.orders.toast.markedStatus", { status: t(`admin.orders.status.${variables.status}`) }));
      setCancelConfirm(false);
    },
    onError: () => toast.error(t("admin.orders.toast.updateOrderFailed")),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id }) => orderApi.updatePayment(id, { status: "paid" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(t("admin.orders.detail.paymentMarked"));
    },
    onError: () => toast.error(t("admin.orders.detail.paymentFailed")),
  });

  const handlePaymentReceived = () => updatePaymentMutation.mutate({ id });
  const handleUpdate = (status) => updateStatusMutation.mutate({ id, status });
  const handleCancel = () => {
    if (!cancelReason.trim()) return toast.error(t("admin.orders.detail.cancelRequired"));
    updateStatusMutation.mutate({ id, status: "cancelled", cancel_reason: cancelReason.trim() });
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  // ✅ Savings ke 3 ALAG buckets — warna double-counting ho jati:
  //    priceDiscounts = regular price discount (sirf non-promo lines)
  //    dealSavings    = buy X get Y / % / fixed-amount deal
  //    bundleSavings  = combo bundle
  const priceDiscounts = useMemo(
    () => (order?.items || []).reduce((s, it) => s + (isPromoLine(it) ? 0 : itemLineSavings(it)), 0),
    [order]
  );
  const dealSavings = useMemo(() => {
    if (Number(order?.total_deal_savings) > 0) return Number(order.total_deal_savings);
    return (order?.items || []).reduce((s, it) => s + (Number(it.deal_savings) || 0), 0);
  }, [order]);
  const bundleSavings = useMemo(() => {
    if (Number(order?.total_bundle_savings) > 0) return Number(order.total_bundle_savings);
    return (order?.items || []).reduce((s, it) => s + (Number(it.bundle_savings) || 0), 0);
  }, [order]);
  const totalSaved = priceDiscounts + dealSavings + bundleSavings;

  // ✅ Counts: product rows, paid units and free units — kept explicit for admin
  const itemRows = (order?.items || []).length;
  const paidUnits = useMemo(
    () => (order?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0),
    [order]
  );
  const freeUnits = useMemo(
    () => (order?.items || []).reduce((s, it) => s + (Number(it.free_items) || 0), 0),
    [order]
  );

  // ✅ Group deals / bundles — each group gets its own reason + savings
  const promoGroups = useMemo(() => {
    const rows = order?.items || [];
    const map = new Map();

    rows.forEach((it) => {
      if (!it.deal_type && !it.deal_id) return;
      const key = `deal:${it.deal_id || it.deal_name || it.deal_type}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          kind: "deal",
          label: dealLabel(it, t),
          name: it.deal_name || "",
          type: it.deal_type || "",
          buyQty: Number(it.deal_buy_quantity) || 0,
          getQty: Number(it.deal_get_quantity) || 0,
          items: [],
          freeUnits: 0,
          savings: 0,
        });
      }
      const g = map.get(key);
      g.items.push(it);
      g.freeUnits += Number(it.free_items) || 0;
      g.savings += Number(it.deal_savings) || 0;
    });

    rows.forEach((it) => {
      if (!it.bundle_id && !it.bundle_name) return;
      const key = `bundle:${it.bundle_id || it.bundle_name}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          kind: "bundle",
          label: it.bundle_name ? `Combo: ${it.bundle_name}` : "Combo Bundle",
          name: it.bundle_name || "",
          type: "bundle",
          items: [],
          freeUnits: 0,
          savings: 0,
        });
      }
      const g = map.get(key);
      g.items.push(it);
      g.savings += Number(it.bundle_savings) || 0;
    });

    // Har group ke saath "kyun lagi" wali explanation
    return Array.from(map.values()).map((g) => ({ ...g, description: promoReason(g, t, locale) }));
  }, [order]);

  const dealGroups = promoGroups.filter((g) => g.kind === "deal");
  const bundleGroups = promoGroups.filter((g) => g.kind === "bundle");

  // ✅ Price discounts (excluding deals) — grouped by discount name
  const discountGroups = useMemo(() => {
    const map = new Map();
    (order?.items || []).forEach((it) => {
      if (isPromoLine(it)) return;
      if (!(Number(it.savings) > 0)) return;
      const key = it.discount_name || "Product discount";
      if (!map.has(key)) {
        map.set(key, {
          key, kind: "discount", label: key, name: key, type: "",
          items: [], freeUnits: 0, savings: 0,
          description: "Price discount applied — unit price was reduced from the original price (before tax & shipping).",
        });
      }
      const g = map.get(key);
      g.items.push(it);
      g.savings += (Number(it.savings) || 0) * (Number(it.qty) || 0);
      g.freeUnits += Number(it.free_items) || 0;
    });
    return Array.from(map.values());
  }, [order]);

  const promoColumnCount = [dealGroups.length, bundleGroups.length, discountGroups.length].filter((n) => n > 0).length;
  const promoGridClass = promoColumnCount > 2
    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
    : "grid grid-cols-1 md:grid-cols-2 gap-3";

  const payStatus = order?.payment?.status || "pending";
  const user = order?.user_id || {};
  const customerName = order?.address_snapshot?.full_name || user.name || "Unknown";
  const customerPhone = order?.address_snapshot?.phone || "";
  const customerEmail = user.email || "";

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ color: "var(--text-primary)" }}>
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="w-full min-h-screen p-3 sm:p-4" style={{ color: "var(--text-primary)" }}>
        <button onClick={() => router.push("/admin/orders")}
          className="mb-4 h-11 sm:h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90"
          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
          <ArrowLeftIcon className="w-5 h-5 sm:w-4 sm:h-4" /> {t("admin.orders.detail.backToOrders")}
        </button>
        <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
          <XCircleIcon className="w-8 h-8 opacity-60" />
          <p className="text-sm text-center px-4" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.notFound")}</p>
          <button onClick={() => refetch()} className="h-11 sm:h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{t("admin.orders.detail.retry")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-4 p-3 sm:p-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-[12px]" aria-label={t("admin.orders.detail.breadcrumbNav")}>
          <button type="button" onClick={() => router.push("/admin/orders")}
            className="font-medium hover:underline" style={{ color: "var(--text-muted)" }}>
            {t("admin.orders.page.title")}
          </button>
          <ChevronRightIcon className="w-3.5 h-3.5" />
          <span className="font-semibold">{t("admin.orders.detail.breadcrumb")}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] sm:text-[22px] leading-7 font-bold tracking-tight truncate">{t("admin.orders.detail.orderPrefix", { number: order.order_number })}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-[12px] sm:text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              {formatDateTime(order.created_at, locale)}
            </p>
          </div>
          <div className="w-full md:w-auto">
            <OrderActions
              order={order}
              onUpdate={handleUpdate}
              onCancel={() => setCancelConfirm(true)}
              onPaymentReceived={handlePaymentReceived}
              isPending={updateStatusMutation.isPending}
              isPaymentPending={updatePaymentMutation.isPending}
            />
          </div>
        </div>

        {/* Quick stats — 3 cards, no duplication:
            Order Status / Payment (status + method + amount) / Total Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard
            label={t("admin.orders.page.status")}
            icon={<BoxIcon className="w-5 h-5" />}
            accent="var(--info-text)"
            accentSoft="var(--info-soft)"
            value={t(ORDER_STEP_LABEL[order.status] || `admin.orders.status.${order.status}`)}
            sub={order.status === "cancelled"
              ? `${t("admin.orders.status.cancelled")} ${formatDateTime(order.updated_at, locale)}`
              : `${t("admin.orders.detail.lastUpdate")} ${formatDateTime(order.updated_at, locale)}`}
          />
          <StatCard
            label={t("admin.orders.page.payment")}
            icon={<BanknoteIcon className="w-5 h-5" />}
            accent="var(--success-text)"
            accentSoft="var(--success-soft)"
            value={t((PAYMENT_STATUS_CONFIG[payStatus] || PAYMENT_STATUS_CONFIG.pending).labelKey)}
            sub={t("admin.orders.detail.via", { method: t(`admin.orders.detail.${({ cod: "cashOnDelivery", bank: "bankTransfer", card: "cardPayment" })[order.payment?.method] || "paymentMethod"}`) })}
          />
          <StatCard
            label={t("admin.orders.detail.totalAmount")}
            icon={<ReceiptIcon className="w-5 h-5" />}
            accent="var(--warning-text)"
            accentSoft="var(--warning-soft)"
            value={formatCurrency(order.total, locale)}
          />
        </div>

        {/* Main grid: items + summary (left) / customer + timeline + info (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8 space-y-4">


            {/* ---- Order Items ---- */}
            <div className="rounded-lg overflow-hidden" style={cardStyle}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-bold">{t("admin.orders.detail.orderItems", { count: new Intl.NumberFormat(intlLocale(locale)).format(itemRows) })}</h2>
                  {freeUnits > 0 && <PromoTag tone="success">{t("admin.orders.detail.freeUnitCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(freeUnits) })}</PromoTag>}
                  {dealGroups.length > 0 && <PromoTag tone="warning">{t("admin.orders.detail.dealsAppliedCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(dealGroups.length) })}</PromoTag>}
                  {bundleGroups.length > 0 && <PromoTag tone="info">{t("admin.orders.detail.bundlesAppliedCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(bundleGroups.length) })}</PromoTag>}
                </div>
                <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {t("admin.orders.detail.paidUnitCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(paidUnits) })}{freeUnits > 0 ? ` + ${t("admin.orders.detail.freeUnitCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(freeUnits) })}` : ""}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[760px]" style={{ tableLayout: "fixed" }}>
                  <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.product")}</th>
                      <th className="w-[116px] px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.price")}</th>
                      <th className="w-[70px] px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.qty")}</th>
                      <th className="w-[200px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.dealDetails")}</th>
                      <th className="w-[124px] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item, idx) => {
                      const badges = itemPromoBadges(item, t, locale);
                      const reason = itemPromoReason(item, t, locale);
                      const lineSaved = itemLineSavings(item);
                      return (
                        <tr key={`${order._id}-item-${idx}`}
                          style={{ borderBottom: idx < (order.items?.length || 0) - 1 ? "1px solid var(--border-color)" : "none" }}>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-start gap-3 min-w-0">
                              <OrderItemImage item={item} size={56} />
                              <div className="min-w-0">
                                <p className="font-semibold" title={item.name}>{productNameOf(item.product_id) || item.name}</p>
                                {item.brand && (
                                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.brand", { brand: item.brand })}</p>
                                )}
                                {(item.variant_id?.title || item.variantTitle) && (
                                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.variantLabel", { variant: contentOf(item.variant_id?.title || item.variantTitle, item.variant_id?.translations?.title) })}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right align-top">
                            {Number(item.original_price) > Number(item.price) && (
                              <span className="block text-[11px] line-through whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                                {formatCurrency(item.original_price, locale)}
                              </span>
                            )}
                            <span className="font-semibold whitespace-nowrap">{formatCurrency(item.price, locale)}</span>
                            {Number(item.savings) > 0 && !isPromoLine(item) && (
                              <span className="block text-[10px] whitespace-nowrap" style={{ color: "var(--success-text)" }}>
                                {t("admin.orders.detail.savePerUnit", { amount: formatCurrency(item.savings, locale) })}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center align-top">
                            <span className="font-bold">{item.qty}</span>
                            {Number(item.free_items) > 0 && (
                              <span className="block text-[10px] font-bold whitespace-nowrap" style={{ color: "var(--success-text)" }}>
                                {t("admin.orders.detail.freeUnitCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(item.free_items) })}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {badges.length === 0 ? (
                              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>—</span>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-1">
                                  {badges.map((b) => (
                                    <PromoTag key={b.key} tone={b.tone}>{b.text}</PromoTag>
                                  ))}
                                </div>
                                {reason && (
                                  <p className="text-[10px] mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>{reason}</p>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right align-top">
                            <span className="font-bold whitespace-nowrap">
                              {formatCurrency(Number(item.price || 0) * (Number(item.qty) || 0), locale)}
                            </span>
                            {lineSaved > 0 && (
                              <span className="block text-[10px] font-semibold whitespace-nowrap" style={{ color: "var(--success-text)" }}>
                                {t("admin.orders.detail.savedAmount", { amount: formatCurrency(lineSaved, locale) })}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Deal/bundle totals are not repeated here — shown once
                in "Order Summary" and "Deal & Bundle Summary" below. */}

            {/* ---- Order Summary ----
                How the total is built, step by step:
                Original MRP (before discounts) − Total Saved = Subtotal (discounted),
                then Subtotal + Shipping + Tax = Total Amount.
                Savings are already adjusted in the prices — never deducted twice. */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <h2 className="text-[15px] font-bold mb-3">{t("admin.orders.detail.orderSummary")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <div className="space-y-1.5">
                  {totalSaved > 0 && (
                    <>
                  <TotalRow label={t("admin.orders.detail.originalPrice")} value={formatCurrency(Number(order.subtotal || 0) + totalSaved, locale)} />
                  <TotalRow label={t("admin.orders.detail.lessSaved")} value={`− ${formatCurrency(totalSaved, locale)}`} accent="var(--success-text)" />
                    </>
                  )}
                  <TotalRow label={t("admin.orders.detail.subtotalAfter")} value={formatCurrency(order.subtotal, locale)} />
                  <TotalRow label={t("admin.orders.detail.shippingCharges")} value={formatCurrency(order.shipping, locale)} />
                  <TotalRow label={`+ ${t("admin.orders.detail.tax")}`} value={formatCurrency(order.tax, locale)} />
                  <div className="flex justify-between text-[15px] font-bold pt-2 mt-1" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <span>{t("admin.orders.detail.totalAmount")}</span>
                    <span>{formatCurrency(order.total, locale)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 mt-3 md:pt-0 md:mt-0 md:border-l md:pl-6"
                  style={{ borderColor: "var(--border-color)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                    {t("admin.orders.detail.savings")}
                  </p>
                  {priceDiscounts > 0 && (
                  <TotalRow label={t("admin.orders.detail.priceDiscounts")} value={formatCurrency(priceDiscounts, locale)} accent="var(--success-text)" />
                  )}
                  {dealSavings > 0 && (
                    <TotalRow label={t("admin.orders.detail.dealSavings")} value={formatCurrency(dealSavings, locale)} accent="var(--success-text)" />
                  )}
                  {bundleSavings > 0 && (
                    <TotalRow label={t("admin.orders.detail.bundleSavings")} value={formatCurrency(bundleSavings, locale)} accent="var(--success-text)" />
                  )}
                  {totalSaved > 0 && (
                    <>
                      <div className="flex justify-between text-[15px] font-bold pt-2 mt-1" style={{ borderTop: "1px solid var(--border-color)" }}>
                        <span>{t("admin.orders.detail.totalSaved")}</span>
                        <span style={{ color: "var(--success-text)" }}>{formatCurrency(totalSaved, locale)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-4">

            {/* ---- Customer & Shipping Address ---- */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <h2 className="text-[15px] font-bold mb-3">{t("admin.orders.detail.customerShippingAddress")}</h2>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                  {(customerName || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate">{customerName}</p>
                  {customerPhone && <p className="text-[12px] truncate" style={{ color: "var(--text-muted)" }}>{customerPhone}</p>}
                  {customerEmail && <p className="text-[12px] truncate" style={{ color: "var(--text-muted)" }}>{customerEmail}</p>}
                </div>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wide mt-4 mb-1.5" style={{ color: "var(--text-muted)" }}>
                {t("admin.orders.detail.shippingAddress")}
              </p>
              <p className="text-[13px] leading-relaxed">
                {order.address_snapshot?.street_address1}
                {order.address_snapshot?.street_address2 ? `, ${order.address_snapshot.street_address2}` : ""}
                <br />
                {order.address_snapshot?.city}, {order.address_snapshot?.state}
                {order.address_snapshot?.zip_code ? ` ${order.address_snapshot.zip_code}` : ""}
                <br />
                {order.address_snapshot?.country}
              </p>
            </div>

            {/* ---- Order Timeline ---- */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <h2 className="text-[15px] font-bold mb-3">{t("admin.orders.detail.orderTimeline")}</h2>
              <OrderTimeline order={order} />
            </div>

            {/* ---- Additional Information ----
                (Order number / date already shown in the header — not repeated) */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <h2 className="text-[15px] font-bold mb-3">{t("admin.orders.detail.additionalInformation")}</h2>
              <div className="space-y-1.5 text-[13px]">
                <InfoRow label={t("admin.orders.detail.shippingMethod")} value={order.shipping_method === "standard" ? t("admin.orders.page.standardShipping") : order.shipping_method === "express" ? t("admin.orders.page.expressShipping") : (shippingMethods.find((method) => method.code === order.shipping_method || String(method._id) === String(order.shipping_method)) ? localizedStrictField(shippingMethods.find((method) => method.code === order.shipping_method || String(method._id) === String(order.shipping_method)).name, shippingMethods.find((method) => method.code === order.shipping_method || String(method._id) === String(order.shipping_method)).translations?.name, locale) : order.shipping_method ? String(order.shipping_method).replace(/_/g, " ") : "—")} capitalize />
                {order.status === "cancelled" && order.cancel_reason && (
                  <InfoRow label={t("admin.purchaseOrders.view.cancelReason")} value={contentOf(order.cancel_reason, order.translations?.cancel_reason)} />
                )}
                {order.notes && <InfoRow label={t("admin.customers.detail.notes")} value={contentOf(order.notes, order.translations?.notes)} />}
              </div>
            </div>
          </div>
        </div>


        {/* ---- Deal & Bundle Summary (shown when any promo is applied to the order) ---- */}
        {(dealGroups.length > 0 || bundleGroups.length > 0 || discountGroups.length > 0) && (
          <div className="rounded-lg p-4" style={cardStyle}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-[15px] font-bold">{t("admin.orders.detail.dealBundleSummary")}</h2>
            </div>

            <div className={promoGridClass}>
              {dealGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {t("admin.orders.detail.dealsAppliedCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(dealGroups.length) })}
                  </p>
                  {dealGroups.map((g) => <PromoGroupCard key={g.key} group={g} />)}
                </div>
              )}

              {bundleGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {t("admin.orders.detail.bundlesAppliedCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(bundleGroups.length) })}
                  </p>
                  {bundleGroups.map((g) => <PromoGroupCard key={g.key} group={g} />)}
                </div>
              )}

              {discountGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {t("admin.orders.detail.discountsAppliedCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(discountGroups.length) })}
                  </p>
                  {discountGroups.map((g) => <PromoGroupCard key={g.key} group={g} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal (Mobile Optimized: Slides up from bottom) */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <style>{`@keyframes modalSlideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } } @keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl p-4 sm:p-5 shadow-2xl border"
            style={{ ...cardStyle, animation: "modalSlideUp 0.3s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertIcon className="w-5 h-5" style={{ color: "var(--danger-text)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{t("admin.orders.detail.cancelOrderQuestion", { number: order.order_number })}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {t("admin.orders.detail.cancelWarning")}
                </p>
                <div className="mt-3">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                    {t("admin.orders.detail.cancellationReason")} <span style={{ color: "var(--danger-text)" }}>*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder={t("admin.orders.detail.cancelPlaceholder")}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none resize-none transition focus:ring-1 focus:ring-red-500/40"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button onClick={() => setCancelConfirm(false)} disabled={updateStatusMutation.isPending}
                className="h-11 sm:h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border order-2 sm:order-1"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>
                {t("admin.orders.detail.keepOrder")}
              </button>
              <button onClick={handleCancel} disabled={updateStatusMutation.isPending || !cancelReason.trim()}
                className="h-11 sm:h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2 order-1 sm:order-2"
                style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                {updateStatusMutation.isPending ? <><Spinner className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> {t("admin.orders.detail.cancelling")}</> : t("admin.orders.detail.confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value, accent }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

/* ==================== PRESENTATIONAL HELPERS (naya order detail layout) ==================== */

// Quick stat card — label + colored icon + value + sub text
function StatCard({ label, icon, value, sub, accent = "var(--accent)", accentSoft = "var(--accent-soft)" }) {
  return (
    <div className="rounded-lg p-3.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex items-center gap-2.5 mt-2.5 min-w-0">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: accentSoft, color: accent }}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold leading-tight truncate">{value}</div>
          {sub && <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// Deal / bundle / discount group card — why it applied + which products + how much saved
function PromoGroupCard({ group }) {
  const { t, locale } = useTranslation();
  const promoTag = group.kind === "deal" ? "warning" : "info";

  return (
    <div className="rounded-md p-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <PromoTag tone={promoTag}>{group.label}</PromoTag>
        {group.name && group.name !== group.label && (
          <span className="text-[11px] font-semibold truncate" style={{ color: "var(--text-secondary)" }}>{group.name}</span>
        )}
        {group.freeUnits > 0 && <PromoTag tone="success">{t("admin.orders.detail.freeUnitCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(group.freeUnits) })}</PromoTag>}
      </div>

      {group.description && (
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {group.description}
        </p>
      )}

      {group.items?.length > 0 && (
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <span className="font-semibold">{t("admin.orders.detail.productsCount")} </span>
          {group.items.map((it) => `${it.name} (×${it.qty}${Number(it.free_items) > 0 ? ` +${it.free_items} free` : ""})`).join(", ")}
        </p>
      )}

      {group.savings > 0 && (
        <p className="text-[11px] font-bold mt-1.5" style={{ color: "var(--success-text)" }}>
          {t("admin.orders.detail.savedAmount", { amount: formatCurrency(group.savings, locale) })}
        </p>
      )}
    </div>
  );
}

// One row of the Additional Information card
function InfoRow({ label, value, capitalize = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`font-semibold text-right break-words ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}
