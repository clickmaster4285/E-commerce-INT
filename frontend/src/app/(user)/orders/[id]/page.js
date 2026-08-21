"use client";

import { use, Fragment } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orderApi } from "@/apis/orderApi";
import {
  ArrowLeft, CheckCircle2, Package, Loader2, MapPin, CreditCard, Calendar,
  Truck, Clock, XCircle, Banknote, Landmark, Zap, Phone, FileText, ShieldCheck, Tag,
} from "lucide-react";

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending:    { label: "Pending",    icon: Clock,        color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   desc: "Order received, confirmation ka intezar" },
  confirmed:  { label: "Confirmed",  icon: CheckCircle2, color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    desc: "Order confirm ho gaya" },
  processing: { label: "Processing", icon: Package,      color: "text-cyan-500",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    desc: "Order pack ho raha hai" },
  shipped:    { label: "Shipped",    icon: Truck,        color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  desc: "Order delivery par hai" },
  delivered:  { label: "Delivered",  icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", desc: "Order aap tak pahunch gaya" },
  cancelled:  { label: "Cancelled",  icon: XCircle,      color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/30",     desc: "Order cancel kar diya gaya" },
};

const PAYMENT_CONFIG = {
  cod:  { label: "Cash on Delivery", icon: Banknote },
  bank: { label: "Bank Transfer",    icon: Landmark },
  card: { label: "Debit / Credit Card", icon: CreditCard },
};

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const DetailStepper = ({ status }) => {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
        <XCircle size={20} className="text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-500">Order Cancelled</p>
          <p className="text-[11px] text-[var(--user-text-muted)]">Ye order cancel kar diya gaya tha.</p>
        </div>
      </div>
    );
  }

  const idx = STATUS_FLOW.indexOf(status);

  return (
    <div className="flex items-start">
      {STATUS_FLOW.map((s, i) => {
        const cfg = STATUS_CONFIG[s];
        const StepIcon = cfg.icon;
        const done = i < idx;
        const current = i === idx;
        return (
          <Fragment key={s}>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                  done
                    ? "bg-[var(--user-accent)] border-[var(--user-accent)] text-[var(--user-accent-text)]"
                    : current
                    ? "border-[var(--user-accent)] text-[var(--user-accent)] bg-[var(--user-accent)]/10"
                    : "border-[var(--user-border)] text-[var(--user-text-subtle)]"
                } ${current ? "animate-pulse" : ""}`}
              >
                {done ? <CheckCircle2 size={15} /> : <StepIcon size={14} />}
              </div>
              <p className={`mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-center ${
                done || current ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"
              }`}>
                {cfg.label}
              </p>
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <div className={`h-0.5 flex-1 mt-4 rounded-full ${i < idx ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

export default function OrderDetailPage({ params }) {
  const { id } = use(params);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderApi.getById(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-[500px] mx-auto px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-[var(--user-text)] mb-2">Order Not Found</h1>
        <Link href="/orders" className="text-sm text-[var(--user-accent)] font-bold hover:underline">Back to Orders</Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const pay = PAYMENT_CONFIG[order.payment?.method] || PAYMENT_CONFIG.cod;
  const PayIcon = pay.icon;
  const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  // ✅ Total savings calculate karo (discounted orders ke liye)
  const totalSavings = order.items.reduce((sum, i) => {
    const original = Number(i.original_price || 0);
    const paid = Number(i.price || 0);
    const saved = (original - paid) * (Number(i.qty) || 1);
    return sum + (saved > 0 ? saved : 0);
  }, 0);

  return (
    <main className="max-w-[1000px] mx-auto px-4 lg:px-6 py-6 lg:py-10 pb-24 md:pb-10">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition mb-5">
        <ArrowLeft size={14} /> Back to Orders
      </Link>

      {/* ✅ HERO CARD */}
      <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 lg:p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-lg lg:text-xl font-black text-[var(--user-text)]">{order.order_number}</h1>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
                <StatusIcon size={12} className={cfg.color} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            <p className="text-xs text-[var(--user-text-muted)] flex items-center gap-1.5">
              <Calendar size={11} /> Placed on {date}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--user-text-muted)] uppercase tracking-wider">Total</p>
            <p className="text-2xl font-black text-[var(--user-accent)]">Rs. {order.total.toLocaleString()}</p>
            {totalSavings > 0 && (
              <p className="text-[10px] font-bold text-[var(--user-success)] flex items-center gap-1 justify-end mt-1">
                <Tag size={10} /> You saved Rs. {totalSavings.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <DetailStepper status={order.status} />
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <p className="text-center text-[11px] text-[var(--user-text-muted)] mt-4 flex items-center justify-center gap-1.5">
              <Truck size={12} className="text-[var(--user-accent)]" />
              {cfg.desc} · Estimated delivery: {order.shipping_method === "express" ? "1–2" : "2–4"} working days
            </p>
          )}
          {order.status === "delivered" && (
            <p className="text-center text-[11px] text-[var(--user-success)] font-bold mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck size={12} /> Delivered successfully — shukriya!
            </p>
          )}
        </div>
      </div>

      {/* ✅ 2-COLUMN LAYOUT */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        {/* LEFT — Items */}
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--user-text)] mb-4">
            <Package size={15} className="text-[var(--user-accent)]" /> Items ({order.items.length})
          </h2>
          <div className="divide-y divide-[var(--user-border)]">
            {order.items.map((i, idx) => {
              const originalPrice = Number(i.original_price || 0);
              const hasDiscount = originalPrice > 0 && originalPrice > Number(i.price);
              const itemSavings = hasDiscount ? (originalPrice - Number(i.price)) * Number(i.qty) : 0;
              
              return (
                <div key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {getImgUrl(i.image) ? (
                    <img src={getImgUrl(i.image)} alt="" className="w-14 h-14 rounded-xl object-cover border border-[var(--user-border)]" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[var(--user-bg-hover)] flex items-center justify-center"><Package size={18} className="text-[var(--user-text-subtle)]" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--user-text)] truncate">{i.name}</p>
                    {i.variantTitle && <p className="text-[11px] text-[var(--user-text-muted)] truncate">{i.variantTitle}</p>}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-[var(--user-text-subtle)]">Qty: {i.qty} × Rs. {Number(i.price).toLocaleString()}</p>
                      {hasDiscount && (
                        <p className="text-[10px] text-[var(--user-text-subtle)] line-through">Rs. {originalPrice.toLocaleString()}</p>
                      )}
                    </div>
                    {hasDiscount && i.discount_name && (
                      <p className="text-[9px] font-bold text-[var(--user-success)] flex items-center gap-0.5 mt-0.5">
                        <Tag size={8} /> {i.discount_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {hasDiscount && (
                      <p className="text-[10px] text-[var(--user-text-subtle)] line-through">Rs. {(originalPrice * i.qty).toLocaleString()}</p>
                    )}
                    <p className="text-sm font-black text-[var(--user-text)]">Rs. {(Number(i.price) * i.qty).toLocaleString()}</p>
                    {itemSavings > 0 && (
                      <p className="text-[9px] font-bold text-[var(--user-success)] mt-0.5">Save Rs. {itemSavings.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Info stack */}
        <div className="space-y-4">
          {/* Delivery */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[var(--user-text)] mb-3">
              <MapPin size={14} className="text-[var(--user-accent)]" /> Delivery Address
            </h2>
            <p className="text-xs text-[var(--user-text-muted)] leading-relaxed">
              <span className="font-semibold text-[var(--user-text)]">{order.address_snapshot?.full_name}</span><br />
              {order.address_snapshot?.street_address1}<br />
              {order.address_snapshot?.street_address2 && <>{order.address_snapshot.street_address2}<br /></>}
              {order.address_snapshot?.city}, {order.address_snapshot?.state}<br />
              {order.address_snapshot?.country} {order.address_snapshot?.zip_code}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-[var(--user-text-secondary)] mt-2">
              <Phone size={11} className="text-[var(--user-accent)]" /> {order.address_snapshot?.phone}
            </p>
            {order.address_snapshot?.delivery_instructions && (
              <p className="flex items-start gap-1.5 text-[11px] text-[var(--user-text-muted)] mt-2 bg-[var(--user-bg-hover)] border border-[var(--user-border)] rounded-lg p-2.5">
                <FileText size={11} className="text-[var(--user-accent)] shrink-0 mt-0.5" /> {order.address_snapshot.delivery_instructions}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--user-border)]">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--user-text-secondary)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2.5 py-1.5 rounded-lg">
                {order.shipping_method === "express" ? <Zap size={11} /> : <Truck size={11} />}
                {order.shipping_method === "express" ? "Express (1–2 days)" : "Standard (2–4 days)"}
              </span>
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[var(--user-text)] mb-3">
              <CreditCard size={14} className="text-[var(--user-accent)]" /> Payment
            </h2>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-semibold text-[var(--user-text)]">
                <PayIcon size={14} className="text-[var(--user-accent)]" /> {pay.label}
              </p>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                order.payment?.status === "paid"
                  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                  : "text-amber-500 bg-amber-500/10 border-amber-500/30"
              }`}>
                {order.payment?.status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm pt-3 border-t border-[var(--user-border)]">
              <div className="flex justify-between text-[var(--user-text-muted)]">
                <span>Subtotal</span>
                <span className="text-[var(--user-text)] font-semibold">Rs. {order.subtotal.toLocaleString()}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--user-success)] flex items-center gap-1">
                    <Tag size={12} /> Discount Savings
                  </span>
                  <span className="text-[var(--user-success)] font-semibold">-Rs. {totalSavings.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--user-text-muted)]">
                <span>Shipping</span>
                <span className="text-[var(--user-text)] font-semibold">{order.shipping === 0 ? "FREE" : `Rs. ${order.shipping.toLocaleString()}`}</span>
              </div>
              {order.tax > 0 && <div className="flex justify-between text-[var(--user-text-muted)]"><span>Tax</span><span className="text-[var(--user-text)] font-semibold">Rs. {order.tax.toLocaleString()}</span></div>}
              <div className="flex justify-between pt-2 border-t border-[var(--user-border)]">
                <span className="font-bold text-[var(--user-text)]">Total</span>
                <span className="text-lg font-black text-[var(--user-accent)]">Rs. {order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}