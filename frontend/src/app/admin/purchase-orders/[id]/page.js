"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowDownToLine, BriefcaseBusiness, CalendarDays, Check, CheckCircle2,
  ChevronRight, Circle, CreditCard, FileText, MapPin, Mail, Package, PackageCheck,
  Phone, Printer, Truck, UserRound, Wallet, XCircle,
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const edge = { border: "1px solid #dce8f8" };
const card = { ...edge, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", borderRadius: 14, boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" };
const muted = { color: "#64748b" };
const primary = { color: "#0f172a" };
const accent = { color: "#2563eb" };
const money = (n) => `Rs. ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? new Date(value).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const dateOnly = (value) => value ? new Date(value).toLocaleDateString("en-CA") : "—";
const imageUrl = (url) => !url ? "" : /^https?:\/\//i.test(url) ? url : `${API_ORIGIN || ""}${url.startsWith("/") ? url : `/${url}`}`;

const statusStyles = {
  pending: { label: "Pending", bg: "#fff5df", fg: "#b5760a" },
  confirmed: { label: "Confirmed", bg: "#fff5df", fg: "#b5760a" },
  delivered: { label: "Delivered", bg: "#e1f8f0", fg: "#079878" },
  closed: { label: "Closed", bg: "#edf2fa", fg: "#627b9f" },
  cancelled: { label: "Cancelled", bg: "#ffebed", fg: "#cf3348" },
  unpaid: { label: "Unpaid", bg: "#fff5df", fg: "#b5760a" },
  partial: { label: "Partial", bg: "#fff5df", fg: "#b5760a" },
  paid: { label: "Paid", bg: "#e1f8f0", fg: "#079878" },
};

function Badge({ value }) {
  const style = statusStyles[String(value || "pending").toLowerCase()] || statusStyles.pending;
  return <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold shadow-sm" style={{ backgroundColor: style.bg, color: style.fg }}>{style.label}</span>;
}

function Panel({ title, icon: Icon, trailing, className = "", children }) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl shadow-lg transition hover:shadow-xl ${className}`} style={card}>
    <div className="flex min-h-10 items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "#e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      {Icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><Icon size={15} strokeWidth={2.5} style={{ color: "#fff" }} /></div>}
      <h2 className="text-sm font-extrabold tracking-tight" style={primary}>{title}</h2>
      <div className="ml-auto">{trailing}</div>
    </div>
    {children}
  </section>;
}

function LabelValue({ label, value, icon: Icon }) {
  return <div className="grid grid-cols-[minmax(84px,.8fr)_minmax(0,1.2fr)] items-center gap-2 text-[13px] leading-6">
    <span className="inline-flex items-center gap-1.5" style={muted}>{Icon && <Icon size={13} />}{label}</span>
    <span className="min-w-0 truncate font-medium" style={primary} title={value || "—"}>{value || "—"}</span>
  </div>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border shadow-2xl" style={{ background: "#fff", borderColor: "#dce8f8", color: "#173d78" }} onClick={(e) => e.stopPropagation()}>
      <div className="border-b px-5 py-4" style={{ borderColor: "#e5eef9" }}><h2 className="text-sm font-bold">{title}</h2></div>
      {children}
    </div>
  </div>;
}

export default function PODetailPage({ params }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [recv, setRecv] = useState({});
  const [invoiceNo, setInvoiceNo] = useState("");
  const [explanation, setExplanation] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank");
  const [cancelReason, setCancelReason] = useState("");
  const { data: res, isLoading, isError, refetch } = useQuery({ queryKey: ["po", id], queryFn: () => purchaseOrderApi.getById(id) });
  const po = res?.data || null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["po", id] });
  const act = (fn, ok) => useMutation({ mutationFn: fn, onSuccess: () => { toast.success(ok); refresh(); }, onError: (e) => toast.error(e?.response?.data?.message || "Failed") });
  const confirmM = act(() => purchaseOrderApi.confirm(id), "PO confirmed");
  const closeM = act(() => purchaseOrderApi.close(id), "PO closed");
  const cancelM = act(() => purchaseOrderApi.cancel(id, cancelReason), "PO cancelled");
  const deliverM = useMutation({
    mutationFn: () => purchaseOrderApi.deliver(id, { items: Object.entries(recv).filter(([, q]) => Number(q) > 0).map(([variant_id, qty]) => ({ variant_id, qty: Number(qty) })), invoice_no: invoiceNo, explanation }),
    onSuccess: () => { toast.success("PO delivered — inventory updated"); setDeliverOpen(false); setRecv({}); setInvoiceNo(""); setExplanation(""); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Delivery failed"),
  });
  const payM = useMutation({
    mutationFn: () => purchaseOrderApi.recordPayment(id, { amount: Number(payAmount), method: payMethod }),
    onSuccess: () => { toast.success("Payment recorded"); setPayOpen(false); setPayAmount(""); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Payment failed"),
  });

  if (isLoading) return <div className="space-y-3"><div className="skeleton h-8 w-1/3" /><div className="skeleton h-28 w-full" /><div className="skeleton h-52 w-full" /></div>;
  if (isError || !po) return <div className="rounded-xl border bg-white p-8 text-center" style={edge}><p className="text-sm" style={primary}>Purchase order could not be loaded.</p><button onClick={() => refetch()} className="mt-2 text-sm font-semibold" style={accent}>Try again</button><div><Link href="/admin/purchase-orders" className="mt-3 inline-block text-sm underline" style={muted}>Back to purchase orders</Link></div></div>;

  const items = po.items || [];
  const vendor = po.vendor_snapshot || {};
  const payments = po.payments || [];
  const status = String(po.status || "pending").toLowerCase();
  const payStatus = String(po.payment_status || "unpaid").toLowerCase();
  const chosen = Object.entries(recv).reduce((sum, [, qty]) => sum + Math.max(0, Number(qty) || 0), 0);
  const canDeliver = items.some((item) => Number(item.qty_ordered) > Number(item.received_qty));
  const canPay = ["delivered", "closed"].includes(status);
  const vendorId = po.vendor_id?._id || po.vendor_id;
  const vendorActive = po.vendor_id?.is_active;
  const taxPercent = items.length ? items.reduce((sum, item) => sum + Number(item.tax_rate || 0), 0) / items.length : 0;
  const steps = ["pending", "confirmed", "delivered", "closed", "cancelled"];
  const currentStep = steps.indexOf(status);
  const openDeliver = () => {
    const full = {};
    for (const item of items) {
      const remaining = Math.max(0, Number(item.qty_ordered) - Number(item.received_qty));
      if (remaining > 0) full[String(item.variant_id)] = remaining;
    }
    setRecv(full);
    setDeliverOpen(true);
  };
  const printOrder = () => window.print();
  const smallAction = (label, onClick, Icon, primaryAction = false, disabled = false) => <button key={label} disabled={disabled} onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition hover:bg-blue-50 disabled:opacity-45" style={{ borderColor: primaryAction ? "#c8dcff" : "#dce8f8", color: primaryAction ? "#2878f0" : "#36567f", background: "white" }}>{Icon && <Icon size={16} />}{label}</button>;

  return <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm" style={muted}>
            <Link href="/admin/purchase-orders" className="inline-flex items-center gap-1 hover:text-blue-700"><ArrowLeft size={14} />Purchase Orders</Link>
            <ChevronRight size={13} /> <span style={primary}>{po.po_number}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}><FileText size={18} /></div>
            <h1 className="font-mono text-xl font-bold" style={primary}>{po.po_number}</h1>
            <Badge value={status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs" style={muted}>
            <span className="inline-flex items-center gap-1"><CalendarDays size={13} />Created: {dateTime(po.created_at)}</span>
            <span className="inline-flex items-center gap-1"><UserRound size={13} />By: {po.createdby?.name || "Admin"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {smallAction("Print", printOrder, Printer)}
          {smallAction("Download PDF", printOrder, ArrowDownToLine)}
          {status === "pending" && smallAction(confirmM.isPending ? "Confirming…" : "Confirm", () => confirmM.mutate(), Check, true, confirmM.isPending)}
          {status === "confirmed" && smallAction("Receive items", openDeliver, Truck, true, !canDeliver)}
          {status === "delivered" && smallAction(closeM.isPending ? "Closing…" : "Close order", () => closeM.mutate(), PackageCheck, false, closeM.isPending)}
          {canPay && smallAction("Add payment", () => setPayOpen(true), CreditCard, true)}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <main className="space-y-3.5 lg:col-span-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Vendor Information" icon={BriefcaseBusiness} trailing={vendorId && <Link href={`/admin/vendors/${vendorId}`} className="rounded border px-2 py-1 text-xs font-semibold hover:bg-blue-50" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}>View Vendor</Link>}>
              <div className="p-4">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "#f0f4fa", color: "#4c6688" }}>{String(vendor.name || po.vendor_id?.name || "V").slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0"><div className="truncate text-[11px] font-bold" style={primary}>{vendor.name || po.vendor_id?.name || "Vendor"}</div><div className="truncate text-xs" style={muted}>{vendor.company_name || "—"}</div></div>
                  {vendorActive !== undefined && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: vendorActive ? "#079878" : "#cf3348", background: vendorActive ? "#e1f8f0" : "#ffebed" }}>{vendorActive ? "Active" : "Inactive"}</span>}
                </div>
                <div className="space-y-0.5">
                  <LabelValue icon={BriefcaseBusiness} label="Company" value={vendor.company_name || vendor.name || po.vendor_id?.name} />
                  <LabelValue icon={Phone} label="Phone" value={vendor.phone} />
                  <LabelValue icon={Mail} label="Email" value={vendor.email} />
                  <LabelValue icon={MapPin} label="Address" value={vendor.address} />
                  <LabelValue icon={MapPin} label="City" value={vendor.city} />
                </div>
              </div>
            </Panel>

            <Panel title="Purchase Order Summary" icon={FileText}>
              <div className="space-y-2 p-4 text-[13px]">
                <div className="flex justify-between"><span style={muted}>Subtotal</span><span style={primary}>{money(po.subtotal)}</span></div>
                <div className="flex justify-between"><span style={muted}>Tax ({taxPercent.toLocaleString()}%)</span><span style={primary}>{money(po.tax)}</span></div>
                <div className="flex justify-between"><span style={muted}>Shipping</span><span style={primary}>{money(po.shipping)}</span></div>
                <div className="flex justify-between"><span style={muted}>Discount</span><span style={primary}>{money(po.discount)}</span></div>
                <div className="mt-2 flex justify-between border-t pt-2.5 text-sm font-bold" style={{ borderColor: "#e5eef9" }}><span style={primary}>Total</span><span style={{ color: "#06a981" }}>{money(po.total)}</span></div>
              </div>
            </Panel>
          </div>

          <Panel title="Ordered Items" icon={PackageCheck} trailing={<span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: "#2878f0", background: "#edf5ff" }}>{items.length} Items</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead style={{ background: "#f8fbff", color: "#627b9f" }}><tr>{["#", "Image", "Product / Variant", "SKU", "Qty Ordered", "Received Qty", "Cost Price", "Line Total", "Tax Rate"].map((label) => <th key={label} className="whitespace-nowrap px-2.5 py-2 font-semibold">{label}</th>)}</tr></thead>
                <tbody>{items.map((item, index) => <tr key={`${item.variant_id}-${index}`} className="border-t" style={{ borderColor: "#eaf0f8" }}>
                  <td className="px-2.5 py-2.5" style={muted}>{index + 1}</td>
                  <td className="px-2.5 py-2"><div className="flex h-9 w-10 items-center justify-center overflow-hidden rounded-md border bg-white" style={{ borderColor: "#dce8f8" }}>{imageUrl(item.image) ? <img src={imageUrl(item.image)} alt={item.name || "Product"} className="h-full w-full object-cover" /> : <Package size={15} style={{ color: "#9bb0cc" }} />}</div></td>
                  <td className="max-w-[150px] px-2.5 py-2.5"><div className="truncate font-semibold" style={primary}>{item.name || "—"}</div><div className="truncate" style={muted}>{item.variantTitle || "—"}</div></td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-mono" style={muted}>{item.sku || "—"}</td>
                  <td className="px-2.5 py-2.5 text-center" style={primary}>{item.qty_ordered}</td>
                  <td className="px-2.5 py-2.5 text-center" style={{ color: Number(item.received_qty) >= Number(item.qty_ordered) ? "#079878" : "#173d78" }}>{item.received_qty || 0}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5" style={primary}>{money(item.cost_price)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-semibold" style={primary}>{money(item.line_total)}</td>
                  <td className="px-2.5 py-2.5" style={muted}>{Number(item.tax_rate || 0)}%</td>
                </tr>)}
                {!items.length && <tr><td colSpan={9} className="p-8 text-center text-xs" style={muted}>No order items.</td></tr>}</tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Receiving Information" icon={PackageCheck} trailing={<span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: "#2878f0", background: "#edf5ff" }}>{(po.receivings || []).length} Receivings</span>}>
              <div className="max-h-[270px] divide-y overflow-auto" style={{ borderColor: "#eaf0f8" }}>
                {(po.receivings || []).map((receiving, index) => <div key={receiving._id || index} className="p-3 text-xs">
                  <div className="grid grid-cols-[1fr_1fr_1.2fr_1fr] gap-2" style={muted}><span>{index + 1}. {dateTime(receiving.received_at)}</span><span>{receiving.invoice_no || "—"}</span><span className="truncate">{receiving.explanation || "—"}</span><span className="truncate text-right">{receiving.received_by_name || "Admin"}</span></div>
                  {!!receiving.items?.length && <div className="mt-2 rounded border p-2" style={{ borderColor: "#e5eef9", background: "#fbfdff" }}><div className="mb-1 grid grid-cols-[1fr_1fr_auto] gap-2 font-semibold" style={muted}><span>Variant ID</span><span>Product ID</span><span>Qty Received</span></div>{receiving.items.map((received, i) => <div key={`${received.variant_id}-${i}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 py-0.5" style={primary}><span className="truncate font-mono">{String(received.variant_id || "—")}</span><span className="truncate font-mono">{String(received.product_id || "—")}</span><span>{received.qty}</span></div>)}</div>}
                </div>)}
                {!po.receivings?.length && <p className="p-5 text-center text-sm" style={muted}>No receiving activity yet.</p>}
              </div>
            </Panel>

            <Panel title="Notes & Other Information" icon={FileText}>
              <div className="space-y-2.5 p-4 text-sm">
                <div><p className="mb-1 font-semibold" style={muted}>Notes</p><p style={primary}>{po.notes || "—"}</p></div>
                {status === "cancelled" && <div><p className="mb-1 font-semibold" style={muted}>Cancel Reason</p><p style={primary}>{po.cancel_reason || "—"}</p></div>}
                <div className="space-y-1.5 border-t pt-2" style={{ borderColor: "#e5eef9" }}><LabelValue label="Expected Date" value={dateOnly(po.expected_date)} /><LabelValue label="Due Date" value={dateOnly(po.due_date)} /><LabelValue label="Is Deleted" value={po.is_deleted ? "Yes" : "No"} /></div>
              </div>
            </Panel>
          </div>
        </main>

        <aside className="space-y-3.5 lg:col-span-4">
          <Panel title="Status & Payment" icon={Circle}>
            <div className="p-4">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>Order Status</span><Badge value={status} /></div>
              <div className="relative mt-5 grid grid-cols-5 gap-1">
                <div className="absolute left-[10%] right-[10%] top-[5px] h-px" style={{ background: "#d9e7fa" }} />
                {steps.map((step, index) => {
                  const complete = status !== "cancelled" && currentStep >= index;
                  const active = status === step;
                  return <div key={step} className="relative flex flex-col items-center gap-1.5 text-center">
                    <span className="z-[1] flex h-[11px] w-[11px] items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: complete ? "#08b88e" : "#cbdaf0", background: complete ? "#08b88e" : "white" }}>{complete && <Check size={7} color="white" strokeWidth={3} />}</span>
                    <span className="text-[11px]" style={{ color: active ? "#173d78" : "#7188a8", fontWeight: active ? 700 : 400 }}>{statusStyles[step].label}</span>
                  </div>;
                })}
              </div>
              <div className="my-3 border-t" style={{ borderColor: "#edf2f9" }} />
              <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>Payment Status</span><Badge value={payStatus} /></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#edf3fb" }}><div className="h-full rounded-full" style={{ width: `${po.total > 0 ? Math.min(100, Math.max(0, (Number(po.paid_amount || 0) / Number(po.total)) * 100)) : 0}%`, background: "#0bb98f" }} /></div>
              <div className="mt-2 space-y-1 text-xs"><div className="flex justify-between"><span style={muted}>Paid Amount</span><span className="font-semibold" style={primary}>{money(po.paid_amount)}</span></div><div className="flex justify-between"><span style={muted}>Due Amount</span><span className="font-semibold" style={primary}>{money(po.due_amount)}</span></div></div>
            </div>
          </Panel>

          <Panel title="Vendor Snapshot" icon={UserRound}>
            <div className="space-y-1 px-4 py-3 text-sm">
              <LabelValue label="Name" value={vendor.name || po.vendor_id?.name} />
              <LabelValue label="Company Name" value={vendor.company_name} />
              <LabelValue label="Phone" value={vendor.phone} />
              <LabelValue label="Email" value={vendor.email} />
              <LabelValue label="Address" value={vendor.address} />
              <LabelValue label="City" value={vendor.city} />
            </div>
          </Panel>

          <Panel title="Payment History" icon={Wallet} trailing={<span className="text-xs font-semibold" style={accent}>{payments.length} Total</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead style={{ background: "#f8fbff", color: "#627b9f" }}><tr>{["#", "Date", "Method", "Amount", "Reference", "Notes"].map((label) => <th key={label} className="whitespace-nowrap px-2 py-2 font-semibold">{label}</th>)}</tr></thead>
                <tbody>{payments.map((payment, index) => <tr key={payment._id || index} className="border-t" style={{ borderColor: "#eaf0f8" }}><td className="px-2 py-2" style={muted}>{index + 1}</td><td className="whitespace-nowrap px-2 py-2" style={primary}>{dateOnly(payment.paid_at || payment.created_at)}</td><td className="px-2 py-2 capitalize" style={primary}>{String(payment.method || "—").replaceAll("_", " ")}</td><td className="whitespace-nowrap px-2 py-2 font-semibold" style={primary}>{money(payment.amount)}</td><td className="max-w-20 truncate px-2 py-2" style={muted}>{payment.reference || "—"}</td><td className="max-w-20 truncate px-2 py-2" style={muted}>{payment.notes || "—"}</td></tr>)}
                  {!payments.length && <tr><td colSpan={6} className="p-4 text-center" style={muted}>No payments recorded.</td></tr>}</tbody>
              </table>
            </div>
            <div className="space-y-2 border-t p-3" style={{ borderColor: "#e5eef9" }}>
              {canPay && <button onClick={() => setPayOpen(true)} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white hover:opacity-90 print:hidden" style={{ background: "#2878f0" }}><CreditCard size={14} />Add Payment</button>}
              {status === "delivered" && <button onClick={() => closeM.mutate()} disabled={closeM.isPending} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-sm font-semibold disabled:opacity-50 print:hidden" style={{ borderColor: "#cfe0f8", color: "#36567f" }}><CheckCircle2 size={14} />{closeM.isPending ? "Closing…" : "Close Purchase Order"}</button>}
              {["pending", "confirmed"].includes(status) && <div className="flex gap-1.5 print:hidden"><input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancellation reason" className="h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none" style={{ borderColor: "#dce8f8", color: "#173d78" }} /><button disabled={cancelM.isPending || !cancelReason.trim()} onClick={() => cancelM.mutate()} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: "#ffc9d0", color: "#cf3348" }}><XCircle size={13} />Cancel PO</button></div>}
            </div>
          </Panel>
        </aside>
      </div>
    {deliverOpen && <Modal title="Mark as Delivered" onClose={() => setDeliverOpen(false)}><div className="space-y-4 p-5">
      <p className="text-xs" style={muted}>Delivery adds the received quantity to inventory. Confirming means the order was accepted; inventory updates on delivery.</p>
      <div className="overflow-hidden rounded-md border" style={edge}><div className="grid grid-cols-[1fr_repeat(4,auto)] gap-3 px-3 py-2 text-[11px] font-semibold" style={{ background: "#f8fbff", color: "#627b9f" }}><span>Item</span><span>Ordered</span><span>Received</span><span>Remaining</span><span>Now</span></div>
        {items.map((item) => { const key = String(item.variant_id); const remaining = Math.max(0, Number(item.qty_ordered) - Number(item.received_qty)); const now = Math.max(0, Number(recv[key]) || 0); return <div key={key} className="grid grid-cols-[1fr_repeat(4,auto)] items-center gap-3 border-t px-3 py-2.5 text-xs" style={{ borderColor: "#e5eef9" }}><div className="min-w-0"><p className="truncate font-medium">{item.name || item.sku}</p><p className="font-mono" style={muted}>{item.sku}</p></div><span>{item.qty_ordered}</span><span>{item.received_qty}</span><span style={{ color: "#b5760a" }}>{remaining}</span><input type="number" min={0} max={remaining} value={recv[key] || ""} onChange={(e) => setRecv({ ...recv, [key]: e.target.value })} className="h-8 w-16 rounded border px-2 text-center" style={{ borderColor: "#dce8f8" }} /><div className="col-span-5 -mt-1 text-right" style={muted}>Remaining after delivery: {remaining - now}</div>{now > remaining && <div className="col-span-5 text-right text-xs" style={{ color: "#cf3348" }}>Cannot deliver more than {remaining} remaining.</div>}</div>; })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium">Invoice number *<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-9 w-full rounded-md border px-3 text-sm outline-none" style={{ borderColor: "#dce8f8" }} /></label><label className="space-y-1 text-xs font-medium">Explanation *<input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Required stock history note" className="h-9 w-full rounded-md border px-3 text-sm outline-none" style={{ borderColor: "#dce8f8" }} /></label></div>
      <p className="text-xs" style={muted}>Delivering now: <strong style={primary}>{chosen} units</strong></p>
      <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "#e5eef9" }}><button onClick={() => setDeliverOpen(false)} className="h-9 rounded-md border px-3 text-sm" style={{ borderColor: "#dce8f8" }}>Cancel</button><button disabled={deliverM.isPending || !invoiceNo.trim() || !explanation.trim() || chosen < 1 || items.some((item) => (Number(recv[String(item.variant_id)]) || 0) > Math.max(0, Number(item.qty_ordered) - Number(item.received_qty)))} onClick={() => deliverM.mutate()} className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#2878f0" }}>{deliverM.isPending ? "Delivering…" : "Confirm delivery"}</button></div>
    </div></Modal>}

    {payOpen && <Modal title="Record payment" onClose={() => setPayOpen(false)}><div className="space-y-4 p-5">
      <div className="grid grid-cols-3 gap-2 rounded-md border p-3 text-xs" style={{ ...edge, background: "#f8fbff" }}><div><p style={muted}>PO total</p><p className="mt-1 font-semibold">{money(po.total)}</p></div><div><p style={muted}>Paid</p><p className="mt-1 font-semibold">{money(po.paid_amount)}</p></div><div><p style={muted}>Remaining</p><p className="mt-1 font-semibold">{money(po.due_amount)}</p></div></div>
      <label className="block space-y-1 text-xs font-medium">Payment amount *<input type="number" min={0.01} max={po.due_amount} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount to pay" className="h-9 w-full rounded-md border px-3 text-sm outline-none" style={{ borderColor: "#dce8f8" }} /></label>
      <label className="block space-y-1 text-xs font-medium">Payment method<select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-9 w-full rounded-md border px-3 text-sm outline-none" style={{ borderColor: "#dce8f8" }}><option value="bank">Bank</option><option value="cash">Cash</option><option value="cod">COD</option><option value="credit">Credit</option></select></label>
      <p className="text-xs" style={muted}>Remaining after payment: <strong style={primary}>{money(Math.max(0, Number(po.due_amount || 0) - Number(payAmount || 0)))}</strong></p>
      <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "#e5eef9" }}><button onClick={() => setPayOpen(false)} className="h-9 rounded-md border px-3 text-sm" style={{ borderColor: "#dce8f8" }}>Cancel</button><button disabled={payM.isPending || !(Number(payAmount) > 0)} onClick={() => payM.mutate()} className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#2878f0" }}>{payM.isPending ? "Saving…" : "Save payment"}</button></div>
    </div></Modal>}
  </div>;
}
