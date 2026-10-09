"use client";

import { Suspense, useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userHttp } from "@/apis/axiosInstance";
import { orderApi } from "@/apis/user/orderApi";
import { reviewApi } from "@/apis/user/reviewApi";
import ProductRating from "@/components/user/ProductReviews";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import {
  Package, Loader2, ShoppingBag, Calendar, MapPin, CreditCard,
  CheckCircle2, Clock, Truck, XCircle, ArrowRight, ArrowLeft, Banknote,
  Landmark, Zap, Trash2, Play, Tag, Navigation, ChevronLeft, ChevronRight,
  AlertTriangle, Search, ChevronDown, Check, ArrowUpDown, X
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const PAGE_SIZE = 10;

const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

/* ============ QTY / DEAL BREAKDOWN ============
   Backend stores item.qty as the PAID quantity (orderController.js:188 `qty: payableItems`)
   and item.free_items as units given ON TOP of it (stock moves by qty + free_items).
   So: paid = payable_items || qty, free = free_items, received = paid + free.        */
const DEAL_TYPE_LABEL = {
  buy_x_get_y: "Buy X Get Y",
  percentage: "Percentage Discount",
  fixed_amount: "Flat Price Discount",
  fixed: "Flat Price Discount",
  bundle: "Bundle Deal",
};

const buildQtyBreakdown = (item) => {
  const paidQty = Number(item.payable_items) > 0 ? Number(item.payable_items) : Number(item.qty) || 1;
  const freeQty = Number(item.free_items) || 0;
  const totalQty = paidQty + freeQty;

  const buy = Number(item.deal_buy_quantity) || 0;
  const get = Number(item.deal_get_quantity) || 0;
  const isBXG = item.deal_type === "buy_x_get_y";

  const dealTitle =
    item.bundle_name ||
    (isBXG && buy > 0 && get > 0 ? `Buy ${buy} Get ${get} Free` : item.deal_name || DEAL_TYPE_LABEL[item.deal_type] || "");

  const unitPrice = Number(item.price || 0);
  const originalPrice = Number(item.original_price || 0);
  const priceCut = originalPrice > unitPrice ? (originalPrice - unitPrice) * paidQty : 0;
  const savings = Math.max(0, Number(item.deal_savings) || 0) + priceCut;

  const reasons = [];
  if (item.discount_name) reasons.push(item.discount_name);
  if (freeQty > 0) {
    reasons.push(isBXG && buy > 0 && get > 0
      ? `Buy ${buy} Get ${get} — you receive ${totalQty} units for the price of ${paidQty}`
      : `You receive ${totalQty} units (${paidQty} paid + ${freeQty} free)`);
  } else if (item.deal_name && !isBXG) {
    reasons.push(item.deal_name);
  }
  if (savings > 0) reasons.push(`You saved Rs. ${savings.toLocaleString()} on this item`);

  return {
    paidQty, freeQty, totalQty, dealTitle, isBXG, reasons, savings,
    hasDetail: freeQty > 0 || !!dealTitle || savings > 0 || !!item.discount_name,
  };
};

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending:    { label: "Pending",    icon: Clock,        color: "text-[var(--user-warning)]", bg: "bg-[var(--user-warning)]/10", border: "border-transparent", textColor: "text-[var(--user-warning)]", dotColor: "bg-[var(--user-warning)]" },
  confirmed:  { label: "Confirmed",  icon: CheckCircle2, color: "text-[var(--user-text-secondary)]", bg: "bg-[var(--user-bg-hover)]", border: "border-transparent", textColor: "text-[var(--user-text-secondary)]", dotColor: "bg-[var(--user-text-subtle)]" },
  processing: { label: "Processing", icon: Package,      color: "text-[var(--user-text-secondary)]", bg: "bg-[var(--user-bg-hover)]", border: "border-transparent", textColor: "text-[var(--user-text-secondary)]", dotColor: "bg-[var(--user-text-subtle)]" },
  shipped:    { label: "Shipped",    icon: Truck,        color: "text-[var(--user-text-secondary)]", bg: "bg-[var(--user-bg-hover)]", border: "border-transparent", textColor: "text-[var(--user-text-secondary)]", dotColor: "bg-[var(--user-text-subtle)]" },
  delivered:  { label: "Delivered",  icon: CheckCircle2, color: "text-[var(--user-success)]", bg: "bg-[var(--user-success)]/10", border: "border-transparent", textColor: "text-[var(--user-success)]", dotColor: "bg-[var(--user-success)]" },
  cancelled:  { label: "Cancelled",  icon: XCircle,      color: "text-[var(--user-danger)]", bg: "bg-[var(--user-danger)]/10", border: "border-transparent", textColor: "text-[var(--user-danger)]", dotColor: "bg-[var(--user-danger)]" },
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
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs font-medium transition ${active ? "bg-[var(--user-accent)] text-[var(--user-accent-text)]" : "text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)]"}`}
              >
                {OIcon && <OIcon size={14} className={active ? "" : (o.color || "")} />}
                <span className="flex-1 truncate">{o.label}</span>
                {o.count !== undefined && (
                  <span className={`text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full ${active ? "bg-[var(--user-accent-text)]/20" : "bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"}`}>{o.count}</span>
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
        <div className="flex-1 h-px bg-[var(--user-danger)]/30" />
        <XCircle size={14} className="text-[var(--user-danger)]" />
        <span className="text-xs font-semibold text-[var(--user-danger)]">Cancelled</span>
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
                : isCurrent ? `${cfg.dotColor} border-transparent text-white ring-4 ring-[var(--user-bg-hover)] scale-110`
                : "bg-[var(--user-bg-card)] border-[var(--user-border)]"
              }`}>
                {(isPast || isCurrent) && <CheckCircle2 size={10} strokeWidth={3} />}
              </div>
              {index < STATUS_FLOW.length - 1 && (
                <div className={`absolute top-[0.4375rem] left-1/2 w-full h-px transition-colors duration-500 ${isPast ? "bg-[var(--user-text-secondary)]" : "bg-[var(--user-border)]"}`} />
              )}
              <span className={`mt-2 text-[0.5625rem] font-medium whitespace-nowrap ${isCurrent ? cfg.textColor : isPast ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"}`}>
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
const ProductScrollList = ({ items, idPrefix, rateable = false, reviewsMap }) => {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

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
        <button onClick={() => scroll("left")} className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-sm flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition-all">
          <ChevronLeft size={16} />
        </button>
      )}
            <div ref={scrollRef} className="flex gap-2 sm:gap-3 overflow-x-auto scroll-smooth py-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {items.map((item, index) => {
          const unitPrice = Number(item.price || item.displayPrice || 0);
          const originalPrice = Number(item.original_price || item.originalPrice || 0);
          const q = buildQtyBreakdown(item);
          // qty is ALREADY the paid qty (free units sit on top) — never subtract free_items here.
          const totalPrice = unitPrice * q.paidQty;
          const hasDiscount = originalPrice > unitPrice;
          const isOpen = openIndex === index;
          const panelId = `qty-breakdown-${idPrefix || "ord"}-${index}`;
          const qtyLabel = `Qty ${q.paidQty}${q.freeQty > 0 ? ` +${q.freeQty} free` : ""} — ${q.totalQty} unit${q.totalQty > 1 ? "s" : ""} in total. Tap for deal details`;
          const pid = String(item.product_id?._id || item.product_id || "");
          const itemReview = rateable && pid ? (reviewsMap && reviewsMap.get(pid)) || null : null;
          return (
                       <div key={index} className="flex-shrink-0 w-44 sm:w-72">
              <div className="flex flex-col h-full p-2 sm:p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] hover:border-[var(--user-border-hover)] transition-all">
                <div className="flex gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                  <div className="shrink-0">
                    {getImgUrl(item.image) ? (
                      <img src={getImgUrl(item.image)} alt={item.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover border border-[var(--user-border)] bg-white" />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center"><Package size={18} className="text-[var(--user-text-subtle)]" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-end items-end text-right">
                    {hasDiscount && <p className="text-[0.5rem] sm:text-[0.5625rem] text-[var(--user-text-subtle)] line-through mb-0.5">Rs. {originalPrice.toLocaleString()}</p>}
                    <p className="text-sm sm:text-base font-semibold text-[var(--user-text)] truncate">Rs. {totalPrice.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0 mb-1.5 sm:mb-2">
                  <p className="text-sm font-medium text-[var(--user-text)] line-clamp-2 leading-snug mb-0.5">{item.name}</p>
                  {item.variantTitle && <p className="text-[0.5rem] sm:text-[0.5625rem] text-[var(--user-text-muted)] truncate">{item.variantTitle}</p>}
                </div>
                {/* QTY + free/deal bonus — attached together, inside the card */}
                <div className="pt-1.5 sm:pt-2 border-t border-[var(--user-border)]">
                  <div className="flex items-center justify-between gap-1">
                    {q.hasDetail ? (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenIndex(isOpen ? null : index); }}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={qtyLabel}
                        title={qtyLabel}
                        className="inline-flex items-center gap-1 shrink-0 rounded-md border border-[var(--user-border)] bg-[var(--user-bg-card)] px-1.5 py-0.5 hover:border-[var(--user-border-hover)] active:scale-95 transition"
                      >
                        <span className="text-[0.5rem] sm:text-[0.5625rem] font-medium text-[var(--user-text)]">Qty: {q.paidQty}</span>
                        {q.freeQty > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-[0.1875rem] border border-[var(--user-success)]/30 bg-[var(--user-success)]/15 px-1 py-px text-[0.5rem] sm:text-[0.5625rem] font-medium text-[var(--user-success)]">
                            +{q.freeQty} FREE
                          </span>
                        )}
                        <ChevronDown size={10} className={`text-[var(--user-text-subtle)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    ) : (
                      <span className="text-[0.5rem] sm:text-[0.5625rem] font-semibold text-[var(--user-text)] bg-[var(--user-bg-card)] px-1.5 py-0.5 rounded border border-[var(--user-border)] shrink-0">Qty: {q.paidQty}</span>
                    )}
                    <p className="text-[0.5rem] sm:text-[0.5625rem] text-[var(--user-text-muted)] truncate">Rs. {unitPrice.toLocaleString()} each</p>
                  </div>

                  {/* Inline breakdown — paid / free / total / deal reason / savings */}
                  {q.hasDetail && isOpen && (
                    <div id={panelId} className="mt-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] px-2 py-1.5 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[0.5rem] sm:text-[0.5625rem]">
                        <span className="font-semibold text-[var(--user-text-muted)]">Paid units</span>
                        <span className="font-medium text-[var(--user-text)]">{q.paidQty} × Rs. {unitPrice.toLocaleString()}</span>
                      </div>
                      {q.freeQty > 0 && (
                        <div className="flex items-center justify-between gap-2 text-[0.5rem] sm:text-[0.5625rem]">
                          <span className="font-semibold text-[var(--user-success)]">Free units</span>
                          <span className="font-medium text-[var(--user-success)]">+{q.freeQty}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 text-[0.5rem] sm:text-[0.5625rem] pt-1 border-t border-dashed border-[var(--user-border)]">
                        <span className="font-medium text-[var(--user-text)]">Total you receive</span>
                        <span className="font-semibold text-[var(--user-text)]">{q.totalQty} unit{q.totalQty > 1 ? "s" : ""}</span>
                      </div>
                      {q.dealTitle && (
                        <p className="flex items-start gap-1 pt-1 border-t border-dashed border-[var(--user-border)] text-[0.5rem] sm:text-[0.5625rem] font-medium text-[var(--user-text-secondary)]">
                          <Zap size={9} className="mt-0.5 shrink-0" /> <span className="min-w-0">{q.dealTitle}</span>
                        </p>
                      )}
                      {q.reasons.map((reason, ri) => (
                        <p key={ri} className="text-[0.5rem] sm:text-[0.5625rem] leading-snug text-[var(--user-text-muted)]">{reason}</p>
                      ))}
                    </div>
                  )}
                </div>

                {rateable && (
                  <div className="pt-1.5 mt-1.5 border-t border-dashed border-[var(--user-border)]">
                    <ProductRating productId={pid} productName={item.name} review={itemReview} variant="compact" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {showRightArrow && (
        <button onClick={() => scroll("right")} className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-sm flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition-all">
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
        <div className="w-10 h-10 rounded-full bg-[var(--user-danger)]/10 flex items-center justify-center shrink-0"><AlertTriangle size={18} className="text-[var(--user-danger)]" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--user-text)] leading-snug">Delete &quot;{orderNumber}&quot;?</h3>
          <p className="text-xs text-[var(--user-text-muted)] mt-1">This action cannot be undone.</p>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-sm font-semibold text-[var(--user-text)] hover:opacity-80 transition">Cancel</button>
        <button onClick={onConfirm} disabled={deleting} className="flex-1 h-10 rounded-xl bg-[var(--user-danger)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
        </button>
      </div>
    </div>
  </div>
);

const DraftProgress = ({ step }) => (
  <p className="text-xs text-[var(--user-text-muted)]">
    Step {step} of 3 · {step >= 3 ? "Payment" : step === 2 ? "Delivery" : "Cart"}
  </p>
);

/* ============ PAGINATION CONTROLS COMPONENT ============ */
const PaginationControls = ({ page, totalPages, pagination, rangeStart, rangeEnd, goToPage, getPageItems }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-8 lg:mt-10 flex flex-col items-center gap-3">
      <p className="text-[0.6875rem] lg:text-xs text-[var(--user-text-muted)]">
        Showing{" "}
        <span className="font-semibold text-[var(--user-text)]">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of <span className="font-semibold text-[var(--user-text)]">{pagination.total}</span> orders
      </p>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] flex items-center justify-center transition hover:border-[var(--user-border-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={15} />
        </button>

        {getPageItems().map((item, i) =>
          item === "..." ? (
            <span key={`gap-${i}`} className="px-1 text-[var(--user-text-muted)] text-xs">
              ...
            </span>
          ) : (
            <button
              key={item}
              onClick={() => goToPage(item)}
              aria-current={page === item ? "page" : undefined}
              className={`h-9 min-w-[2.25rem] px-2 lg:h-10 lg:min-w-[2.5rem] rounded-lg lg:rounded-xl text-[0.6875rem] lg:text-xs font-medium transition ${
                page === item
                  ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border border-[var(--user-accent)]"
                  : "bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] hover:border-[var(--user-border-hover)]"
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          onClick={() => goToPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] flex items-center justify-center transition hover:border-[var(--user-border-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

/* OrdersPage — /orders route ka full page AUR account ke My Orders tab
   ka reused view (dono jagah EXACT same design).
   compact=true (account tab): page chrome (desktop title header, mobile
   sticky app bar, login redirect, page paddings, scroll-to-top) hide —
   sirf toolbar + orders list + pagination render hota hai. */
const ORDER_STATUSES = ["all", "draft", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const ORDER_SORTS = ["newest", "oldest", "total_high", "total_low"];
const ORDER_RANGES = ["all", "30", "90", "180", "365"];

const pickParam = (sp, key, fallback, valid) => {
  const raw = sp.get(key);
  if (raw === null || raw === "") return fallback;
  return valid.includes(raw) ? raw : fallback;
};

const safeOrderPage = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

export default function OrdersPage({ compact = false }) {
  return (
    <Suspense fallback={null}>
      <OrdersContent compact={compact} />
    </Suspense>
  );
}

function OrdersContent({ compact = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { restoreItems } = useCart();
  const { calculateProductDiscount } = useDiscounts();

  // ✅ Full page me page/filter/sort/search/range URL me (refresh/share safe);
  // account tab (compact) me local state (URL nahi chhedte)
  const [local, setLocal] = useState({
    filter: "all",
    search: "",
    sortBy: "newest",
    timeRange: "all",
    page: 1,
  });
  const fromUrl = !compact;
  const filter = fromUrl
    ? pickParam(searchParams, "status", "all", ORDER_STATUSES)
    : local.filter;
  const sortBy = fromUrl
    ? pickParam(searchParams, "sort", "newest", ORDER_SORTS)
    : local.sortBy;
  const timeRange = fromUrl
    ? pickParam(searchParams, "range", "all", ORDER_RANGES)
    : local.timeRange;
  const urlSearch = fromUrl ? (searchParams.get("q") || "") : local.search;
  const page = fromUrl ? safeOrderPage(searchParams.get("page")) : local.page;

  const writeUrl = (patch) => {
    const sp = new URLSearchParams(searchParams.toString());
    const apply = (key, value, fallback) => {
      if (value === fallback || value === "" || value === 1) sp.delete(key);
      else sp.set(key, String(value));
    };
    if ("filter" in patch) apply("status", patch.filter, "all");
    if ("sortBy" in patch) apply("sort", patch.sortBy, "newest");
    if ("timeRange" in patch) apply("range", patch.timeRange, "all");
    if ("search" in patch) apply("q", patch.search, "");
    if ("page" in patch) apply("page", patch.page, 1);
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const patchLocal = (patch) => setLocal((prev) => ({ ...prev, ...patch }));
  const setFilter = (v) =>
    fromUrl ? writeUrl({ filter: v, page: 1 }) : patchLocal({ filter: v, page: 1 });
  const setSortBy = (v) =>
    fromUrl ? writeUrl({ sortBy: v, page: 1 }) : patchLocal({ sortBy: v, page: 1 });
  const setTimeRange = (v) =>
    fromUrl ? writeUrl({ timeRange: v, page: 1 }) : patchLocal({ timeRange: v, page: 1 });
  const setPage = (v) => (fromUrl ? writeUrl({ page: v }) : patchLocal({ page: v }));

  // ✅ Search: textbox local (typing smooth), query + URL 400ms debounce par
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      if (fromUrl) writeUrl({ search: searchInput.trim(), page: 1 });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);
  const search = fromUrl ? debouncedSearch : searchInput;
  const setSearch = (v) => {
    setSearchInput(v);
    if (!fromUrl) patchLocal({ search: v, page: 1 });
  };

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllDrafts, setShowAllDrafts] = useState(false);

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => { const res = await userHttp.get("/users/profile"); return res.data?.user || res.data; },
    retry: false,
  });

  // ✅ User ki apni ratings — delivered order items par "Rate" / rated badge dikhane ke liye.
  const { data: myReviews = [] } = useQuery({
    queryKey: ["myReviews"],
    queryFn: reviewApi.mine,
    enabled: !!user,
    retry: false,
  });
  const reviewsMap = useMemo(() => {
    const map = new Map();
    (myReviews || []).forEach((r) => {
      const pid = String(r.product_id?._id || r.product_id || "");
      if (pid) map.set(pid, r);
    });
    return map;
  }, [myReviews]);

  // ✅ SERVER-SIDE PAGINATION query (for non-draft orders)
  const isDraftFilter = filter === "draft";
  const { data, isLoading: ordersLoading, isFetching } = useQuery({
    queryKey: ["myOrders", "paginated", page, filter, search, sortBy, timeRange],
    queryFn: () =>
      orderApi.getMyOrdersPaginated({
        page,
        limit: PAGE_SIZE,
        status: filter,
        search,
        sort: sortBy,
        timeRange,
      }),
    enabled: !!user && !isDraftFilter,
    staleTime: 60 * 1000,
  });

  // ✅ Legacy full fetch for "all" filter — needed for status counts + draft filter
  const { data: allOrders = [], isLoading: allLoading } = useQuery({
    queryKey: ["myOrders"],
    queryFn: orderApi.myOrders,
    enabled: !!user && isDraftFilter,
  });

  const orders = isDraftFilter ? allOrders : (data?.items || []);
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };
  const serverCounts = data?.counts || {};
  const totalOrders = data?.totalOrders ?? allOrders.length;

  const isLoading = userLoading || ordersLoading || allLoading;

  const { data: drafts = [] } = useQuery({
    queryKey: ["checkoutDrafts"],
    queryFn: async () => { const res = await userHttp.get("/users/checkout-drafts"); return res.data?.drafts || []; },
    enabled: !!user, staleTime: 0, refetchOnMount: "always",
  });

  const hasDrafts = drafts.length > 0;

  // ✅ Page reset setters me hota hai (filter/sort/search/range badle to page 1, URL समेत)

  const totalPages = Math.max(1, isDraftFilter ? 1 : (pagination.pages || 1));

  const goToPage = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    if (!compact) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageItems = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
    if (page >= totalPages - 3)
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  const rangeStart = orders.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, pagination.total);

  const deleteDraft = async (draftId, items) => {
    try {
      if (items?.length) restoreItems(items);
      await userHttp.delete(`/users/checkout-drafts/${draftId}`);
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
      toast.success("Draft deleted — items returned to cart!");
    } catch (e) { toast.error("Failed to delete draft"); }
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await userHttp.delete(`/orders/${deleteTarget._id}`);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success("Order deleted successfully!");
      setDeleteTarget(null);
    } catch (error) { toast.error(error.response?.data?.message || "Failed to delete order"); }
    finally { setDeleting(false); }
  };

  const resumeDraft = (draftId) => router.push(`/checkout?draftId=${draftId}`);

  useEffect(() => { if (!compact && !userLoading && !user) router.replace("/login?redirect=/orders"); }, [user, userLoading, router, compact]);

  if (isLoading) {
    return (
    <>
      <div className="hidden lg:flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--user-text-muted)]" size={28} /></div>
      <div className="lg:hidden min-h-[60vh] flex items-center justify-center bg-[var(--user-bg)]"><Loader2 className="animate-spin text-[var(--user-text-muted)]" size={28} /></div>
    </>
    );
  }

  // ✅ Use server-side counts when available, else compute from full list
  const counts = isDraftFilter
    ? allOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {})
    : serverCounts;
  const activeCount = isDraftFilter
    ? allOrders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length
    : (totalOrders - (counts.delivered || 0) - (counts.cancelled || 0));

  // ✅ CLIENT-SIDE FILTERING: only for draft view or when using allOrders fallback
  let filtered = isDraftFilter ? [] : orders;
  if (!isDraftFilter) {
    // Server already filtered by status/search/sort/timeRange — no client-side re-filter needed
  }

  const hasActiveFilters = search.trim() || filter !== "all" || timeRange !== "all" || sortBy !== "newest";
  const clearFilters = () => { setSearch(""); setFilter("all"); setTimeRange("all"); setSortBy("newest"); };

  const statusOptions = [
    { value: "all", label: "All Orders", icon: Package, count: isDraftFilter ? allOrders.length : (totalOrders || 0) },
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

  const dropdownBtn = "w-full flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-medium text-[var(--user-text)] transition";

  const DraftCard = ({ draft }) => {
    const items = draft.items || [];
    const count = items.length || draft.selectedKeys?.length || 0;
    const firstItem = items[0];
    const discountedItems = items.map((i) => {
      const basePrice = Number(i.originalPrice ?? i.regularPrice ?? i.price) || 0;
      const disc = calculateProductDiscount({ _id: i.productId || i.id, category_id: i.categoryId || null, brand_id: i.brandId || null, discount: i.productDiscountPct || 0 }, basePrice, false);
      const originalPrice = i.originalPrice != null ? Number(i.originalPrice) : Number(disc.originalPrice ?? basePrice);
      const displayPrice = i.displayPrice != null ? Number(i.displayPrice) : Number(disc.discountedPrice ?? i.price ?? basePrice);
      return { ...i, displayPrice, originalPrice };
    });
    const totalSavings = discountedItems.reduce((sum, i) => {
      const qty = Number(i.qty) || 1;
      return sum + Math.max(0, (Number(i.originalPrice) || 0) - (Number(i.displayPrice) || 0)) * qty;
    }, 0);
    const displayedSavings = Math.max(totalSavings, Number(draft.discount) || 0);
    const fallbackSubtotal = discountedItems.reduce((sum, i) => {
      const qty = Number(i.payableItems) || Number(i.qty) || 1;
      return sum + (Number(i.originalPrice) || 0) * qty;
    }, 0);
    const fallbackDiscount = discountedItems.reduce((sum, i) => {
      const qty = Number(i.qty) || 1;
      return sum + Math.max(0, (Number(i.originalPrice) || 0) - (Number(i.displayPrice) || 0)) * qty;
    }, 0);
    const fallbackTax = Math.round(discountedItems.reduce((sum, i) => {
      const qty = Number(i.payableItems) || Number(i.qty) || 1;
      return sum + (Number(i.displayPrice) || 0) * qty * (Number(i.tax) || 0) / 100;
    }, 0));
    const draftSubtotal = draft.subtotal != null ? Number(draft.subtotal) : fallbackSubtotal;
    const draftDiscount = draft.discount != null ? Number(draft.discount) : fallbackDiscount;
    const draftShipping = Number(draft.shipping) || 0;
    const draftTax = draft.tax != null ? Number(draft.tax) : fallbackTax;
    const total = draft.estimatedTotal != null && Number.isFinite(Number(draft.estimatedTotal))
      ? Number(draft.estimatedTotal)
      : Math.round(draftSubtotal + draftShipping + draftTax - draftDiscount);
    const unavailable =
      !firstItem ||
      !firstItem.name ||
      count > items.length ||
      items.some((item) =>
        item.available === false ||
        item.isAvailable === false ||
        item.productUnavailable === true ||
        !(item.productId || item.product_id || item.id || item._id)
      );
    const draftDate = draft.updatedAt
      ? new Date(draft.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";

    return (
      <div className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 sm:p-5 transition-colors hover:border-[var(--user-border-hover)]">
        <div className="mb-3 flex justify-end gap-2">
          {unavailable && <span className="rounded-full bg-[var(--user-bg-hover)] px-2.5 py-1 text-xs text-[var(--user-text-muted)]">Item unavailable</span>}
          <span className="text-xs text-[var(--user-text-muted)]">{draftDate}</span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {getImgUrl(firstItem?.image) ? (
              <Image src={getImgUrl(firstItem.image)} alt={firstItem.name || "Draft product"} width={56} height={56} loader={smartImageLoader} sizes="56px" className="h-14 w-14 shrink-0 rounded-lg border border-[var(--user-border)] object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]"><Package size={20} className="text-[var(--user-text-subtle)]" /></div>
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium text-[var(--user-text)]">{firstItem?.name || "Saved checkout"}</p>
              <p className="mt-0.5 text-xs text-[var(--user-text-muted)]">
                Qty {Number(firstItem?.qty) || 1}{count > 1 ? ` · +${count - 1} more ${count - 1 === 1 ? "item" : "items"}` : ""}
              </p>
              <DraftProgress step={draft.step || 1} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--user-border)] pt-3 sm:border-0 sm:pt-0">
            <div className="min-w-0">
              <p className="text-[0.6875rem] text-[var(--user-text-muted)]">Total</p>
              {total > 0 ? (
                <p className="text-base font-semibold text-[var(--user-text)]">Rs. {total.toLocaleString()}</p>
              ) : (
                <p className="text-sm text-[var(--user-text-muted)]">Calculated at checkout</p>
              )}
              {displayedSavings > 0 && <p className="mt-0.5 text-xs text-[var(--user-success)]">You save Rs. {displayedSavings.toLocaleString()}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => resumeDraft(draft._id)} disabled={unavailable} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-medium text-[var(--user-accent-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Play size={13} /> Resume</button>
              <button type="button" onClick={() => deleteDraft(draft._id, items)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[var(--user-text-muted)] transition hover:bg-[var(--user-danger)]/10 hover:text-[var(--user-danger)]"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    {/* ============= DESKTOP ============= */}
    <div className="hidden lg:block">
    <main className={compact ? "" : "max-w-[75rem] mx-auto px-4 lg:px-6 py-6 lg:py-8 pb-24 md:pb-10"}>
      {/* HEADER — account tab (compact) me account ka apna header hota hai */}
      {!compact && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--user-text)]">My Orders</h1>
          <p className="mt-1 text-sm text-[var(--user-text-muted)]">{isDraftFilter ? allOrders.length : (totalOrders || 0)} orders</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-[var(--user-border)] px-3 py-2 text-sm font-medium text-[var(--user-text)] transition hover:bg-[var(--user-bg-hover)]">
          <ShoppingBag size={16} /> Continue Shopping
        </Link>
      </div>
      )}

      {/* TOOLBAR (Search + Dropdowns) */}
      {(totalOrders > 0 || hasDrafts) && (
        <>
        <div className="mb-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(140px,auto))]">
            {/* SEARCH */}
            <div className="relative col-span-2 lg:col-span-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order # or product..."
                className="w-full h-10 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] pl-10 pr-9 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-border-hover)] transition"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] hover:text-[var(--user-text)] transition"><X size={14} /></button>
              )}
            </div>

            {/* STATUS DROPDOWN */}
            <FilterDropdown icon={Package} options={statusOptions} value={filter} onChange={setFilter} buttonClass={dropdownBtn} />

            {/* SORT DROPDOWN */}
            <FilterDropdown icon={ArrowUpDown} options={sortOptions} value={sortBy} onChange={setSortBy} buttonClass={dropdownBtn} width="w-48" />

            {/* TIME RANGE DROPDOWN */}
            <FilterDropdown icon={Calendar} options={timeOptions} value={timeRange} onChange={setTimeRange} buttonClass={dropdownBtn} width="w-44" />
          </div>

        </div>
        <div className="mb-6 flex items-center justify-between gap-3 px-1 text-xs text-[var(--user-text-muted)]">
          <p>Showing {isDraftFilter ? drafts.length : (pagination.total || orders.length)} of {isDraftFilter ? drafts.length : (totalOrders || 0)} orders</p>
          {hasActiveFilters && <button onClick={clearFilters} className="inline-flex items-center gap-1 font-medium hover:text-[var(--user-text)]"><X size={12} /> Clear filters</button>}
        </div>
        </>
      )}

      {/* DRAFTS */}
      {hasDrafts && (filter === "all" || filter === "draft") && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--user-text)]">Saved drafts</h2>
            <span className="rounded-full bg-[var(--user-bg-hover)] px-2 py-0.5 text-xs text-[var(--user-text-muted)]">{drafts.length}</span>
          </div>
          {(showAllDrafts ? drafts : drafts.slice(0, 2)).map((draft) => <DraftCard key={draft._id} draft={draft} />)}
          {drafts.length > 2 && (
            <button type="button" onClick={() => setShowAllDrafts((current) => !current)} className="text-sm font-medium text-[var(--user-text-muted)] hover:text-[var(--user-text)]">
              {showAllDrafts ? "Show fewer drafts" : `Show all drafts (${drafts.length})`}
            </button>
          )}
        </div>
      )}

      {/* EMPTY */}
      {(filter !== "draft" || !hasDrafts) && orders.length === 0 && !(filter === "all" && hasDrafts) && (
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4"><ShoppingBag size={28} className="text-[var(--user-text-subtle)]" /></div>
          <h2 className="text-base font-semibold text-[var(--user-text)] mb-2">{filter === "draft" ? "No saved drafts" : (totalOrders || 0) === 0 ? "No orders yet" : "No orders match your filters"}</h2>
          <p className="text-sm text-[var(--user-text-muted)] mb-5">{filter === "draft" ? "Saved checkout drafts will appear here." : (totalOrders || 0) === 0 ? "Start shopping to see your orders here." : "Try adjusting your search or filters."}</p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="inline-block rounded-lg border border-[var(--user-border)] px-4 py-2 text-sm font-medium text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">Clear Filters</button>
          ) : (
            <Link href="/" className="inline-block rounded-lg border border-[var(--user-border)] px-4 py-2 text-sm font-medium text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">Start shopping</Link>
          )}
        </div>
      )}

      {/* ORDERS LIST */}
      {filter !== "draft" && orders.length > 0 && (
        <div className={`space-y-3 transition-opacity ${isFetching ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
          <h2 className="text-sm font-semibold text-[var(--user-text)]">Orders</h2>
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const pay = PAYMENT_LABEL[order.payment?.method] || PAYMENT_LABEL.cod;
            const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
            const orderTotalSavings = order.items.reduce((sum, i) => {
              const original = Number(i.original_price || 0);
              const paid = Number(i.price || 0);
              const qty = Number(i.qty) || 1;
              const priceDiff = Math.max(0, (original - paid) * qty);
              const dealSavings = (i.deal_type === 'buy_x_get_y') ? Number(i.deal_savings || 0) : 0;
              return sum + priceDiff + dealSavings;
            }, 0);

            return (
              <div key={order._id} className="group rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 transition-colors hover:border-[var(--user-border-hover)] sm:p-5">
                <div className="grid grid-cols-2 gap-3 border-b border-[var(--user-border)] pb-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-[var(--user-text-muted)] mb-0.5">Order number</p>
                    <p className="text-sm font-medium text-[var(--user-text)] font-mono">{order.order_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--user-text-muted)] mb-0.5">Placed on</p>
                    <p className="text-sm font-medium text-[var(--user-text)] flex items-center gap-1.5"><Calendar size={12} className="text-[var(--user-text-subtle)]" /> {date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--user-text-muted)] mb-0.5">Payment</p>
                    <p className="text-sm font-medium text-[var(--user-text)] flex items-center gap-1.5"><pay.icon size={12} className="text-[var(--user-text-subtle)]" /> {pay.label}</p>
                  </div>
                  <div className="flex sm:justify-end">
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${cfg.bg}`}>
                      <StatusIcon size={12} className={cfg.color} />
                      <span className={`text-xs font-medium ${cfg.textColor}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>

                <div className="py-4">
                  {order.status === "cancelled" && (
                    <div className="mb-3 flex items-start gap-2.5 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/20 p-3">
                      <XCircle size={16} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--user-danger)]">Order Cancelled</p>
                        <p className="text-xs text-[var(--user-text)] mt-1 leading-relaxed">
                          <span className="font-medium text-[var(--user-danger)]">Reason:</span> {order.cancel_reason || "No reason provided."}
                        </p>
                      </div>
                    </div>
                  )}
                  <ProductScrollList items={order.items} idPrefix={order._id} rateable={order.status === "delivered"} reviewsMap={reviewsMap} />
                  {!["delivered", "cancelled"].includes(order.status) && (
                    <div className="mt-2 border-t border-[var(--user-border)] border-dashed">
                      <OrderProgress status={order.status} />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--user-border)] pt-3">
                  <div>
                    <p className="text-[0.625rem] text-[var(--user-text-muted)] font-medium mb-0.5">Order Total</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-base font-semibold text-[var(--user-text)]">Rs. {order.total.toLocaleString()}</p>
                      {orderTotalSavings > 0 && (
                        <span className="text-[0.625rem] font-medium text-[var(--user-success)] flex items-center gap-1 bg-[var(--user-success)]/10 px-2 py-0.5 rounded-full border border-[var(--user-success)]/20"><Tag size={10} /> Saved Rs. {orderTotalSavings.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === "shipped" && (
                      <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-medium text-[var(--user-text)] hover:border-[var(--user-border-hover)] transition"><Navigation size={13} /> Track</button>
                    )}
                    {order.status === "pending" && (
                      <button onClick={() => setDeleteTarget(order)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--user-danger)]/40 text-[var(--user-danger)] text-xs font-medium hover:bg-[var(--user-danger)]/10 transition"><Trash2 size={13} /> Cancel Order</button>
                    )}
                    <Link href={`/orders/${order._id}`} className="flex items-center gap-2 rounded-lg border border-[var(--user-border)] px-4 py-2 text-sm font-medium text-[var(--user-text)] transition hover:bg-[var(--user-bg-hover)]">
                      View details <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DESKTOP PAGINATION */}
      {!isDraftFilter && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          pagination={pagination}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          goToPage={goToPage}
          getPageItems={getPageItems}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal orderNumber={deleteTarget.order_number} deleting={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteOrder} />
      )}
    </main>
    </div>

    {/* ============= MOBILE (Daraz-style) — lg:hidden ============= */}
    <div className="lg:hidden bg-[var(--user-bg)]">
      {/* Sticky top app bar — account tab (compact) me account ka apna top bar hota hai */}
      {!compact && (
      <div
        className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 px-3 h-12">
          <button type="button" onClick={() => router.push("/")} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-semibold tracking-tight text-[var(--user-text)] leading-none truncate">My Orders</p>
            <p className="text-[0.6875rem] text-[var(--user-text-muted)] mt-0.5">{isDraftFilter ? allOrders.length : (totalOrders || 0)} {totalOrders === 1 ? "order" : "orders"}</p>
          </div>
          <Link href="/" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[var(--user-border)] px-2 text-xs font-medium text-[var(--user-text)] transition hover:bg-[var(--user-bg-hover)]">
            <ShoppingBag size={14} />
            <span className="hidden sm:inline">Continue Shopping</span>
            <span className="sm:hidden">Shop</span>
          </Link>
        </div>
      </div>
      )}

      <div className={compact ? "space-y-6" : "px-3 pt-3 pb-24 space-y-6"}>
        {(totalOrders > 0 || hasDrafts) && (
          <>
            <div className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3">
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <div className="relative min-w-[190px] flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search orders"
                    className="h-10 w-full rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] pl-9 pr-3 text-sm text-[var(--user-text)] outline-none placeholder:text-[var(--user-text-subtle)] focus:border-[var(--user-border-hover)]"
                  />
                </div>
                <div className="w-36 shrink-0">
                  <FilterDropdown icon={Package} options={statusOptions} value={filter} onChange={setFilter} buttonClass={dropdownBtn} width="w-56" />
                </div>
                <div className="w-40 shrink-0">
                  <FilterDropdown icon={ArrowUpDown} options={sortOptions} value={sortBy} onChange={setSortBy} buttonClass={dropdownBtn} width="w-52" />
                </div>
                <div className="w-36 shrink-0">
                  <FilterDropdown icon={Calendar} options={timeOptions} value={timeRange} onChange={setTimeRange} buttonClass={dropdownBtn} width="w-52" />
                </div>
              </div>
            </div>
            <div className="-mt-5 flex items-center justify-between px-1 text-xs text-[var(--user-text-muted)]">
              <p>Showing {isDraftFilter ? drafts.length : (pagination.total || orders.length)} of {isDraftFilter ? drafts.length : (totalOrders || 0)} orders</p>
              {hasActiveFilters && <button onClick={clearFilters} className="font-medium hover:text-[var(--user-text)]">Clear filters</button>}
            </div>
          </>
        )}

        {/* Drafts */}
        {hasDrafts && (filter === "all" || filter === "draft") && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--user-text)]">Saved drafts</h2>
              <span className="rounded-full bg-[var(--user-bg-hover)] px-2 py-0.5 text-xs text-[var(--user-text-muted)]">{drafts.length}</span>
            </div>
            {(showAllDrafts ? drafts : drafts.slice(0, 2)).map((draft) => <DraftCard key={draft._id} draft={draft} />)}
            {drafts.length > 2 && (
              <button type="button" onClick={() => setShowAllDrafts((current) => !current)} className="text-sm font-medium text-[var(--user-text-muted)] hover:text-[var(--user-text)]">
                {showAllDrafts ? "Show fewer drafts" : `Show all drafts (${drafts.length})`}
              </button>
            )}
          </div>
        )}

        {/* Empty */}
        {(filter !== "draft" || !hasDrafts) && orders.length === 0 && !(filter === "all" && hasDrafts) && (
          <div className="rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-sm p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
                <Package size={36} className="text-[var(--user-text-muted)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--user-text)] mb-1.5">
              {filter === "draft" ? "No saved drafts" : (totalOrders || 0) === 0 ? "No orders yet" : "No orders match your filters"}
            </h2>
            <p className="text-xs text-[var(--user-text-muted)] mb-5">
              {filter === "draft" ? "Saved checkout drafts will appear here." : (totalOrders || 0) === 0 ? "Start shopping to see your orders here." : "Try adjusting your filters."}
            </p>
            {hasActiveFilters ? (
              <button onClick={clearFilters} className="w-full h-10 rounded-lg border border-[var(--user-border)] text-sm font-medium text-[var(--user-text)] flex items-center justify-center gap-2 hover:bg-[var(--user-bg-hover)] transition">
                Clear Filters
              </button>
            ) : (
              <Link href="/" className="w-full h-10 rounded-lg border border-[var(--user-border)] text-sm font-medium text-[var(--user-text)] flex items-center justify-center gap-2 hover:bg-[var(--user-bg-hover)] transition">
                <ShoppingBag size={16} /> Start Shopping
              </Link>
            )}
          </div>
        )}

        {/* Orders list */}
        {filter !== "draft" && orders.length > 0 && (
          <div className={`space-y-3 transition-opacity ${isFetching ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
            <h2 className="text-sm font-semibold text-[var(--user-text)]">Orders</h2>
            {orders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const pay = PAYMENT_LABEL[order.payment?.method] || PAYMENT_LABEL.cod;
              const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
              return (
                <Link
                  key={order._id}
                  href={`/orders/${order._id}`}
                  className="block rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 transition-colors hover:border-[var(--user-border-hover)]"
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div>
                      <p className="text-xs text-[var(--user-text-muted)]">Order number</p>
                      <p className="text-sm font-medium text-[var(--user-text)]">{order.order_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--user-text-muted)]">Placed on</p>
                      <p className="text-sm font-medium text-[var(--user-text)]">{date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--user-text-muted)]">Payment</p>
                      <p className="text-sm font-medium text-[var(--user-text)]">{pay.label}</p>
                    </div>
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.textColor}`}>
                        <StatusIcon size={12} /> {cfg.label}
                      </span>
                    </div>
                  </div>
                  {/* Cancelled reason strip */}
                  {order.status === "cancelled" && order.cancel_reason && (
                    <div className="mt-3 rounded-lg bg-[var(--user-danger)]/10 p-2">
                      <p className="text-xs text-[var(--user-danger)] line-clamp-2">
                        Reason: {order.cancel_reason}
                      </p>
                    </div>
                  )}

                  {order.items?.length > 0 && (
                    <div className="mt-3 border-t border-[var(--user-border)] pt-3">
                      <ProductScrollList items={order.items} idPrefix={order._id} rateable={order.status === "delivered"} reviewsMap={reviewsMap} />
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--user-border)] pt-3">
                    <p className="text-base font-semibold text-[var(--user-text)] leading-none">
                      Rs. {order.total.toLocaleString()}
                    </p>
                    <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--user-border)] px-3 text-sm font-medium text-[var(--user-text)]">
                      View details <ChevronRight size={14} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* MOBILE PAGINATION */}
        {!isDraftFilter && (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            pagination={pagination}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            goToPage={goToPage}
            getPageItems={getPageItems}
          />
        )}
      </div>
    </div>

    {/* Shared modal — works for both desktop and mobile */}
    {deleteTarget && (
      <DeleteConfirmModal orderNumber={deleteTarget.order_number} deleting={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteOrder} />
    )}
    </>
  );
}
