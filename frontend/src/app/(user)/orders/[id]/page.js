"use client";

import { use, Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { orderApi } from "@/apis/user/orderApi";
import { addressApi } from "@/apis/user/addressApi";
import {
  ArrowLeft, CheckCircle2, Package, Loader2, MapPin, CreditCard, Calendar,
  Truck, Clock, XCircle, Banknote, Landmark, Zap, Phone, FileText, ShieldCheck, 
  Tag, Headphones, Download, Pencil, Plus, Minus, Save, X, Trash2, AlertTriangle
} from "lucide-react";

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending:    { label: "Pending",    icon: Clock,        color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   desc: "Order received, awaiting confirmation" },
  confirmed:  { label: "Confirmed",  icon: CheckCircle2, color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    desc: "Order has been confirmed" },
  processing: { label: "Processing", icon: Package,      color: "text-cyan-500",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    desc: "Order is being packed" },
  shipped:    { label: "Shipped",    icon: Truck,        color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  desc: "Order is out for delivery" },
  delivered:  { label: "Delivered",  icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", desc: "Order has been successfully delivered" },
  cancelled:  { label: "Cancelled",  icon: XCircle,      color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/30",     desc: "Order has been cancelled" },
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
      <div className="flex items-center gap-3 rounded-xl bg-red-500/5 border border-red-500/20 p-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
          <XCircle size={20} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-red-500">Order Cancelled</p>
          <p className="text-xs text-red-500/70 mt-0.5">This order has been cancelled and will not be processed.</p>
        </div>
      </div>
    );
  }

  const idx = STATUS_FLOW.indexOf(status);

  return (
    <div className="relative py-4 px-2">
      <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[var(--user-border)] -translate-y-1/2 rounded-full" />
      <div 
        className="absolute left-0 top-1/2 h-0.5 bg-[var(--user-accent)] -translate-y-1/2 rounded-full transition-all duration-700"
        style={{ width: `${(idx / (STATUS_FLOW.length - 1)) * 100}%` }}
      />
      <div className="relative flex items-start justify-between">
        {STATUS_FLOW.map((step, index) => {
          const isCompleted = index <= idx;
          const isCurrent = index === idx;
          const cfg = STATUS_CONFIG[step];
          
          return (
            <div key={step} className="flex flex-col items-center flex-1 relative z-10">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isCompleted 
                  ? "bg-[var(--user-accent)] border-[var(--user-accent)] text-white shadow-lg shadow-[var(--user-accent)]/30" 
                  : "bg-[var(--user-bg-card)] border-[var(--user-border)]"
              } ${isCurrent ? "ring-4 ring-[var(--user-accent)]/20 scale-110" : ""}`}>
                {isCompleted && index < idx && <CheckCircle2 size={10} strokeWidth={3} />}
              </div>
              <span className={`mt-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                isCurrent ? cfg.color : isCompleted ? "text-[var(--user-text)]" : "text-[var(--user-text-subtle)]"
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

// ✅ EDIT MODAL - Qty + Address
const EditOrderModal = ({ order, addresses, onClose, onSuccess }) => {
  const [editingItems, setEditingItems] = useState(order.items.map(item => ({
    id: item._id,
    qty: item.qty,
    name: item.name,
    price: item.price,
    image: item.image,
  })));
  const [selectedAddressId, setSelectedAddressId] = useState(String(order.address_id || ""));
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleQtyChange = (index, delta) => {
    setEditingItems(prev => prev.map((item, i) => 
      i === index ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const newTotal = editingItems.reduce((sum, item) => sum + (Number(item.price) || 0) * item.qty, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/orders/${order._id}/edit`, {
        items: editingItems.map(i => ({ id: i.id, qty: i.qty })),
        address_id: selectedAddressId,
      });
      queryClient.invalidateQueries({ queryKey: ["order", order._id] });
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success("Order updated successfully!");
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--user-border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--user-text)]">Edit Order</h2>
            <p className="text-xs text-[var(--user-text-muted)] mt-0.5">{order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--user-bg-hover)] rounded-lg transition">
            <X size={18} className="text-[var(--user-text-muted)]" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-3">Update Quantities</h3>
            <div className="space-y-3">
              {editingItems.map((item, index) => (
                <div key={item.id || index} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)]">
                  {getImgUrl(item.image) ? (
                    <img src={getImgUrl(item.image)} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-[var(--user-border)] bg-white shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center shrink-0">
                      <Package size={16} className="text-[var(--user-text-subtle)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--user-text)] truncate">{item.name}</p>
                    <p className="text-[11px] text-[var(--user-text-muted)]">Rs. {(Number(item.price) || 0).toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => handleQtyChange(index, -1)}
                      className="w-8 h-8 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text)] hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] transition"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-[var(--user-text)]">{item.qty}</span>
                    <button 
                      onClick={() => handleQtyChange(index, 1)}
                      className="w-8 h-8 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text)] hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[var(--user-text-muted)] uppercase tracking-wider mb-3">Delivery Address</h3>
            <select 
              value={selectedAddressId}
              onChange={(e) => setSelectedAddressId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl text-sm bg-[var(--user-bg-hover)] border border-[var(--user-border)] text-[var(--user-text)] outline-none focus:ring-2 focus:ring-[var(--user-accent)]/40 cursor-pointer"
            >
              {addresses.map((a) => (
                <option key={a._id} value={String(a._id)}>
                  {a.full_name} — {a.street_address1}, {a.city}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30">
            <span className="text-sm font-semibold text-[var(--user-text)]">New Estimated Total</span>
            <span className="text-lg font-black text-[var(--user-accent)]">Rs. {newTotal.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <span className="font-bold">Note:</span> You can only modify this order while it is pending. Once confirmed, changes cannot be made.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--user-border)]">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[var(--user-border)] text-sm font-semibold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ✅ DELETE CONFIRM MODAL (Admin-style, Centered)
const DeleteConfirmModal = ({ orderNumber, deleting, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[var(--user-bg-card)] rounded-2xl border border-[var(--user-border)] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        
        {/* Icon + Title */}
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

        {/* Buttons */}
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

export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderApi.getById(id),
    retry: false,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.getAll,
    enabled: !!order && order.status === "pending",
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={32} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-[500px] mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
          <Package size={28} className="text-[var(--user-text-subtle)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--user-text)] mb-2">Order Not Found</h1>
        <p className="text-sm text-[var(--user-text-muted)] mb-6">The order you are looking for does not exist or has been removed.</p>
        <Link href="/orders" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
          <ArrowLeft size={16} /> Back to Orders
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const pay = PAYMENT_CONFIG[order.payment?.method] || PAYMENT_CONFIG.cod;
  const PayIcon = pay.icon;
  const date = new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  const canEdit = order.status === "pending";
  
  const totalSavings = order.items.reduce((sum, i) => {
    const original = Number(i.original_price || 0);
    const paid = Number(i.price || 0);
    const qty = Number(i.qty) || 1;
    const priceSaved = (original - paid) * qty;
    const dealSaved = Number(i.deal_savings || 0);
    return sum + (priceSaved > 0 ? priceSaved : 0) + dealSaved;
  }, 0);

  // ✅ DELETE ORDER (No more window.confirm)
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axiosInstance.delete(`/orders/${order._id}`);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success("Order deleted successfully!");
      router.push("/orders");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete order");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 lg:px-6 py-6 lg:py-10 pb-24 md:pb-10">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition mb-6 group">
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Orders
      </Link>

      {/* ✅ HERO CARD */}
      <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 lg:p-8 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          
          {/* Left: Order Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-xl lg:text-2xl font-black text-[var(--user-text)] tracking-tight">{order.order_number}</h1>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
                <StatusIcon size={14} className={cfg.color} />
                <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            <p className="text-sm text-[var(--user-text-muted)] flex items-center gap-2">
              <Calendar size={14} className="text-[var(--user-text-subtle)]" /> 
              Placed on {date}
            </p>
          </div>
          
          {/* Right: Total + Savings + Actions */}
          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            
            {/* Order Total */}
            <div className="text-left lg:text-right">
              <p className="text-xs font-semibold text-[var(--user-text-muted)] uppercase tracking-wider mb-1">Order Total</p>
              <p className="text-3xl font-black text-[var(--user-accent)]">Rs. {order.total.toLocaleString()}</p>
            </div>
            
            {/* Savings Badge */}
            {totalSavings > 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 px-2.5 py-1 rounded-full border border-[var(--user-success)]/20">
                <Tag size={12} /> You saved Rs. {totalSavings.toLocaleString()}
              </p>
            )}
            
            {/* Edit + Delete Buttons */}
            {canEdit ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold hover:opacity-90 transition shadow-lg shadow-[var(--user-accent)]/20"
                >
                  <Pencil size={14} /> Edit Order
                </button>
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--user-danger)]/40 text-[var(--user-danger)] text-xs font-bold hover:bg-[var(--user-danger)]/10 transition"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            ) : (
              order.status !== "cancelled" && (
                <p className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Order locked - cannot be modified
                </p>
              )
            )}
          </div>
        </div>

        <div className="mt-8">
          <DetailStepper status={order.status} />
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <p className="text-center text-xs text-[var(--user-text-muted)] mt-6 flex items-center justify-center gap-2 bg-[var(--user-bg-hover)] py-2.5 rounded-xl border border-[var(--user-border)]">
              <Truck size={14} className="text-[var(--user-accent)]" />
              {cfg.desc} · Estimated delivery: <span className="font-semibold text-[var(--user-text)]">{order.shipping_method === "express" ? "1–2" : "2–4"} working days</span>
            </p>
          )}
          {order.status === "delivered" && (
            <p className="text-center text-xs font-bold text-[var(--user-success)] mt-6 flex items-center justify-center gap-2 bg-[var(--user-success)]/5 py-2.5 rounded-xl border border-[var(--user-success)]/20">
              <ShieldCheck size={14} /> Delivered successfully — thank you for shopping with us!
            </p>
          )}
        </div>
      </div>

      {/* ✅ 2-COLUMN LAYOUT */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* LEFT — Items */}
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--user-border)] bg-[var(--user-bg-hover)]/30">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--user-text)]">
              <Package size={16} className="text-[var(--user-accent)]" /> Order Items ({order.items.length})
            </h2>
            <button className="text-xs font-semibold text-[var(--user-accent)] hover:opacity-80 flex items-center gap-1 transition">
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
              const dealSavings = Number(i.deal_savings || 0);
              const hasDiscount = originalPrice > 0 && originalPrice > paidPrice;
              const itemSavings = (hasDiscount ? (originalPrice - paidPrice) * qty : 0) + dealSavings;
              
              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 hover:bg-[var(--user-bg-hover)]/30 transition-colors">
                  <div className="shrink-0">
                    {getImgUrl(i.image) ? (
                      <img src={getImgUrl(i.image)} alt={i.name} className="w-20 h-20 rounded-xl object-cover border border-[var(--user-border)] bg-white" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center">
                        <Package size={24} className="text-[var(--user-text-subtle)]" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[var(--user-text)] line-clamp-2 leading-snug">{i.name}</h3>
                    {i.variantTitle && (
                      <p className="text-[11px] text-[var(--user-text-muted)] mt-1 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[var(--user-text-subtle)]" />
                        {i.variantTitle}
                      </p>
                    )}
                    
                    {i.deal_id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          <Tag size={10} /> 
                          {i.deal_type === 'buy_x_get_y' 
                            ? `Buy ${i.deal_buy_quantity || 2} Get ${i.deal_get_quantity || 1} Free` 
                            : (i.deal_name || 'Active Deal')}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-[11px] font-semibold text-[var(--user-text)] bg-[var(--user-bg-card)] px-2 py-1 rounded border border-[var(--user-border)]">
                        Qty: {qty}
                      </span>
                      {freeItems > 0 && (
                        <span className="text-[11px] font-bold text-[var(--user-success)]">+{freeItems} FREE</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right sm:min-w-[120px] shrink-0">
                    {hasDiscount && (
                      <p className="text-[11px] text-[var(--user-text-subtle)] line-through mb-0.5">Rs. {(originalPrice * qty).toLocaleString()}</p>
                    )}
                    <p className="text-base font-black text-[var(--user-text)]">Rs. {(paidPrice * payableItems).toLocaleString()}</p>
                    {itemSavings > 0 && (
                      <p className="text-[10px] font-bold text-[var(--user-success)] mt-1 flex items-center justify-end gap-1">
                        <Tag size={10} /> Save Rs. {itemSavings.toLocaleString()}
                      </p>
                    )}
                    {payableItems < qty && (
                      <p className="text-[10px] text-[var(--user-text-muted)] mt-1">Paying for {payableItems}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Info stack */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--user-text)] mb-4">
              <MapPin size={16} className="text-[var(--user-accent)]" /> Delivery Address
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-[var(--user-text)] leading-relaxed">
                <span className="font-bold">{order.address_snapshot?.full_name}</span><br />
                {order.address_snapshot?.street_address1}
                {order.address_snapshot?.street_address2 && <>, {order.address_snapshot.street_address2}</>}<br />
                {order.address_snapshot?.city}, {order.address_snapshot?.state}<br />
                {order.address_snapshot?.country} {order.address_snapshot?.zip_code}
              </p>
              <p className="flex items-center gap-2 text-sm text-[var(--user-text-muted)] pt-2 border-t border-[var(--user-border)]">
                <Phone size={14} className="text-[var(--user-accent)]" /> {order.address_snapshot?.phone}
              </p>
              {order.address_snapshot?.delivery_instructions && (
                <div className="flex items-start gap-2 text-xs text-[var(--user-text-muted)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] rounded-xl p-3">
                  <FileText size={14} className="text-[var(--user-accent)] shrink-0 mt-0.5" /> 
                  <span>{order.address_snapshot.delivery_instructions}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-[var(--user-border)]">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--user-text)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-3 py-1.5 rounded-lg">
                  {order.shipping_method === "express" ? <Zap size={12} className="text-amber-500" /> : <Truck size={12} className="text-[var(--user-accent)]" />}
                  {order.shipping_method === "express" ? "Express Delivery (1–2 days)" : "Standard Delivery (2–4 days)"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--user-text)] mb-4">
              <CreditCard size={16} className="text-[var(--user-accent)]" /> Payment & Summary
            </h2>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] mb-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--user-text)]">
                <PayIcon size={16} className="text-[var(--user-accent)]" /> {pay.label}
              </p>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                order.payment?.status === "paid"
                  ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
                  : "text-amber-600 bg-amber-500/10 border-amber-500/30"
              }`}>
                {order.payment?.status || "Pending"}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[var(--user-text-muted)]">
                <span>Subtotal</span>
                <span className="font-semibold text-[var(--user-text)]">Rs. {order.subtotal.toLocaleString()}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between text-[var(--user-success)]">
                  <span className="flex items-center gap-1.5"><Tag size={14}/> Total Savings</span>
                  <span className="font-bold">-Rs. {totalSavings.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--user-text-muted)]">
                <span>Shipping</span>
                <span className="font-semibold text-[var(--user-text)]">{order.shipping === 0 ? "FREE" : `Rs. ${order.shipping.toLocaleString()}`}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>Tax</span>
                  <span className="font-semibold text-[var(--user-text)]">Rs. {order.tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-4 mt-2 border-t-2 border-[var(--user-border)]">
                <span className="text-base font-bold text-[var(--user-text)]">Total</span>
                <span className="text-xl font-black text-[var(--user-accent)]">Rs. {order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--user-accent)]/10 flex items-center justify-center shrink-0">
                <Headphones size={18} className="text-[var(--user-accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--user-text)]">Need Help?</h3>
                <p className="text-xs text-[var(--user-text-muted)] mt-1 mb-3">
                  Have a question about this order? Our support team is here to help.
                </p>
                <button className="text-xs font-bold text-[var(--user-accent)] hover:underline flex items-center gap-1">
                  Contact Support <ArrowLeft size={12} className="rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ EDIT MODAL */}
      {showEditModal && (
        <EditOrderModal 
          order={order} 
          addresses={addresses}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => setShowEditModal(false)}
        />
      )}

      {/* ✅ DELETE CONFIRM MODAL */}
      {showDeleteModal && (
        <DeleteConfirmModal 
          orderNumber={order.order_number}
          deleting={deleting}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}