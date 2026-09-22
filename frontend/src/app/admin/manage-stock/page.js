"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockApi } from "../../../apis/admin/stockApi";
import { toast } from "sonner";
import { useStockSocketSync } from "@/hooks/useStockSocketSync";

/* ================= Icons ================= */
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const ListIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const BoxIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const AlertTriangleIcon = () => (
  <svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3.732 1.732 3z" />
  </svg>
);
const InfoIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

/* ================= Helpers ================= */
const getInitials = (name) => {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
};

const getStockStatus = (item) => {
  const qty = Number(item.quantity ?? 0);
  const min = Number(item.min_qnt ?? 0);
  if (qty === 0) return "out";
  if (qty <= min) return "low";
  return "in";
};

const STATUS_META = {
  in: { label: "In Stock", color: "var(--success-text)", backgroundColor: "var(--success-soft)" },
  low: { label: "Low Stock", color: "var(--warning)", backgroundColor: "var(--warning-soft)" },
  out: { label: "Out of Stock", color: "var(--danger)", backgroundColor: "var(--danger-soft)" },
};

const ADD_REASONS = ["New Purchase", "Customer Return", "Inventory Correction", "Supplier Bonus"];
const REMOVE_REASONS = ["Sale / Order Fulfillment", "Damaged / Defective", "Expired", "Lost / Stolen", "Internal Use / Sample"];

const formatDateTime = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

/* ================= Small Components ================= */
const Avatar = ({ name, size = "w-8 h-8" }) => (
  <div className={`${size} rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`} style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
    {getInitials(name)}
  </div>
);

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.in;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] px-2 py-1 rounded-md whitespace-nowrap" style={{ backgroundColor: meta.backgroundColor, color: meta.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
};

// ✅ UPDATED: Mobile optimized TabButton
const TabButton = ({ value, label, icon, active, onSelect }) => (
  <button 
    type="button" 
    onClick={() => onSelect(value)} 
    className="h-10 sm:h-9 px-3 sm:px-4 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 text-[12px] sm:text-[13px] font-semibold transition flex-1 sm:flex-none min-w-[140px] sm:min-w-0" 
    style={active ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
  >
    {icon} 
    <span className="truncate">{label}</span>
  </button>
);

const FilterPill = ({ value, label, count, active, onSelect }) => (
  <button type="button" onClick={() => onSelect(value)} className="h-9 sm:h-8 px-3 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5" style={active ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
    {label}
    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={active ? { backgroundColor: "rgba(255,255,255,0.2)" } : { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
      {count}
    </span>
  </button>
);

/* ================= Main Component ================= */
export default function ManageStockPage() {
  const queryClient = useQueryClient();
  useStockSocketSync();

  const [tab, setTab] = useState("stock");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [adjustTarget, setAdjustTarget] = useState(null);
  
  const [adjustForm, setAdjustForm] = useState({
    type: "add",
    quantity: "",
    reason: "",
    customReason: "",
  });

  const [adjustError, setAdjustError] = useState("");
  const [detailsTarget, setDetailsTarget] = useState(null);
  const itemsPerPage = 20;

  const dropdownRef = useRef(null);
  const [isReasonOpen, setIsReasonOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsReasonOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: paginatedStockData, isLoading: loading, isError, error } = useQuery({
    queryKey: ["stock", "paginated", currentPage, search, statusFilter],
    queryFn: () => stockApi.getAllPaginated({ page: currentPage, limit: itemsPerPage, search, status: statusFilter }),
    retry: false,
  });
  const stockItems = paginatedStockData?.items || paginatedStockData || [];
  const stockPagination = paginatedStockData?.pagination || { total: stockItems.length, page: currentPage, limit: itemsPerPage, pages: 1, hasNext: false, hasPrev: false };

  const { data: paginatedHistoryData, isLoading: historyLoading } = useQuery({
    queryKey: ["stock-history", "paginated", historyPage],
    queryFn: () => stockApi.getHistoryPaginated({ page: historyPage, limit: itemsPerPage }),
    enabled: tab === "history",
  });
  const historyItems = paginatedHistoryData?.items || paginatedHistoryData || [];
  const historyPagination = paginatedHistoryData?.pagination || { total: historyItems.length, page: historyPage, limit: itemsPerPage, pages: 1, hasNext: false, hasPrev: false };

  const adjustMutation = useMutation({
    mutationFn: (data) => stockApi.adjust(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-history"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(res?.message || "Stock adjusted successfully");
      closeAdjustModal();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || "Stock adjustment failed";
      setAdjustError(msg);
    },
  });

  // ===== Stock Details Drawer: variant-specific history (existing API reuse) =====
  const { data: detailsHistoryData, isLoading: detailsHistoryLoading, isError: detailsHistoryError } = useQuery({
    queryKey: ["stock-history", "variant", detailsTarget?._id],
    queryFn: () => stockApi.getHistoryPaginated({ page: 1, limit: 50, variantId: detailsTarget._id }),
    enabled: !!detailsTarget?._id,
  });
  const detailsHistory = detailsHistoryData?.items || detailsHistoryData || [];

  const openDetails = (item) => setDetailsTarget(item);
  const closeDetails = () => setDetailsTarget(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && detailsTarget) closeDetails(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailsTarget]);

    const summary = useMemo(() => {
    // Current page counts
    let pageInStock = 0, pageLowStock = 0, pageOutOfStock = 0;
    stockItems.forEach((item) => {
      const s = getStockStatus(item);
      if (s === "in") pageInStock++; else if (s === "low") pageLowStock++; else pageOutOfStock++;
    });
    
    // Use server pagination total for accurate counts
    const totalVariants = stockPagination?.total || stockItems.length;
    const totalProducts = stockPagination?.totalProducts || new Set(stockItems.map((i) => String(i.product_id))).size;
    
    return {
      totalVariants,
      totalProducts,
      // These are current page counts (backend should return totals for accurate stats)
      inStock: pageInStock,
      lowStock: pageLowStock,
      outOfStock: pageOutOfStock,
      isPageSpecific: true, // Flag to show note
    };
  }, [stockItems, stockPagination]);

  const searchedItems = useMemo(() => {
    const text = search.toLowerCase().trim();
    if (!text) return stockItems;
    return stockItems.filter((item) => 
      item.product_name?.toLowerCase().includes(text) || 
      item.sku?.toLowerCase().includes(text) || 
      item.title?.toLowerCase().includes(text)
    );
  }, [stockItems, search]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return searchedItems;
    return searchedItems.filter((item) => getStockStatus(item) === statusFilter);
  }, [searchedItems, statusFilter]);

  const filterCounts = useMemo(() => {
    let inStock = 0, lowStock = 0, outOfStock = 0;
    searchedItems.forEach((item) => {
      const s = getStockStatus(item);
      if (s === "in") inStock++; else if (s === "low") lowStock++; else outOfStock++;
    });
    return { all: searchedItems.length, in: inStock, low: lowStock, out: outOfStock };
  }, [searchedItems]);

  const computedNewStock = useMemo(() => {
    if (!adjustTarget) return null;
    const current = Number(adjustTarget.quantity ?? 0);
    const qty = Number(adjustForm.quantity.trim() || 0);
    if (adjustForm.type === "add") return current + qty;
    if (adjustForm.type === "remove") return Math.max(0, current - qty);
    return current;
  }, [adjustTarget, adjustForm.type, adjustForm.quantity]);

  // Server pagination: paginated results from API; pagination info from server
  const paginatedStockItems = stockItems; // server paginated results (current stock tab)
  const paginatedHistoryItems = historyItems; // server paginated history results (history tab)

  // Pagination variables (use server pagination data)
  const stockTotalPages = stockPagination?.pages || 1;
  const stockSafePage = Math.min(currentPage, Math.max(1, stockTotalPages));
  const stockTotalItems = stockPagination?.total || stockItems.length;
  const historyTotalPages = historyPagination?.pages || 1;
  const historySafePage = Math.min(historyPage, Math.max(1, historyTotalPages));
  const historyTotalItems = historyPagination?.total || historyItems.length;

  const paginationStart = (currentPage - 1) * itemsPerPage + 1;
  const paginationEnd = Math.min(currentPage * itemsPerPage, stockPagination?.total || stockItems.length);

  const handleSearchChange = (value) => { setSearch(value); setCurrentPage(1); };
  const handleStatusFilterChange = (value) => { setStatusFilter(value); setCurrentPage(1); };
  const handleTabChange = (value) => { setTab(value); setHistoryPage(1); };

  const openAdjustModal = (item) => {
    setAdjustForm({ type: "add", quantity: "", reason: "", customReason: "" });
    setAdjustError("");
    setAdjustTarget(item);
    setIsReasonOpen(false);
  };

  const closeAdjustModal = () => { setAdjustTarget(null); setAdjustError(""); setIsReasonOpen(false); };

  const validateAdjust = () => {
    const qtyRaw = adjustForm.quantity.trim();
    if (!qtyRaw) return "Quantity is required";
    const qty = Number(qtyRaw);
    if (!Number.isInteger(qty) || qty < 0) return "Quantity must be a valid non-negative whole number";
    if (qty === 0) return "Quantity must be greater than 0";
    if (adjustForm.type === "remove" && qty > Number(adjustTarget.quantity ?? 0)) {
      return `Cannot remove ${qty} units. Only ${adjustTarget.quantity} in stock.`;
    }
    
    if (!adjustForm.reason) return "Please select a reason for this adjustment";
    if (adjustForm.reason === "__OTHER__" && !adjustForm.customReason.trim()) {
      return "Please specify the custom reason";
    }
    return "";
  };

  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    const validationMsg = validateAdjust();
    if (validationMsg) { setAdjustError(validationMsg); return; }
    
    setAdjustError("");
    const finalReason = adjustForm.reason === "__OTHER__" 
      ? adjustForm.customReason.trim() 
      : adjustForm.reason;

    adjustMutation.mutate({
      variant_id: adjustTarget._id,
      type: adjustForm.type,
      quantity: Number(adjustForm.quantity.trim()),
      reason: finalReason,
    });
  };

  const renderPageNumbers = (page, totalPagesCount, goToPage) => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPagesCount <= maxVisiblePages) {
      for (let i = 1; i <= totalPagesCount; i++) pages.push(i);
    } else {
      if (page <= 3) pages.push(1, 2, 3, 4, "...", totalPagesCount);
      else if (page >= totalPagesCount - 2) pages.push(1, "...", totalPagesCount - 3, totalPagesCount - 2, totalPagesCount - 1, totalPagesCount);
      else pages.push(1, "...", page - 1, page, page + 1, "...", totalPagesCount);
    }
    return pages.map((p, index) => (
      <React.Fragment key={index}>
        {p === "..." ? (
          <span className="px-2 text-sm hidden sm:inline" style={{ color: "var(--text-muted)" }}>...</span>
        ) : (
          <button onClick={() => goToPage(p)} className="h-9 w-9 sm:h-8 sm:min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: page === p ? "var(--accent)" : "var(--bg-tertiary)", color: page === p ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${page === p ? "var(--accent)" : "var(--border-color)"}` }}>
            {p}
          </button>
        )}
      </React.Fragment>
    ));
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
  const tableHeaderStyle = { backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" };

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-4 sm:space-y-5 p-3 sm:p-0">
        
        {/* ✅ UPDATED HEADER - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-[20px] sm:text-[24px] leading-tight sm:leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Manage Stock</h1>
            <p className="text-[12px] sm:text-[13px] mt-0.5 sm:mt-1" style={{ color: "var(--text-muted)" }}>Easily monitor and manage product inventory.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <TabButton value="stock" label="Current Stock" icon={<ListIcon />} active={tab === "stock"} onSelect={handleTabChange} />
            <TabButton value="history" label="Stock History" icon={<ClockIcon />} active={tab === "history"} onSelect={handleTabChange} />
          </div>
        </div>

               {/* ✅ UPDATED STAT CARDS - Mobile optimized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            { label: "Total Variants", value: summary.totalVariants, sub: `Across ${summary.totalProducts} products` },
            { label: "In Stock", value: summary.inStock, color: "var(--success-text)", isCurrentPage: summary.isPageSpecific },
            { label: "Low Stock", value: summary.lowStock, color: "var(--warning)", isCurrentPage: summary.isPageSpecific },
            { label: "Out of Stock", value: summary.outOfStock, color: "var(--danger)", isCurrentPage: summary.isPageSpecific },
          ].map((card, idx) => (
            <div key={idx} className="rounded-lg p-3 sm:p-4" style={cardStyle}>
              <p className="text-[11px] sm:text-[12px] font-medium leading-tight mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
              <p className="text-[20px] sm:text-[20px] font-bold" style={{ color: card.color || "var(--text-primary)" }}>{card.value}</p>
              {card.sub && <p className="text-[10px] sm:text-[11px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{card.sub}</p>}
              {card.isCurrentPage && <p className="text-[9px] mt-1 italic" style={{ color: "var(--text-muted)" }}>Current page only</p>}
            </div>
          ))}
        </div>

       
        {tab === "stock" && (
          <>
            {/* ===== Professional Toolbar: Search Left, Filters Right ===== */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              
              {/* Wider Search Bar (Left Side) */}
              <div className="relative w-full md:w-[400px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
                <input 
                  type="text" 
                  placeholder="Search by product name, SKU or variant..." 
                  value={search} 
                  onChange={(e) => handleSearchChange(e.target.value)} 
                  className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" 
                  style={inputStyle} 
                />
              </div>

              {/* Filters (Right Side) */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                {["all", "in", "low", "out"].map((f) => (
                  <FilterPill key={f} value={f} label={f === "all" ? "All" : STATUS_META[f].label} count={filterCounts[f]} active={statusFilter === f} onSelect={handleStatusFilterChange} />
                ))}
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading stock...</span></div>
            ) : isError ? (
              <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}><AlertTriangleIcon /><p className="text-sm text-center px-4" style={{ color: "var(--text-muted)" }}>{error?.message || "Failed to load stock"}</p></div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}><BoxIcon className="w-8 h-8" /><p className="text-sm text-center px-4" style={{ color: "var(--text-muted)" }}>{search || statusFilter !== "all" ? "No stock items match your filters" : "No product variants found"}</p></div>
            ) : (
              <>
                {/* ✅ DESKTOP TABLE (Hidden on mobile) */}
                <div className="hidden md:block rounded-lg overflow-hidden" style={cardStyle}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] min-w-[860px]">
                      <thead style={tableHeaderStyle}>
                        <tr>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">Product</th>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">SKU</th>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell">Variant</th>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">Current Stock</th>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell">Min Stock</th>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell">Max Stock</th>
                          <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedStockItems.map((item, index) => {
                          const status = getStockStatus(item);
                          return (
                            <tr key={item._id} className="transition" style={{ borderBottom: index < paginatedStockItems.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: "var(--bg-card)" }}>
<td className="px-4 py-2.5">
  <div className="flex items-center gap-2.5">
    <Avatar name={item.product_name} />
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-medium text-[13px] truncate max-w-[160px]">{item.product_name}</span>
      {item.product_is_deleted && (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
          Deleted
        </span>
      )}
    </div>
  </div>
</td>
                              <td className="px-4 py-2.5"><span className="text-[13px] font-mono truncate max-w-[120px] block" style={{ color: "var(--text-secondary)" }}>{item.sku}</span></td>
                              <td className="px-4 py-2.5 hidden lg:table-cell"><span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{item.title}</span></td>
                              <td className="px-4 py-2.5"><span className="text-[13px] font-semibold" style={{ color: status === "out" ? "var(--danger)" : status === "low" ? "var(--warning)" : "var(--text-primary)" }}>{item.quantity} units</span></td>
                              <td className="px-4 py-2.5 hidden lg:table-cell"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{item.min_qnt}</span></td>
                              <td className="px-4 py-2.5 hidden lg:table-cell"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{item.max_qnt}</span></td>
                              <td className="px-4 py-2.5"><StatusPill status={status} /></td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => openDetails(item)} disabled={adjustMutation.isPending} className="h-8 px-2.5 rounded-md text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }} title="View Stock Details">
                                    <EyeIcon className="w-3.5 h-3.5" /> View
                                  </button>
                                  <button onClick={() => openAdjustModal(item)} disabled={adjustMutation.isPending} className="h-8 px-3 rounded-md text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }} title="Adjust Stock">
                                    <EditIcon className="w-3.5 h-3.5" /> Adjust Stock
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ✅ MOBILE-ONLY card list (replaces table on <768px) */}
                <div className="md:hidden space-y-2.5">
                  {paginatedStockItems.map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <div
                        key={item._id}
                        className="rounded-lg p-3 space-y-2.5 transition"
                        style={cardStyle}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
                            <BoxIcon className="w-4 h-4" />
                          </div>
                                               <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-medium truncate leading-tight">{item.product_name}</p>
                              {item.product_is_deleted && (
                                <span className="inline-flex items-center text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
                                  Deleted
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.sku || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="text-[12px] font-semibold" style={{ color: status === "out" ? "var(--danger)" : status === "low" ? "var(--warning)" : "var(--text-primary)" }}>
                            {item.quantity} units
                          </span>
                          <StatusPill status={status} />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                          <button
                            onClick={() => openDetails(item)}
                            className="flex-shrink-0 min-h-[44px] px-3 rounded-md transition hover:opacity-80 flex items-center justify-center text-[12px] font-semibold gap-1.5"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                          >
                            <EyeIcon className="w-4 h-4" /> Details
                          </button>
                          <button
                            onClick={() => openAdjustModal(item)}
                            disabled={adjustMutation.isPending}
                            className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center text-[12px] font-semibold gap-1.5"
                            style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}
                          >
                            <EditIcon className="w-4 h-4" /> Adjust
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {!loading && !isError && (stockPagination?.total || 0) > itemsPerPage && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
                <p className="text-[12px] text-center sm:text-left" style={{ color: "var(--text-muted)" }}>Showing {paginationStart}-{paginationEnd} of {stockPagination?.total || stockItems.length} stock items</p>
                <div className="flex items-center gap-2">
                  <span className="sm:hidden text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>Page {currentPage} of {stockTotalPages}</span>
                  <button onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeftIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                  <span className="hidden sm:inline-flex items-center gap-1">
                    {renderPageNumbers(currentPage, stockTotalPages, setCurrentPage)}
                  </span>
                  <button onClick={() => currentPage < stockTotalPages && setCurrentPage(currentPage + 1)} disabled={currentPage === stockTotalPages} className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRightIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= HISTORY TAB ================= */}
        {tab === "history" && (
          <>
            {historyLoading ? (
              <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading stock history...</span></div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}><ClockIcon className="w-8 h-8" /><p className="text-sm text-center px-4" style={{ color: "var(--text-muted)" }}>No stock adjustments yet</p></div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={cardStyle}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[900px]">
                    <thead style={tableHeaderStyle}>
                      <tr>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">SKU</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden md:table-cell">Variant</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">Previous Stock</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">Change</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider">New Stock</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell">Reason</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell">Updated By</th>
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden md:table-cell">Date/Time</th>
                      </tr>
                    </thead>
                    <tbody>
                     {paginatedHistoryItems.map((h, index) => {
                        const change = h.change_quantity ?? 0;
                        const isSet = h.adjustment_type === "set";
                        return (
                          <tr key={h._id} className="transition" style={{ borderBottom: index < paginatedHistoryItems.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: "var(--bg-card)" }}>
                            <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={h.product_name} /><span className="font-medium text-[13px] truncate max-w-[150px]">{h.product_name}</span></div></td>
                            <td className="px-4 py-2.5"><span className="text-[13px] font-mono truncate max-w-[110px] block" style={{ color: "var(--text-secondary)" }}>{h.sku}</span></td>
                            <td className="px-4 py-2.5 hidden md:table-cell"><span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{h.variant_title}</span></td>
                            <td className="px-4 py-2.5"><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{h.previous_quantity} units</span></td>
                            <td className="px-4 py-2.5"><span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: isSet ? "var(--warning)" : change > 0 ? "var(--success-text)" : change < 0 ? "var(--danger)" : "var(--text-muted)" }}>{change > 0 ? `+${change}` : change}</span></td>
                            <td className="px-4 py-2.5"><span className="text-[13px] font-semibold">{h.new_quantity} units</span></td>
                            <td className="px-4 py-2.5 hidden lg:table-cell"><span className="text-[12px] px-2 py-1 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>{h.reason || "—"}</span></td>
                            <td className="px-4 py-2.5 hidden lg:table-cell"><span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{h.performed_by_name}</span></td>
                            <td className="px-4 py-2.5 hidden md:table-cell"><span className="text-[12px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{formatDateTime(h.created_at)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!historyLoading && (historyPagination?.total || 0) > itemsPerPage && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
                <p className="text-[12px] text-center sm:text-left" style={{ color: "var(--text-muted)" }}>Showing {(historyPage - 1) * itemsPerPage + 1}-{Math.min(historyPage * itemsPerPage, historyPagination?.total || historyItems.length)} of {historyPagination?.total || historyItems.length} records</p>
                <div className="flex items-center gap-2">
                  <span className="sm:hidden text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>Page {historyPage} of {historyPagination?.pages || 1}</span>
                  <button onClick={() => historyPage > 1 && setHistoryPage(historyPage - 1)} disabled={historyPage === 1} className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeftIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                  <span className="hidden sm:inline-flex items-center gap-1">
                    {renderPageNumbers(historyPage, historyPagination?.pages || 1, setHistoryPage)}
                  </span>
                  <button onClick={() => historyPage < (historyPagination?.pages || 1) && setHistoryPage(historyPage + 1)} disabled={historyPage === (historyPagination?.pages || 1)} className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRightIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================= STOCK DETAILS DRAWER ================= */}
      {detailsTarget && (() => {
        const status = getStockStatus(detailsTarget);
        const meta = STATUS_META[status];
        const qty = Number(detailsTarget.quantity ?? 0);
        const min = Number(detailsTarget.min_qnt ?? 0);
        const max = Number(detailsTarget.max_qnt ?? 0);
        const hasMax = max > 0;
        const pct = hasMax ? Math.min(100, Math.max(0, (qty / max) * 100)) : 0;
        const latest = detailsHistory[0] || null;
        const changeColor = (c) => (c > 0 ? "var(--success-text)" : c < 0 ? "var(--danger)" : "var(--warning)");

        return (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDetails} />

            <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] max-w-full flex flex-col shadow-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", borderLeft: "1px solid var(--border-color)", animation: "drawerIn 0.25s ease-out" }}>
              <style>{`@keyframes drawerIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

              {/* HEADER */}
              <div className="px-5 py-4 shrink-0 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={detailsTarget.product_name} size="w-10 h-10" />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Stock Details</h3>
                    <p className="text-[13px] font-medium truncate mt-0.5" style={{ color: "var(--text-primary)" }}>{detailsTarget.product_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] truncate max-w-[180px]" style={{ color: "var(--text-muted)" }}>{detailsTarget.title || "—"}</span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>{detailsTarget.sku}</span>
                      <StatusPill status={status} />
                    </div>
                  </div>
                </div>
                <button onClick={closeDetails} className="p-1.5 rounded-md transition hover:opacity-70 shrink-0" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* BODY */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* PRODUCT INFORMATION */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                    <h4 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Product Information</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={detailsTarget.product_name} size="w-10 h-10" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{detailsTarget.product_name}</p>
                        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{detailsTarget.title || "—"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {[
                        { label: "SKU", value: detailsTarget.sku || "—", mono: true },
                        { label: "Variant", value: detailsTarget.title || "—" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 pb-2.5" style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{row.label}</span>
                          <span className={`text-[12px] text-right truncate ${row.mono ? "font-mono" : "font-medium"}`} style={{ color: "var(--text-secondary)" }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* INVENTORY OVERVIEW */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                    <h4 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Inventory Overview</h4>
                  </div>
                  <div className="p-4">
                    <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <p className="text-[10px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>Current Stock</p>
                      <p className="text-[24px] font-bold mt-1 leading-tight" style={{ color: "var(--text-primary)" }}>{qty}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>units</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Status</span>
                      <StatusPill status={status} />
                    </div>
                  </div>
                </div>

                {/* STOCK HISTORY (variant-specific) */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                    <h4 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Stock History</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>{detailsHistory.length} records</span>
                  </div>
                  <div className="p-4">
                    {detailsHistoryLoading ? (
                      <div className="space-y-3">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                            <div className="h-3 w-1/3 rounded" style={{ backgroundColor: "var(--bg-card)" }} />
                            <div className="h-2.5 w-2/3 rounded mt-2" style={{ backgroundColor: "var(--bg-card)" }} />
                          </div>
                        ))}
                      </div>
                    ) : detailsHistoryError ? (
                      <p className="text-[12px] text-center py-3" style={{ color: "var(--danger)" }}>Unable to load stock history.</p>
                    ) : detailsHistory.length === 0 ? (
                      <p className="text-[12px] text-center py-3" style={{ color: "var(--text-muted)" }}>No stock activity recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {detailsHistory.map((h) => {
                          const change = h.change_quantity ?? 0;
                          return (
                            <div key={h._id} className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-bold" style={{ color: changeColor(change) }}>
                                  {change > 0 ? `+${change}` : change} units
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md truncate max-w-[140px]" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>{h.reason || h.adjustment_type || "—"}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                                <span style={{ color: "var(--text-muted)" }}>Previous Stock: <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{h.previous_quantity ?? 0}</span></span>
                                <span style={{ color: "var(--text-muted)" }}>New Stock: <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{h.new_quantity ?? 0}</span></span>
                                <span className="truncate" style={{ color: "var(--text-muted)" }}>Updated By: <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{h.performed_by_name || "—"}</span></span>
                                <span style={{ color: "var(--text-muted)" }}>Date: <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{formatDateTime(h.created_at)}</span></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {/* RECENT ACTIVITY */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                    <h4 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recent Activity</h4>
                  </div>
                  <div className="p-4">
                    {latest ? (
                      <div className="grid grid-cols-1 gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Action</span>
                          <span className="text-[12px] font-semibold" style={{ color: changeColor(latest.change_quantity ?? 0) }}>
                            {(latest.change_quantity ?? 0) > 0 ? "Added" : "Removed"} {Math.abs(latest.change_quantity ?? 0)} units
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Reason</span>
                          <span className="text-[12px] truncate max-w-[200px]" style={{ color: "var(--text-secondary)" }}>{latest.reason || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Performed By</span>
                          <span className="text-[12px] truncate max-w-[160px]" style={{ color: "var(--text-secondary)" }}>{latest.performed_by_name || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Date & Time</span>
                          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{formatDateTime(latest.created_at)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No stock activity recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="px-5 py-4 shrink-0 flex items-center gap-3" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <button onClick={closeDetails} className="flex-1 h-10 rounded-lg text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Close</button>
                <button
                  onClick={() => { const t = detailsTarget; closeDetails(); openAdjustModal(t); }}
                  disabled={adjustMutation.isPending}
                  className="flex-1 h-10 rounded-lg text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}
                >
                  Adjust Stock
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {adjustTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-xl overflow-hidden max-h-[90vh] sm:max-h-[85vh] flex flex-col" style={cardStyle}>
            
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <div>
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Adjust Stock</h3>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>Update inventory quantity for this variant</p>
              </div>
              <button onClick={closeAdjustModal} disabled={adjustMutation.isPending} className="p-1.5 rounded-md transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>
                <CloseIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                
                {/* Product Info */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>Product Information</p>
                  <div className="flex items-center gap-3 sm:gap-3.5 p-3 sm:p-3.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <Avatar name={adjustTarget.product_name} size="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{adjustTarget.product_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>{adjustTarget.sku}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{adjustTarget.title}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>In Stock</p>
                      <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStockStatus(adjustTarget) === "out" ? "var(--danger)" : getStockStatus(adjustTarget) === "low" ? "var(--warning)" : "var(--success-text)" }} />
                        <p className="text-[16px] font-bold" style={{ color: getStockStatus(adjustTarget) === "out" ? "var(--danger)" : getStockStatus(adjustTarget) === "low" ? "var(--warning)" : "var(--success-text)" }}>{adjustTarget.quantity}</p>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>units</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adjustment Type */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>Stock Adjustment</p>
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    {[
                      { value: "add", label: "Add Stock", icon: "+", color: "var(--success-text)" },
                      { value: "remove", label: "Remove Stock", icon: "−", color: "var(--danger)" },
                    ].map((opt) => {
                      const isActive = adjustForm.type === opt.value;
                      const currentStock = Number(adjustTarget.quantity ?? 0);
                      const isRemoveDisabled = currentStock === 0;
                      
                      return (
                        <div key={opt.value} className="relative group">
                          <button 
                            type="button" 
                            onClick={() => { 
                              setAdjustError(""); 
                              setAdjustForm({ ...adjustForm, type: opt.value, quantity: "", reason: "", customReason: "" }); 
                              setIsReasonOpen(false); 
                            }} 
                            disabled={opt.value === "remove" ? (isRemoveDisabled || adjustMutation.isPending) : adjustMutation.isPending} 
                            className="relative w-full flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-center transition disabled:opacity-40 disabled:cursor-not-allowed" 
                            style={{ 
                              backgroundColor: isActive ? "var(--bg-tertiary)" : "var(--bg-card)", 
                              border: `1.5px solid ${isActive ? opt.color : "var(--border-color)"}`, 
                              color: isActive ? opt.color : "var(--text-secondary)" 
                            }}
                          >
                            <span className="text-[16px] font-bold leading-none">{opt.icon}</span>
                            <span className="text-[11px] font-medium leading-tight mt-0.5">{opt.label}</span>
                          </button>
                          
                          {opt.value === "remove" && isRemoveDisabled && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10" style={{ backgroundColor: "var(--danger)", color: "#fff", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                              No stock available to remove
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: "var(--danger)" }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Quantity <span style={{ color: "var(--danger)" }}>*</span></label>
                    <input 
                      type="number" 
                      min={1} 
                      max={adjustForm.type === "remove" ? (adjustTarget.quantity ?? 0) : undefined}
                      step="1" 
                      value={adjustForm.quantity} 
                      onChange={(e) => { 
                        setAdjustError(""); 
                        const val = e.target.value;
                        const maxStock = adjustForm.type === "remove" ? Number(adjustTarget.quantity ?? 0) : Infinity;
                        if (val === "" || Number(val) <= maxStock) {
                          setAdjustForm({ ...adjustForm, quantity: val });
                        }
                      }} 
                      disabled={adjustMutation.isPending} 
                      className="h-11 sm:h-10 px-3 rounded-lg text-[13px] w-full outline-none transition disabled:opacity-50" 
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} 
                      onFocus={(e) => e.target.style.borderColor = "var(--accent)"} 
                      onBlur={(e) => e.target.style.borderColor = "var(--border-color)"} 
                      placeholder={adjustForm.type === "add" ? "Units to add" : "Units to remove"} 
                    />
                    
                    {adjustForm.type === "remove" && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <InfoIcon className="w-3.5 h-3.5" style={{ color: "var(--warning)" }} />
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Maximum removable: <span className="font-semibold" style={{ color: "var(--warning)" }}>{adjustTarget.quantity} units</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Live Preview */}
                  {adjustForm.quantity.trim() && computedNewStock !== null && (
                    <div className="mt-3 p-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>New Stock</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{adjustTarget.quantity}</span>
                        <span className="text-[11px] font-semibold" style={{ color: adjustForm.type === "add" ? "var(--success-text)" : "var(--danger)" }}>
                          {adjustForm.type === "add" ? `+${Number(adjustForm.quantity.trim())}` : `−${Number(adjustForm.quantity.trim())}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>=</span>
                        <span className="text-[15px] font-bold" style={{ color: computedNewStock === 0 ? "var(--danger)" : computedNewStock <= (adjustTarget.min_qnt ?? 0) ? "var(--warning)" : "var(--success-text)" }}>{computedNewStock}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>units</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reason Dropdown */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>Reason</p>
                  
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsReasonOpen(!isReasonOpen)}
                      disabled={adjustMutation.isPending}
                      className="h-11 sm:h-10 px-3 pr-8 rounded-lg text-[13px] w-full outline-none transition disabled:opacity-50 flex items-center justify-between"
                      style={{ 
                        backgroundColor: "var(--bg-tertiary)", 
                        border: `1px solid ${isReasonOpen ? "var(--accent)" : "var(--border-color)"}`, 
                        color: adjustForm.reason ? "var(--text-primary)" : "var(--text-muted)" 
                      }}
                    >
                      <span className="truncate">
                        {adjustForm.reason ? (adjustForm.reason === "__OTHER__" ? "Other (Specify below)" : adjustForm.reason) : "Select a reason..."}
                      </span>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isReasonOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isReasonOpen && (
                      <div className="absolute z-50 w-full mt-1 rounded-lg shadow-xl border overflow-hidden" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                        <div className="max-h-60 overflow-y-auto py-1">
                          {(adjustForm.type === "add" ? ADD_REASONS : REMOVE_REASONS).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setAdjustForm({ ...adjustForm, reason: r, customReason: r === "__OTHER__" ? adjustForm.customReason : "" });
                                setIsReasonOpen(false);
                              }}
                              className="w-full text-left px-3 py-2.5 text-[13px] transition flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5"
                              style={{ 
                                backgroundColor: adjustForm.reason === r ? "var(--bg-tertiary)" : "transparent",
                                color: "var(--text-primary)"
                              }}
                            >
                              {adjustForm.reason === r && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                              <span className={adjustForm.reason === r ? "font-medium" : ""}>
                                {r === "__OTHER__" ? "Other (Specify below)" : r}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Explanation <span style={{ color: adjustForm.reason === "__OTHER__" ? "var(--danger)" : "var(--text-muted)" }}>
                        {adjustForm.reason === "__OTHER__" ? "*" : "(Optional)"}
                      </span>
                    </label>
                    <textarea
                      value={adjustForm.customReason}
                      onChange={(e) => setAdjustForm({ ...adjustForm, customReason: e.target.value })}
                      disabled={adjustMutation.isPending}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition disabled:opacity-50 resize-none"
                      style={{ 
                        backgroundColor: "var(--bg-card)", 
                        border: `1px solid ${adjustForm.reason === "__OTHER__" && !adjustForm.customReason.trim() && adjustError ? "var(--danger)" : "var(--border-color)"}`, 
                        color: "var(--text-primary)" 
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                      onBlur={(e) => e.target.style.borderColor = adjustForm.reason === "__OTHER__" && !adjustForm.customReason.trim() && adjustError ? "var(--danger)" : "var(--border-color)"}
                      placeholder={adjustForm.reason === "__OTHER__" ? "Please specify the custom reason..." : "Add any additional notes or context (optional)"}
                    />
                  </div>
                </div>

                {adjustError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
                    <AlertTriangleIcon />
                    <p className="text-[12px]" style={{ color: "var(--danger)" }}>{adjustError}</p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <button type="button" onClick={closeAdjustModal} disabled={adjustMutation.isPending} className="w-full sm:flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={adjustMutation.isPending} className="w-full sm:flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-semibold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {adjustMutation.isPending ? (<><Spinner className="w-4 h-4" /> Updating...</>) : "Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}