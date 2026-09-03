"use client";

import { useEffect, useState, Fragment, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { orderApi } from "@/apis/user/orderApi";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import {
  Package, Loader2, ShoppingBag, Calendar, MapPin, CreditCard,
  CheckCircle2, Clock, Truck, XCircle, ArrowRight, Banknote,
  Landmark, Zap, Trash2, Play, Tag, Navigation, ChevronLeft, ChevronRight,
  AlertTriangle, Search, ChevronDown, Check, ArrowUpDown, X
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending:    { label: "Pending",    icon: Clock,        color: "text-amber-500",    bg: "bg-amber-500/10",    border: "border-amber-500/30",    textColor: "text-amber-500",    dotColor: "bg-amber-500" },
  confirmed:  { label: "Confirmed",  icon: CheckCircle2, color: "text-blue-500",     bg: "bg-blue-500/10",     border: "border-blue-500/30",    textColor: "text-blue-500",     dotColor: "bg-blue-500" },
  processing: { label: "Processing", icon: Package,      color: "text-cyan-500",     bg: "bg-cyan-500/10",     border: "border-cyan-500/30",    textColor: "text-cyan-500",     dotColor: "bg-cyan-500" },
  shipped:    { label: "Shipped",    icon: Truck,        color: "text-indigo-500",   bg: "bg-indigo-500/10",   border: "border-indigo-500/30",  textColor: "text-indigo-500",   dotColor: "bg-indigo-500" },
  delivered:  { label: "Delivered",  icon: CheckCircle2, color: "text-emerald-500",  bg: "bg-emerald-500/10",  border: "border-emerald-500/30", textColor: "text-emerald-500",  dotColor: "bg-emerald-500" },
  cancelled:  { label: "Cancelled",  icon: XCircle,      color: "text-red-500",      bg: "bg-red-500/10",      border: "border-red-500/30",     textColor: "text-red-500",      dotColor: "bg-red-500" },
};

const PAYMENT_LABEL = {
  cod: { label: "Cash on Delivery", icon: Banknote },
  bank: { label: "Bank Transfer", icon: Landmark },
  card: { label: "Card", icon: CreditCard },
};

/* ============ PROFESSIONAL FILTER DROPDOWN ============ */
const FilterDropdown = ({ icon: Icon, options, value, onChange, buttonClass, width = "w-56" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={buttonClass}>
        {Icon && <Icon size={14} className="shrink-0" />}
        <span className="truncate">{selected?.label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute left-0 top-full mt-2 ${width} max-h-72 overflow-y-auto z-50 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-2xl p-1.5`}>
          {options.map((o) => {
            const OIcon = o.icon;
            const active = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs font-semibold transition ${active ? "bg-[var(--user-accent)] text-[var(--user-accent-text)]" : "text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)]"}`}
              >
                {OIcon && <OIcon size={14} className={active ? "" : (o.color || "")} />}
                <span className="flex-1 truncate">{o.label}</span>
                {o.count !== undefined && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? "bg-[var(--user-accent-text)]/20" : "bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"}`}>{o.count}</span>
                )}
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============ PROGRESS STEPPER ============ */
const OrderProgress = ({ status }) => {
  const currentIndex = STATUS_FLOW.indexOf(status);
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 h-px bg-red-500/30" />
        <XCircle size={14} className="text-red-500" />
        <span className="text-xs font-semibold text-red-500">Cancelled</span>
      </div>
    );
  }
  return (
    <div className="py-4">
      <div className="flex items-start justify-between relative">
        {STATUS_FLOW.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isPast = index < currentIndex;
          const cfg = STATUS_CONFIG[step];
          return (
            <div key={step} className="flex flex-col items-center flex-1 relative">
              <div className={`relative z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isPast ? `${cfg.dotColor} border-transparent text-white`
                : isCurrent ? `${cfg.dotColor} border-transparent text-white ring-4 ring-[var(--user-accent)]/20 scale-110`
                : "bg-[var(--user-bg-card)] border-[var(--user-border)]"
              }`}>
                {(isPast || isCurrent) && <CheckCircle2 size={10} strokeWidth={3} />}
              </div>
              {index < STATUS_FLOW.length - 1 && (
                <div className={`absolute top-[7px] left-1/2 w-full h-px transition-colors duration-500 ${isPast ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />
              )}
              <span className={`mt-2 text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap ${isCurrent ? cfg.textColor : isPast ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"}`}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============ PRODUCT SCROLL LIST ============ */
const ProductScrollList = ({ items }) => {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      checkScroll();
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, []);

  const scroll = (d) => { if (scrollRef.current) scrollRef.current.scrollBy({ left: d === "left" ? -280 : 280, behavior: "smooth" }); };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative group">
      {showLeftArrow && (
        <button onClick={() => scroll("left")} className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-xl flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] transition-all">
          <ChevronLeft size={16} />
        </button>
      )}
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scroll-smooth py-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {items.map((item, index) => {
          const unitPrice = Number(item.price || item.displayPrice || 0);
          const originalPrice = Number(item.original_price || item.originalPrice || 0);
          const qty = Number(item.qty) || 1;
          const freeItems = Number(item.free_items || 0);
          const payableQty = qty - freeItems;
          const totalPrice = unitPrice * payableQty;
          const hasDiscount = originalPrice > unitPrice;
          return (
            <div key={index} className="flex-shrink-0 w-72">
              <div className="flex flex-col h-full p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] hover:border-[var(--user-accent)]/40 transition-all">
                <div className="flex gap-3 mb-2">
                  <div className="shrink-0">
                    {getImgUrl(item.image) ? (
                      <img src={getImgUrl(item.image)} alt={item.name} className="w-16 h-16 rounded-lg object-cover border border-[var(--user-border)] bg-white" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center"><Package size={20} className="text-[var(--user-text-subtle)]" /></div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between items-end">
                    <div className="text-right">
                      {hasDiscount && <p className="text-[9px] text-[var(--user-text-subtle)] line-through mb-0.5">Rs. {originalPrice.toLocaleString()}</p>}
                      <p className="text-base font-black text-[var(--user-accent)]">Rs. {totalPrice.toLocaleString()}</p>
                    </div>
                    {freeItems > 0 && <span className="text-[9px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 px-1.5 py-0.5 rounded border border-[var(--user-success)]/20">+{freeItems} FREE</span>}
                  </div>
                </div>
                <div className="flex-1 min-w-0 mb-2">
                  <p className="text-xs font-bold text-[var(--user-text)] line-clamp-2 leading-snug mb-0.5">{item.name}</p>
                  {item.variantTitle && <p className="text-[9px] text-[var(--user-text-muted)] truncate">{item.variantTitle}</p>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--user-border)]">
                  <span className="text-[9px] font-semibold text-[var(--user-text)] bg-[var(--user-bg-card)] px-1.5 py-0.5 rounded border border-[var(--user-border)]">Qty: {qty}</span>
                  <p className="text-[9px] text-[var(--user-text-muted)]">Rs. {unitPrice.toLocaleString()} each</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showRightArrow && (
        <button onClick={() => scroll("right")} className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-xl flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] transition-all">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

/* ============ DELETE MODAL ============ */
const DeleteConfirmModal = ({ orderNumber, deleting, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-sm bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><AlertTriangle size={18} className="text-red-500" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--user-text)] leading-snug">Delete "{orderNumber}"?</h3>
          <p className="text-xs text-[var(--user-text-muted)] mt-1">This action cannot be undone.</p>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-sm font-semibold text-[var(--user-text)] hover:opacity-80 transition">Cancel</button>
        <button onClick={onConfirm} disabled={deleting} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
        </button>
      </div>
    </div>
  </div>
);

const DraftProgress = ({ step }) => (
  <div className="flex items-center gap-2">
    {[1, 2, 3].map((s, i) => (
      <Fragment key={s}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s <= step ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />
        {i < 2 && <div className={`h-0.5 w-8 rounded-full ${s < step ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />}
      </Fragment>
    ))}
    <span className="text-[10px] font-bold text-[var(--user-accent)] uppercase tracking-wider">Step {step}/3</span>
  </div>
);

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restoreItems } = useCart();
  const { calculateProductDiscount } = useDiscounts();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [timeRange, setTimeRange] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => { const res = await axiosInstance.get("/users/profile"); return res.data?.user || res.data; },
    retry: false,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["myOrders"], queryFn: orderApi.myOrders, enabled: !!user,
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ["checkoutDrafts"],
    queryFn: async () => { const res = await axiosInstance.get("/users/checkout-drafts"); return res.data?.drafts || []; },
    enabled: !!user, staleTime: 0, refetchOnMount: "always",
  });

  const hasDrafts = drafts.length > 0;

  const deleteDraft = async (draftId, items) => {
    try {
      if (items?.length) restoreItems(items);
      await axiosInstance.delete(`/users/checkout-drafts/${draftId}`);
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
      toast.success("Draft deleted — items returned to cart!");
    } catch (e) { toast.error("Failed to delete draft"); }
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axiosInstance.delete(`/orders/${deleteTarget._id}`);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success("Order deleted successfully!");
      setDeleteTarget(null);
    } catch (error) { toast.error(error.response?.data?.message || "Failed to delete order"); }
    finally { setDeleting(false); }
  };

  const resumeDraft = (draftId) => router.push(`/checkout?draftId=${draftId}`);

  useEffect(() => { if (!userLoading && !user) router.replace("/login?redirect=/orders"); }, [user, userLoading, router]);

  if (userLoading || ordersLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--user-accent)]" size={28} /></div>;
  }

  const counts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  const activeCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  // ✅ PROFESSIONAL FILTERING: status + search + time + sort
  let filtered = orders;
  if (filter !== "all" && filter !== "draft") filtered = filtered.filter((o) => o.status === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((o) => o.order_number.toLowerCase().includes(q) || (o.items || []).some((i) => (i.name || "").toLowerCase().includes(q)));
  }
  if (timeRange !== "all") {
    const cutoff = Date.now() - Number(timeRange) * 86400000;
    filtered = filtered.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  }
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === "total_high") return (b.total || 0) - (a.total || 0);
    if (sortBy === "total_low") return (a.total || 0) - (b.total || 0);
    return 0;
  });

  const hasActiveFilters = search.trim() || filter !== "all" || timeRange !== "all" || sortBy !== "newest";
  const clearFilters = () => { setSearch(""); setFilter("all"); setTimeRange("all"); setSortBy("newest"); };

  const statusOptions = [
    { value: "all", label: "All Orders", icon: Package, count: orders.length },
    { value: "draft", label: "Drafts", icon: ShoppingBag, count: drafts.length },
    ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label, icon: cfg.icon, color: cfg.color, count: counts[key] || 0 })),
  ];
  const sortOptions = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "total_high", label: "Total: High to Low" },
    { value: "total_low", label: "Total: Low to High" },
  ];
  const timeOptions = [
    { value: "all", label: "All Time" },
    { value: "30", label: "Last 30 Days" },
    { value: "90", label: "Last 3 Months" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "This Year" },
  ];

  const dropdownBtn = "w-full flex items-center gap-2 px-3.5 h-11 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-bold text-[var(--user-text)] hover:border-[var(--user-accent)]/50 transition";

  const DraftCard = ({ draft }) => {
    const items = draft.items || [];
    const count = items.length || draft.selectedKeys?.length || 0;
    const firstItem = items[0];
    const discountedItems = items.map((i) => {
      const disc = calculateProductDiscount({ _id: i.productId || i.id, category_id: i.categoryId || null, brand_id: i.brandId || null, discount: i.productDiscountPct || 0 }, i.price);
      return { ...i, displayPrice: disc.discountedPrice, originalPrice: disc.originalPrice, hasDiscount: disc.hasDiscount, savings: disc.savings };
    });
    const total = discountedItems.reduce((s, i) => s + (Number(i.displayPrice) || 0) * (Number(i.qty) || 1), 0);
    const totalSavings = discountedItems.reduce((s, i) => s + (Number(i.savings) || 0) * (Number(i.qty) || 1) + Number(i.deal_savings || 0), 0);

    return (
      <div className="w-full text-left rounded-2xl border-2 border-[var(--user-accent)] bg-[var(--user-bg-card)] p-4 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--user-accent)]/10 flex items-center justify-center"><ShoppingBag size={18} className="text-[var(--user-accent)]" /></div>
            <div>
              <p className="font-black text-sm text-[var(--user-text)]">DRAFT ORDER</p>
              <p className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1 mt-0.5"><Calendar size={10} /> {draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
            </div>
          </div>
          <DraftProgress step={draft.step} />
        </div>
        {firstItem && (
          <div className="flex gap-3 mb-4 p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)]">
            {getImgUrl(firstItem.image) ? (
              <img src={getImgUrl(firstItem.image)} alt={firstItem.name} className="w-16 h-16 rounded-lg object-cover border border-[var(--user-border)] bg-white" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center"><Package size={20} className="text-[var(--user-text-subtle)]" /></div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--user-text)] line-clamp-2">{firstItem.name}</p>
              <p className="text-[11px] text-[var(--user-text-muted)] mt-1">Qty: {firstItem.qty} {count > 1 && `• +${count - 1} more items`}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--user-border)]">
          <div>
            <p className="text-xs text-[var(--user-text-muted)]">Estimated Total</p>
            <p className="text-lg font-black text-[var(--user-accent)]">Rs. {total.toLocaleString()}</p>
            {totalSavings > 0 && <p className="text-[10px] text-[var(--user-success)] font-semibold mt-0.5 flex items-center gap-1"><Tag size={10} /> You save Rs. {totalSavings.toLocaleString()}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => resumeDraft(draft._id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold hover:opacity-90 transition"><Play size={12} /> Resume</button>
            <button onClick={() => deleteDraft(draft._id, items)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--user-danger)]/30 text-[var(--user-danger)] text-xs font-bold hover:bg-[var(--user-danger)]/10 transition"><Trash2 size={12} /> Delete</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 lg:py-8 pb-24 md:pb-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-[var(--user-text)]">My Orders</h1>
          <p className="text-sm text-[var(--user-text-muted)] mt-1">{orders.length} total orders · {activeCount} active</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--user-accent)] hover:opacity-80 transition">
          <ShoppingBag size={16} /> Continue Shopping
        </Link>
      </div>

      {/* ✅ PROFESSIONAL TOOLBAR (Search + Dropdowns) */}
      {(orders.length > 0 || hasDrafts) && (
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3 sm:p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-3">
            {/* SEARCH */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order # or product..."
                className="w-full h-11 pl-10 pr-9 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/20 transition"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] hover:text-[var(--user-text)] transition"><X size={14} /></button>
              )}
            </div>

            {/* STATUS DROPDOWN (default All Orders) */}
            <FilterDropdown icon={Package} options={statusOptions} value={filter} onChange={setFilter} buttonClass={dropdownBtn} />

            {/* SORT DROPDOWN */}
            <FilterDropdown icon={ArrowUpDown} options={sortOptions} value={sortBy} onChange={setSortBy} buttonClass={dropdownBtn} width="w-48" />

            {/* TIME RANGE DROPDOWN */}
            <FilterDropdown icon={Calendar} options={timeOptions} value={timeRange} onChange={setTimeRange} buttonClass={dropdownBtn} width="w-44" />
          </div>

          {/* RESULT COUNT + CLEAR */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--user-border)]">
            <p className="text-[11px] font-semibold text-[var(--user-text-muted)]">
              Showing <span className="font-black text-[var(--user-text)]">{filter === "draft" ? drafts.length : filtered.length}</span> of {orders.length} orders
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-bold text-[var(--user-accent)] hover:opacity-80 transition">
                <X size={12} /> Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* DRAFTS */}
      {hasDrafts && (filter === "all" || filter === "draft") && (
        <div className="space-y-4 mb-6">
          <h2 className="text-sm font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-3">Saved Drafts</h2>
          {drafts.map((draft) => <DraftCard key={draft._id} draft={draft} />)}
        </div>
      )}

      {/* EMPTY */}
      {filter !== "draft" && filtered.length === 0 && !(filter === "all" && hasDrafts) && (
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4"><ShoppingBag size={28} className="text-[var(--user-text-subtle)]" /></div>
          <h2 className="text-lg font-bold text-[var(--user-text)] mb-2">{orders.length === 0 ? "No orders yet" : "No orders match your filters"}</h2>
          <p className="text-sm text-[var(--user-text-muted)] mb-5">{orders.length === 0 ? "Start shopping to see your orders here." : "Try adjusting your search or filters."}</p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">Clear Filters</button>
          ) : (
            <Link href="/" className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">Shop Now</Link>
          )}
        </div>
      )}

      {/* ORDERS LIST */}
      {filter !== "draft" && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const pay = PAYMENT_LABEL[order.payment?.method] || PAYMENT_LABEL.cod;
            const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
            const orderTotalSavings = order.items.reduce((sum, i) => {
              const original = Number(i.original_price || 0);
              const paid = Number(i.price || 0);
              const qty = Number(i.qty) || 1;
              return sum + ((original - paid) * qty) + Number(i.deal_savings || 0);
            }, 0);

            return (
              <div key={order._id} className="group rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden hover:shadow-xl hover:border-[var(--user-accent)]/30 transition-all duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 border-b border-[var(--user-border)] bg-[var(--user-bg-hover)]/40 px-5 py-3">
                  <div className="sm:col-span-3">
                    <p className="text-[9px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-0.5">Order Number</p>
                    <p className="text-sm font-black text-[var(--user-accent)] font-mono">{order.order_number}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <p className="text-[9px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-0.5">Placed On</p>
                    <p className="text-sm font-semibold text-[var(--user-text)] flex items-center gap-1.5"><Calendar size={12} className="text-[var(--user-text-subtle)]" /> {date}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <p className="text-[9px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-0.5">Payment</p>
                    <p className="text-sm font-semibold text-[var(--user-text)] flex items-center gap-1.5"><pay.icon size={12} className="text-[var(--user-text-subtle)]" /> {pay.label}</p>
                  </div>
                  <div className="sm:col-span-3 flex sm:justify-end">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
                      <StatusIcon size={12} className={cfg.color} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textColor}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <ProductScrollList items={order.items} />
                  {!["delivered", "cancelled"].includes(order.status) && (
                    <div className="mt-2 border-t border-[var(--user-border)] border-dashed">
                      <OrderProgress status={order.status} />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--user-border)] bg-[var(--user-bg-hover)]/30 px-5 py-3">
                  <div>
                    <p className="text-[10px] text-[var(--user-text-muted)] font-medium mb-0.5">Order Total</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-black text-[var(--user-text)]">Rs. {order.total.toLocaleString()}</p>
                      {orderTotalSavings > 0 && (
                        <span className="text-[10px] font-bold text-[var(--user-success)] flex items-center gap-1 bg-[var(--user-success)]/10 px-2 py-0.5 rounded-full border border-[var(--user-success)]/20"><Tag size={10} /> Saved Rs. {orderTotalSavings.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === "shipped" && (
                      <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-bold text-[var(--user-text)] hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] transition"><Navigation size={13} /> Track</button>
                    )}
                    {order.status === "pending" && (
                      <button onClick={() => setDeleteTarget(order)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--user-danger)]/40 text-[var(--user-danger)] text-xs font-bold hover:bg-[var(--user-danger)]/10 transition"><Trash2 size={13} /> Cancel Order</button>
                    )}
                    <Link href={`/orders/${order._id}`} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold hover:opacity-90 hover:shadow-lg hover:shadow-[var(--user-accent)]/20 transition-all active:scale-95">
                      View Details <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal orderNumber={deleteTarget.order_number} deleting={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteOrder} />
      )}
    </main>
  );
}