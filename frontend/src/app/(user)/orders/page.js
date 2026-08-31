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
  AlertTriangle
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

// ✅ PROGRESS STEPPER (Compact Height)
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
                isPast 
                  ? `${cfg.dotColor} border-transparent text-white` 
                  : isCurrent 
                    ? `${cfg.dotColor} border-transparent text-white ring-4 ring-[var(--user-accent)]/20 scale-110`
                    : "bg-[var(--user-bg-card)] border-[var(--user-border)]"
              }`}>
                {(isPast || isCurrent) && <CheckCircle2 size={10} strokeWidth={3} />}
              </div>
              
              {index < STATUS_FLOW.length - 1 && (
                <div className={`absolute top-[7px] left-1/2 w-full h-px transition-colors duration-500 ${
                  isPast ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"
                }`} />
              )}
              
              <span className={`mt-2 text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                isCurrent ? cfg.textColor : isPast ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"
              }`}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ✅ PRODUCT SCROLL LIST (Width same, Height compact)
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

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -280 : 280,
        behavior: "smooth"
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative group">
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-xl flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] transition-all"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-none scroll-smooth py-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
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
                {/* Top: Image + Price */}
                <div className="flex gap-3 mb-2">
                  <div className="shrink-0">
                    {getImgUrl(item.image) ? (
                      <img 
                        src={getImgUrl(item.image)} 
                        alt={item.name} 
                        className="w-16 h-16 rounded-lg object-cover border border-[var(--user-border)] bg-white" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center">
                        <Package size={20} className="text-[var(--user-text-subtle)]" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between items-end">
                    <div className="text-right">
                      {hasDiscount && (
                        <p className="text-[9px] text-[var(--user-text-subtle)] line-through mb-0.5">
                          Rs. {originalPrice.toLocaleString()}
                        </p>
                      )}
                      <p className="text-base font-black text-[var(--user-accent)]">
                        Rs. {totalPrice.toLocaleString()}
                      </p>
                    </div>
                    {freeItems > 0 && (
                      <span className="text-[9px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 px-1.5 py-0.5 rounded border border-[var(--user-success)]/20">
                        +{freeItems} FREE
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Middle: Name */}
                <div className="flex-1 min-w-0 mb-2">
                  <p className="text-xs font-bold text-[var(--user-text)] line-clamp-2 leading-snug mb-0.5">
                    {item.name}
                  </p>
                  {item.variantTitle && (
                    <p className="text-[9px] text-[var(--user-text-muted)] truncate">
                      {item.variantTitle}
                    </p>
                  )}
                </div>
                
                {/* Bottom: Qty + Unit Price */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--user-border)]">
                  <span className="text-[9px] font-semibold text-[var(--user-text)] bg-[var(--user-bg-card)] px-1.5 py-0.5 rounded border border-[var(--user-border)]">
                    Qty: {qty}
                  </span>
                  <p className="text-[9px] text-[var(--user-text-muted)]">
                    Rs. {unitPrice.toLocaleString()} each
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-xl flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] transition-all"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

// ✅ DELETE CONFIRM MODAL (Centered)
const DeleteConfirmModal = ({ orderNumber, deleting, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[var(--user-text)] leading-snug">
              Delete "{orderNumber}"?
            </h3>
            <p className="text-xs text-[var(--user-text-muted)] mt-1">This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button 
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-sm font-semibold text-[var(--user-text)] hover:opacity-80 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const DraftProgress = ({ step }) => (
  <div className="flex items-center gap-2">
    {[1, 2, 3].map((s, i) => (
      <Fragment key={s}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s <= step ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />
        {i < 2 && <div className={`h-0.5 w-8 rounded-full ${s < step ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />}
      </Fragment>
    ))}
    <span className="text-[10px] font-bold text-[var(--user-accent)] uppercase tracking-wider">
      Step {step}/3
    </span>
  </div>
);

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restoreItems } = useCart();
  const { calculateProductDiscount } = useDiscounts();
  const [filter, setFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["myOrders"],
    queryFn: orderApi.myOrders,
    enabled: !!user,
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ["checkoutDrafts"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/checkout-drafts");
      return res.data?.drafts || [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const hasDrafts = drafts.length > 0;

  const deleteDraft = async (draftId, items) => {
    try {
      if (items?.length) restoreItems(items);
      await axiosInstance.delete(`/users/checkout-drafts/${draftId}`);
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
      toast.success("Draft deleted — items returned to cart!");
    } catch (e) {
      toast.error("Failed to delete draft");
    }
  };

  // ✅ DELETE ORDER (Pending only)
  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axiosInstance.delete(`/orders/${deleteTarget._id}`);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success("Order deleted successfully!");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete order");
    } finally {
      setDeleting(false);
    }
  };

  const resumeDraft = (draftId) => router.push(`/checkout?draftId=${draftId}`);

  useEffect(() => {
    if (!userLoading && !user) router.replace("/login?redirect=/orders");
  }, [user, userLoading, router]);

  if (userLoading || ordersLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
      </div>
    );
  }

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? orders : filter === "draft" ? [] : orders.filter((o) => o.status === filter);
  const activeCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  const DraftCard = ({ draft }) => {
    const items = draft.items || [];
    const count = items.length || draft.selectedKeys?.length || 0;
    const firstItem = items[0];

    const discountedItems = items.map((i) => {
      const disc = calculateProductDiscount(
        { _id: i.productId || i.id, category_id: i.categoryId || null, brand_id: i.brandId || null, discount: i.productDiscountPct || 0 },
        i.price,
      );
      return { ...i, displayPrice: disc.discountedPrice, originalPrice: disc.originalPrice, hasDiscount: disc.hasDiscount, savings: disc.savings };
    });

    const total = discountedItems.reduce((s, i) => s + (Number(i.displayPrice) || 0) * (Number(i.qty) || 1), 0);
    const totalSavings = discountedItems.reduce((s, i) => s + (Number(i.savings) || 0) * (Number(i.qty) || 1) + Number(i.deal_savings || 0), 0);
    const pay = PAYMENT_LABEL[draft.paymentMethod] || PAYMENT_LABEL.cod;

    return (
      <div className="w-full text-left rounded-2xl border-2 border-[var(--user-accent)] bg-[var(--user-bg-card)] p-4 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--user-accent)]/10 flex items-center justify-center">
              <ShoppingBag size={18} className="text-[var(--user-accent)]" />
            </div>
            <div>
              <p className="font-black text-sm text-[var(--user-text)]">DRAFT ORDER</p>
              <p className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1 mt-0.5">
                <Calendar size={10} /> {draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
          </div>
          <DraftProgress step={draft.step} />
        </div>

        {firstItem && (
          <div className="flex gap-3 mb-4 p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)]">
            {getImgUrl(firstItem.image) ? (
              <img src={getImgUrl(firstItem.image)} alt={firstItem.name} className="w-16 h-16 rounded-lg object-cover border border-[var(--user-border)] bg-white" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center">
                <Package size={20} className="text-[var(--user-text-subtle)]" />
              </div>
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
            {totalSavings > 0 && (
              <p className="text-[10px] text-[var(--user-success)] font-semibold mt-0.5 flex items-center gap-1">
                <Tag size={10} /> You save Rs. {totalSavings.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => resumeDraft(draft._id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold hover:opacity-90 transition">
              <Play size={12} /> Resume
            </button>
            <button onClick={() => deleteDraft(draft._id, items)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--user-danger)]/30 text-[var(--user-danger)] text-xs font-bold hover:bg-[var(--user-danger)]/10 transition">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    // ✅ WIDTH SAME (1200px) — sirf height compact hai
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 lg:py-8 pb-24 md:pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-[var(--user-text)]">My Orders</h1>
          <p className="text-sm text-[var(--user-text-muted)] mt-1">
            {orders.length} total orders · {activeCount} active
          </p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--user-accent)] hover:opacity-80 transition">
          <ShoppingBag size={16} /> Continue Shopping
        </Link>
      </div>

      {(orders.length > 0 || hasDrafts) && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          <button onClick={() => setFilter("all")} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition ${filter === "all" ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]" : "bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] border-[var(--user-border)] hover:border-[var(--user-accent)]/50"}`}>
            All Orders ({orders.length})
          </button>

          {hasDrafts && (
            <button onClick={() => setFilter("draft")} className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${filter === "draft" ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]" : "bg-[var(--user-bg-card)] border-[var(--user-accent)]/40 hover:border-[var(--user-accent)]"}`} style={filter !== "draft" ? { color: "var(--user-accent)" } : {}}>
              <ShoppingBag size={12} /> Draft ({drafts.length})
            </button>
          )}

          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const isActive = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${isActive ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]" : "bg-[var(--user-bg-card)] border-[var(--user-border)] hover:border-[var(--user-accent)]/50"}`} style={!isActive ? { color: `var(--user-text-secondary)` } : {}}>
                <Icon size={12} className={!isActive ? cfg.color : ""} />
                {cfg.label} ({counts[key] || 0})
              </button>
            );
          })}
        </div>
      )}

      {hasDrafts && (filter === "all" || filter === "draft") && (
        <div className="space-y-4 mb-6">
          <h2 className="text-sm font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-3">Saved Drafts</h2>
          {drafts.map((draft) => <DraftCard key={draft._id} draft={draft} />)}
        </div>
      )}

      {filter !== "draft" && filtered.length === 0 && !(filter === "all" && hasDrafts) && (
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
            <ShoppingBag size={28} className="text-[var(--user-text-subtle)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--user-text)] mb-2">{orders.length === 0 ? "No orders yet" : "No orders in this status"}</h2>
          <p className="text-sm text-[var(--user-text-muted)] mb-5">{orders.length === 0 ? "Start shopping to see your orders here." : "Try a different filter."}</p>
          <Link href="/" className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">Shop Now</Link>
        </div>
      )}

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
                
                {/* ✅ 1. HEADER (Compact) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 border-b border-[var(--user-border)] bg-[var(--user-bg-hover)]/40 px-5 py-3">
                  <div className="sm:col-span-3">
                    <p className="text-[9px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-0.5">Order Number</p>
                    <p className="text-sm font-black text-[var(--user-accent)] font-mono">{order.order_number}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <p className="text-[9px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-0.5">Placed On</p>
                    <p className="text-sm font-semibold text-[var(--user-text)] flex items-center gap-1.5">
                      <Calendar size={12} className="text-[var(--user-text-subtle)]" /> {date}
                    </p>
                  </div>
                  <div className="sm:col-span-3">
                    <p className="text-[9px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-0.5">Payment</p>
                    <p className="text-sm font-semibold text-[var(--user-text)] flex items-center gap-1.5">
                      <pay.icon size={12} className="text-[var(--user-text-subtle)]" /> {pay.label}
                    </p>
                  </div>
                  <div className="sm:col-span-3 flex sm:justify-end">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
                      <StatusIcon size={12} className={cfg.color} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textColor}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>

                {/* ✅ 2. BODY (Compact) */}
                <div className="p-4">
                  <ProductScrollList items={order.items} />
                  
                  {!["delivered", "cancelled"].includes(order.status) && (
                    <div className="mt-2 border-t border-[var(--user-border)] border-dashed">
                      <OrderProgress status={order.status} />
                    </div>
                  )}
                </div>

                {/* ✅ 3. FOOTER: Total + Delete + View Details */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--user-border)] bg-[var(--user-bg-hover)]/30 px-5 py-3">
                  <div>
                    <p className="text-[10px] text-[var(--user-text-muted)] font-medium mb-0.5">Order Total</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-black text-[var(--user-text)]">Rs. {order.total.toLocaleString()}</p>
                      {orderTotalSavings > 0 && (
                        <span className="text-[10px] font-bold text-[var(--user-success)] flex items-center gap-1 bg-[var(--user-success)]/10 px-2 py-0.5 rounded-full border border-[var(--user-success)]/20">
                          <Tag size={10} /> Saved Rs. {orderTotalSavings.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {order.status === "shipped" && (
                      <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-bold text-[var(--user-text)] hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] transition">
                        <Navigation size={13} /> Track
                      </button>
                    )}
                    
                    {/* ✅ DELETE BUTTON — Sirf Pending */}
                    {order.status === "pending" && (
                      <button 
                        onClick={() => setDeleteTarget(order)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--user-danger)]/40 text-[var(--user-danger)] text-xs font-bold hover:bg-[var(--user-danger)]/10 transition"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                    
                    <Link 
                      href={`/orders/${order._id}`} 
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold hover:opacity-90 hover:shadow-lg hover:shadow-[var(--user-accent)]/20 transition-all active:scale-95"
                    >
                      View Details <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ✅ DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <DeleteConfirmModal 
          orderNumber={deleteTarget.order_number}
          deleting={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteOrder}
        />
      )}
    </main>
  );
}