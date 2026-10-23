"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderApi } from "@/apis/admin/orderApi";
import { shippingApi } from "@/apis/admin/shippingApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { localizedStrictField, useLocalized } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";

/* ==================== ICONS ==================== */
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const DotsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const XIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>);
const BanIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);
const TruckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1h4a1 1 0 001-1v-3m-9 4a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>);
const BoxIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const PackageIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const AlertIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const ClockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const CheckCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const HomeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h4" /></svg>);
const XCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const BanknoteIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 7h20v10H2V7zm10 5a2 2 0 100-4 2 2 0 000 4zm-6 0h.01M18 12h.01" /></svg>);

/* ==================== HELPERS ==================== */
const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-US" : locale;
const formatDate = (d, locale = "en") => d ? new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : "—";

// ✅ Product history me "KAB order hua" exact dekhna ho to time bhi chahiye
const formatDateTime = (d, locale = "en") => d
  ? new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d))
  : "—";
const formatCurrency = (value, locale = "en") => new Intl.NumberFormat(locale === "en" ? "en-PK" : intlLocale(locale), { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatNumber = (value, locale = "en") => new Intl.NumberFormat(intlLocale(locale)).format(Number(value) || 0);
const paymentMethodLabel = (method, t) => {
  const labels = { cod: "cashOnDelivery", bank: "bankTransfer", card: "cardPayment" };
  return labels[method] ? t(`admin.orders.detail.${labels[method]}`) : method || "—";
};
const shippingMethodLabel = (method, t, methods = [], locale = "en") => {
  const labels = { standard: "standardShipping", express: "expressShipping" };
  if (labels[method]) return t(`admin.orders.page.${labels[method]}`);
  const custom = methods.find((entry) => entry.code === method || String(entry._id) === String(method));
  return custom ? localizedStrictField(custom.name, custom.translations?.name, locale) : method ? String(method).replace(/_/g, " ") : t("common.notProvided");
};

// ✅ Line item product se match karta hai? (String compare — ObjectId vs string safe)
const isProductMatch = (item, productId) =>
  Boolean(productId) && item?.product_id != null && String(item.product_id?._id || item.product_id) === String(productId);

// ✅ Order items ko aise order karo ki filtered product pehle dikhe
const orderItemsForDisplay = (order, productId) => {
  const items = order?.items || [];
  if (!productId) return items;
  const matched = items.filter((it) => isProductMatch(it, productId));
  const rest = items.filter((it) => !isProductMatch(it, productId));
  return [...matched, ...rest];
};

// ✅ Summary panel ka status breakdown — schema ke saath consistent
const SUMMARY_STATUS_KEYS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

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
  paid:     { label: "Paid",     bg: "var(--success-soft)", color: "var(--success-text)", border: "color-mix(in srgb, var(--success) 28%, transparent)" },
  pending:  { label: "Unpaid",   bg: "var(--warning-soft)", color: "var(--warning-text)", border: "color-mix(in srgb, var(--warning) 28%, transparent)" },
  failed:   { label: "Failed",   bg: "var(--danger-soft)",  color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
  refunded: { label: "Refunded", bg: "rgba(100,116,139,0.10)", color: "var(--text-muted)", border: "rgba(100,116,139,0.25)" },
};

const STATUS_ICON_MAP = {
  pending: ClockIcon, confirmed: CheckCircleIcon, processing: BoxIcon,
  shipped: TruckIcon, delivered: HomeIcon, cancelled: XCircleIcon,
};

function getStatusIcon(status) {
  const Icon = STATUS_ICON_MAP[status] || ClockIcon;
  return <Icon className="w-4 h-4 shrink-0" />;
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
    <img src={src} alt={item?.name || "Product"} loading="lazy" onError={() => setFailed(true)}
      className="shrink-0 object-cover rounded-lg"
      style={{ width: `${size}px`, height: `${size}px`, border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }} />
  );
}

/* ==================== ORDER COUNT / PROMO HELPERS ==================== */
// ✅ "Items" ka matlab saaf karo: product lines vs paid units vs free units
const orderItemRows = (order) => (order?.items || []).length;
const orderPaidUnits = (order) =>
  (order?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
const orderFreeUnits = (order) =>
  (order?.items || []).reduce((s, it) => s + (Number(it.free_items) || 0), 0);
const orderDealCount = (order) => (order?.deal_ids || []).length;
const orderBundleCount = (order) => (order?.bundle_ids || []).length;

// Deal type → human-readable label (checkout/cart wali wording)
function dealLabel(item, t) {
  const type = item?.deal_type || "";
  if (type === "buy_x_get_y") {
    const b = Number(item.deal_buy_quantity) || 0;
    const g = Number(item.deal_get_quantity) || 0;
    return b > 0 && g > 0 ? t("admin.orders.page.buyXGetY", { buy: b, get: g }) : t("admin.orders.page.buyXGetYGeneric");
  }
  if (type === "free_shipping") return t("admin.orders.page.freeShipping");
  if (type === "bundle") return item.deal_name || t("admin.orders.page.bundleDeal");
  return item.deal_name || item.discount_name || "";
}

// ✅ Sirf tab label do jab us line par waqai koi deal lagi ho
const itemDealTag = (item, t) => (item?.deal_type ? dealLabel(item, t) : "");

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


function SkeletonRows({ rows = 6 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`skeleton-${i}`} style={{ borderBottom: i < rows - 1 ? "1px solid var(--border-color)" : "none" }}>
          {Array.from({ length: 8 }).map((__, c) => (
            <td key={`skeleton-${i}-${c}`} className="px-6 py-4">
              <div className="h-3.5 rounded animate-pulse motion-reduce:animate-none"
                style={{ backgroundColor: "var(--bg-tertiary)", width: c === 0 ? "16px" : `${45 + ((i * 13 + c * 29) % 45)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
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

function PaymentBadge({ status }) {
  const { t } = useTranslation();
  const item = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      {t(`admin.orders.status.${status === "paid" ? "paid" : status === "refunded" ? "refunded" : status === "failed" ? "failed" : "unpaid"}`)}
    </span>
  );
}

function FilterSelect({ value, onChange, options, width = 160 }) {
  const { t } = useTranslation();
  const filterKeys = { "All Status": "allStatuses", "All Payments": "allPayments", "All Shipping": "allShipping", "All Time": "allTime", Today: "today", Yesterday: "yesterday", "Last 7 days": "last7Days", "Last 30 days": "last30Days", Pending: "status.pending", Confirmed: "status.confirmed", Processing: "status.processing", Shipped: "status.shipped", Delivered: "status.delivered", Cancelled: "status.cancelled", Paid: "status.paid", Unpaid: "status.unpaid", Failed: "status.failed", Standard: "standardShipping", Express: "expressShipping" };
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t("admin.orders.page.filterOrders")}
        className="appearance-none h-9 pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer"
        style={{ width: `${width}px`, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
        {options.map(([val, label]) => (
          <option key={`${val}-${label}`} value={val}>{filterKeys[label]?.startsWith("status.") ? t(`admin.orders.${filterKeys[label]}`) : t(`admin.orders.page.${filterKeys[label] || label}`)}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}

/* ==================== MAIN COMPONENT ==================== */
// ✅ useSearchParams ko Suspense boundary chahiye (production build warna fail hota hai)
export default function OrdersPage() {
  return (
    <React.Suspense fallback={<OrdersFallback />}>
      <OrdersView />
    </React.Suspense>
  );
}

function OrdersFallback() {
  const { t } = useTranslation();
  return (
    <div className="w-full min-h-screen flex items-center justify-center p-10">
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Spinner className="w-4 h-4" /> {t("admin.orders.page.loading")}
      </div>
    </div>
  );
}

function OrdersView() {
  const { t, locale } = useTranslation();
  const { productNameOf, contentOf } = useLocalized();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // ✅ Product filter URL me hota hai — refresh / back button / shareable sab kaam kare
  const productId = searchParams.get("productId") || "";
  const productName = searchParams.get("productName") || "";
  const productFilterActive = Boolean(productId);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [shippingFilter, setShippingFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [jumpTo, setJumpTo] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [actionMenuFor, setActionMenuFor] = useState(null);
  const [bulkCancelConfirm, setBulkCancelConfirm] = useState(false);
  const [cancelIds, setCancelIds] = useState([]);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  const ordersQueryKey = ["admin-orders", page, pageSize, statusFilter, search, paymentFilter, shippingFilter, dateRange, productId];
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ordersQueryKey,
    // ✅ Saare filters backend pe jaate hain — pagination aur counts sahi rehte hain
    queryFn: () => orderApi.getAll({
      page, limit: pageSize, status: statusFilter, search,
      payment: paymentFilter, shipping: shippingFilter, dateRange,
      productId: productId || undefined,
    }),
    retry: 1,
  });

  // ✅ Product URL se badla (dashboard click / back-forward) to page 1 pe wapas —
//    warna page 3 pe stale ya khaali results dikh sakte hain.
//    Render-phase adjust (project convention — same pattern wishlist page me hai),
//    effect me setState se cascading render hota hai.
const [lastProductId, setLastProductId] = useState(productId);
if (lastProductId !== productId) {
  setLastProductId(productId);
  setPage(1);
}

  const debounceRef = useRef(null);
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);
  const handleSearchInput = (value) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(value.trim()); setPage(1); }, 300);
  };

  // ✅ productId bhi count queries me jata hai — stat cards filtered product ke orders dikhate hain
  const buildCountQuery = (key, status) => ({
    queryKey: ["admin-orders-count", key, productId],
    queryFn: () => orderApi.getAll({ page: 1, limit: 1, status, productId: productId || undefined }),
    staleTime: 60 * 1000, retry: false,
  });
  const { data: allCount } = useQuery(buildCountQuery("all", "all"));
  const { data: pendingCount } = useQuery(buildCountQuery("pending", "pending"));
  const { data: shippedCount } = useQuery(buildCountQuery("shipped", "shipped"));
  const { data: deliveredCount } = useQuery(buildCountQuery("delivered", "delivered"));
  const { data: cancelledCount } = useQuery(buildCountQuery("cancelled", "cancelled"));

  // ✅ Product history summary — units/revenue/date range + status breakdown.
  //    NOTE: status filter yahan intentionally pass nahi kiya, warna status
  //    breakdown meaningless ho jata. Baaki filters (search/payment/shipping/time) lagte hain.
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin-product-summary", productId, paymentFilter, shippingFilter, dateRange, search],
    queryFn: () => orderApi.getProductSummary({
      productId,
      status: "all",
      payment: paymentFilter,
      shipping: shippingFilter,
      dateRange,
      search,
    }),
    enabled: productFilterActive,
    staleTime: 60 * 1000,
    retry: false,
  });
  const summary = summaryData?.data;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }) => orderApi.updateStatus(id, { status, ...(notes ? { notes } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
    },
    onError: () => toast.error(t("admin.orders.toast.updateOrderFailed")),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id }) => orderApi.updatePayment(id, { status: "paid" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(t("admin.orders.toast.paymentReceived"));
    },
    onError: () => toast.error(t("admin.orders.toast.paymentFailed")),
  });

  const orders = useMemo(() => data?.data || [], [data]);
  const { data: shippingMethods = [], isLoading: shippingMethodsLoading } = useQuery({ queryKey: ["adminShippingMethods"], queryFn: shippingApi.getMethods, retry: false });
  usePageTranslations({ model: "ShippingMethod", records: shippingMethods, locale, ready: !shippingMethodsLoading, queryKey: ["adminShippingMethods"], queryClient });
  usePageTranslations({ model: "Order", records: orders, locale, ready: !isFetching, queryKey: ordersQueryKey, queryClient });
  const orderProducts = useMemo(() => orders.flatMap((order) => (order.items || []).map((item) => item.product_id).filter((product) => product && typeof product === "object" && product._id)), [orders]);
  usePageTranslations({ model: "Product", records: orderProducts, locale, ready: !isFetching, queryKey: ordersQueryKey, queryClient });
  const orderVariants = useMemo(() => orders.flatMap((order) => (order.items || []).map((item) => item.variant_id).filter((variant) => variant && typeof variant === "object" && variant._id)), [orders]);
  usePageTranslations({ model: "Variant", records: orderVariants, locale, ready: !isFetching, queryKey: ordersQueryKey, queryClient });
  const pagination = data?.pagination || {};
  const total = pagination.total || 0;
  const totalPages = pagination.totalPages || 1;

  // ✅ Payment / shipping / date range / product filters ab BACKEND pe lagte hain
  //    (is liye pagination + counts sahi hain). Yahan sirf sorting hai — wo backend nahi karta.
  const filteredOrders = useMemo(() => {
    const { key, direction } = sortConfig;
    const val = (o) => {
      switch (key) {
        case "order_number": return o.order_number || "";
        case "customer": return (o.address_snapshot?.full_name || o.user_id?.name || "").toLowerCase();
        case "total": return Number(o.total || 0);
        case "payment": return o.payment?.method || "";
        case "status": return o.status || "";
        case "created_at": default: return new Date(o.created_at || 0).getTime();
      }
    };
    return [...orders].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return direction === "asc" ? -1 : 1;
      if (va > vb) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [orders, sortConfig]);

  const startIndex = ((pagination.page || 1) - 1) * pageSize;

  const allSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.includes(o._id));
  const someSelected = filteredOrders.some((o) => selectedIds.includes(o._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : [...new Set([...selectedIds, ...filteredOrders.map((o) => o._id)])]);
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const [bulkBusy, setBulkBusy] = useState(false);
  const runBulkStatus = async (status, ids) => {
    const targets = ids || selectedIds;
    if (!targets.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(targets.map((id) => orderApi.updateStatus(id, { status })));
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(t("admin.orders.toast.bulkStatus", { count: formatNumber(targets.length, locale), status: t(`admin.orders.status.${status}`) }));
      setSelectedIds([]);
      setBulkCancelConfirm(false);
    } catch (error) {
      toast.error(t("admin.orders.toast.bulkUpdateFailed"));
    } finally {
      setBulkBusy(false);
    }
  };
  const openCancelModal = (ids) => { setCancelIds(ids); setCancelReason(""); setBulkCancelConfirm(true); };

  const runCancelWithReason = async () => {
    if (!cancelReason.trim()) return toast.error(t("admin.orders.toast.cancelRequired"));
    if (!cancelIds.length) return;
    setCancelBusy(true);
    try {
      await Promise.all(cancelIds.map((id) => orderApi.updateStatus(id, { status: "cancelled", cancel_reason: cancelReason.trim() })));
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(t("admin.orders.toast.bulkCancelled", { count: formatNumber(cancelIds.length, locale) }));
      setSelectedIds([]); setBulkCancelConfirm(false); setCancelIds([]);
    } catch (error) {
      toast.error(t("admin.orders.toast.bulkCancelFailed"));
    } finally { setCancelBusy(false); }
  };
  const handleSort = (key) => setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));

  const renderPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (page <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (page >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
    return pages;
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  // ✅ Product chip ✕ -> URL se params hatate hain (shareable link + back button theek rehta hai)
  const clearProductFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("productId");
    params.delete("productName");
    setPage(1);
    const qs = params.toString();
    router.replace(`/admin/orders${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const activeFilters = [];
  // ✅ Product chip sabse pehle (wo primary filter hai)
  if (productFilterActive) {
    activeFilters.push({
      key: "product",
      label: t("admin.orders.page.productFilter", { name: productName || t("admin.orders.page.selectedProduct") }),
      clear: clearProductFilter,
    });
  }
  if (search) activeFilters.push({ key: "search", label: `Search: ${search}`, clear: () => { setSearchInput(""); setSearch(""); setPage(1); } });
  if (statusFilter !== "all") activeFilters.push({ key: "status", label: `Status: ${statusFilter}`, clear: () => { setStatusFilter("all"); setPage(1); } });
  if (paymentFilter !== "all") activeFilters.push({ key: "payment", label: `Payment: ${PAYMENT_STATUS_CONFIG[paymentFilter]?.label || paymentFilter}`, clear: () => { setPaymentFilter("all"); setPage(1); } });
  if (shippingFilter !== "all") activeFilters.push({ key: "shipping", label: `Shipping: ${shippingFilter}`, clear: () => { setShippingFilter("all"); setPage(1); } });
  if (dateRange !== "all") activeFilters.push({ key: "date", label: t("admin.orders.page.dateFilter", { date: t(`admin.orders.page.${({ today: "today", yesterday: "yesterday", "7d": "last7Days", "30d": "last30Days" })[dateRange]}`) }), clear: () => { setDateRange("all"); setPage(1); } });
  const clearAllFilters = () => {
    setSearchInput(""); setSearch("");
    setStatusFilter("all"); setPaymentFilter("all");
    setShippingFilter("all"); setDateRange("all");
    setPage(1);
    if (productFilterActive) clearProductFilter();
  };

  const statCards = [
    { title: t("admin.orders.page.totalOrders"), value: allCount?.pagination?.total ?? "—", valueClass: "" },
    { title: t("admin.orders.status.pending"), value: pendingCount?.pagination?.total ?? "—", valueClass: "text-amber-400" },
    { title: t("admin.orders.status.shipped"), value: shippedCount?.pagination?.total ?? "—", valueClass: "text-indigo-400" },
    { title: t("admin.orders.status.delivered"), value: deliveredCount?.pagination?.total ?? "—", valueClass: "text-emerald-400" },
    { title: t("admin.orders.status.cancelled"), value: cancelledCount?.pagination?.total ?? "—", valueClass: "text-red-400" },
  ];

  const openDetailPage = (order) => router.push(`/admin/orders/${order._id}`);

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div aria-live="polite" className="sr-only">
        {selectedIds.length > 0 ? t("admin.orders.page.selectedCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(selectedIds.length) }) : ""}
        {updateStatusMutation.isSuccess ? t("admin.orders.page.retryStatus") : ""}
      </div>

      <div className="w-full space-y-4 sm:space-y-5 p-3 sm:p-4 md:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[22px] sm:text-[24px] leading-7 font-bold tracking-tight">{t("admin.orders.page.title")}</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {isError && (
              <button onClick={() => refetch()} className="h-10 sm:h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90"
                style={{ backgroundColor: "var(--danger, var(--danger))", color: "#fff" }}>
                {t("admin.orders.page.retryLoading")}
              </button>
            )}
          </div>
        </div>

        {/* Stat Cards - Mobile Optimized Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map((stat) => (
            <div key={stat.title} className="rounded-lg p-3 sm:p-4" style={cardStyle}>
              <p className="text-[11px] sm:text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{stat.title}</p>
              <p className={`text-[18px] sm:text-[20px] font-bold mt-1 ${stat.valueClass}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ✅ Product history summary — sirf tab jab product filter active ho */}
        {productFilterActive && (
          <ProductSummaryPanel
            summary={summary}
            loading={summaryLoading}
            productName={productName}
            cardStyle={cardStyle}
          />
        )}

        {/* ===== Professional Toolbar: Search Left, Filters Right ===== */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Wider Search Bar (Left Side) */}
          <div className="relative w-full md:w-[400px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
              <SearchIcon />
            </span>
            <input 
              type="text" 
              placeholder={t("admin.orders.page.searchPlaceholder")}
              value={searchInput} 
              onChange={(e) => handleSearchInput(e.target.value)} 
              aria-label={t("admin.orders.page.search")}
              className="w-full h-9 pl-9 pr-9 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 motion-reduce:transition-none"
              style={inputStyle} 
            />
            {searchInput && (
              <button onClick={() => handleSearchInput("")} aria-label={t("admin.orders.page.clearSearch")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 p-1"
                style={{ color: "var(--text-muted)" }}>
                <CloseIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters (Right Side) */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <FilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[["all", "All Status"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["processing", "Processing"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]]} />
            <FilterSelect width={130} value={paymentFilter} onChange={setPaymentFilter}
              options={[["all", "All Payments"], ["paid", "Paid"], ["pending", "Unpaid"], ["failed", "Failed"]]} />
            <FilterSelect width={140} value={shippingFilter} onChange={setShippingFilter}
              options={[["all", "All Shipping"], ["standard", "Standard"], ["express", "Express"]]} />
            <FilterSelect width={130} value={dateRange} onChange={setDateRange}
              options={[["all", "All Time"], ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]]} />
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <span key={f.key || f.label} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)", color: "var(--success-text)" }}>
                {f.label}
                <button onClick={f.clear} aria-label={t("admin.orders.page.removeFilter", { label: f.label })} className="hover:opacity-70 p-0.5"><XIcon className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-[11px] font-semibold underline underline-offset-2 hover:opacity-80 px-2 py-1"
              style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.clearAll")}</button>
          </div>
        )}

        {/* Bulk Actions - Mobile optimized */}
        {selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-lg px-3 sm:px-4 py-3 sm:py-2.5"
            style={{ backgroundColor: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--success-text)" }}>{t("admin.orders.page.selectedCount", { count: formatNumber(selectedIds.length, locale) })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => runBulkStatus("confirmed")} disabled={bulkBusy}
                className="h-11 sm:h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50 flex-1 sm:flex-none justify-center"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                {bulkBusy ? <Spinner className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />} {t("admin.orders.page.confirm")}
              </button>
              <button onClick={() => runBulkStatus("shipped")} disabled={bulkBusy}
                className="h-11 sm:h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50 flex-1 sm:flex-none justify-center"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                <TruckIcon className="w-3.5 h-3.5" /> {t("admin.orders.status.shipped")}
              </button>
              <button onClick={() => openCancelModal(selectedIds)} disabled={bulkBusy}
                className="h-11 sm:h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50 flex-1 sm:flex-none justify-center"
                style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                <BanIcon className="w-3.5 h-3.5" /> {t("common.cancel")}
              </button>
              <button onClick={() => setSelectedIds([])}
                className="h-11 sm:h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80 flex-1 sm:flex-none justify-center"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                {t("admin.orders.page.clearAll")}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.loading")}</span>
            </div>
            <table className="w-full text-[13px]"><SkeletonRows rows={6} /></table>
          </div>
        ) : isError ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <AlertIcon className="w-8 h-8 opacity-60" />
            <p className="text-sm text-center px-4" style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.loadFailed")}</p>
            <button onClick={() => refetch()} className="h-10 sm:h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{t("admin.orders.page.retry")}</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-2" style={cardStyle}>
            <BoxIcon className="w-8 h-8 mb-1 opacity-50" />
            {/* ✅ Product filter active hai + koi order nahi -> specific message */}
            <p className="text-sm text-center px-4" style={{ color: "var(--text-muted)" }}>
              {productFilterActive
                ? t("admin.orders.page.noProductOrders")
                : activeFilters.length > 0
                  ? t("admin.orders.page.noMatchingOrders")
                  : t("admin.orders.page.noOrders")}
            </p>
            {productFilterActive && (
              <button onClick={clearProductFilter}
                className="mt-2 px-4 h-9 rounded-lg text-[13px] font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                {t("admin.orders.page.showAllOrders")}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE - Hidden on mobile */}
            <div className="hidden md:block rounded-lg border relative" style={cardStyle}>
              {isFetching && !isLoading && (
                <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
                  <div className="h-full w-1/3 animate-pulse motion-reduce:animate-none" style={{ backgroundColor: "var(--accent)" }} />
                </div>
              )}
              <table className="w-full text-[13px] box-border" style={{ tableLayout: "fixed", width: "100%" }}>
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                
                    <th className="w-[36px] px-1 py-3" />
                    <SortHeader label={t("admin.orders.page.orderNumber")} sortKey="order_number" sortConfig={sortConfig} onSort={handleSort} width="12%" />
                    <SortHeader label={t("admin.orders.page.customer")} sortKey="customer" sortConfig={sortConfig} onSort={handleSort} width="16%" />
                    <th className="px-3 py-4 text-left text-[12px] font-semibold uppercase tracking-wider hidden md:table-cell"
                      style={{ color: "var(--text-muted)", width: "28%" }}>{t("admin.orders.page.products")}</th>
                    <SortHeader label={t("admin.orders.page.total")} sortKey="total" sortConfig={sortConfig} onSort={handleSort} align="right" width="12%" />
                    <th className="px-3 py-4 text-center text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell"
                      style={{ color: "var(--text-muted)", width: "9%" }}>{t("admin.orders.page.payment")}</th>
                    <SortHeader label={t("admin.orders.page.status")} sortKey="status" sortConfig={sortConfig} onSort={handleSort} align="center" width="11%" />
                    <SortHeader label={t("admin.orders.page.date")} sortKey="created_at" sortConfig={sortConfig} onSort={handleSort} hidden width="9%" />
                    <th className="w-[80px] px-3 py-4 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap rounded-tr-lg"
                      style={{ color: "var(--text-secondary)" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => {
                    const isSelected = selectedIds.includes(order._id);
                    const isExpanded = expandedRows.includes(order._id);
                    const payStatus = order.payment?.status || "pending";
                    return (
                      <React.Fragment key={order._id}>
                        <tr
                          className="transition cursor-pointer box-border"
                          style={{
                            borderBottom: isExpanded ? "none" : "1px solid var(--border-color)",
                            backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}
                          onClick={() => openDetailPage(order)}
                        >
                        
                          <td className="px-1 py-2.5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setExpandedRows((prev) => isExpanded ? prev.filter((x) => x !== order._id) : [...prev, order._id])}
                              aria-label={t(isExpanded ? "admin.orders.page.collapsePreview" : "admin.orders.page.expandPreview")}
                              aria-expanded={isExpanded}
                              className="p-1 rounded-md hover:bg-white/5 transition motion-reduce:transition-none"
                              style={{ color: "var(--text-muted)" }}>
                              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 align-middle box-border">
                            <p className="font-semibold break-words">{order.order_number}</p>
                          </td>
                          <td className="px-4 py-2.5 align-middle box-border">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                                style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                                {(order.address_snapshot?.full_name || "U").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 leading-snug">
                                <p className="font-medium line-clamp-2 break-words"
                                  title={order.address_snapshot?.full_name || order.user_id?.name || "Unknown"}>
                                  {order.address_snapshot?.full_name || order.user_id?.name || "Unknown"}
                                </p>
                                <p className="text-[11px] mt-0.5 break-words" style={{ color: "var(--text-muted)" }}
                                  title={order.user_id?.email || order.address_snapshot?.phone}>
                                  {order.user_id?.email || order.address_snapshot?.phone}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-middle hidden md:table-cell box-border">
                            <div className="space-y-0.5">
                              {/* ✅ Filtered product ki line pehle + highlight (qty already ×N me dikhta hai) */}
                              {orderItemsForDisplay(order, productId).slice(0, 2).map((item, idx) => {
                                const isMatch = isProductMatch(item, productId);
                                return (
                                <div key={`${order._id}-row-item-${idx}`}
                                  className={`flex items-center gap-1.5 min-w-0 rounded px-1 py-0.5 -mx-1 ${isMatch ? "ring-1" : ""}`}
                                  style={isMatch ? {
                                    backgroundColor: "var(--accent-soft)",
                                    boxShadow: "inset 2px 0 0 var(--accent)",
                                  } : undefined}>
                                  <OrderItemImage item={item} size={22} />
                                  <span className={`truncate text-[12px] min-w-0 ${isMatch ? "font-bold" : ""}`} title={item.name}>{productNameOf(item.product_id) || item.name}</span>
                                  <span className="shrink-0 text-[11px] font-bold whitespace-nowrap" style={{ color: isMatch ? "var(--accent)" : "var(--text-secondary)" }}>
                                    ×{item.qty}
                                  </span>
                                  {itemDealTag(item, t) && (
                                    <span className="shrink-0"><PromoTag tone="warning">{itemDealTag(item, t)}</PromoTag></span>
                                  )}
                                  {Number(item.free_items) > 0 && (
                                  <span className="shrink-0 hidden xl:inline-block"><PromoTag tone="success">{t("admin.orders.page.freeCount", { count: formatNumber(item.free_items, locale) })}</PromoTag></span>
                                  )}
                                  {item.bundle_name && (
                                <span className="shrink-0"><PromoTag tone="info">{t("admin.orders.page.combo")}</PromoTag></span>
                                  )}
                                </div>
                                );
                              })}
                              {orderItemsForDisplay(order, productId).length > 2 && (
                                <p className="text-[10px] pl-[29px]" style={{ color: "var(--text-muted)" }}>
                                  {t("admin.orders.page.moreItems", { count: formatNumber(orderItemsForDisplay(order, productId).length - 2, locale), item: t("admin.orders.page.item") })}
                                </p>
                              )}
                              <p className="text-[10px] pl-[29px]" style={{ color: "var(--text-muted)" }}>
                                {t("admin.orders.page.itemsAndUnits", { items: formatNumber(orderItemRows(order), locale), units: formatNumber(orderPaidUnits(order), locale) })}
                                {orderFreeUnits(order) > 0 ? ` (+${t("admin.orders.page.freeCount", { count: formatNumber(orderFreeUnits(order), locale) })})` : ""}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-right box-border">
                            <p className="font-bold whitespace-nowrap">{formatCurrency(order.total, locale)}</p>
                            {orderFreeUnits(order) > 0 && (
                              <p className="text-[11px] mt-0.5 whitespace-nowrap" style={{ color: "var(--success-text)" }}>
                                {t("admin.orders.page.freeCount", { count: formatNumber(orderFreeUnits(order), locale) })}
                              </p>
                            )}
                            {(order.items || []).some((it) => it.savings > 0) && (
                              <p className="text-[11px] mt-0.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                                {t("admin.orders.page.savedAmount", { amount: formatCurrency((order.items || []).reduce((s, it) => s + Number(it.savings || 0), 0), locale) })}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center hidden lg:table-cell box-border">
                            <div className="inline-flex flex-col items-center gap-1">
                              <PaymentBadge status={payStatus} />
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                                {paymentMethodLabel(order.payment?.method, t)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center box-border"><StatusBadge status={order.status} /></td>
                          <td className="px-4 py-2.5 align-middle text-[13px] whitespace-nowrap hidden lg:table-cell box-border"
                            style={{ color: "var(--text-muted)" }}
                            title={formatDateTime(order.created_at, locale)}>
                            {/* ✅ Product history me exact time chahiye — date + time dikhao */}
                            {productFilterActive ? formatDateTime(order.created_at, locale) : formatDate(order.created_at, locale)}
                          </td>
                          <td className="px-3 py-2.5 align-middle whitespace-nowrap text-right relative box-border" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center">
                              <button
                                onClick={() => setActionMenuFor(actionMenuFor === order._id ? null : order._id)}
                                aria-label={t("admin.orders.page.actionsFor", { number: order.order_number })}
                                aria-haspopup="menu"
                                aria-expanded={actionMenuFor === order._id}
                                className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
                                style={{ color: "var(--text-secondary)" }}>
                                <DotsIcon />
                              </button>
                            </div>
                            {actionMenuFor === order._id && (
                              <>
                                <div className="fixed inset-0 z-20" onClick={() => setActionMenuFor(null)} />
                                <div role="menu" className="absolute right-3 top-12 z-30 w-48 rounded-lg shadow-xl border py-1 text-left"
                                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                                  <MenuItem icon={<EyeIcon />} label={t("admin.shared.action.viewDetails")}
                                    onClick={() => { openDetailPage(order); setActionMenuFor(null); }} />
                                  {order.status === "pending" && (
                                    <MenuItem icon={<CheckIcon />} label={t("admin.orders.detail.confirmOrder")}
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "confirmed" }); setActionMenuFor(null); }} />
                                  )}
                                  {(order.status === "confirmed" || order.status === "processing") && (
                                    <MenuItem icon={<TruckIcon />} label={t("admin.orders.detail.markShipped")}
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "shipped" }); setActionMenuFor(null); }} />
                                  )}
                                  {order.status === "shipped" && (
                                    <MenuItem icon={<HomeIcon />} label={t("admin.orders.detail.markDelivered")}
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "delivered" }); setActionMenuFor(null); }} />
                                  )}
                                  {order.status === "delivered" && order.payment?.method === "cod" && order.payment?.status !== "paid" && (
                                    <MenuItem icon={<BanknoteIcon />} label={t("admin.orders.detail.paymentReceived")}
                                      onClick={() => { updatePaymentMutation.mutate({ id: order._id }); setActionMenuFor(null); }} />
                                  )}
                                  {["pending", "confirmed", "processing", "shipped"].includes(order.status) && (
                                    <MenuItem icon={<BanIcon />} label={t("admin.orders.detail.cancelOrder")} danger
                                      onClick={() => { openCancelModal([order._id]); setActionMenuFor(null); }} />
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
<td colSpan={9} className={`px-6 py-4 box-border ${index === filteredOrders.length - 1 ? "rounded-b-lg" : ""}`}>
                              {/* ✅ Preview summary — kitni lines, kitni units, kya promos */}
                              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                                  {t("admin.orders.page.itemsAndUnits", { items: formatNumber(orderItemRows(order), locale), units: formatNumber(orderPaidUnits(order), locale) })}
                                </span>
                                {orderFreeUnits(order) > 0 && (
                                  <PromoTag tone="success">{t("admin.orders.page.freeCount", { count: formatNumber(orderFreeUnits(order), locale) })}</PromoTag>
                                )}
                                {orderDealCount(order) > 0 && <PromoTag tone="warning">{t("admin.orders.page.dealApplied")}</PromoTag>}
                                {orderBundleCount(order) > 0 && <PromoTag tone="info">{t("admin.orders.page.comboApplied")}</PromoTag>}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                                {/* ✅ Matched product pehle + highlight */}
                                {orderItemsForDisplay(order, productId).map((item, idx) => {
                                  const isMatch = isProductMatch(item, productId);
                                  return (
                                  <div key={`${order._id}-item-${idx}`} className="flex items-start gap-2.5 p-2 rounded-md max-w-full box-border"
                                    style={{
                                      backgroundColor: isMatch ? "var(--accent-soft)" : "var(--bg-card)",
                                      border: `1px solid ${isMatch ? "var(--accent)" : "var(--border-color)"}`,
                                    }}>
                                    <OrderItemImage item={item} size={36} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium truncate" title={item.name}>{productNameOf(item.product_id) || item.name}</p>
                                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                        {t("admin.orders.page.quantityPrice", { quantity: formatNumber(item.qty, locale), price: formatCurrency(item.price, locale) })}{(item.variant_id?.title || item.variantTitle) ? ` · ${contentOf(item.variant_id?.title || item.variantTitle, item.variant_id?.translations?.title)}` : ""}
                                      </p>
                                      {(dealLabel(item, t) || Number(item.free_items) > 0 || item.bundle_name) && (
                                        <p className="flex flex-wrap items-center gap-1 mt-1">
                                          {dealLabel(item, t) && <PromoTag tone="warning">{dealLabel(item, t)}</PromoTag>}
                                          {Number(item.free_items) > 0 && (
                                            <PromoTag tone="success">{t("admin.orders.page.freeCount", { count: formatNumber(item.free_items, locale) })}</PromoTag>
                                          )}
                                          {item.bundle_name && <PromoTag tone="info">{t("admin.orders.page.combo")}</PromoTag>}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS - Optimized for touch */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredOrders.map((order) => {
                const isSelected = selectedIds.includes(order._id);
                const payStatus = order.payment?.status || "pending";
                return (
                  <OrderCard
                    key={order._id}
                    order={order}
                    isSelected={isSelected}
                    payStatus={payStatus}
                    menuOpen={actionMenuFor === order._id}
                    cardStyle={cardStyle}
                    onToggleSelect={() => toggleSelect(order._id)}
                    onOpen={() => openDetailPage(order)}
                    onToggleMenu={() => setActionMenuFor(actionMenuFor === order._id ? null : order._id)}
                    onCloseMenu={() => setActionMenuFor(null)}
                    onViewDetails={() => { openDetailPage(order); setActionMenuFor(null); }}
                    onQuickStatus={(status) => { updateStatusMutation.mutate({ id: order._id, status }); setActionMenuFor(null); }}
                    onCancel={() => { runBulkStatus("cancelled", [order._id]); setActionMenuFor(null); }}
                    onMarkPayment={() => { updatePaymentMutation.mutate({ id: order._id }); setActionMenuFor(null); }}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Pagination - Mobile Optimized */}
        {!isLoading && !isError && total > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-3 sm:p-4" style={cardStyle}>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <p className="text-[12px] text-center sm:text-left" style={{ color: "var(--text-muted)" }}>
                {t("admin.orders.page.showingRange", { from: new Intl.NumberFormat(intlLocale(locale)).format(filteredOrders.length > 0 ? startIndex + 1 : 0), to: new Intl.NumberFormat(intlLocale(locale)).format(Math.min(startIndex + pageSize, total)), total: new Intl.NumberFormat(intlLocale(locale)).format(total) })}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.rows")}</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  aria-label={t("admin.orders.page.rowsPerPage")}
                  className="appearance-none h-9 sm:h-8 pl-2 pr-7 rounded-md text-[12px] outline-none cursor-pointer"
                  style={{ ...inputStyle, backgroundColor: "var(--bg-tertiary)" }}>
                  {[15, 30, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.orders.page.goTo")}</label>
                  <input type="number" min="1" max={totalPages} value={jumpTo}
                    onChange={(e) => setJumpTo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = Number(jumpTo);
                        if (n >= 1 && n <= totalPages) { setPage(n); setJumpTo(""); }
                      }
                    }}
                    aria-label={t("admin.orders.page.jumpToPage")}
                    className="w-16 sm:w-14 h-9 sm:h-8 rounded-md text-[12px] text-center outline-none"
                    style={inputStyle} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-10 w-10 sm:h-8 sm:w-8 rounded-md flex items-center justify-center transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <ChevronLeftIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
              <div className="flex items-center gap-1">
                {renderPageNumbers().map((pageNum, index) =>
                  pageNum === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm hidden sm:inline" style={{ color: "var(--text-muted)" }}>...</span>
                  ) : (
                    <button key={`page-${pageNum}`} type="button" onClick={() => setPage(pageNum)}
                      aria-current={page === pageNum ? "page" : undefined}
                      className="h-10 w-10 sm:h-8 sm:min-w-[32px] sm:px-2 rounded-md text-[13px] font-medium transition hover:opacity-80"
                      style={{
                        backgroundColor: page === pageNum ? "var(--accent)" : "var(--bg-tertiary)",
                        color: page === pageNum ? "var(--accent-text)" : "var(--text-primary)",
                        border: `1px solid ${page === pageNum ? "var(--accent)" : "var(--border-color)"}`,
                      }}>
                      {pageNum}
                    </button>
                  )
                )}
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="h-10 w-10 sm:h-8 sm:w-8 rounded-md flex items-center justify-center transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <ChevronRightIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Modal - Mobile Optimized */}
      {bulkCancelConfirm && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <style>{`@keyframes modalSlideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } } @keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 sm:p-5 shadow-2xl border"
            style={{ ...cardStyle, animation: "modalSlideUp 0.3s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertIcon className="w-5 h-5" style={{ color: "var(--danger, var(--danger))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{t("admin.orders.page.cancelCount", { count: formatNumber(selectedIds.length, locale) })}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {t("admin.orders.page.ordersCancelledList")}{" "}
                  <span className="font-mono">{orders.filter((o) => selectedIds.includes(o._id)).map((o) => o.order_number).slice(0, 4).join(", ")}</span>
                  {selectedIds.length > 4 && ` ${t("admin.orders.page.moreCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(selectedIds.length - 4) })}`}.
                </p>
                <div className="mt-3">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                    {t("admin.orders.page.cancellationReason")} <span style={{ color: "var(--danger-text)" }}>*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                  placeholder={t("admin.orders.page.cancelReasonPlaceholder")}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none resize-none transition focus:ring-1 focus:ring-red-500/40"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button onClick={() => setBulkCancelConfirm(false)} disabled={bulkBusy}
                className="h-11 sm:h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border order-2 sm:order-1"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>{t("common.cancel")}</button>
              <button onClick={runCancelWithReason} disabled={bulkBusy || cancelBusy || !cancelReason.trim()}
                className="h-11 sm:h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2 order-1 sm:order-2"
                style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                {bulkBusy ? <><Spinner className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> {t("admin.orders.page.cancelling")}</> : t("admin.orders.page.confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */

const SUMMARY_STATUS_TONES = {
  pending:    "var(--warning-text)",
  confirmed:  "var(--info-text)",
  processing: "var(--purple-text)",
  shipped:    "var(--indigo-text)",
  delivered:  "var(--success-text)",
  cancelled:  "var(--danger-text)",
};

/* ✅ Product history summary panel — table ke upar, sirf product filter active hone par.
   Units + revenue me CANCELLED orders include nahi hote (frontend note bhi dikhata hai). */
function ProductSummaryPanel({ summary, loading, productName, cardStyle }) {
  const { t, locale } = useTranslation();
  if (loading && !summary) {
    return (
      <div className="rounded-lg p-4" style={cardStyle} aria-busy="true">
        <div className="h-3.5 w-40 rounded animate-pulse motion-reduce:animate-none"
          style={{ backgroundColor: "var(--bg-tertiary)" }} />
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`sum-skeleton-${i}`} className="h-12 rounded animate-pulse motion-reduce:animate-none"
              style={{ backgroundColor: "var(--bg-tertiary)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const stats = [
    { label: t("admin.orders.page.totalOrders"), value: formatNumber(summary.totalOrders ?? 0, locale) },
    { label: t("admin.orders.page.unitsSold"), value: formatNumber(summary.unitsSold ?? 0, locale) },
    { label: t("admin.orders.page.revenue"), value: formatCurrency(summary.revenue ?? 0, locale) },
    { label: t("admin.orders.page.firstOrder"), value: formatDate(summary.firstOrderDate, locale) },
    { label: t("admin.orders.page.latestOrder"), value: formatDate(summary.lastOrderDate, locale) },
  ];

  return (
    <div className="rounded-lg p-4 space-y-3" style={cardStyle}>
      <div className="flex flex-wrap items-center gap-2">
        <PackageIcon className="w-4 h-4" />
        <p className="text-[13px] font-bold">
          {t("admin.orders.page.productHistory")}{productName ? `: ${productName}` : ""}
        </p>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {t("admin.orders.page.acrossAllStatuses")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg p-3"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            <p className="text-[15px] font-bold mt-0.5 truncate" title={String(s.value)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {t("admin.orders.page.byStatus")}
        </span>
        {SUMMARY_STATUS_KEYS.map((key) => (
          <span key={`by-status-${key}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "var(--bg-tertiary)", color: SUMMARY_STATUS_TONES[key] || "var(--text-muted)" }}>
            {key}
            <span className="tabular-nums">{summary.byStatus?.[key] ?? 0}</span>
          </span>
        ))}
      </div>

      {/* ✅ Cancelled exclusion ka clear note (requirement 7) */}
      {summary.cancelledOrders > 0 && (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {t("admin.orders.page.cancelledOrdersExcluded", { count: formatNumber(summary.cancelledOrders, locale), units: formatNumber(summary.cancelledUnits, locale), revenue: formatCurrency(summary.cancelledRevenue ?? 0, locale) })}
        </p>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button role="menuitem" onClick={onClick}
      className={`w-full px-3 py-2.5 sm:py-2 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-white/5 ${danger ? "text-red-400 hover:bg-red-500/10" : ""}`}
      style={{ color: danger ? undefined : "var(--text-primary)" }}>
      {icon} {label}
    </button>
  );
}

function SortHeader({ label, sortKey, sortConfig, onSort, hidden = false, align = "left", width }) {
  const active = sortConfig.key === sortKey;
  return (
    <th className={`px-4 py-4 align-middle ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${hidden ? "hidden lg:table-cell" : ""} box-border`}
      style={{ ...(width ? { width } : {}) }}>
      <button type="button" onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80 ${align === "right" ? "flex-row-reverse" : ""} ${align === "center" ? "mx-auto" : ""}`}
        style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label}
        <svg className={`w-3 h-3 transition ${active ? "" : "opacity-40"} ${active && sortConfig.direction === "desc" ? "rotate-180" : ""} motion-reduce:transition-none`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
    </th>
  );
}

// Mobile Order Card - Optimized for touch
function OrderCard({ order, isSelected, payStatus, menuOpen, cardStyle, onToggleSelect, onOpen, onToggleMenu, onCloseMenu, onViewDetails, onQuickStatus, onCancel, onMarkPayment }) {
  const { t, locale } = useTranslation();
  return (
    <div className="rounded-xl p-4 space-y-3 cursor-pointer transition box-border max-w-full"
      style={cardStyle} onClick={onOpen}>
      {/* Header Section */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
               
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] break-words">{order.order_number}</p>
            <p className="text-[11px] mt-0.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{formatDate(order.created_at, locale)}</p>
          </div>
        </div>
        <div className="shrink-0 pt-0.5"><StatusBadge status={order.status} /></div>
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-3 min-w-0 p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
          style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
          {(order.address_snapshot?.full_name || "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-snug">
          <p className="font-medium text-[13px] break-words line-clamp-2">{order.address_snapshot?.full_name || order.user_id?.name || t("common.notProvided")}</p>
          <p className="text-[11px] mt-0.5 break-words" style={{ color: "var(--text-muted)" }}>{order.user_id?.email || order.address_snapshot?.phone}</p>
        </div>
      </div>

      {/* Items Preview */}
      {(order.items || []).length > 0 && (
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex -space-x-2">
            {(order.items || []).slice(0, 3).map((item, idx) => (
              <div key={`${order._id}-card-item-${idx}`} className="relative">
                <OrderItemImage item={item} size={36} />
              </div>
            ))}
          </div>
          {(order.items || []).length > 3 && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-md ml-1"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
              +{order.items.length - 3}
            </span>
          )}
          <span className="ml-auto text-[11px] whitespace-nowrap font-medium text-right" style={{ color: "var(--text-secondary)" }}>
            {formatNumber(orderItemRows(order), locale)} {t(orderItemRows(order) === 1 ? "admin.orders.page.item" : "admin.orders.page.items")}
            {orderPaidUnits(order) !== orderItemRows(order) && (
              <span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>
                {formatNumber(orderPaidUnits(order), locale)} {t("admin.orders.page.units")}
              </span>
            )}
          </span>
        </div>
      )}

      {/* ✅ Promo tags — deal / combo / free units (mobile card) */}
      {(orderDealCount(order) > 0 || orderBundleCount(order) > 0 || orderFreeUnits(order) > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {orderDealCount(order) > 0 && <PromoTag tone="warning">{t("admin.orders.page.dealApplied")}</PromoTag>}
          {orderBundleCount(order) > 0 && <PromoTag tone="info">{t("admin.orders.page.comboApplied")}</PromoTag>}
          {orderFreeUnits(order) > 0 && <PromoTag tone="success">{t("admin.orders.page.freeCount", { count: formatNumber(orderFreeUnits(order), locale) })}</PromoTag>}
        </div>
      )}

      {/* Payment & Shipping Info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
        <PaymentBadge status={payStatus} />
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {paymentMethodLabel(order.payment?.method, t)} • {shippingMethodLabel(order.shipping_method || "standard", t, shippingMethods, locale)}
        </span>
      </div>

      {/* Footer - Total & Actions */}
      <div className="flex items-center justify-between pt-3 relative" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.orders.detail.totalAmount")}</p>
          <p className="font-bold text-[18px] text-emerald-500">{formatCurrency(order.total, locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleMenu} aria-label={t("admin.orders.page.actions")} aria-haspopup="menu" aria-expanded={menuOpen}
            className="min-w-[48px] min-h-[48px] p-3 rounded-xl transition hover:bg-white/5 flex items-center justify-center"
            style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <DotsIcon className="w-5 h-5" />
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={onCloseMenu} />
            <div role="menu" className="absolute right-4 bottom-16 z-30 w-56 rounded-xl shadow-2xl border py-2 text-left"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <MenuItem icon={<EyeIcon />} label={t("admin.shared.action.viewDetails")} onClick={onViewDetails} />
              {order.status === "pending" && <MenuItem icon={<CheckIcon />} label={t("admin.orders.detail.confirmOrder")} onClick={() => onQuickStatus("confirmed")} />}
              {(order.status === "confirmed" || order.status === "processing") && <MenuItem icon={<TruckIcon />} label={t("admin.orders.detail.markShipped")} onClick={() => onQuickStatus("shipped")} />}
              {order.status === "shipped" && <MenuItem icon={<HomeIcon />} label={t("admin.orders.detail.markDelivered")} onClick={() => onQuickStatus("delivered")} />}
              {order.status === "delivered" && order.payment?.method === "cod" && order.payment?.status !== "paid" && (
                <MenuItem icon={<BanknoteIcon />} label={t("admin.orders.detail.paymentReceived")} onClick={onMarkPayment} />
              )}
              {["pending", "confirmed", "processing", "shipped"].includes(order.status) && (
                <MenuItem icon={<BanIcon />} label={t("admin.orders.detail.cancelOrder")} danger onClick={onCancel} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
