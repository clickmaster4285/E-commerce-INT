"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Clock3,
  FileText,
  Pencil,
  Mail,
  MapPin,
  Package,
  Phone,
  Printer,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import { posApi } from "@/apis/admin/posApi";
import { storeApi } from "@/apis/admin/storeApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

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
const money = (value, locale) =>
  `Rs. ${(Number(value) || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value, locale, t) =>
  value ? new Date(value).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" }) : t("common.notProvided");
const saleStatusLabel = (status, t) => {
  const normalized = String(status || "completed").toLowerCase();
  const key = `admin.pos.value.${normalized}`;
  const label = t(key);
  return label === key ? normalized.replaceAll("_", " ") : label;
};
const paymentName = (method, t) => {
  const normalized = String(method || "cash").toLowerCase();
  const key = { cash: "cash", card: "card", bank_transfer: "bankTransfer" }[normalized];
  return key ? t(`admin.pos.payment.${key}`) : normalized.replaceAll("_", " ");
};
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
        {trailing && <div className="ms-auto">{trailing}</div>}
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
  const { locale } = useTranslation();
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${emphasis ? "mt-1 border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/80 text-sm font-extrabold text-blue-950" : "bg-slate-50 text-[13px]"}`}>
      <span className={emphasis ? "" : "font-medium text-slate-500"}>{label}</span>
      <span className={`whitespace-nowrap font-bold ${negative ? "text-rose-600" : emphasis ? "" : "text-slate-900"}`}>{negative ? "− " : ""}{money(value, locale)}</span>
    </div>
  );
}

export default function PosSaleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, locale, dir } = useTranslation();
  const formatMoney = (value) => money(value, locale);
  const { productNameOf } = useLocalized();
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

  if (isLoading) return <div className="py-12 text-center text-sm" style={muted}>{t("admin.pos.ui.loadingSaleDetails")}</div>;
  if (isError || !sale) {
    return (
      <div className="space-y-4">
        <Link href="/admin/pos/history" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><ArrowLeft size={16} /> {t("admin.pos.ui.saleHistory")}</Link>
        <div className="rounded-2xl p-10 text-center text-sm font-semibold text-rose-600" style={cardStyle}>{t("admin.pos.ui.couldNotLoadThisSale")}</div>
      </div>
    );
  }

  const customer = sale.customer_snapshot || {};
  const customerRecord = sale.customer_id || {};
  const cashier = sale.cashier_id || {};
  const customerName = customer.name || customerRecord.name || t("admin.pos.ui.walkInCustomer");
  const customerPhone = customer.phone || customerRecord.phone;
  const customerEmail = customer.email || customerRecord.email;
  const customerAddress = customer.address || customerRecord.address;
  const items = sale.items || [];
  const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const method = paymentName(sale.payment?.method, t);
  const isCompleted = (sale.status || "completed") === "completed";
  const activity = [
    {
      id: "created",
      type: "created",
      at: sale.created_at,
      actor: sale.created_by_name || sale.cashier_name || cashier.name || t("admin.pos.ui.unknownStaff"),
      changes: items.map((item) => ({ action: "added", product_name: productNameOf(item) || item.product_name, variant_title: item.variant_title, sku: item.sku, to_quantity: item.quantity })),
    },
    ...(sale.edit_history || []).map((entry, index) => ({ ...entry, id: `edit-${index}`, type: "edited", at: entry.edited_at, actor: entry.edited_by_name || t("admin.pos.ui.unknownStaff") })),
    ...(sale.returns || []).map((entry, index) => ({ ...entry, id: `return-${index}`, type: "returned", at: entry.returned_at, actor: entry.returned_by_name || t("admin.pos.ui.unknownStaff") })),
  ].sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime());
  const activityChangeLabel = (change) => {
    const name = productNameOf(change) || change.product_name || t("admin.pos.ui.product");
    const variant = change.variant_title || change.sku;
    const product = variant ? `${name} · ${variant}` : name;
    if (change.action === "added") return t("admin.pos.ui.activityProductAdded", { product, quantity: change.to_quantity || 0 });
    if (change.action === "removed") return t("admin.pos.ui.activityProductRemoved", { product, quantity: change.from_quantity || 0 });
    if (change.action === "quantity") return t("admin.pos.ui.activityQuantityChanged", { product, from: change.from_quantity || 0, to: change.to_quantity || 0 });
    if (change.action === "price") return t("admin.pos.ui.activityItemPriceChanged", { product, from: formatMoney(change.from_value), to: formatMoney(change.to_value) });
    if (change.action === "discount") return t("admin.pos.ui.activityItemDiscountChanged", { product, from: change.from_value, to: change.to_value });
    if (change.action === "tax") return change.product_name
      ? t("admin.pos.ui.activityItemTaxChanged", { product, from: change.from_value, to: change.to_value })
      : t("admin.pos.ui.activityTaxChanged", { from: formatMoney(change.from_value), to: formatMoney(change.to_value) });
    if (change.action === "sale_discount") return t("admin.pos.ui.activitySaleDiscountChanged", { from: formatMoney(change.from_value), to: formatMoney(change.to_value) });
    if (change.action === "sale_total") return t("admin.pos.ui.activitySaleTotalChanged", { from: formatMoney(change.from_value), to: formatMoney(change.to_value) });
    if (change.action === "customer") return t("admin.pos.ui.activityCustomerChanged", { from: change.from_value, to: change.to_value });
    if (change.action === "payment") return t("admin.pos.ui.activityPaymentChanged", { from: change.from_value, to: change.to_value });
    if (change.action === "notes") return t("admin.pos.ui.activityNotesChanged", { from: change.from_value, to: change.to_value });
    return product;
  };
  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=460,height=760");
    if (!printWindow) return;
    const storeName = storeInfo.store_name || t("admin.pos.ui.ourStore");
    const contact = [
      [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.zip_code].filter(Boolean).join(", "),
      storeInfo.phone || storeInfo.support_phone,
      storeInfo.email || storeInfo.support_email,
    ].filter(Boolean).map(escapeHtml).join(" · ");
    const rows = items.map((item) => {
      const variant = [item.variant_title, item.sku].filter(Boolean).join(" · ");
      return `<tr><td><strong>${escapeHtml(productNameOf(item) || t("admin.pos.ui.product"))}</strong>${variant ? `<small>${escapeHtml(variant)}</small>` : ""}</td><td>${Number(item.quantity) || 0} × ${formatMoney(item.unit_price)}</td><td>${formatMoney(item.line_total)}</td></tr>`;
    }).join("");
    const receipt = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.sale_number || t("common.notProvided"))}</title><style>
      *{box-sizing:border-box}body{width:100%;max-width:390px;margin:0 auto;padding:22px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#172033;background:#fff}header{text-align:center;padding-bottom:12px;border-bottom:1px solid #dbe2ea}.store{margin:0;font-size:19px;font-weight:700}.contact{margin-top:5px;color:#64748b;font-size:10px}.title{margin:13px 0;text-align:center;color:#334155;font-size:10px;font-weight:700;letter-spacing:1.2px}.meta{padding:9px 0;border-top:1px dashed #cbd5e1;border-bottom:1px dashed #cbd5e1}.row,.summary-row,.total,.payment{display:flex;justify-content:space-between;gap:12px;padding:4px 0}.row span:first-child,.summary-row span:first-child,.payment span{color:#64748b}.row span:last-child{text-align:right;font-weight:600}table{width:100%;margin-top:10px;border-collapse:collapse;table-layout:fixed}th{padding:7px 3px;border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b;font-size:10px}th:first-child{width:46%}th:nth-child(2){width:30%;text-align:center}th:last-child{width:24%;text-align:right}td{padding:8px 3px;border-bottom:1px solid #e8edf3;vertical-align:top;font-size:10px;overflow-wrap:anywhere}td:nth-child(2){text-align:center;color:#475569}td:last-child{text-align:right;white-space:nowrap;font-weight:600}small{display:block;margin-top:3px;color:#64748b;font-size:9px}.summary{margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1}.summary-row{font-size:11px}.total{margin-top:6px;padding:10px 0;border-top:1px solid #334155;border-bottom:1px solid #334155;font-size:15px;font-weight:700}.payment{font-size:11px}.notes{margin-top:9px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:10px;white-space:pre-wrap}.thanks{margin-top:16px;text-align:center;color:#64748b;font-size:10px}@page{size:80mm auto;margin:4mm}@media print{body{width:72mm;max-width:72mm;margin:0 auto;padding:0}tr,.summary,.total,.payment,.notes{break-inside:avoid}}
    </style></head><body><header><h1 class="store">${escapeHtml(storeName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ""}</header><div class="title">${escapeHtml(t("admin.pos.receipt.salesReceipt"))}</div><div class="meta"><div class="row"><span>${escapeHtml(t("admin.pos.receipt.receipt"))}</span><span>${escapeHtml(sale.sale_number || t("common.notProvided"))}</span></div><div class="row"><span>${escapeHtml(t("admin.pos.receipt.customer"))}</span><span>${escapeHtml(customerName)}</span></div>${customerPhone ? `<div class="row"><span>${escapeHtml(t("common.phone"))}</span><span>${escapeHtml(customerPhone)}</span></div>` : ""}<div class="row"><span>${escapeHtml(t("common.date"))}</span><span>${escapeHtml(sale.created_at ? new Date(sale.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "")}</span></div></div><table><thead><tr><th>${escapeHtml(t("admin.pos.receipt.item"))}</th><th>${escapeHtml(t("admin.pos.receipt.quantityPrice"))}</th><th>${escapeHtml(t("admin.pos.receipt.total"))}</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.subtotal"))}</span><span>${formatMoney(sale.subtotal)}</span></div>${Number(sale.discount_amount) > 0 ? `<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.discount"))}</span><span>− ${formatMoney(sale.discount_amount)}</span></div>` : ""}<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.tax"))}</span><span>${formatMoney(sale.tax_amount)}</span></div></div><div class="total"><span>${escapeHtml(t("admin.pos.receipt.total"))}</span><span>${formatMoney(sale.total)}</span></div><div class="payment"><span>${escapeHtml(t("admin.pos.receipt.payment"))} ? ${escapeHtml(method)}</span><strong>${formatMoney(sale.payment?.amount_received)}</strong></div>${Number(sale.payment?.change_due) > 0 ? `<div class="payment"><span>${escapeHtml(t("admin.pos.receipt.change"))}</span><strong>${formatMoney(sale.payment.change_due)}</strong></div>` : ""}${sale.notes ? `<div class="notes"><strong>${escapeHtml(t("admin.pos.receipt.notes"))}:</strong> ${escapeHtml(sale.notes)}</div>` : ""}<footer class="thanks">${escapeHtml(t("admin.pos.receipt.thankYou"))}</footer><script>window.onload=()=>window.print();window.onafterprint=()=>window.close()</script></body></html>`;
    printWindow.document.write(receipt);
    printWindow.document.close();
  };

  return (
    <div dir={dir} className="min-h-full space-y-4 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><ReceiptText size={22} color="#fff" /></span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("admin.pos.ui.saleDetails")}</h1>
            <p className="mt-0.5 text-xs sm:text-sm" style={muted}>{t("admin.pos.ui.receiptAndCompleteTransactionInformation")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={printReceipt} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: "#dce8f8", backgroundColor: "#fff" }}>
            <Printer size={15} /> {t("admin.pos.ui.print")}
          </button>
          <button type="button" onClick={() => router.push("/admin/pos/history")} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }}>
            <ArrowLeft size={15} /> {t("admin.pos.ui.saleHistory")}
          </button>
        </div>
      </header>

      <Panel
        title={t("admin.pos.ui.saleOverview")}
        icon={ReceiptText}
        trailing={<span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{isCompleted && <CheckCircle2 size={12} />}{saleStatusLabel(sale.status, t)}</span>}
      >
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={muted}>{t("admin.pos.ui.saleNumber")}</p>
              <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-blue-700">{sale.sale_number || t("common.notProvided")}</h2>
            </div>
            <span className="text-xs" style={muted}>{dateTime(sale.created_at, locale, t)}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [CalendarDays, t("admin.pos.ui.saleDate"), dateTime(sale.created_at, locale, t)],
              [UserRound, t("admin.pos.ui.customer"), customerName],
              [CreditCard, t("admin.pos.ui.paymentMethod"), method],
              [ShoppingBag, t("admin.pos.ui.itemsSoldCount", { count: quantity })],
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
        <Panel title={t("admin.pos.ui.productsItems")} icon={Package} trailing={<span className="text-xs font-semibold" style={muted}>{items.length} {t("admin.pos.ui.product")}{items.length === 1 ? "" : "s"}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                <tr>
                {[t("admin.pos.ui.productVariant"), t("admin.pos.ui.qty"), t("admin.pos.ui.unitPrice"), t("admin.pos.ui.discount"), t("admin.pos.ui.tax"), t("admin.pos.ui.lineTotal")].map((label, index) => (
                    <th key={label} className={`whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wide ${index === 0 ? "text-start" : "text-end"}`} style={muted}>{label}</th>
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
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border bg-white" style={edge}><FallbackImage nextImage src={productImage} alt={productNameOf(item) || t("admin.pos.ui.product")} fill unoptimized className="object-contain p-1" /></span>
                          ) : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Package size={18} /></span>}
                          <span className="min-w-0"><span className="block truncate text-xs font-bold" style={primary}>{productNameOf(item) || t("admin.pos.ui.product")}</span><span className="mt-0.5 block truncate text-[10px]" style={muted}>{item.variant_title || t("admin.pos.ui.defaultVariant")}{item.sku ? ` · ${item.sku}` : ""}</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end font-medium" style={primary}>{item.quantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-end" style={muted}>{formatMoney(item.unit_price)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        {Number(item.discount_amount) > 0 ? <><span className="block text-xs font-semibold text-emerald-700">− {formatMoney(item.discount_amount)}</span><span className="text-[10px] text-emerald-600">{discountRate.toFixed(1)}%</span></> : <span style={muted}>—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end"><span className="block text-xs" style={primary}>{Number(item.tax_rate) || 0}%</span><span className="text-[10px]" style={muted}>{formatMoney(taxValue)}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-end text-xs font-bold" style={primary}>{formatMoney(lineTotalWithTax)}</td>
                    </tr>
                  );
                })}
                {!items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={muted}>{t("admin.pos.ui.noItemsWereRecordedForThisSale")}</td></tr>}
              </tbody>
            </table>
            <p className="border-t px-4 py-2 text-[11px]" style={{ ...muted, borderColor: "#e2e8f0" }}>{t("admin.pos.ui.lineTotalsIncludeItemDiscountsAndTaxAnySaleWideDiscountIsShownInTheSummary")}</p>
          </div>
        </Panel>

        <aside className="space-y-4">
          <Panel title={t("admin.pos.ui.saleSummary")} icon={Wallet}>
            <div className="space-y-2 p-4">
              <AmountRow label={t("admin.pos.ui.subtotal")} value={sale.subtotal} />
              <AmountRow label={t("admin.pos.ui.discount")} value={sale.discount_amount} negative />
              <AmountRow label={t("admin.pos.ui.tax")} value={sale.tax_amount} />
              <AmountRow label={t("admin.pos.ui.saleTotal")} value={sale.total} emphasis />
              <div className="mt-3 grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="rounded-xl border p-3" style={edge}><p style={muted}>{t("admin.pos.ui.amountReceived")}</p><p className="mt-1 font-bold" style={primary}>{formatMoney(sale.payment?.amount_received)}</p></div>
                <div className="rounded-xl border p-3" style={edge}><p style={muted}>{t("admin.pos.ui.changeGiven")}</p><p className="mt-1 font-bold" style={primary}>{formatMoney(sale.payment?.change_due)}</p></div>
              </div>
            </div>
          </Panel>

          <Panel title={t("admin.pos.ui.customerPayment")} icon={UserRound}>
            <div className="px-4 py-1">
              <DetailRow icon={UserRound} label={t("admin.pos.ui.customer")} value={customerName} />
              <DetailRow icon={Phone} label={t("common.phone")} value={customerPhone} />
              <DetailRow icon={Mail} label={t("common.email")} value={customerEmail} />
              <DetailRow icon={MapPin} label={t("admin.pos.ui.address")} value={customerAddress} />
              <DetailRow icon={CreditCard} label={t("admin.pos.ui.paymentMethod")} value={method} />
              <DetailRow icon={FileText} label={t("admin.pos.ui.paymentReference")} value={sale.payment?.reference} />
              <DetailRow icon={UserRound} label={t("admin.pos.ui.cashier")} value={sale.cashier_name || cashier.name} />
              {cashier.email && <DetailRow icon={Mail} label={t("admin.pos.ui.cashierEmail")} value={cashier.email} />}
            </div>
          </Panel>

          <Panel title={t("admin.pos.ui.activityTimeline")} icon={Clock3} trailing={<span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">{activity.length}</span>}>
            <div className="max-h-[360px] overflow-y-auto px-3 py-3">
              <ol className="space-y-0">
                {[...activity].reverse().map((event, index, events) => {
                  const created = event.type === "created";
                  const returned = event.type === "returned";
                  const Icon = created ? ShoppingBag : returned ? RotateCcw : Pencil;
                  const eventTitle = created
                    ? t("admin.pos.ui.saleCreated")
                    : returned
                      ? t("admin.pos.ui.saleReturned")
                      : t("admin.pos.ui.saleUpdated");
                  const changes = event.type === "returned"
                    ? (event.items || []).map((item) => ({ action: "removed", product_name: item.product_name, variant_title: item.variant_title, sku: item.sku, from_quantity: item.quantity }))
                    : event.changes || [];
                  const eventDate = event.at && !Number.isNaN(new Date(event.at).getTime())
                    ? new Date(event.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
                    : t("common.notProvided");
                  return (
                    <li key={event.id} className="relative flex gap-2.5 pb-3 last:pb-0">
                      {index < events.length - 1 && <span aria-hidden="true" className="absolute start-[11px] top-6 h-[calc(100%-16px)] w-px bg-slate-200" />}
                      <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-white ${created ? "bg-emerald-100 text-emerald-700" : returned ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}><Icon size={11} /></span>
                      <div className="min-w-0 flex-1 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2"><p className="min-w-0 text-[11px] font-bold leading-4 text-slate-800">{eventTitle}</p><time className="shrink-0 text-[9px] leading-4 text-slate-400">{eventDate}</time></div>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{t("admin.pos.ui.activityBy", { name: event.actor || t("admin.pos.ui.unknownStaff") })}</p>
                        {changes.length > 0 ? <ul className="mt-1.5 space-y-1">{changes.map((change, changeIndex) => <li key={`${event.id}-${changeIndex}`} className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-600"><span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${change.action === "removed" ? "bg-rose-400" : change.action === "quantity" ? "bg-amber-400" : "bg-emerald-500"}`} /><span className="min-w-0 break-words">{activityChangeLabel(change)}</span></li>)}</ul> : !created && !returned ? <p className="mt-1 text-[10px] text-slate-500">{t("admin.pos.ui.saleDetailsUpdated")}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Panel>

          {sale.notes && (
            <Panel title={t("admin.pos.ui.saleNotes")} icon={FileText}>
              <p className="whitespace-pre-wrap break-words px-4 py-3 text-[13px] leading-6 text-slate-700">{sale.notes}</p>
            </Panel>
          )}
        </aside>
      </div>

    </div>
  );
}
