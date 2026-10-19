"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Package,
  Phone,
  Printer,
  ReceiptText,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import { posApi } from "@/apis/admin/posApi";
import { storeApi } from "@/apis/admin/storeApi";

const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
const edge = { border: "1px solid #dce8f8" };
const cardStyle = {
  ...edge,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)",
};
const muted = { color: "#64748b" };
const primary = { color: "#0f172a" };
const money = (value) =>
  `Rs. ${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: "long", timeStyle: "short" }) : "—";
const paymentName = (method) => String(method || "cash").replaceAll("_", " ");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const imageUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return API_ORIGIN ? `${API_ORIGIN}/${String(value).replace(/^\/+/, "")}` : value;
};

function Panel({ title, icon: Icon, trailing, children, className = "" }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl shadow-lg transition-shadow duration-200 hover:shadow-xl ${className}`} style={cardStyle}>
      <div className="flex min-h-10 items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "#e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
        {Icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><Icon size={15} strokeWidth={2.5} color="#fff" /></span>}
        <h2 className="text-sm font-extrabold tracking-tight" style={primary}>{title}</h2>
        {trailing && <div className="ml-auto">{trailing}</div>}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex min-w-0 items-start gap-2.5 border-b py-2.5 last:border-0" style={{ borderColor: "#eaf0f8" }}>
      {Icon && <Icon size={14} className="mt-0.5 shrink-0" style={muted} />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px]" style={muted}>{label}</p>
        <p className="break-words text-[13px] font-semibold capitalize" style={primary}>{value}</p>
      </div>
    </div>
  );
}

function AmountRow({ label, value, emphasis = false, negative = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${emphasis ? "mt-1 border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/80 text-sm font-extrabold text-blue-950" : "bg-slate-50 text-[13px]"}`}>
      <span className={emphasis ? "" : "font-medium text-slate-500"}>{label}</span>
      <span className={`whitespace-nowrap font-bold ${negative ? "text-rose-600" : emphasis ? "" : "text-slate-900"}`}>{negative ? "− " : ""}{money(value)}</span>
    </div>
  );
}

export default function PosSaleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ["pos-sale-detail", id],
    queryFn: () => posApi.getSale(id),
    enabled: Boolean(id),
  });
  const { data: storeInfo = {} } = useQuery({
    queryKey: ["store"],
    queryFn: () => storeApi.get(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <div className="py-12 text-center text-sm" style={muted}>Loading sale details...</div>;
  if (isError || !sale) {
    return (
      <div className="space-y-4">
        <Link href="/admin/pos/history" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><ArrowLeft size={16} /> Sale History</Link>
        <div className="rounded-2xl p-10 text-center text-sm font-semibold text-rose-600" style={cardStyle}>Could not load this sale.</div>
      </div>
    );
  }

  const customer = sale.customer_snapshot || {};
  const customerRecord = sale.customer_id || {};
  const cashier = sale.cashier_id || {};
  const customerName = customer.name || customerRecord.name || "Walk-in Customer";
  const customerPhone = customer.phone || customerRecord.phone;
  const customerEmail = customer.email || customerRecord.email;
  const customerAddress = customer.address || customerRecord.address;
  const items = sale.items || [];
  const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const method = paymentName(sale.payment?.method);
  const isCompleted = (sale.status || "completed") === "completed";
  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=460,height=760");
    if (!printWindow) return;
    const storeName = storeInfo.store_name || "Our Store";
    const contact = [
      [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.zip_code].filter(Boolean).join(", "),
      storeInfo.phone || storeInfo.support_phone,
      storeInfo.email || storeInfo.support_email,
    ].filter(Boolean).map(escapeHtml).join(" · ");
    const rows = items.map((item) => {
      const variant = [item.variant_title, item.sku].filter(Boolean).join(" · ");
      return `<tr><td><strong>${escapeHtml(item.product_name || "Product")}</strong>${variant ? `<small>${escapeHtml(variant)}</small>` : ""}</td><td>${Number(item.quantity) || 0} × ${money(item.unit_price)}</td><td>${money(item.line_total)}</td></tr>`;
    }).join("");
    const receipt = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.sale_number || "Sales Receipt")}</title><style>
      *{box-sizing:border-box}body{width:100%;max-width:390px;margin:0 auto;padding:22px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#172033;background:#fff}header{text-align:center;padding-bottom:12px;border-bottom:1px solid #dbe2ea}.store{margin:0;font-size:19px;font-weight:700}.contact{margin-top:5px;color:#64748b;font-size:10px}.title{margin:13px 0;text-align:center;color:#334155;font-size:10px;font-weight:700;letter-spacing:1.2px}.meta{padding:9px 0;border-top:1px dashed #cbd5e1;border-bottom:1px dashed #cbd5e1}.row,.summary-row,.total,.payment{display:flex;justify-content:space-between;gap:12px;padding:4px 0}.row span:first-child,.summary-row span:first-child,.payment span{color:#64748b}.row span:last-child{text-align:right;font-weight:600}table{width:100%;margin-top:10px;border-collapse:collapse;table-layout:fixed}th{padding:7px 3px;border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b;font-size:10px}th:first-child{width:46%}th:nth-child(2){width:30%;text-align:center}th:last-child{width:24%;text-align:right}td{padding:8px 3px;border-bottom:1px solid #e8edf3;vertical-align:top;font-size:10px;overflow-wrap:anywhere}td:nth-child(2){text-align:center;color:#475569}td:last-child{text-align:right;white-space:nowrap;font-weight:600}small{display:block;margin-top:3px;color:#64748b;font-size:9px}.summary{margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1}.summary-row{font-size:11px}.total{margin-top:6px;padding:10px 0;border-top:1px solid #334155;border-bottom:1px solid #334155;font-size:15px;font-weight:700}.payment{font-size:11px}.notes{margin-top:9px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:10px;white-space:pre-wrap}.thanks{margin-top:16px;text-align:center;color:#64748b;font-size:10px}@page{size:80mm auto;margin:4mm}@media print{body{width:72mm;max-width:72mm;margin:0 auto;padding:0}tr,.summary,.total,.payment,.notes{break-inside:avoid}}
    </style></head><body><header><h1 class="store">${escapeHtml(storeName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ""}</header><div class="title">SALES RECEIPT</div><div class="meta"><div class="row"><span>Receipt</span><span>${escapeHtml(sale.sale_number || "—")}</span></div><div class="row"><span>Customer</span><span>${escapeHtml(customerName)}</span></div>${customerPhone ? `<div class="row"><span>Phone</span><span>${escapeHtml(customerPhone)}</span></div>` : ""}<div class="row"><span>Date</span><span>${escapeHtml(sale.created_at ? new Date(sale.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "")}</span></div></div><table><thead><tr><th>Item</th><th>Qty × Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-row"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>${Number(sale.discount_amount) > 0 ? `<div class="summary-row"><span>Discount</span><span>− ${money(sale.discount_amount)}</span></div>` : ""}<div class="summary-row"><span>Tax</span><span>${money(sale.tax_amount)}</span></div></div><div class="total"><span>Total</span><span>${money(sale.total)}</span></div><div class="payment"><span>Payment · ${escapeHtml(method)}</span><strong>${money(sale.payment?.amount_received)}</strong></div>${Number(sale.payment?.change_due) > 0 ? `<div class="payment"><span>Change</span><strong>${money(sale.payment.change_due)}</strong></div>` : ""}${sale.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(sale.notes)}</div>` : ""}<footer class="thanks">Thank you for your purchase</footer><script>window.onload=()=>window.print();window.onafterprint=()=>window.close()</script></body></html>`;
    printWindow.document.write(receipt);
    printWindow.document.close();
  };

  return (
    <div className="min-h-full space-y-4 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><ReceiptText size={22} color="#fff" /></span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Sale Details</h1>
            <p className="mt-0.5 text-xs sm:text-sm" style={muted}>Receipt and complete transaction information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={printReceipt} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: "#dce8f8", backgroundColor: "#fff" }}>
            <Printer size={15} /> Print
          </button>
          <button type="button" onClick={() => router.push("/admin/pos/history")} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }}>
            <ArrowLeft size={15} /> Sale History
          </button>
        </div>
      </header>

      <Panel
        title="Sale Overview"
        icon={ReceiptText}
        trailing={<span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{isCompleted && <CheckCircle2 size={12} />}{sale.status || "Completed"}</span>}
      >
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={muted}>Sale Number</p>
              <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-blue-700">{sale.sale_number || "—"}</h2>
            </div>
            <span className="text-xs" style={muted}>{dateTime(sale.created_at)}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [CalendarDays, "Sale Date", dateTime(sale.created_at)],
              [UserRound, "Customer", customerName],
              [CreditCard, "Payment Method", method],
              [ShoppingBag, "Items Sold", `${quantity} item${quantity === 1 ? "" : "s"}`],
            ].map(([Icon, label, value]) => (
              <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border p-3" style={{ ...edge, background: "#f8fafc" }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={16} /></span>
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide" style={muted}>{label}</p><p className="truncate text-xs font-bold capitalize" style={primary}>{value}</p></div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Products & Items" icon={Package} trailing={<span className="text-xs font-semibold" style={muted}>{items.length} product{items.length === 1 ? "" : "s"}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                <tr>
                  {["Product / Variant", "Qty", "Unit Price", "Discount", "Tax", "Line Total"].map((label, index) => (
                    <th key={label} className={`whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wide ${index === 0 ? "text-left" : "text-right"}`} style={muted}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const itemTotal = Number(item.line_total) || 0;
                  const taxValue = itemTotal * (Number(item.tax_rate) || 0) / 100;
                  const lineTotalWithTax = itemTotal + taxValue;
                  const gross = (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
                  const discountRate = gross > 0 ? (Number(item.discount_amount) || 0) / gross * 100 : 0;
                  const productImage = imageUrl(item.product_image || item.variant_id?.images?.[0]?.img_url);
                  return (
                    <tr key={`${item.variant_id || item.sku || item.product_name}-${index}`} className="border-b last:border-0 hover:bg-blue-50/40" style={{ borderColor: "#eaf0f8" }}>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {productImage ? (
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border bg-white" style={edge}><Image src={productImage} alt={item.product_name || "Product"} fill unoptimized className="object-contain p-1" /></span>
                          ) : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Package size={18} /></span>}
                          <span className="min-w-0"><span className="block truncate text-xs font-bold" style={primary}>{item.product_name || "Product"}</span><span className="mt-0.5 block truncate text-[10px]" style={muted}>{item.variant_title || "Default"}{item.sku ? ` · ${item.sku}` : ""}</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium" style={primary}>{item.quantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right" style={muted}>{money(item.unit_price)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {Number(item.discount_amount) > 0 ? <><span className="block text-xs font-semibold text-emerald-700">− {money(item.discount_amount)}</span><span className="text-[10px] text-emerald-600">{discountRate.toFixed(1)}%</span></> : <span style={muted}>—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><span className="block text-xs" style={primary}>{Number(item.tax_rate) || 0}%</span><span className="text-[10px]" style={muted}>{money(taxValue)}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold" style={primary}>{money(lineTotalWithTax)}</td>
                    </tr>
                  );
                })}
                {!items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={muted}>No items were recorded for this sale.</td></tr>}
              </tbody>
            </table>
            <p className="border-t px-4 py-2 text-[11px]" style={{ ...muted, borderColor: "#e2e8f0" }}>Line totals include item discounts and tax. Any sale-wide discount is shown in the summary.</p>
          </div>
        </Panel>

        <aside className="space-y-4">
          <Panel title="Sale Summary" icon={Wallet}>
            <div className="space-y-2 p-4">
              <AmountRow label="Subtotal" value={sale.subtotal} />
              <AmountRow label="Discount" value={sale.discount_amount} negative />
              <AmountRow label="Tax" value={sale.tax_amount} />
              <AmountRow label="Sale Total" value={sale.total} emphasis />
              <div className="mt-3 grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="rounded-xl border p-3" style={edge}><p style={muted}>Amount Received</p><p className="mt-1 font-bold" style={primary}>{money(sale.payment?.amount_received)}</p></div>
                <div className="rounded-xl border p-3" style={edge}><p style={muted}>Change Given</p><p className="mt-1 font-bold" style={primary}>{money(sale.payment?.change_due)}</p></div>
              </div>
            </div>
          </Panel>

          <Panel title="Customer & Payment" icon={UserRound}>
            <div className="px-4 py-1">
              <DetailRow icon={UserRound} label="Customer" value={customerName} />
              <DetailRow icon={Phone} label="Phone" value={customerPhone} />
              <DetailRow icon={Mail} label="Email" value={customerEmail} />
              <DetailRow icon={MapPin} label="Address" value={customerAddress} />
              <DetailRow icon={CreditCard} label="Payment Method" value={method} />
              <DetailRow icon={FileText} label="Payment Reference" value={sale.payment?.reference} />
              <DetailRow icon={UserRound} label="Cashier" value={sale.cashier_name || cashier.name} />
              {cashier.email && <DetailRow icon={Mail} label="Cashier Email" value={cashier.email} />}
            </div>
          </Panel>

          {sale.notes && (
            <Panel title="Sale Notes" icon={FileText}>
              <p className="whitespace-pre-wrap break-words px-4 py-3 text-[13px] leading-6 text-slate-700">{sale.notes}</p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
