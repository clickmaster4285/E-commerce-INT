"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderApi } from "@/apis/admin/orderApi";

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
const AlertIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const ClockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const CheckCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const HomeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h4" /></svg>);
const XCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);

/* ==================== HELPERS ==================== */
const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

const API_BASE = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "";

const getImageUrl = (itemOrPath) => {
  const img = typeof itemOrPath === "string" ? itemOrPath : itemOrPath?.image || itemOrPath?.product_image || "";
  if (!img) return null;
  if (img.startsWith("http") || img.startsWith("blob:") || img.startsWith("data:")) return img;
  return `${API_BASE}/${img.replace(/^\/+/, "")}`;
};

const ORDER_STATUS_CONFIG = {
  pending:    { bg: "rgba(245,158,11,0.10)",  color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
  confirmed:  { bg: "rgba(59,130,246,0.10)",  color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  processing: { bg: "rgba(168,85,247,0.10)",  color: "#c084fc", border: "rgba(168,85,247,0.25)" },
  shipped:    { bg: "rgba(99,102,241,0.10)",  color: "#818cf8", border: "rgba(99,102,241,0.25)" },
  delivered:  { bg: "rgba(16,185,129,0.10)",  color: "#34d399", border: "rgba(16,185,129,0.25)" },
  cancelled:  { bg: "rgba(239,68,68,0.10)",   color: "#f87171", border: "rgba(239,68,68,0.25)" },
};

const PAYMENT_STATUS_CONFIG = {
  paid:     { label: "Paid",     bg: "rgba(16,185,129,0.10)", color: "#34d399", border: "rgba(16,185,129,0.25)" },
  pending:  { label: "Unpaid",   bg: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
  failed:   { label: "Failed",   bg: "rgba(239,68,68,0.10)",  color: "#f87171", border: "rgba(239,68,68,0.25)" },
  refunded: { label: "Refunded", bg: "rgba(100,116,139,0.10)", color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
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
  const item = ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.pending;
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      {status}
    </span>
  );
}

function PaymentBadge({ status }) {
  const item = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      {item.label}
    </span>
  );
}

function FilterSelect({ value, onChange, options, width = 160 }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter orders"
        className="appearance-none h-9 pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer"
        style={{ width: `${width}px`, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
        {options.map(([val, label]) => (
          <option key={`${val}-${label}`} value={val}>{label}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}

/* ==================== MAIN COMPONENT ==================== */
export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-orders", page, pageSize, statusFilter, search],
    queryFn: () => orderApi.getAll({ page, limit: pageSize, status: statusFilter, search }),
    retry: 1,
  });

  const debounceRef = useRef(null);
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);
  const handleSearchInput = (value) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(value.trim()); setPage(1); }, 300);
  };

  const buildCountQuery = (key, status) => ({
    queryKey: ["admin-orders-count", key],
    queryFn: () => orderApi.getAll({ page: 1, limit: 1, status }),
    staleTime: 60 * 1000, retry: false,
  });
  const { data: allCount } = useQuery(buildCountQuery("all", "all"));
  const { data: pendingCount } = useQuery(buildCountQuery("pending", "pending"));
  const { data: shippedCount } = useQuery(buildCountQuery("shipped", "shipped"));
  const { data: deliveredCount } = useQuery(buildCountQuery("delivered", "delivered"));
  const { data: cancelledCount } = useQuery(buildCountQuery("cancelled", "cancelled"));

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }) => orderApi.updateStatus(id, { status, ...(notes ? { notes } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Failed to update order"),
  });

  const orders = useMemo(() => data?.data || [], [data]);
  const pagination = data?.pagination || {};
  const total = pagination.total || 0;
  const totalPages = pagination.totalPages || 1;

  const filteredOrders = useMemo(() => {
    let arr = orders;
    if (paymentFilter !== "all") arr = arr.filter((o) => (o.payment?.status || "pending") === paymentFilter);
    if (shippingFilter !== "all") arr = arr.filter((o) => (o.shipping_method || "standard") === shippingFilter);
    if (dateRange !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      arr = arr.filter((o) => {
        const d = new Date(o.created_at);
        switch (dateRange) {
          case "today": return d >= startOfToday;
          case "yesterday": { const y = new Date(startOfToday); y.setDate(y.getDate() - 1); return d >= y && d < startOfToday; }
          case "7d": { const c = new Date(startOfToday); c.setDate(c.getDate() - 7); return d >= c; }
          case "30d": { const c = new Date(startOfToday); c.setDate(c.getDate() - 30); return d >= c; }
          default: return true;
        }
      });
    }
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
    return [...arr].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return direction === "asc" ? -1 : 1;
      if (va > vb) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [orders, paymentFilter, shippingFilter, dateRange, sortConfig]);

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
      toast.success(`${targets.length} order${targets.length > 1 ? "s" : ""} marked as ${status}`);
      setSelectedIds([]);
      setBulkCancelConfirm(false);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
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

  const activeFilters = [];
  if (search) activeFilters.push({ label: `Search: ${search}`, clear: () => { setSearchInput(""); setSearch(""); setPage(1); } });
  if (statusFilter !== "all") activeFilters.push({ label: `Status: ${statusFilter}`, clear: () => { setStatusFilter("all"); setPage(1); } });
  if (paymentFilter !== "all") activeFilters.push({ label: `Payment: ${PAYMENT_STATUS_CONFIG[paymentFilter]?.label || paymentFilter}`, clear: () => setPaymentFilter("all") });
  if (shippingFilter !== "all") activeFilters.push({ label: `Shipping: ${shippingFilter}`, clear: () => setShippingFilter("all") });
  if (dateRange !== "all") activeFilters.push({ label: `Date: ${({ today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days" })[dateRange]}`, clear: () => setDateRange("all") });
  const clearAllFilters = () => {
    setSearchInput(""); setSearch("");
    setStatusFilter("all"); setPaymentFilter("all");
    setShippingFilter("all"); setDateRange("all");
    setPage(1);
  };

  const statCards = [
    { title: "Total Orders", value: allCount?.pagination?.total ?? "—", valueClass: "" },
    { title: "Pending", value: pendingCount?.pagination?.total ?? "—", valueClass: "text-amber-400" },
    { title: "Shipped", value: shippedCount?.pagination?.total ?? "—", valueClass: "text-indigo-400" },
    { title: "Delivered", value: deliveredCount?.pagination?.total ?? "—", valueClass: "text-emerald-400" },
    { title: "Cancelled", value: cancelledCount?.pagination?.total ?? "—", valueClass: "text-red-400" },
  ];

  // ✅ Row/card click → Detail PAGE
  const openDetailPage = (order) => router.push(`/admin/orders/${order._id}`);

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div aria-live="polite" className="sr-only">
        {selectedIds.length > 0 ? `${selectedIds.length} orders selected` : ""}
        {updateStatusMutation.isSuccess ? "Order status updated" : ""}
      </div>

      <div className="w-full space-y-5 p-4 md:p-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight">Order Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Track, verify, and fulfil customer orders</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {isError && (
              <button onClick={() => refetch()} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90"
                style={{ backgroundColor: "var(--danger, #ef4444)", color: "#fff" }}>
                Retry Loading
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {statCards.map((stat) => (
            <div key={stat.title} className="rounded-lg p-4" style={cardStyle}>
              <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{stat.title}</p>
              <p className={`text-[20px] font-bold mt-1 ${stat.valueClass}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search order #, customer name or phone..."
            value={searchInput} onChange={(e) => handleSearchInput(e.target.value)} aria-label="Search orders"
            className="w-full h-10 pl-9 pr-9 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 motion-reduce:transition-none"
            style={inputStyle} />
          {searchInput && (
            <button onClick={() => handleSearchInput("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              style={{ color: "var(--text-muted)" }}>
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[["all", "All Status"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["processing", "Processing"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]]} />
          <FilterSelect width={140} value={paymentFilter} onChange={setPaymentFilter}
            options={[["all", "All Payments"], ["paid", "Paid"], ["pending", "Unpaid"], ["failed", "Failed"]]} />
          <FilterSelect width={150} value={shippingFilter} onChange={setShippingFilter}
            options={[["all", "All Shipping"], ["standard", "Standard"], ["express", "Express"]]} />
          <FilterSelect width={150} value={dateRange} onChange={setDateRange}
            options={[["all", "All Time"], ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]]} />
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <span key={f.label} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}>
                {f.label}
                <button onClick={f.clear} aria-label={`Remove filter ${f.label}`} className="hover:opacity-70"><XIcon className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-[11px] font-semibold underline underline-offset-2 hover:opacity-80"
              style={{ color: "var(--text-muted)" }}>Clear all</button>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2.5"
            style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} order{selectedIds.length > 1 ? "s" : ""} selected</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => runBulkStatus("confirmed")} disabled={bulkBusy}
                className="h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                {bulkBusy ? <Spinner className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />} Confirm Selected
              </button>
              <button onClick={() => runBulkStatus("shipped")} disabled={bulkBusy}
                className="h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                <TruckIcon className="w-3.5 h-3.5" /> Mark as Shipped
              </button>
              <button onClick={() => setBulkCancelConfirm(true)} disabled={bulkBusy}
                className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--danger, #ef4444)" }}>
                <BanIcon className="w-3.5 h-3.5" /> Cancel Selected
              </button>
              <button onClick={() => setSelectedIds([])}
                className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                Clear selection
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading orders...</span>
            </div>
            <table className="w-full text-[13px]"><SkeletonRows rows={6} /></table>
          </div>
        ) : isError ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <AlertIcon className="w-8 h-8 opacity-60" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Failed to load orders. Please check your connection.</p>
            <button onClick={() => refetch()} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Retry</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center" style={cardStyle}>
            <BoxIcon className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search || statusFilter !== "all" || activeFilters.length > 0 ? "No orders match your filters" : "No orders yet"}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block rounded-lg border relative" style={cardStyle}>
              {isFetching && !isLoading && (
                <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
                  <div className="h-full w-1/3 animate-pulse motion-reduce:animate-none" style={{ backgroundColor: "var(--accent)" }} />
                </div>
              )}
              <table className="w-full text-[13px] box-border" style={{ tableLayout: "fixed", width: "100%" }}>
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="w-[44px] px-3 py-4 align-middle rounded-tl-lg">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={toggleSelectAll} aria-label="Select all orders on this page"
                          className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                      </div>
                    </th>
                    <th className="w-[36px] px-1 py-4" />
                    <SortHeader label="Order #" sortKey="order_number" sortConfig={sortConfig} onSort={handleSort} width="14%" />
                    <SortHeader label="Customer" sortKey="customer" sortConfig={sortConfig} onSort={handleSort} width="24%" />
                    <th className="px-4 py-4 text-right text-[12px] font-semibold uppercase tracking-wider hidden md:table-cell"
                      style={{ color: "var(--text-muted)", width: "9%" }}>Items</th>
                    <SortHeader label="Total" sortKey="total" sortConfig={sortConfig} onSort={handleSort} align="right" width="13%" />
                    <th className="px-4 py-4 text-center text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell"
                      style={{ color: "var(--text-muted)", width: "10%" }}>Payment</th>
                    <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} align="center" width="12%" />
                    <SortHeader label="Date" sortKey="created_at" sortConfig={sortConfig} onSort={handleSort} hidden width="9%" />
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
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}
                          onClick={() => openDetailPage(order)}
                        >
                          <td className="px-3 py-4 align-middle box-border" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-center">
                              <input type="checkbox" checked={isSelected}
                                onChange={() => toggleSelect(order._id)}
                                aria-label={`Select order ${order.order_number}`}
                                className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                            </div>
                          </td>
                          <td className="px-1 py-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setExpandedRows((prev) => isExpanded ? prev.filter((x) => x !== order._id) : [...prev, order._id])}
                              aria-label={isExpanded ? "Collapse items preview" : "Expand items preview"}
                              aria-expanded={isExpanded}
                              className="p-1 rounded-md hover:bg-white/5 transition motion-reduce:transition-none"
                              style={{ color: "var(--text-muted)" }}>
                              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                          <td className="px-4 py-4 align-middle box-border">
                            <p className="font-semibold break-words">{order.order_number}</p>
                          </td>
                          <td className="px-4 py-4 align-middle box-border">
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
                          <td className="px-4 py-4 align-middle text-right whitespace-nowrap hidden md:table-cell box-border"
                            style={{ color: "var(--text-secondary)" }}>
                            {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? "" : "s"}
                          </td>
                          <td className="px-4 py-4 align-middle text-right box-border">
                            <p className="font-bold whitespace-nowrap">Rs. {order.total?.toLocaleString()}</p>
                            {(order.items || []).some((it) => it.savings > 0) && (
                              <p className="text-[11px] mt-0.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                                saved Rs. {(order.items || []).reduce((s, it) => s + Number(it.savings || 0), 0).toLocaleString()}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-4 align-middle text-center hidden lg:table-cell box-border">
                            <div className="inline-flex flex-col items-center gap-1">
                              <PaymentBadge status={payStatus} />
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                                {order.payment?.method || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-4 align-middle text-center box-border"><StatusBadge status={order.status} /></td>
                          <td className="px-4 py-4 align-middle text-[13px] whitespace-nowrap hidden lg:table-cell box-border"
                            style={{ color: "var(--text-muted)" }}>
                            {formatDate(order.created_at)}
                          </td>
                          <td className="px-3 py-4 align-middle whitespace-nowrap text-right relative box-border" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center">
                              <button
                                onClick={() => setActionMenuFor(actionMenuFor === order._id ? null : order._id)}
                                aria-label={`Actions for order ${order.order_number}`}
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
                                  <MenuItem icon={<EyeIcon />} label="View Details"
                                    onClick={() => { openDetailPage(order); setActionMenuFor(null); }} />
                                  {order.status === "pending" && (
                                    <MenuItem icon={<CheckIcon />} label="Confirm Order"
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "confirmed" }); setActionMenuFor(null); }} />
                                  )}
                                  {(order.status === "confirmed" || order.status === "processing") && (
                                    <MenuItem icon={<TruckIcon />} label="Mark as Shipped"
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "shipped" }); setActionMenuFor(null); }} />
                                  )}
                                  {order.status === "shipped" && (
                                    <MenuItem icon={<HomeIcon />} label="Mark as Delivered"
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "delivered" }); setActionMenuFor(null); }} />
                                  )}
                                  {["pending", "confirmed", "processing", "shipped"].includes(order.status) && (
                                    <MenuItem icon={<BanIcon />} label="Cancel Order" danger
                                      onClick={() => { runBulkStatus("cancelled", [order._id]); setActionMenuFor(null); }} />
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                            <td colSpan={10} className={`px-6 py-4 box-border ${index === filteredOrders.length - 1 ? "rounded-b-lg" : ""}`}>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                                {(order.items || []).map((item, idx) => (
                                  <div key={`${order._id}-item-${idx}`} className="flex items-center gap-2.5 p-2 rounded-md max-w-full box-border"
                                    style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                    <OrderItemImage item={item} size={36} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium truncate" title={item.name}>{item.name}</p>
                                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                        Qty {item.qty} × Rs. {item.price?.toLocaleString()}{item.variantTitle ? ` • ${item.variantTitle}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                ))}
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

            {/* MOBILE CARDS */}
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
                  />
                );
              })}
            </div>
          </>
        )}

        {!isLoading && !isError && total > 0 && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                Showing {filteredOrders.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + pageSize, total)} of {total} orders
              </p>
              <div className="flex items-center gap-2">
                <label className="text-[12px]" style={{ color: "var(--text-muted)" }}>Rows:</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  aria-label="Rows per page"
                  className="appearance-none h-8 pl-2 pr-7 rounded-md text-[12px] outline-none cursor-pointer"
                  style={{ ...inputStyle, backgroundColor: "var(--bg-tertiary)" }}>
                  {[15, 30, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-[12px]" style={{ color: "var(--text-muted)" }}>Go to:</label>
                  <input type="number" min="1" max={totalPages} value={jumpTo}
                    onChange={(e) => setJumpTo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = Number(jumpTo);
                        if (n >= 1 && n <= totalPages) { setPage(n); setJumpTo(""); }
                      }
                    }}
                    aria-label="Jump to page"
                    className="w-14 h-8 rounded-md text-[12px] text-center outline-none"
                    style={inputStyle} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 w-8 rounded-md flex items-center justify-center transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {renderPageNumbers().map((pageNum, index) =>
                  pageNum === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span>
                  ) : (
                    <button key={`page-${pageNum}`} type="button" onClick={() => setPage(pageNum)}
                      aria-current={page === pageNum ? "page" : undefined}
                      className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80"
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
                className="h-8 w-8 rounded-md flex items-center justify-center transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {bulkCancelConfirm && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full max-w-md rounded-xl p-5 shadow-2xl border"
            style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertIcon className="w-5 h-5" style={{ color: "var(--danger, #ef4444)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Cancel {selectedIds.length} order{selectedIds.length > 1 ? "s" : ""}?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Orders will be marked as cancelled:{" "}
                  <span className="font-mono">{orders.filter((o) => selectedIds.includes(o._id)).map((o) => o.order_number).slice(0, 4).join(", ")}</span>
                  {selectedIds.length > 4 && ` +${selectedIds.length - 4} more`}.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setBulkCancelConfirm(false)} disabled={bulkBusy}
                className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>Cancel</button>
              <button onClick={() => runBulkStatus("cancelled")} disabled={bulkBusy}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger, #ef4444)" }}>
                {bulkBusy ? <><Spinner className="w-3.5 h-3.5" /> Cancelling...</> : "Yes, Cancel Orders"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button role="menuitem" onClick={onClick}
      className={`w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-white/5 ${danger ? "text-red-400 hover:bg-red-500/10" : ""}`}
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

function OrderCard({ order, isSelected, payStatus, menuOpen, cardStyle, onToggleSelect, onOpen, onToggleMenu, onCloseMenu, onViewDetails, onQuickStatus, onCancel }) {
  return (
    <div className="rounded-lg p-4 space-y-3 cursor-pointer transition box-border max-w-full"
      style={cardStyle} onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect}
            aria-label={`Select order ${order.order_number}`}
            className="w-4 h-4 rounded cursor-pointer shrink-0" style={{ accentColor: "var(--accent)" }} />
          <div className="min-w-0">
            <p className="font-semibold break-words">{order.order_number}</p>
            <p className="text-[11px] mt-0.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{formatDate(order.created_at)}</p>
          </div>
        </div>
        <div className="shrink-0 pt-0.5"><StatusBadge status={order.status} /></div>
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
          {(order.address_snapshot?.full_name || "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 leading-snug">
          <p className="font-medium break-words line-clamp-2">{order.address_snapshot?.full_name || order.user_id?.name || "Unknown"}</p>
          <p className="text-[11px] mt-0.5 break-words" style={{ color: "var(--text-muted)" }}>{order.user_id?.email || order.address_snapshot?.phone}</p>
        </div>
      </div>

      {(order.items || []).length > 0 && (
        <div className="flex items-center gap-2 overflow-hidden">
          {(order.items || []).slice(0, 4).map((item, idx) => (
            <OrderItemImage key={`${order._id}-card-item-${idx}`} item={item} size={32} />
          ))}
          {(order.items || []).length > 4 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
              +{order.items.length - 4}
            </span>
          )}
          <span className="ml-auto text-[11px] whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PaymentBadge status={payStatus} />
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {order.payment?.method || "—"} • {order.shipping_method || "standard"}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 relative" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total</p>
          <p className="font-bold text-emerald-500">Rs. {order.total?.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleMenu} aria-label="Actions" aria-haspopup="menu" aria-expanded={menuOpen}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-md transition hover:bg-white/5 flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}>
            <DotsIcon />
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={onCloseMenu} />
            <div role="menu" className="absolute right-3 bottom-12 z-30 w-48 rounded-lg shadow-xl border py-1 text-left"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <MenuItem icon={<EyeIcon />} label="View Details" onClick={onViewDetails} />
              {order.status === "pending" && <MenuItem icon={<CheckIcon />} label="Confirm Order" onClick={() => onQuickStatus("confirmed")} />}
              {(order.status === "confirmed" || order.status === "processing") && <MenuItem icon={<TruckIcon />} label="Mark as Shipped" onClick={() => onQuickStatus("shipped")} />}
              {order.status === "shipped" && <MenuItem icon={<HomeIcon />} label="Mark as Delivered" onClick={() => onQuickStatus("delivered")} />}
              {["pending", "confirmed", "processing", "shipped"].includes(order.status) && (
                <MenuItem icon={<BanIcon />} label="Cancel Order" danger onClick={onCancel} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}