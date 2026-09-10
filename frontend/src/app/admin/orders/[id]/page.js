"use client";
import React, { useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderApi } from "@/apis/admin/orderApi";

/* ==================== ICONS ==================== */
const ArrowLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const XIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const ClockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const CheckCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const BoxIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const TruckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1h4a1 1 0 001-1v-3m-9 4a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>);
const HomeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h4" /></svg>);
const XCircleIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const BanIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);
const AlertIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const LockIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>);
const BanknoteIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 7h20v10H2V7zm10 5a2 2 0 100-4 2 2 0 000 4zm-6 0h.01M18 12h.01" /></svg>);

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

const STATUS_ICON_MAP = {
  pending: ClockIcon, confirmed: CheckCircleIcon, processing: BoxIcon,
  shipped: TruckIcon, delivered: HomeIcon, cancelled: XCircleIcon,
};

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

const STATUS_FLOW = ["pending", "confirmed", "shipped", "delivered"];
function StatusStepper({ order }) {
  const cancelled = order.status === "cancelled";
  const effective = order.status === "processing" ? "confirmed" : order.status;
  const currentIdx = STATUS_FLOW.indexOf(effective);
  const paymentDone = order.payment?.status === "paid";
  const paymentWaiting = !cancelled && effective === "delivered" && !paymentDone;

  return (
    <div className="flex items-start flex-wrap gap-y-3">
      {STATUS_FLOW.map((step, i) => {
        const done = !cancelled && currentIdx >= i;
        const connectorGreen = !cancelled && (i === STATUS_FLOW.length - 1 ? paymentDone : currentIdx > i);
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
              <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 transition"
                style={{ backgroundColor: done ? "#10b981" : "transparent", borderColor: done ? "#10b981" : "var(--border-color)", color: "#fff" }}>
                {done ? <CheckIcon className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--border-color)" }} />}
              </div>
              <span className="text-[10px] font-semibold capitalize text-center leading-tight"
                style={{ color: done ? "var(--text-primary)" : "var(--text-muted)" }}>
                {step === "pending" ? "Placed" : step}
              </span>
            </div>
            <div className="flex-1 h-0.5 mt-3 mx-1 rounded min-w-[20px]"
              style={{ backgroundColor: connectorGreen ? "#10b981" : "var(--border-color)" }} />
          </React.Fragment>
        );
      })}

      {/* 💰 Payment Received (last step) */}
      <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
        <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 transition"
          style={{
            backgroundColor: paymentDone ? "#10b981" : "transparent",
            borderColor: paymentDone ? "#10b981" : paymentWaiting ? "#fbbf24" : "var(--border-color)",
            color: paymentDone ? "#fff" : paymentWaiting ? "#fbbf24" : "var(--border-color)",
          }}>
          {paymentDone ? <CheckIcon className="w-3 h-3" /> : <BanknoteIcon className="w-3 h-3" />}
        </div>
        <span className="text-[10px] font-semibold text-center leading-tight"
          style={{ color: paymentDone ? "var(--text-primary)" : paymentWaiting ? "#fbbf24" : "var(--text-muted)" }}>
          Payment
        </span>
      </div>

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

/* ==================== ACTION BUTTONS (Smart by Status) ==================== */
function OrderActions({ order, onUpdate, onCancel, onPaymentReceived, isPending, isPaymentPending }) {
  const status = order.status;
  const payStatus = order.payment?.status || "pending";

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
        style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <LockIcon className="w-4 h-4" style={{ color: "#f87171" }} />
        <span className="text-xs font-semibold" style={{ color: "#f87171" }}>This order is cancelled</span>
      </div>
    );
  }

  // ✅ Delivered — last action = Payment Received
  if (status === "delivered") {
    if (payStatus !== "paid") {
      return (
        <button
          onClick={onPaymentReceived}
          disabled={isPaymentPending}
          className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
          style={{ backgroundColor: "#10b981", color: "#fff" }}>
          {isPaymentPending ? <Spinner className="w-4 h-4" /> : <BanknoteIcon className="w-4 h-4" />}
          Payment Received
        </button>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
        style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
        <CheckCircleIcon className="w-4 h-4" style={{ color: "#34d399" }} />
        <span className="text-xs font-semibold" style={{ color: "#34d399" }}>Order completed & payment received</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pending" && (
        <button onClick={() => onUpdate("confirmed")} disabled={isPending}
          className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/10"
          style={{ backgroundColor: "#3b82f6", color: "#fff" }}>
          {isPending ? <Spinner className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
          Confirm Order
        </button>
      )}

      {(status === "confirmed" || status === "processing") && (
        <button onClick={() => onUpdate("shipped")} disabled={isPending}
          className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/10"
          style={{ backgroundColor: "#6366f1", color: "#fff" }}>
          {isPending ? <Spinner className="w-4 h-4" /> : <TruckIcon className="w-4 h-4" />}
          Mark as Shipped
        </button>
      )}

      {status === "shipped" && (
        <button onClick={() => onUpdate("delivered")} disabled={isPending}
          className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
          style={{ backgroundColor: "#10b981", color: "#fff" }}>
          {isPending ? <Spinner className="w-4 h-4" /> : <HomeIcon className="w-4 h-4" />}
          Mark as Delivered
        </button>
      )}

      <button onClick={onCancel} disabled={isPending}
        className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
        <BanIcon className="w-4 h-4" />
        Cancel Order
      </button>
    </div>
  );
}

/* ==================== MAIN PAGE ==================== */
export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const body = await orderApi.getById(id);
      return body?.data || null;
    },
    retry: 1,
  });

  const updateStatusMutation = useMutation({
        mutationFn: ({ id, status, cancel_reason }) => orderApi.updateStatus(id, { status, ...(cancel_reason ? { cancel_reason } : {}) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success(`Order marked as ${variables.status}`);
      setCancelConfirm(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Failed to update order"),
  });
    const updatePaymentMutation = useMutation({
    mutationFn: ({ id }) => orderApi.updatePayment(id, { status: "paid" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-count"] });
      toast.success("Payment marked as received");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Failed to update payment"),
  });

  const handlePaymentReceived = () => updatePaymentMutation.mutate({ id });

  const handleUpdate = (status) => updateStatusMutation.mutate({ id, status });
  const handleCancel = () => {
    if (!cancelReason.trim()) return toast.error("Cancellation reason is required");
    updateStatusMutation.mutate({ id, status: "cancelled", cancel_reason: cancelReason.trim() });
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const savings = useMemo(() => (order?.items || []).reduce((s, it) => s + Number(it.savings || 0), 0), [order]);
  const payStatus = order?.payment?.status || "pending";
  const user = order?.user_id || {};

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ color: "var(--text-primary)" }}>
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="w-full min-h-screen p-4" style={{ color: "var(--text-primary)" }}>
        <button onClick={() => router.push("/admin/orders")}
          className="mb-4 h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition hover:opacity-90"
          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
          <ArrowLeftIcon /> Back to Orders
        </button>
        <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
          <XCircleIcon className="w-8 h-8 opacity-60" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Order not found or failed to load.</p>
          <button onClick={() => refetch()} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* Header with smart action buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin/orders")}
              aria-label="Back to orders"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <ArrowLeftIcon />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] leading-7 font-bold tracking-tight">Order {order.order_number}</h1>
                <StatusBadge status={order.status} />
                <PaymentBadge status={payStatus} />
              </div>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                Placed {formatDateTime(order.created_at)} • {order.items?.length || 0} items • {order.payment?.method?.toUpperCase() || "—"}
              </p>
            </div>
          </div>
          <div>
                      <OrderActions
              order={order}
              onUpdate={handleUpdate}
              onCancel={() => setCancelConfirm(true)}
              onPaymentReceived={handlePaymentReceived}
              isPending={updateStatusMutation.isPending}
              isPaymentPending={updatePaymentMutation.isPending}
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <StatusStepper order={order} />
          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
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

            {order.notes && (
              <InfoCard title="Customer Notes">
                <p className="text-sm whitespace-pre-line">{order.notes}</p>
              </InfoCard>
            )}
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
                    <tr key={`${order._id}-item-${idx}`}
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
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl border"
            style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertIcon className="w-5 h-5" style={{ color: "#f87171" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Cancel Order {order.order_number}?</h3>
                               <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  This will mark the order as cancelled and restore stock. This action cannot be undone.
                </p>
                <div className="mt-3">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                    Cancellation Reason <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Stock unavailable, customer request..."
                    className="w-full px-3 py-2 rounded-md text-sm outline-none resize-none transition focus:ring-1 focus:ring-red-500/40"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setCancelConfirm(false)} disabled={updateStatusMutation.isPending}
                className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>
                Keep Order
              </button>
                           <button onClick={handleCancel} disabled={updateStatusMutation.isPending || !cancelReason.trim()}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger, #ef4444)" }}>
                {updateStatusMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> Cancelling...</> : "Yes, Cancel"}
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