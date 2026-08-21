"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { orderApi } from "@/apis/orderApi";
import { useCart } from "@/components/user/CartContext";
import {
  Package, Loader2, ShoppingBag, Calendar, MapPin, CreditCard,
  CheckCircle2, Clock, Truck, XCircle, ArrowRight, Banknote, Landmark, Zap, Trash2, Play,
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

// Progress tracker dots
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

// ✅ Draft progress dots (step based)
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

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restoreItems } = useCart();
  const [filter, setFilter] = useState("all");

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



  // ✅ Fetch ALL drafts
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

  const resumeDraft = (draftId) =>
    router.push(`/checkout?draftId=${draftId}`);


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



   // ✅ Draft card — "all" aur "draft" dono mein show hoga (multiple)
  const DraftCard = ({ draft }) => {
    const items = draft.items || [];
    const count = items.length || draft.selectedKeys?.length || 0;
    const total = items.reduce(
      (s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
      0,
    );
    const pay = PAYMENT_LABEL[draft.paymentMethod] || PAYMENT_LABEL.cod;

    return (
      <div className="w-full text-left rounded-2xl border-2 border-[var(--user-accent)] bg-[var(--user-accent)]/5 p-4 lg:p-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="font-mono font-black text-sm text-[var(--user-accent)]">
                DRAFT ORDER
              </p>
              <p className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1 mt-0.5">
                <Calendar size={10} />{" "}
                {draft.updatedAt
                  ? new Date(draft.updatedAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-[var(--user-accent)]/10 border-[var(--user-accent)]/40">
            <ShoppingBag size={12} className="text-[var(--user-accent)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--user-accent)]">
              Draft
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex -space-x-3">
            {items.slice(0, 4).map((item, i) => {
              const imgUrl = getImgUrl(item.image);
              return imgUrl ? (
                <img
                  key={i}
                  src={imgUrl}
                  alt={item.name}
                  className="w-11 h-11 rounded-xl object-cover border-2 border-[var(--user-bg-card)] shadow-md"
                />
              ) : (
                <div
                  key={i}
                  className="w-11 h-11 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-bg-card)] shadow-md flex items-center justify-center"
                >
                  <Package
                    size={14}
                    className="text-[var(--user-text-subtle)]"
                  />
                </div>
              );
            })}
            {items.length > 4 && (
              <div className="w-11 h-11 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-bg-card)] shadow-md flex items-center justify-center">
                <span className="text-[10px] font-black text-[var(--user-text-muted)]">
                  +{items.length - 4}
                </span>
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
          <p className="text-xs text-[var(--user-text-muted)]">
            Total:{" "}
            <span className="text-base font-black text-[var(--user-accent)]">
              Rs. {total.toLocaleString()}
            </span>
          </p>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[var(--user-text)]">My Orders</h1>
          <p className="text-xs text-[var(--user-text-muted)] mt-1">
            {orders.length} total · {activeCount} active
          </p>
        </div>
        <Link href="/" className="text-xs text-[var(--user-accent)] font-bold hover:underline flex items-center gap-1">
          <ShoppingBag size={13} /> Continue Shopping
        </Link>
      </div>



            {/* ✅ Filter Tabs — All ke baad Draft (multiple) */}
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

          {/* ✅ DRAFT CARDS — "all" aur "draft" dono mein (multiple) */}
      {hasDrafts && (filter === "all" || filter === "draft") && (
        <div className="space-y-4 mb-4">
          {drafts.map((draft) => (
            <DraftCard key={draft._id} draft={draft} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filter !== "draft" &&
        filtered.length === 0 &&
        !(filter === "all" && hasDrafts) && (
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
            <ShoppingBag size={32} className="text-[var(--user-text-subtle)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--user-text)] mb-2">
            {orders.length === 0 ? "No orders yet" : "No orders in this status"}
          </h2>
          <p className="text-sm text-[var(--user-text-muted)] mb-6">
            {orders.length === 0 ? "Start shopping to see your orders here." : "Try a different filter."}
          </p>
          <Link href="/" className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
            Shop Now
          </Link>
        </div>
      )}

      {/* Orders List */}
      {filter !== "draft" && filtered.length > 0 && (
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
      )}
    </main>
  );
}