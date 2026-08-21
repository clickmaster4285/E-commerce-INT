"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import {
  User,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ShoppingBag,
  Loader2,
  Calendar,
  MapPin,
  CreditCard,
  Banknote,
  Landmark,
  Zap,
  ArrowRight,
  Trash2,
  Play,
  Tag,
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending:    { label: "Pending",    icon: Clock,        color: "text-amber-500",    bg: "bg-amber-500/10",    border: "border-amber-500/30" },
  confirmed:  { label: "Confirmed",  icon: CheckCircle2, color: "text-blue-500",     bg: "bg-blue-500/10",     border: "border-blue-500/30" },
  processing: { label: "Processing", icon: Package,      color: "text-cyan-500",     bg: "bg-cyan-500/10",     border: "border-cyan-500/30" },
  shipped:    { label: "Shipped",    icon: Truck,        color: "text-indigo-500",   bg: "bg-indigo-500/10",   border: "border-indigo-500/30" },
  delivered:  { label: "Delivered",  icon: CheckCircle2, color: "text-emerald-500",  bg: "bg-emerald-500/10",  border: "border-emerald-500/30" },
  cancelled:  { label: "Cancelled",  icon: XCircle,      color: "text-red-500",      bg: "bg-red-500/10",      border: "border-red-500/30" },
};

const PAYMENT_LABEL = {
  cod: { label: "Cash on Delivery", icon: Banknote },
  bank: { label: "Bank Transfer", icon: Landmark },
  card: { label: "Card", icon: CreditCard },
};

const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_ORIGIN}${path}`;
};

const OrderProgress = ({ status }) => {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-red-500/30" />
        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Cancelled</span>
      </div>
    );
  }
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1.5">
      {STATUS_FLOW.map((s, i) => (
        <Fragment key={s}>
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition ${i <= idx ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`}
            title={STATUS_CONFIG[s].label}
          />
          {i < STATUS_FLOW.length - 1 && (
            <div className={`h-0.5 flex-1 rounded-full ${i < idx ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />
          )}
        </Fragment>
      ))}
      <span className="ml-2 text-[10px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider whitespace-nowrap">
        {STATUS_CONFIG[status]?.label}
      </span>
    </div>
  );
};

const DraftProgress = ({ step }) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3].map((s, i) => (
      <Fragment key={s}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s <= step ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />
        {i < 2 && <div className={`h-0.5 flex-1 rounded-full ${s < step ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />}
      </Fragment>
    ))}
    <span className="ml-2 text-[10px] font-bold text-[var(--user-accent)] uppercase tracking-wider whitespace-nowrap">
      Step {step} of 3
    </span>
  </div>
);

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restoreItems } = useCart();
  const { calculateProductDiscount } = useDiscounts();
  const [filter, setFilter] = useState("all");

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: 2,
    retryDelay: 1000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["myOrders"],
    queryFn: async () => {
      const res = await axiosInstance.get("/orders/my");
      return res.data?.data || [];
    },
    enabled: !!user,
    retry: 1,
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

  const resumeDraft = (draftId) => router.push(`/checkout?draftId=${draftId}`);

  if (userLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={32} />
      </div>
    );
  }

  if (!userLoading && !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-20 lg:py-28 text-center">
        <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5 lg:mb-6">
          <User size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-[var(--user-text)] mb-2">Login Required</h1>
        <p className="text-[var(--user-text-muted)] text-sm mb-6 lg:mb-8 max-w-sm mx-auto">
          Please login to view your account and orders.
        </p>
        <Link href="/login?redirect=/account" className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 lg:px-8 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition">
          Login to Your Account
        </Link>
      </div>
    );
  }

  const avatarLetter = (user.name || user.email || "U").charAt(0).toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "";

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? orders : filter === "draft" ? [] : orders.filter((o) => o.status === filter);
  const activeCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  const DraftCard = ({ draft }) => {
    const items = draft.items || [];
    const count = items.length || draft.selectedKeys?.length || 0;

    const discountedItems = items.map((i) => {
      const disc = calculateProductDiscount(
        {
          _id: i.productId || i.id,
          category_id: i.categoryId || null,
          brand_id: i.brandId || null,
          discount: i.productDiscountPct || 0,
        },
        i.price,
      );
      return {
        ...i,
        displayPrice: disc.discountedPrice,
        originalPrice: disc.originalPrice,
        hasDiscount: disc.hasDiscount,
        savings: disc.savings,
      };
    });

    const total = discountedItems.reduce(
      (s, i) => s + (Number(i.displayPrice) || 0) * (Number(i.qty) || 1),
      0,
    );
    const totalSavings = discountedItems.reduce(
      (s, i) => s + (Number(i.savings) || 0) * (Number(i.qty) || 1),
      0,
    );
    const pay = PAYMENT_LABEL[draft.paymentMethod] || PAYMENT_LABEL.cod;

    return (
      <div className="w-full text-left rounded-2xl border-2 border-[var(--user-accent)] bg-[var(--user-accent)]/5 p-4 lg:p-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="font-mono font-black text-sm text-[var(--user-accent)]">DRAFT ORDER</p>
              <p className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1 mt-0.5">
                <Calendar size={10} /> {draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-[var(--user-accent)]/10 border-[var(--user-accent)]/40">
            <ShoppingBag size={12} className="text-[var(--user-accent)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--user-accent)]">Draft</span>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex -space-x-3">
            {items.slice(0, 4).map((item, i) => {
              const imgUrl = getImgUrl(item.image);
              return imgUrl ? (
                <img key={i} src={imgUrl} alt={item.name} className="w-11 h-11 rounded-xl object-cover border-2 border-[var(--user-bg-card)] shadow-md" />
              ) : (
                <div key={i} className="w-11 h-11 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-bg-card)] shadow-md flex items-center justify-center">
                  <Package size={14} className="text-[var(--user-text-subtle)]" />
                </div>
              );
            })}
            {items.length > 4 && (
              <div className="w-11 h-11 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-bg-card)] shadow-md flex items-center justify-center">
                <span className="text-[10px] font-black text-[var(--user-text-muted)]">+{items.length - 4}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--user-text-secondary)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2.5 py-1.5 rounded-lg">
              <MapPin size={11} /> {count} item{count > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--user-text-secondary)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2.5 py-1.5 rounded-lg">
              <pay.icon size={11} /> {pay.label}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <DraftProgress step={draft.step} />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--user-border)] flex-wrap gap-3">
          <div>
            {totalSavings > 0 && (
              <p className="text-[10px] font-bold text-[var(--user-success)] flex items-center gap-1 mb-0.5">
                <Tag size={10} /> Save Rs. {totalSavings.toLocaleString()}
              </p>
            )}
            <p className="text-xs text-[var(--user-text-muted)]">
              Total: <span className="text-base font-black text-[var(--user-accent)]">Rs. {total.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => resumeDraft(draft._id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[11px] font-bold hover:opacity-90 transition"
            >
              <Play size={12} /> Resume
            </button>
            <button
              onClick={() => deleteDraft(draft._id, items)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--user-danger)]/30 text-[var(--user-danger)] text-[11px] font-bold hover:bg-[var(--user-danger)]/10 transition"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 lg:py-10 pb-24 md:pb-10">
      <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-5 sm:p-6 lg:p-8 mb-6 lg:mb-8">
        <div className="absolute -right-6 -bottom-10 lg:-right-10 lg:-bottom-16 opacity-[0.04] pointer-events-none">
          <ShoppingBag size={180} className="lg:w-[220px] lg:h-[220px] text-[var(--user-accent)]" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-16 h-16 lg:w-20 lg:h-20 rounded-full border-2 lg:border-4 border-[var(--user-accent)] object-cover" />
          ) : (
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-2xl lg:text-3xl font-black flex items-center justify-center">
              {avatarLetter}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--user-text)] capitalize truncate">
              {user.name || user.username}
            </h1>
            <p className="text-[var(--user-text-muted)] text-xs lg:text-sm mt-1 truncate">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[9px] lg:text-[10px] font-bold px-2.5 lg:px-3 py-1 rounded-full uppercase tracking-wider">
                ClickMasters Member
              </span>
              {memberSince && (
                <span className="text-[10px] lg:text-[11px] text-[var(--user-text-subtle)]">Member since {memberSince}</span>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col gap-3 text-center shrink-0">
            <div className="flex-1 sm:flex-none rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-4 lg:px-5 py-2.5 lg:py-3">
              <p className="text-lg lg:text-xl font-black text-[var(--user-accent)]">{orders.length}</p>
              <p className="text-[9px] lg:text-[10px] text-[var(--user-text-subtle)] uppercase tracking-wider">Total Orders</p>
            </div>
            <div className="flex-1 sm:flex-none rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-4 lg:px-5 py-2.5 lg:py-3">
              <p className="text-lg lg:text-xl font-black text-[var(--user-accent)]">{activeCount}</p>
              <p className="text-[9px] lg:text-[10px] text-[var(--user-text-subtle)] uppercase tracking-wider">Active</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg lg:text-xl font-black text-[var(--user-text)]">My Orders</h2>
          {orders.length > 5 && (
            <Link href="/orders" className="text-xs text-[var(--user-accent)] font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {(orders.length > 0 || hasDrafts) && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
            <button
              onClick={() => setFilter("all")}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                filter === "all"
                  ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]"
                  : "bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] border-[var(--user-border)] hover:border-[var(--user-accent)]/50"
              }`}
            >
              All ({orders.length})
            </button>

            {hasDrafts && (
              <button
                onClick={() => setFilter("draft")}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                  filter === "draft"
                    ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]"
                    : "bg-[var(--user-bg-card)] border-[var(--user-accent)]/40 hover:border-[var(--user-accent)]"
                }`}
                style={filter !== "draft" ? { color: "var(--user-accent)" } : {}}
              >
                <ShoppingBag size={12} />
                Draft ({drafts.length})
              </button>
            )}

            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    isActive
                      ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]"
                      : "bg-[var(--user-bg-card)] border-[var(--user-border)] hover:border-[var(--user-accent)]/50"
                  }`}
                  style={!isActive ? { color: `var(--user-text-secondary)` } : {}}
                >
                  <Icon size={12} className={!isActive ? cfg.color : ""} />
                  {cfg.label} ({counts[key] || 0})
                </button>
              );
            })}
          </div>
        )}

        {hasDrafts && (filter === "all" || filter === "draft") && (
          <div className="space-y-4 mb-4">
            {drafts.map((draft) => (
              <DraftCard key={draft._id} draft={draft} />
            ))}
          </div>
        )}

        {ordersLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
          </div>
        ) : filter !== "draft" && filtered.length === 0 && !(filter === "all" && hasDrafts) ? (
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
              <ShoppingBag size={32} className="text-[var(--user-text-subtle)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--user-text)] mb-2">
              {orders.length === 0 ? "No orders yet" : "No orders in this status"}
            </h2>
            <p className="text-sm text-[var(--user-text-muted)] mb-6 max-w-sm mx-auto">
              {orders.length === 0 ? "Start shopping to see your orders here." : "Try a different filter."}
            </p>
            <Link href="/" className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
              Shop Now
            </Link>
          </div>
        ) : filter !== "draft" && filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const pay = PAYMENT_LABEL[order.payment?.method] || PAYMENT_LABEL.cod;
              const PayIcon = pay.icon;
              const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

              return (
                <button
                  key={order._id}
                  onClick={() => router.push(`/orders/${order._id}`)}
                  className="w-full text-left rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 lg:p-5 hover:border-[var(--user-accent)]/50 hover:-translate-y-0.5 transition group"
                >
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <p className="font-mono font-black text-sm text-[var(--user-accent)]">{order.order_number}</p>
                        <p className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> {date}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
                      <StatusIcon size={12} className={cfg.color} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <div className="flex -space-x-3">
                      {order.items.slice(0, 4).map((item, i) => {
                        const imgUrl = getImgUrl(item.image);
                        return imgUrl ? (
                          <img key={i} src={imgUrl} alt={item.name} className="w-11 h-11 rounded-xl object-cover border-2 border-[var(--user-bg-card)] shadow-md" />
                        ) : (
                          <div key={i} className="w-11 h-11 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-bg-card)] shadow-md flex items-center justify-center">
                            <Package size={14} className="text-[var(--user-text-subtle)]" />
                          </div>
                        );
                      })}
                      {order.items.length > 4 && (
                        <div className="w-11 h-11 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-bg-card)] shadow-md flex items-center justify-center">
                          <span className="text-[10px] font-black text-[var(--user-text-muted)]">+{order.items.length - 4}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--user-text-secondary)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2.5 py-1.5 rounded-lg">
                        <MapPin size={11} /> {order.items.length} item{order.items.length > 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--user-text-secondary)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2.5 py-1.5 rounded-lg">
                        <PayIcon size={11} /> {pay.label}
                      </span>
                      {order.shipping_method === "express" && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--user-text-secondary)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2.5 py-1.5 rounded-lg">
                          <Zap size={11} /> Express
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <OrderProgress status={order.status} />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--user-border)]">
                    <p className="text-xs text-[var(--user-text-muted)]">
                      Total: <span className="text-base font-black text-[var(--user-accent)]">Rs. {order.total.toLocaleString()}</span>
                    </p>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--user-text-secondary)] group-hover:text-[var(--user-accent)] transition">
                      View Details <ArrowRight size={13} className="group-hover:translate-x-0.5 transition" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}