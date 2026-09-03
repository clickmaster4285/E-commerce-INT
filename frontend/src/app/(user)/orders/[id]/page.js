"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { orderApi } from "@/apis/user/orderApi";
import { addressApi } from "@/apis/user/addressApi";
import { Country, State, City } from "country-state-city";
import {
  ArrowLeft, CheckCircle2, Package, Loader2, MapPin, CreditCard, Calendar,
  Truck, Clock, XCircle, Banknote, Landmark, Zap, Phone, FileText, ShieldCheck,
  Tag, Headphones, Download, Pencil, Save, X, ChevronDown, Sparkles, TrendingUp,
  Box, MessageCircle, Lock
} from "lucide-react";

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending:    { label: "Pending",    icon: Clock,        desc: "We've received your order and are preparing it" },
  confirmed:  { label: "Confirmed",  icon: CheckCircle2, desc: "Your order has been confirmed" },
  processing: { label: "Processing", icon: Package,      desc: "Your items are being carefully packed" },
  shipped:    { label: "Shipped",    icon: Truck,        desc: "Your order is on its way to you" },
  delivered:  { label: "Delivered",  icon: CheckCircle2, desc: "Your order has been successfully delivered" },
  cancelled:  { label: "Cancelled",  icon: XCircle,      desc: "This order has been cancelled" },
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
const fmt = (n) => `Rs. ${Math.round(n).toLocaleString()}`;

/* ============ MONOCHROME TIMELINE (no halo) ============ */
const OrderTimeline = ({ status }) => {
  if (status === "cancelled") {
    return (
      <div className="rounded-2xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/20 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--user-danger)] flex items-center justify-center shrink-0">
            <XCircle size={22} className="text-white" />
          </div>
          <div>
            <p className="text-base font-black text-[var(--user-danger)]">Order Cancelled</p>
            <p className="text-xs text-[var(--user-text-muted)] mt-1">Items have been restored to stock.</p>
          </div>
        </div>
      </div>
    );
  }

  const idx = STATUS_FLOW.indexOf(status);

  return (
    <>
      <div className="lg:hidden relative">
        <div className="absolute left-[21px] top-6 bottom-6 w-[2px] bg-[var(--user-border)] rounded-full" />
        <div className="absolute left-[21px] top-6 w-[2px] bg-[var(--user-accent)] rounded-full transition-all duration-700"
          style={{ height: `calc((100% - 48px) * ${idx / (STATUS_FLOW.length - 1)})` }} />
        <div className="space-y-7">
          {STATUS_FLOW.map((step, i) => {
            const isCompleted = i < idx;
            const isCurrent = i === idx;
            const cfg = STATUS_CONFIG[step];
            const Icon = cfg.icon;
            return (
              <div key={step} className="flex gap-4 relative">
                <div className="relative z-10 shrink-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all ${
                    isCompleted ? "bg-[var(--user-accent)] border-[var(--user-accent)] text-[var(--user-accent-text)]"
                    : isCurrent ? "bg-[var(--user-bg-card)] border-[var(--user-accent)] text-[var(--user-text)] shadow-md"
                    : "bg-[var(--user-bg-card)] border-[var(--user-border)] text-[var(--user-text-subtle)]"
                  }`}>
                    {isCompleted ? <CheckCircle2 size={19} /> : <Icon size={18} />}
                  </div>
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-black ${isCurrent || isCompleted ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"}`}>{cfg.label}</p>
                    {isCurrent && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)]">Now</span>}
                  </div>
                  <p className="text-xs text-[var(--user-text-muted)] mt-1 leading-relaxed">{cfg.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden lg:block relative">
        <div className="absolute left-[10%] right-[10%] top-[24px] h-[2px] -translate-y-1/2 bg-[var(--user-border)] rounded-full" />
        <div className="absolute left-[10%] top-[24px] h-[2px] -translate-y-1/2 bg-[var(--user-accent)] rounded-full transition-all duration-700"
          style={{ width: `${(idx / (STATUS_FLOW.length - 1)) * 80}%` }} />
        <div className="relative flex items-start">
          {STATUS_FLOW.map((step, i) => {
            const isCompleted = i < idx;
            const isCurrent = i === idx;
            const cfg = STATUS_CONFIG[step];
            const Icon = cfg.icon;
            return (
              <div key={step} className="flex-1 flex flex-col items-center relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  isCompleted ? "bg-[var(--user-accent)] border-[var(--user-accent)] text-[var(--user-accent-text)]"
                  : isCurrent ? "bg-[var(--user-bg-card)] border-[var(--user-accent)] text-[var(--user-text)] shadow-md"
                  : "bg-[var(--user-bg-card)] border-[var(--user-border)] text-[var(--user-text-subtle)]"
                }`}>
                  {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={19} />}
                </div>
                <p className={`mt-3 text-xs font-black uppercase tracking-wider ${isCurrent || isCompleted ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"}`}>{cfg.label}</p>
                {isCurrent && <span className="mt-1.5 text-[9px] font-black px-2.5 py-0.5 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)]">Now</span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

/* ============ ✅ SIMPLIFIED ADDRESS MODAL (Edit Current Only) ============ */
const AddressModal = ({ order, addresses, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const currentAddress = addresses.find(a => String(a._id) === String(order.address_id));
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState(null);

  // ✅ Pre-fill form with current address
  const [form, setForm] = useState({
    full_name: currentAddress?.full_name || "",
    phone: currentAddress?.phone || "",
    country: currentAddress?.country || "",
    state: currentAddress?.state || "",
    city: currentAddress?.city || "",
    street_address1: currentAddress?.street_address1 || "",
    street_address2: currentAddress?.street_address2 || "",
    zip_code: currentAddress?.zip_code || "",
    delivery_instructions: currentAddress?.delivery_instructions || "",
    is_default: currentAddress?.is_default || false,
  });

  const allCountries = Country.getAllCountries();
  const allStates = (() => { const c = allCountries.find(x => x.name === form.country); return c ? State.getStatesOfCountry(c.isoCode) : []; })();
  const allCities = (() => { const c = allCountries.find(x => x.name === form.country); const s = allStates.find(x => x.name === form.state); return c && s ? City.getCitiesOfState(c.isoCode, s.isoCode) : []; })();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
    queryClient.invalidateQueries({ queryKey: ["order", order._id] });
    queryClient.invalidateQueries({ queryKey: ["myOrders"] });
  };

  const handleSave = async (type) => {
    setSaving(true); setActionType(type);
    try {
      const required = form.full_name.trim() && form.phone.trim() && form.country && form.state && form.city && form.street_address1.trim();
      if (!required) { toast.error("Please fill all required fields"); setSaving(false); setActionType(null); return; }

      if (type === "update_saved") {
        // Update saved address + order snapshot
        if (currentAddress) await addressApi.update(currentAddress._id, form);
        await axiosInstance.put(`/orders/${order._id}/edit`, { address_id: currentAddress?._id });
      } else {
        // Order only — custom snapshot, address book untouched
        await axiosInstance.put(`/orders/${order._id}/edit`, { address_id: currentAddress?._id, address_override: form });
      }

      invalidateAll();
      toast.success(type === "order_only" ? "Delivery address updated for this order" : "Address updated in your address book & this order");
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update address");
    } finally { setSaving(false); setActionType(null); }
  };

  const inputCls = "w-full h-11 px-3 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)]";
  const labelCls = "block text-xs font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider";
  const textareaCls = "w-full px-3 py-2 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] resize-none";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[var(--user-bg-card)] border-t-2 sm:border-2 border-[var(--user-border)] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b-2 border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur-sm">
          <div>
            <h2 className="text-base font-black text-[var(--user-text)]">Edit Delivery Address</h2>
            <p className="text-xs text-[var(--user-text-muted)] mt-0.5">{order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl border border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition"><X size={16} /></button>
        </div>

        {/* Form (current address pre-filled) */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Full Name *</label><input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Ahsan Khan" className={inputCls} /></div>
            <div><label className={labelCls}>Phone *</label><input type="tel" value={form.phone} maxLength={14} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,"").slice(0,14)})} placeholder="03001234567" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Country *</label>
            <div className="relative"><select value={form.country} onChange={e => setForm({...form, country: e.target.value, state:"", city:""})} className={inputCls+" appearance-none pr-10 cursor-pointer"}><option value="">Select country</option>{allCountries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}</select><ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>State *</label><div className="relative"><select value={form.state} onChange={e => setForm({...form, state: e.target.value, city:""})} disabled={!form.country} className={inputCls+" appearance-none pr-10 cursor-pointer disabled:opacity-50"}><option value="">Select</option>{allStates.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select><ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" /></div></div>
            <div><label className={labelCls}>City *</label><div className="relative"><select value={form.city} onChange={e => setForm({...form, city: e.target.value})} disabled={!form.state} className={inputCls+" appearance-none pr-10 cursor-pointer disabled:opacity-50"}><option value="">Select</option>{allCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select><ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" /></div></div>
            <div><label className={labelCls}>ZIP</label><input value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} placeholder="54000" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Street Address *</label><textarea value={form.street_address1} onChange={e => setForm({...form, street_address1: e.target.value})} rows="2" placeholder="Street address" className={textareaCls} /></div>
          <div><label className={labelCls}>Delivery Instructions</label><textarea value={form.delivery_instructions} onChange={e => setForm({...form, delivery_instructions: e.target.value})} rows="2" placeholder="Notes, access codes" className={textareaCls} /></div>
        </div>

        {/* ✅ COMPACT ACTION BAR — Left: Cancel | Right: 2 buttons */}
        <div className="sticky bottom-0 px-5 py-3 border-t-2 border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {/* LEFT: Cancel */}
            <button
              onClick={onClose}
              disabled={saving}
              className="h-10 px-4 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-sm font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* RIGHT: 2 action buttons (compact) */}
            <button
              onClick={() => handleSave("order_only")}
              disabled={saving}
              className="h-10 px-3 sm:px-4 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[11px] sm:text-xs font-black flex items-center gap-1.5 hover:opacity-90 transition disabled:opacity-50"
            >
              {saving && actionType === "order_only" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span className="whitespace-nowrap">Order only</span>
            </button>

            <button
              onClick={() => handleSave("update_saved")}
              disabled={saving}
              className="h-10 px-3 sm:px-4 rounded-xl border-2 border-[var(--user-border)] text-[var(--user-text-secondary)] text-[11px] sm:text-xs font-bold hover:border-[var(--user-accent)]/40 transition disabled:opacity-40 flex items-center gap-1.5"
            >
              {saving && actionType === "update_saved" ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              <span className="whitespace-nowrap">Save to address book</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============ CANCEL MODAL ============ */
const CancelConfirmModal = ({ orderNumber, canceling, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-sm bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)] shadow-2xl p-6" onClick={e => e.stopPropagation()}>
      <div className="flex flex-col items-center text-center mb-5">
        <div className="w-16 h-16 rounded-2xl bg-[var(--user-danger)] flex items-center justify-center mb-4">
          <XCircle size={28} className="text-white" />
        </div>
        <h3 className="text-lg font-black text-[var(--user-text)]">Cancel "{orderNumber}"?</h3>
        <p className="text-xs text-[var(--user-text-muted)] mt-2 leading-relaxed">Items will be restored to stock. This cannot be undone.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-sm font-semibold text-[var(--user-text)] transition">Keep Order</button>
        <button onClick={onConfirm} disabled={canceling} className="flex-1 h-11 rounded-xl bg-[var(--user-danger)] text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {canceling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Cancel
        </button>
      </div>
    </div>
  </div>
);

/* ============ MAIN ============ */
export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const { data: order, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => orderApi.getById(id), retry: false });
  const { data: addresses = [] } = useQuery({ queryKey: ["addresses"], queryFn: addressApi.getAll, enabled: !!order && order.status === "pending" });

  if (isLoading) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 lg:px-6 py-10 space-y-5 animate-pulse">
        <div className="h-4 w-32 bg-[var(--user-bg-hover)] rounded" />
        <div className="h-72 bg-[var(--user-bg-card)] rounded-3xl border border-[var(--user-border)]" />
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div className="h-96 bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)]" />
          <div className="space-y-5"><div className="h-52 bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)]" /><div className="h-64 bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)]" /></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-[500px] mx-auto px-4 py-24 text-center">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-[var(--user-accent)] flex items-center justify-center mb-6 shadow-2xl">
          <Package size={40} className="text-[var(--user-accent-text)]" />
        </div>
        <h1 className="text-2xl font-black text-[var(--user-text)] mb-2">Order Not Found</h1>
        <p className="text-sm text-[var(--user-text-muted)] mb-7">This order does not exist or has been removed.</p>
        <Link href="/orders" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition"><ArrowLeft size={16} /> Back to Orders</Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const pay = PAYMENT_CONFIG[order.payment?.method] || PAYMENT_CONFIG.cod;
  const PayIcon = pay.icon;
  const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const canCancel = order.status === "pending";

  const totalSavings = order.items.reduce((sum, i) => {
    const priceSaved = (Number(i.original_price || 0) - Number(i.price || 0)) * (Number(i.qty) || 1);
    return sum + (priceSaved > 0 ? priceSaved : 0) + Number(i.deal_savings || 0);
  }, 0);

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await axiosInstance.delete(`/orders/${order._id}`);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success("Order cancelled successfully!");
      router.push("/orders");
    } catch (e) { toast.error(e.response?.data?.message || "Failed to cancel order"); setCanceling(false); setShowCancelModal(false); }
  };

  const estimatedDelivery = order.shipping_method === "express" ? "1–2" : "2–4";

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-5 lg:px-6 py-5 sm:py-8 lg:py-10 pb-40 md:pb-10">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition mb-4 sm:mb-5 group">
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Orders
      </Link>

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--user-border)] bg-[var(--user-bg-card)] mb-5 sm:mb-6 shadow-lg">
        <div className="h-1 bg-[var(--user-accent)]" />
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow-md">
                <StatusIcon size={14} />
                <span className="text-xs font-black uppercase tracking-wider">{cfg.label}</span>
              </span>
              {totalSavings > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 text-[var(--user-success)]">
                  <Sparkles size={12} /><span className="text-[10px] font-black">Saved {fmt(totalSavings)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--user-text-muted)]">
              <Calendar size={13} /> {date}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-start mb-6">
            <div>
              <p className="text-[10px] font-bold text-[var(--user-text-muted)] uppercase tracking-[0.2em] mb-1.5">Order Number</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--user-text)] tracking-tight break-all">{order.order_number}</h1>
              <p className="text-xs sm:text-sm text-[var(--user-text-muted)] mt-2 leading-relaxed max-w-md">{cfg.desc}</p>
            </div>
            <div className="sm:text-right sm:flex sm:flex-col sm:items-end">
              <p className="text-[10px] font-bold text-[var(--user-text-muted)] uppercase tracking-[0.2em] mb-1.5">Order Total</p>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--user-text)]">{fmt(order.total)}</p>
              <p className="text-xs text-[var(--user-text-muted)] mt-2 font-semibold inline-flex items-center gap-1.5">
                <PayIcon size={13} className="text-[var(--user-accent)]" /> {pay.label}
                {order.payment?.status === "paid" && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--user-success)]/10 text-[var(--user-success)] border border-[var(--user-success)]/20">Paid</span>}
              </p>
              <div className="hidden sm:block mt-4">
                {canCancel ? (
                  <button onClick={() => setShowCancelModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[var(--user-danger)]/40 text-[var(--user-danger)] text-xs font-black hover:bg-[var(--user-danger)]/10 transition">
                    <XCircle size={14} /> Cancel Order
                  </button>
                ) : (
                  order.status !== "cancelled" && <p className="text-[10px] text-[var(--user-text-muted)] inline-flex items-center gap-1.5"><Lock size={12} /> Order locked — cannot be modified</p>
                )}
              </div>
            </div>
          </div>

          {canCancel && (
            <div className="sm:hidden mb-5">
              <button onClick={() => setShowCancelModal(true)} className="w-full h-11 rounded-xl border-2 border-[var(--user-danger)]/40 text-[var(--user-danger)] text-xs font-black hover:bg-[var(--user-danger)]/10 transition flex items-center justify-center gap-2">
                <XCircle size={14} /> Cancel Order
              </button>
            </div>
          )}

          {order.status !== "cancelled" && order.status !== "delivered" && (
            <div className="rounded-2xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--user-accent)] flex items-center justify-center shrink-0">
                  <Truck size={22} className="text-[var(--user-accent-text)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider">Estimated Delivery</p>
                  <p className="text-base lg:text-lg font-black text-[var(--user-text)] mt-0.5">{estimatedDelivery} working days</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-[var(--user-text-muted)] uppercase tracking-wider">Shipping</p>
                  <p className="text-sm font-black text-[var(--user-text)] mt-0.5 inline-flex items-center gap-1">
                    {order.shipping_method === "express" ? <><Zap size={14} /> Express</> : <><Truck size={14} /> Standard</>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {order.status === "delivered" && (
            <div className="rounded-2xl bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--user-success)] flex items-center justify-center shrink-0">
                  <CheckCircle2 size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-base lg:text-lg font-black text-[var(--user-success)]">Delivered Successfully!</p>
                  <p className="text-xs text-[var(--user-text-muted)] mt-0.5">Thank you for shopping with us.</p>
                </div>
              </div>
            </div>
          )}

          <OrderTimeline status={order.status} />
        </div>
      </div>

      {/* GRID */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-5 lg:gap-6 items-start">
        {/* ITEMS */}
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-[var(--user-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                <Box size={18} className="text-[var(--user-accent-text)]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[var(--user-text)]">Order Items</h2>
                <p className="text-[10px] text-[var(--user-text-muted)]">{order.items.length} {order.items.length === 1 ? "item" : "items"}</p>
              </div>
            </div>
            <button className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 px-3 py-1.5 rounded-lg transition">
              <Download size={14} /> Invoice
            </button>
          </div>
          <div className="divide-y divide-[var(--user-border)]">
            {order.items.map((i, idx) => {
              const originalPrice = Number(i.original_price || 0);
              const paidPrice = Number(i.price || 0);
              const qty = Number(i.qty) || 1;
              const freeItems = Number(i.free_items || 0);
              const payableItems = Number(i.payable_items || qty);
              const hasDiscount = originalPrice > 0 && originalPrice > paidPrice;
              const itemSavings = (hasDiscount ? (originalPrice - paidPrice) * qty : 0) + Number(i.deal_savings || 0);
              return (
                <div key={idx} className="flex gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-[var(--user-bg-hover)]/30 transition-colors group">
                  <div className="shrink-0 relative">
                    {getImgUrl(i.image) ? (
                      <img src={getImgUrl(i.image)} alt={i.name} className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[var(--user-border)]" />
                    ) : (
                      <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] flex items-center justify-center"><Package size={26} className="text-[var(--user-text-subtle)]" /></div>
                    )}
                    <div className="absolute -top-2 -right-2 min-w-[22px] h-6 px-1.5 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[10px] font-black flex items-center justify-center border-2 border-[var(--user-bg-card)]">×{qty}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--user-text)] line-clamp-2 leading-snug">{i.name}</h3>
                    {i.variantTitle && <p className="text-[11px] text-[var(--user-text-muted)] mt-1">{i.variantTitle}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {i.deal_id && <span className="inline-flex items-center gap-1 text-[10px] font-black text-[var(--user-text)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2 py-0.5 rounded-md"><Sparkles size={10} /> {i.deal_type === 'buy_x_get_y' ? `Buy ${i.deal_buy_quantity || 2} Get ${i.deal_get_quantity || 1} Free` : (i.deal_name || 'Deal')}</span>}
                      {freeItems > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-black text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 px-2 py-0.5 rounded-md"><CheckCircle2 size={10} /> +{freeItems} FREE</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {hasDiscount && <p className="text-[11px] text-[var(--user-text-subtle)] line-through mb-0.5">{fmt(originalPrice * qty)}</p>}
                    <p className="text-sm sm:text-lg font-black text-[var(--user-text)]">{fmt(paidPrice * payableItems)}</p>
                    {itemSavings > 0 && <p className="text-[10px] font-bold text-[var(--user-success)] mt-1 flex items-center justify-end gap-1"><TrendingUp size={10} /> Save {fmt(itemSavings)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          {/* ADDRESS — Pencil opens Edit Modal */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center"><MapPin size={18} className="text-[var(--user-accent-text)]" /></div>
                <div>
                  <h2 className="text-sm font-black text-[var(--user-text)]">Delivery Address</h2>
                  <p className="text-[10px] text-[var(--user-text-muted)]">Shipping to</p>
                </div>
              </div>
              {canCancel && (
                <button onClick={() => setShowAddressModal(true)} className="w-9 h-9 rounded-xl text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition flex items-center justify-center" title="Edit delivery address"><Pencil size={15} /></button>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--user-text)]">{order.address_snapshot?.full_name}</p>
            <p className="text-xs text-[var(--user-text-muted)] leading-relaxed mt-1">
              {order.address_snapshot?.street_address1}{order.address_snapshot?.street_address2 && <>, {order.address_snapshot.street_address2}</>}<br />
              {order.address_snapshot?.city}, {order.address_snapshot?.state}<br />
              {order.address_snapshot?.country} {order.address_snapshot?.zip_code}
            </p>
            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[var(--user-border)]">
              <Phone size={14} className="text-[var(--user-accent)]" />
              <span className="text-sm font-semibold text-[var(--user-text)]">{order.address_snapshot?.phone}</span>
            </div>
            {order.address_snapshot?.delivery_instructions && (
              <div className="flex items-start gap-2 text-xs text-[var(--user-text-muted)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] rounded-xl p-3 mt-3">
                <FileText size={14} className="text-[var(--user-accent)] shrink-0 mt-0.5" /><span className="leading-relaxed">{order.address_snapshot.delivery_instructions}</span>
              </div>
            )}
          </div>

          {/* PAYMENT */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center"><CreditCard size={18} className="text-[var(--user-accent-text)]" /></div>
              <div>
                <h2 className="text-sm font-black text-[var(--user-text)]">Payment Summary</h2>
                <p className="text-[10px] text-[var(--user-text-muted)]">{pay.label}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] mb-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--user-text)]"><PayIcon size={16} className="text-[var(--user-accent)]" /> {pay.label}</p>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${order.payment?.status === "paid" ? "text-[var(--user-success)] bg-[var(--user-success)]/10 border-[var(--user-success)]/20" : "text-amber-600 bg-amber-500/10 border-amber-500/20"}`}>{order.payment?.status || "Pending"}</span>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[var(--user-text-muted)]"><span>Subtotal</span><span className="font-semibold text-[var(--user-text)]">{fmt(order.subtotal)}</span></div>
              {totalSavings > 0 && <div className="flex justify-between text-[var(--user-success)]"><span className="flex items-center gap-1.5 font-semibold"><Sparkles size={14} /> You Saved</span><span className="font-bold">-{fmt(totalSavings)}</span></div>}
              <div className="flex justify-between text-[var(--user-text-muted)]"><span>Shipping</span><span className="font-semibold text-[var(--user-text)]">{order.shipping === 0 ? <span className="text-[var(--user-success)] font-bold">FREE</span> : fmt(order.shipping)}</span></div>
              {order.tax > 0 && <div className="flex justify-between text-[var(--user-text-muted)]"><span>Tax</span><span className="font-semibold text-[var(--user-text)]">{fmt(order.tax)}</span></div>}
              <div className="flex justify-between pt-3 mt-3 border-t-2 border-[var(--user-border)]"><span className="text-base font-bold text-[var(--user-text)]">Total Paid</span><span className="text-2xl font-black text-[var(--user-text)]">{fmt(order.total)}</span></div>
            </div>
          </div>

          {/* HELP */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--user-accent)] flex items-center justify-center shrink-0"><Headphones size={20} className="text-[var(--user-accent-text)]" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-[var(--user-text)]">Need Help?</h3>
                <p className="text-xs text-[var(--user-text-muted)] mt-1 leading-relaxed">Questions about this order? Our support team is here 24/7.</p>
                <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[var(--user-accent)] hover:gap-2.5 transition-all"><MessageCircle size={14} /> Contact Support <ArrowLeft size={12} className="rotate-180" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BAR */}
      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t border-[var(--user-border)] px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="flex gap-3">
          <button className="flex-1 h-12 rounded-xl border-2 border-[var(--user-border)] text-[var(--user-text-secondary)] text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition"><MessageCircle size={16} /> Help</button>
          {canCancel && (
            <button onClick={() => setShowCancelModal(true)} className="flex-1 h-12 rounded-xl bg-[var(--user-danger)] text-white text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition"><XCircle size={16} /> Cancel Order</button>
          )}
        </div>
      </div>

      {showAddressModal && <AddressModal order={order} addresses={addresses} onClose={() => setShowAddressModal(false)} onSuccess={() => setShowAddressModal(false)} />}
      {showCancelModal && <CancelConfirmModal orderNumber={order.order_number} canceling={canceling} onClose={() => setShowCancelModal(false)} onConfirm={handleCancel} />}
    </main>
  );
}