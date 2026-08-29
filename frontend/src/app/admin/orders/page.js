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
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const DownloadIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>);
const XIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>);
const BanIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);
const TruckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1h4a1 1 0 001-1v-3m-9 4a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>);
const BoxIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const AlertIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const ClockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const CheckCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const HomeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h4" /></svg>);
const XCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const RefreshIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>);

/* ==================== HELPERS ==================== */
const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatDateTime = (d) => d ? new Date(d).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

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

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

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

function StatusDropdown({ value, onChange, currentStatus, disabled }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapRef = useRef(null);
  const statuses = Object.keys(ORDER_STATUS_CONFIG);

  const commit = (status) => {
    if (status === currentStatus) { setOpen(false); return; }
    onChange(status);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKey = (e) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        setHighlighted(statuses.indexOf(value));
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, statuses.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (highlighted >= 0) commit(statuses[highlighted]); }
  };

  const selectedCfg = value ? ORDER_STATUS_CONFIG[value] : null;

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} onKeyDown={handleKey}
        aria-haspopup="listbox" aria-expanded={open} aria-label="Select new order status"
        className="h-10 w-full px-3 rounded-md text-sm outline-none flex items-center justify-between gap-2 transition focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
        <span className="flex items-center gap-2 truncate">
          {value && selectedCfg ? (
            <>
              <span style={{ color: selectedCfg.color }}>{getStatusIcon(value)}</span>
              <span className="capitalize">{value}</span>
            </>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>Select new status…</span>
          )}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul role="listbox" aria-label="Available statuses"
            className="absolute z-40 mt-1 w-full rounded-md shadow-xl border py-1 max-h-60 overflow-y-auto"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            {statuses.map((status) => {
              const cfg = ORDER_STATUS_CONFIG[status];
              const isCurrent = status === currentStatus;
              const isHighlighted = highlighted === statuses.indexOf(status);
              return (
                <li key={status}>
                  <button type="button" role="option" aria-selected={value === status} disabled={isCurrent}
                    onClick={() => commit(status)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed ${isHighlighted && !isCurrent ? "bg-white/5" : ""}`}>
                    <span style={{ color: cfg.color }}>{getStatusIcon(status)}</span>
                    <span className="capitalize flex-1" style={{ color: isCurrent ? undefined : cfg.color }}>
                      {isCurrent ? `${status} (current)` : status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                    {value === status && <span style={{ color: "#34d399" }}><CheckIcon className="w-3.5 h-3.5" /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
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
  const [selectedOrder, setSelectedOrder] = useState(null); // ✅ Edit form modal
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
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(`Order marked as ${variables.status}${variables.notes ? " with note" : ""}`);
      const updated = response?.data;
      setSelectedOrder((prev) =>
        prev && prev._id === variables.id
          ? { ...prev, ...(updated || {}), status: variables.status }
          : prev
      );
      setTimeout(() => {
        setSelectedOrder((cur) => (cur && cur._id === variables.id ? null : cur));
      }, 1000);
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

  const exportCsv = () => {
    const rows = [["Order #", "Date", "Customer", "Phone", "City", "Items", "Subtotal", "Shipping", "Tax", "Total", "Payment", "Method", "Status"]];
    filteredOrders.forEach((o) => rows.push([
      o.order_number, formatDate(o.created_at),
      o.address_snapshot?.full_name || "", o.address_snapshot?.phone || "",
      o.address_snapshot?.city || "", o.items?.length || 0,
      o.subtotal ?? "", o.shipping ?? "", o.tax ?? "", o.total ?? "",
      o.payment?.status || "", o.payment?.method || "", o.status,
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-page${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredOrders.length} orders`);
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

  // ✅ Row click → Detail PAGE
  const openDetailPage = (order) => router.push(`/admin/orders/${order._id}`);
  // ✅ Edit icon click → old FORM modal
  const openEditForm = (order) => setSelectedOrder(order);

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
                {bulkBusy ? <Spinner className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />} Verify Selected
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
                    <th className="w-[110px] px-3 py-4 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap rounded-tr-lg"
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
                            <div className="flex justify-end items-center gap-1">
                              {/* ✅ EDIT ICON → opens FORM modal */}
                              <button
                                onClick={() => openEditForm(order)}
                                aria-label={`Edit order ${order.order_number}`}
                                title="Edit Order"
                                className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
                                style={{ color: "var(--text-secondary)" }}>
                                <EditIcon />
                              </button>
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
                                  <MenuItem icon={<EditIcon />} label="Edit Order"
                                    onClick={() => { openEditForm(order); setActionMenuFor(null); }} />
                                  {order.status === "pending" && (
                                    <MenuItem icon={<CheckIcon />} label="Verify"
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "confirmed" }); setActionMenuFor(null); }} />
                                  )}
                                  {(order.status === "confirmed" || order.status === "processing") && (
                                    <MenuItem icon={<TruckIcon />} label="Mark as Shipped"
                                      onClick={() => { updateStatusMutation.mutate({ id: order._id, status: "shipped" }); setActionMenuFor(null); }} />
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
                    onEdit={() => openEditForm(order)}
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

      {/* ✅ EDIT FORM MODAL (purana wala form) */}
      {selectedOrder && (
        <OrderDetailModal
          key={selectedOrder._id}
          order={selectedOrder}
          inputStyle={inputStyle}
          isPending={updateStatusMutation.isPending}
          statusMutation={updateStatusMutation}
          onClose={() => setSelectedOrder(null)}
        />
      )}

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

function OrderCard({ order, isSelected, payStatus, menuOpen, cardStyle, onToggleSelect, onOpen, onEdit, onToggleMenu, onCloseMenu, onViewDetails, onQuickStatus, onCancel }) {
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
          <button onClick={onEdit} aria-label="Edit order" title="Edit"
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-md transition hover:bg-white/5 flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}>
            <EditIcon />
          </button>
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
              <MenuItem icon={<EditIcon />} label="Edit Order" onClick={() => { onEdit(); onCloseMenu(); }} />
              {order.status === "pending" && <MenuItem icon={<CheckIcon />} label="Verify" onClick={() => onQuickStatus("confirmed")} />}
              {(order.status === "confirmed" || order.status === "processing") && <MenuItem icon={<TruckIcon />} label="Mark as Shipped" onClick={() => onQuickStatus("shipped")} />}
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

/* ✅ Order journey stepper */
function StatusStepper({ order }) {
  const cancelled = order.status === "cancelled";
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  return (
    <div className="flex items-start">
      {STATUS_FLOW.map((step, i) => {
        const done = !cancelled && currentIdx >= i;
        const isLast = i === STATUS_FLOW.length - 1;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
              <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 transition"
                style={{
                  backgroundColor: done ? "#10b981" : "transparent",
                  borderColor: done ? "#10b981" : "var(--border-color)",
                  color: "#fff",
                }}>
                {done ? <CheckIcon className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--border-color)" }} />}
              </div>
              <span className="text-[10px] font-semibold capitalize text-center leading-tight"
                style={{ color: done ? "var(--text-primary)" : "var(--text-muted)" }}>
                {step === "pending" ? "Placed" : step}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 mt-3 mx-1 rounded"
                style={{ backgroundColor: !cancelled && currentIdx > i ? "#10b981" : "var(--border-color)" }} />
            )}
          </React.Fragment>
        );
      })}
      {cancelled && (
        <div className="flex flex-col items-center gap-1.5 min-w-[64px] ml-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center border-2"
            style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", color: "#fff" }}>
            <XIcon className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-semibold" style={{ color: "#f87171" }}>Cancelled</span>
        </div>
      )}
    </div>
  );
}

/* ==================== ORDER DETAILS / EDIT FORM MODAL ==================== */
function OrderDetailModal({ order, inputStyle, isPending, statusMutation, onClose }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const [nextStatus, setNextStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const hasUnsavedChanges = nextStatus !== "" || notes.trim() !== "";
  const attemptClose = () => {
    if (hasUnsavedChanges && !isPending) setConfirmDiscard(true);
    else onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); attemptClose(); return; }
    if (e.key === "Tab" && panelRef.current) {
      const focusables = panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const savings = (order.items || []).reduce((s, it) => s + Number(it.savings || 0), 0);
  const payStatus = order.payment?.status || "pending";
  const user = order.user_id || {};

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label={`Order details ${order.order_number}`}
      onMouseDown={(e) => { if (e.target === overlayRef.current) attemptClose(); }}
      onKeyDown={handleKeyDown}>
      <div ref={panelRef} className="w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
        <div className="px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Order {order.order_number}</h3>
              <StatusBadge status={order.status} />
              <PaymentBadge status={payStatus} />
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Placed {formatDateTime(order.created_at)} • {order.items?.length || 0} items • {order.payment?.method?.toUpperCase() || "—"}
            </p>
          </div>
          <button onClick={attemptClose} disabled={isPending} aria-label="Close order details"
            className="p-2 rounded-lg transition disabled:opacity-50 hover:bg-gray-500/10">
            <CloseIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          <div className="rounded-lg p-4 box-border" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <StatusStepper order={order} />
            <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
              {order.status === "cancelled"
                ? `This order was cancelled on ${formatDateTime(order.updated_at)}`
                : `Last updated ${formatDateTime(order.updated_at)}`}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <InfoCard title="Customer">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                    {(order.address_snapshot?.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{order.address_snapshot?.full_name || user.name || "Unknown"}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{user.email || order.address_snapshot?.phone}</p>
                  </div>
                </div>
                {user.email && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>}
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{order.address_snapshot?.phone}</p>
              </InfoCard>

              <InfoCard title="Shipping Address">
                <p className="text-sm leading-relaxed">
                  {order.address_snapshot?.street_address1}
                  {order.address_snapshot?.street_address2 ? `, ${order.address_snapshot.street_address2}` : ""}
                </p>
                <p className="text-sm mt-0.5">
                  {order.address_snapshot?.city}, {order.address_snapshot?.state}{order.address_snapshot?.zip_code ? ` ${order.address_snapshot.zip_code}` : ""}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{order.address_snapshot?.country}</p>
              </InfoCard>

              <InfoCard title="Payment Details">
                <div className="space-y-1.5 text-sm">
                  <p className="capitalize flex justify-between"><span style={{ color: "var(--text-muted)" }}>Method</span><span className="font-semibold">{order.payment?.method || "—"}</span></p>
                  <p className="flex justify-between items-center"><span style={{ color: "var(--text-muted)" }}>Status</span><PaymentBadge status={payStatus} /></p>
                  <p className="capitalize flex justify-between"><span style={{ color: "var(--text-muted)" }}>Delivery</span><span className="font-semibold">{order.shipping_method || "standard"}</span></p>
                </div>
              </InfoCard>
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <table className="w-full text-[13px] box-border" style={{ tableLayout: "fixed", width: "100%" }}>
                  <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Product</th>
                      <th className="w-[52px] px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Qty</th>
                      <th className="w-[92px] px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Price</th>
                      <th className="w-[104px] px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item, idx) => (
                      <tr key={`${order._id}-modal-item-${idx}`}
                        style={{ borderBottom: idx < (order.items?.length || 0) - 1 ? "1px solid var(--border-color)" : "none" }}>
                        <td className="px-3 py-2.5 box-border">
                          <div className="flex items-center gap-3 min-w-0">
                            <OrderItemImage item={item} size={60} />
                            <div className="min-w-0">
                              <p className="font-medium truncate" title={item.name}>{item.name}</p>
                              {(item.variantTitle || item.brand) && (
                                <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                                  {[item.variantTitle, item.brand].filter(Boolean).join(" • ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">{item.qty}</td>
                        <td className="px-3 py-2.5 text-right">
                          {Number(item.savings) > 0 && (
                            <span className="block text-[11px] line-through whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                              Rs. {Number(item.original_price || 0).toLocaleString()}
                            </span>
                          )}
                          <span className="whitespace-nowrap">Rs. {item.price?.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold"><span className="whitespace-nowrap">Rs. {(item.price * item.qty)?.toLocaleString()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg p-4 space-y-1.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <TotalRow label="Subtotal" value={`Rs. ${order.subtotal?.toLocaleString()}`} />
                {savings > 0 && <TotalRow label="Discount savings" value={`− Rs. ${savings.toLocaleString()}`} accent="#34d399" />}
                <TotalRow label="Shipping" value={`Rs. ${order.shipping?.toLocaleString()}`} />
                <TotalRow label="Tax" value={`Rs. ${order.tax?.toLocaleString()}`} />
                <div className="flex justify-between text-base font-bold pt-2 mt-1" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <span>Grand Total</span>
                  <span className="text-emerald-500">Rs. {order.total?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {order.notes && (
            <InfoCard title="Customer Notes">
              <p className="text-sm whitespace-pre-line">{order.notes}</p>
            </InfoCard>
          )}

          {/* ✅ UPDATE STATUS FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nextStatus || isPending) return;
              statusMutation.mutate(
                { id: order._id, status: nextStatus, notes: notes.trim() },
                { onSuccess: () => { setNextStatus(""); setNotes(""); } }
              );
            }}
            className="rounded-xl p-5 space-y-4"
            style={{ backgroundColor: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#34d399" }}>
                <RefreshIcon />
              </div>
              <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#34d399" }}>
                Update Order Status
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium">
                  New Status <span className="text-red-500">*</span>
                </label>
                <StatusDropdown value={nextStatus} onChange={setNextStatus} currentStatus={order.status} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="order-status-note" className="block text-xs font-medium">
                  Note (optional)
                </label>
                <input id="order-status-note" type="text" value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Customer confirmed by phone"
                  maxLength={300}
                  className="h-10 w-full px-3 rounded-md text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/20 motion-reduce:transition-none"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                {notes && (
                  <p className="text-[10px] text-right" style={{ color: "var(--text-muted)" }}>{notes.length}/300</p>
                )}
              </div>
            </div>

            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Select a status and click Apply to update the order.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3"
              style={{ borderTop: "1px solid rgba(16,185,129,0.25)" }}>
              <button type="button"
                onClick={() => { setNextStatus(""); setNotes(""); }}
                disabled={(!nextStatus && !notes) || isPending}
                className="h-10 px-5 rounded-md text-sm font-medium transition hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                Reset
              </button>
              <button type="submit" disabled={!nextStatus || isPending}
                className="h-11 px-6 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 motion-reduce:transition-none"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                {isPending ? (<><Spinner className="w-4 h-4" /> Updating...</>) : (<><CheckIcon className="w-4 h-4" /> Apply Update</>)}
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirmDiscard && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl border"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)", animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                <AlertIcon className="w-5 h-5" style={{ color: "#fbbf24" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Discard unsaved changes?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  You have selected a new status or typed a note that has not been applied yet.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirmDiscard(false)}
                className="flex-1 h-9 rounded-md text-sm font-medium transition hover:opacity-80 border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>
                Keep Editing
              </button>
              <button onClick={() => { setConfirmDiscard(false); onClose(); }}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: "var(--danger, #ef4444)" }}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
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