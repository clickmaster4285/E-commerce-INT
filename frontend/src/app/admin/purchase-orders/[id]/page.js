"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  ArrowLeft, BriefcaseBusiness, CalendarDays, Check, CheckCircle2,
  ChevronRight, Circle, CreditCard, FileText, MapPin, Mail, Package, PackageCheck,
  Phone, Truck, UserRound, Wallet, XCircle,
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const edge = { border: "1px solid #dce8f8" };
const card = { ...edge, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", borderRadius: 14, boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" };
const muted = { color: "#64748b" };
const primary = { color: "#0f172a" };
const accent = { color: "#2563eb" };
const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-PK" : locale;
const money = (n, locale = "en") => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const dateTime = (value, locale = "en") => value ? new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const dateOnly = (value, locale = "en") => value ? new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "—";
const imageUrl = (url) => !url ? "" : /^https?:\/\//i.test(url) ? url : `${API_ORIGIN || ""}${url.startsWith("/") ? url : `/${url}`}`;

const statusStyles = {
  pending: { label: "Pending", bg: "#fff5df", fg: "#b5760a" },
  confirmed: { label: "Confirmed", bg: "#fff5df", fg: "#b5760a" },
  delivered: { label: "Received", bg: "#e1f8f0", fg: "#079878" },
  closed: { label: "Closed", bg: "#edf2fa", fg: "#627b9f" },
  cancelled: { label: "Cancelled", bg: "#ffebed", fg: "#cf3348" },
  unpaid: { label: "Unpaid", bg: "#fff5df", fg: "#b5760a" },
  partial: { label: "Partial", bg: "#fff5df", fg: "#b5760a" },
  paid: { label: "Paid", bg: "#e1f8f0", fg: "#079878" },
};

function Badge({ value }) {
  const { t } = useTranslation();
  const style = statusStyles[String(value || "pending").toLowerCase()] || statusStyles.pending;
  return <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold shadow-sm" style={{ backgroundColor: style.bg, color: style.fg }}>{t(`admin.purchaseOrders.status.${String(value || "pending").toLowerCase()}`)}</span>;
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

function Modal({ title, onClose, icon: Icon, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border shadow-2xl" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", borderColor: "#dce8f8", color: "#173d78", boxShadow: "0 24px 70px rgba(15,23,42,0.25)" }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "#e5eef9", background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)" }}>
        {Icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><Icon size={18} color="#fff" /></div>}
        <h2 className="text-base font-extrabold tracking-tight" style={primary}>{title}</h2>
      </div>
      {children}
    </div>
  </div>;
}

export default function PODetailPage({ params }) {
  const { t, locale } = useTranslation();
  const { id } = use(params);
  const qc = useQueryClient();
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showAllItems, setShowAllItems] = useState(false);
  const { data: res, isLoading, isError, refetch } = useQuery({ queryKey: ["po", id], queryFn: () => purchaseOrderApi.getById(id) });
  const po = res?.data || null;
  const taxBase = po ? Math.max(0, Number(po.subtotal || 0) - Number(po.discount || 0)) : 0;
  const overallTaxPercent = po?.overall_tax_rate != null
    ? Number(po.overall_tax_rate)
    : taxBase > 0 ? Number(po?.overall_tax || 0) / taxBase * 100 : 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ["po", id] });
  const act = (fn, ok) => useMutation({ mutationFn: fn, onSuccess: () => { toast.success(ok); refresh(); }, onError: () => toast.error(t("admin.purchaseOrders.toast.updateFailed")) });
  const confirmM = act(() => purchaseOrderApi.confirm(id), t("admin.purchaseOrders.toast.confirmed"));
  const cancelM = act(() => purchaseOrderApi.cancel(id, cancelReason), t("admin.purchaseOrders.toast.cancelled"));
  const deliverM = useMutation({
    mutationFn: (invoiceNumber) => purchaseOrderApi.deliver(id, {
      items: (po?.items || [])
        .map((item) => ({ variant_id: item.variant_id, qty: Math.max(0, Number(item.qty_ordered) - Number(item.received_qty)) }))
        .filter((item) => item.qty > 0),
      invoice_no: invoiceNumber,
    }),
    onSuccess: () => {
      toast.success(t("admin.purchaseOrders.toast.deliveryUpdated"));
      setDeliverOpen(false);
      setInvoiceNo("");
      refresh();
      qc.invalidateQueries({ queryKey: ["stock-all"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-history"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
    },
    onError: () => toast.error(t("admin.purchaseOrders.toast.deliveryFailed")),
  });
  const payM = useMutation({
    mutationFn: ({ amount, method }) => purchaseOrderApi.recordPayment(id, { amount, method }),
    onSuccess: (_, variables) => { toast.success(Number(variables.amount) >= dueAmount ? t("admin.purchaseOrders.toast.paidClosed") : t("admin.purchaseOrders.toast.paymentRecorded")); setPayOpen(false); setPayAmount(""); refresh(); },
    onError: () => toast.error(t("admin.purchaseOrders.toast.paymentFailed")),
  });

  if (isLoading) return <div className="space-y-3"><div className="skeleton h-8 w-1/3" /><div className="skeleton h-28 w-full" /><div className="skeleton h-52 w-full" /></div>;
  if (isError || !po) return <div className="rounded-xl border bg-white p-8 text-center" style={edge}><p className="text-sm" style={primary}>{t("admin.purchaseOrders.toast.loadFailed")}</p><button onClick={() => refetch()} className="mt-2 text-sm font-semibold" style={accent}>{t("admin.purchaseOrders.toast.tryAgain")}</button><div><Link href="/admin/purchase-orders" className="mt-3 inline-block text-sm underline" style={muted}>{t("admin.purchaseOrders.detail.poDetails")}</Link></div></div>;

  const items = po.items || [];
  const vendor = po.vendor_snapshot || {};
  const payments = po.payments || [];
  const status = String(po.status || "pending").toLowerCase();
  const payStatus = String(po.payment_status || "unpaid").toLowerCase();
  const dueAmount = Math.max(0, Number(po.due_amount ?? (Number(po.total || 0) - Number(po.paid_amount || 0))) || 0);
  const canDeliver = items.some((item) => Number(item.qty_ordered) > Number(item.received_qty));
  const canPay = ["delivered", "closed"].includes(status) && dueAmount > 0;
  const vendorId = po.vendor_id?._id || po.vendor_id;
  const vendorActive = po.vendor_id?.is_active;
  const steps = ["pending", "confirmed", "delivered", "closed", "cancelled"];
  const currentStep = steps.indexOf(status);
  const openDeliver = () => { setInvoiceNo(""); setDeliverOpen(true); };
  const smallAction = (label, onClick, Icon, primaryAction = false, disabled = false) => <button key={label} disabled={disabled} onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition hover:bg-blue-50 disabled:opacity-45" style={{ borderColor: primaryAction ? "#c8dcff" : "#dce8f8", color: primaryAction ? "#2878f0" : "#36567f", background: "white" }}>{Icon && <Icon size={16} />}{label}</button>;

  return <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm" style={muted}>
          <Link href="/admin/purchase-orders" className="inline-flex items-center gap-1 hover:text-blue-700"><ArrowLeft size={14} />{t("admin.purchaseOrders.page.title")}</Link>
            <ChevronRight size={13} /> <span style={primary}>{po.po_number}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}><FileText size={18} /></div>
            <h1 className="font-mono text-xl font-bold" style={primary}>{po.po_number}</h1>
            <Badge value={status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs" style={muted}>
            <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{t("admin.purchaseOrders.view.created")} {dateTime(po.created_at, locale)}</span>
            <span className="inline-flex items-center gap-1"><UserRound size={13} />{t("admin.purchaseOrders.view.by")} {po.createdby?.name || t("admin.purchaseOrders.view.admin")}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {status === "pending" && smallAction(confirmM.isPending ? t("admin.purchaseOrders.view.confirming") : t("admin.purchaseOrders.view.confirm"), () => confirmM.mutate(), Check, true, confirmM.isPending)}
          {status === "confirmed" && smallAction(t("admin.purchaseOrders.view.receiveItems"), openDeliver, Truck, true, !canDeliver)}
          {canPay && smallAction(t("admin.purchaseOrders.view.addPayment"), () => setPayOpen(true), CreditCard, true)}
          {status === "delivered" && dueAmount > 0 && smallAction(payM.isPending && payM.variables?.type === "full" ? t("admin.purchaseOrders.view.paying") : t("admin.purchaseOrders.view.paymentDone"), () => payM.mutate({ amount: dueAmount, method: "bank", type: "full" }), CheckCircle2, false, payM.isPending)}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <main className="space-y-3.5 lg:col-span-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={t("admin.purchaseOrders.detail.vendorInfo")} icon={BriefcaseBusiness} trailing={vendorId && <Link href={`/admin/vendors/${vendorId}`} className="rounded border px-2 py-1 text-xs font-semibold hover:bg-blue-50" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}>{t("admin.purchaseOrders.view.viewVendor")}</Link>}>
              <div className="p-4">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "#f0f4fa", color: "#4c6688" }}>{String(vendor.name || po.vendor_id?.name || "V").slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0"><div className="truncate text-[11px] font-bold" style={primary}>{vendor.name || po.vendor_id?.name || "Vendor"}</div><div className="truncate text-xs" style={muted}>{vendor.company_name || "—"}</div></div>
                  {vendorActive !== undefined && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: vendorActive ? "#079878" : "#cf3348", background: vendorActive ? "#e1f8f0" : "#ffebed" }}>{t(vendorActive ? "admin.purchaseOrders.view.active" : "admin.purchaseOrders.view.inactive")}</span>}
                </div>
                <div className="space-y-0.5">
                  <LabelValue icon={BriefcaseBusiness} label={t("admin.purchaseOrders.view.company")} value={vendor.company_name || vendor.name || po.vendor_id?.name} />
                  <LabelValue icon={Phone} label={t("admin.purchaseOrders.detail.phone")} value={vendor.phone} />
                  <LabelValue icon={Mail} label={t("admin.purchaseOrders.detail.email")} value={vendor.email} />
                  <LabelValue icon={MapPin} label={t("admin.purchaseOrders.detail.address")} value={vendor.address} />
                  <LabelValue icon={MapPin} label={t("admin.purchaseOrders.view.city")} value={vendor.city} />
                </div>
              </div>
            </Panel>

            <Panel title={t("admin.purchaseOrders.view.summary")} icon={FileText}>
              <div className="space-y-2 p-4 text-[13px]">
<<<<<<< HEAD
                <div className="flex justify-between"><span style={muted}>Subtotal</span><span style={primary}>{money(po.subtotal)}</span></div>
                <div className="flex justify-between"><span style={muted}>Tax (overall {new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(overallTaxPercent)}%)</span><span style={primary}>{money(Number(po.tax || 0) + Number(po.overall_tax || 0))}</span></div>
                <div className="flex justify-between"><span style={muted}>Shipping</span><span style={primary}>{money(po.shipping)}</span></div>
                <div className="flex justify-between"><span style={muted}>Discount</span><span style={primary}>{money(po.discount)}</span></div>
                <div className="mt-2 flex justify-between border-t pt-2.5 text-sm font-bold" style={{ borderColor: "#e5eef9" }}><span style={primary}>Total</span><span style={{ color: "#06a981" }}>{money(po.total)}</span></div>
=======
                <div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.detail.subtotal")}</span><span style={primary}>{money(po.subtotal)}</span></div>
                <div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.detail.tax")} ({new Intl.NumberFormat(intlLocale(locale)).format(taxPercent)}%)</span><span style={primary}>{money(po.tax)}</span></div>
                <div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.detail.overallTax")}</span><span style={primary}>{money(po.overall_tax)}</span></div>
                <div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.view.shipping")}</span><span style={primary}>{money(po.shipping)}</span></div>
                <div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.view.discount")}</span><span style={primary}>{money(po.discount)}</span></div>
                <div className="mt-2 flex justify-between border-t pt-2.5 text-sm font-bold" style={{ borderColor: "#e5eef9" }}><span style={primary}>{t("admin.purchaseOrders.detail.total")}</span><span style={{ color: "#06a981" }}>{money(po.total)}</span></div>
>>>>>>> 2e3f0d01943d374997bd89fc3c0e0f7e0754f66e
              </div>
            </Panel>
          </div>

          <Panel title={t("admin.purchaseOrders.view.items")} icon={PackageCheck} trailing={<span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: "#2878f0", background: "#edf5ff" }}>{t("admin.purchaseOrders.view.itemCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(items.length) })}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead style={{ background: "#f8fbff", color: "#627b9f" }}><tr>{["#", "admin.purchaseOrders.view.image", "admin.purchaseOrders.view.productVariant", "SKU", "admin.purchaseOrders.view.qtyOrdered", "admin.purchaseOrders.view.costPrice", "admin.purchaseOrders.view.sellPrice", "admin.purchaseOrders.view.lineTotal", "admin.purchaseOrders.view.taxRate", "admin.purchaseOrders.view.expiryAfterDelivery"].map((key) => <th key={key} className="whitespace-nowrap px-2.5 py-2 font-semibold">{key === "#" || key === "SKU" ? key : t(key)}</th>)}</tr></thead>
                <tbody>{items.slice(0, showAllItems ? items.length : 10).map((item, index) => <tr key={`${item.variant_id}-${index}`} className="border-t" style={{ borderColor: "#eaf0f8" }}>
                  <td className="px-2.5 py-2.5" style={muted}>{index + 1}</td>
                  <td className="px-2.5 py-2"><div className="flex h-9 w-10 items-center justify-center overflow-hidden rounded-md border bg-white" style={{ borderColor: "#dce8f8" }}>{imageUrl(item.image) ? <img src={imageUrl(item.image)} alt={item.name || ""} className="h-full w-full object-cover" /> : <Package size={15} style={{ color: "#9bb0cc" }} />}</div></td>
                  <td className="max-w-[150px] px-2.5 py-2.5"><div className="truncate font-semibold" style={primary}>{item.name || "—"}</div><div className="truncate" style={muted}>{item.variantTitle || "—"}</div></td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-mono" style={muted}>{item.sku || "—"}</td>
                  <td className="px-2.5 py-2.5 text-center" style={primary}>{item.qty_ordered}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5" style={primary}>{money(item.cost_price, locale)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5" style={primary}>{money(item.sell_price, locale)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-semibold" style={primary}>{money(item.line_total, locale)}</td>
                  <td className="px-2.5 py-2.5" style={muted}>{new Intl.NumberFormat(intlLocale(locale)).format(Number(item.tax_rate || 0))}%</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5" style={primary}>{Number(item.expiry_after_delivery) > 0 ? `${new Intl.NumberFormat(intlLocale(locale)).format(item.expiry_after_delivery)} ${t("admin.purchaseOrders.view.days")}` : item.expiry_date ? t("admin.purchaseOrders.view.until", { date: dateOnly(item.expiry_date, locale) }) : "—"}</td>
                </tr>)}
                  {!items.length && <tr><td colSpan={10} className="p-8 text-center text-xs" style={muted}>{t("admin.purchaseOrders.view.noItems")}</td></tr>}</tbody>
              </table>
            </div>
            {items.length > 10 && (
              <div className="border-t p-3 text-center" style={{ borderColor: "#eaf0f8" }}>
                <button type="button" onClick={() => setShowAllItems((current) => !current)} className="rounded-lg px-4 py-2 text-xs font-semibold transition hover:bg-blue-50" style={{ color: "#2878f0" }}>
                  {showAllItems ? "Show less" : `Show more (${items.length - 10} remaining)`}
                </button>
              </div>
            )}
          </Panel>

        </main>

        <aside className="space-y-3.5 lg:col-span-4">
          <Panel title={t("admin.purchaseOrders.view.statusPayment")} icon={Circle}>
            <div className="p-4">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>{t("admin.purchaseOrders.view.orderStatus")}</span><Badge value={status} /></div>
              <div className="relative mt-5 grid grid-cols-5 gap-1">
                <div className="absolute left-[10%] right-[10%] top-[5px] h-px" style={{ background: "#d9e7fa" }} />
                {steps.map((step, index) => {
                  const complete = status !== "cancelled" && currentStep >= index;
                  const active = status === step;
                  return <div key={step} className="relative flex flex-col items-center gap-1.5 text-center">
                    <span className="z-[1] flex h-[11px] w-[11px] items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: complete ? "#08b88e" : "#cbdaf0", background: complete ? "#08b88e" : "white" }}>{complete && <Check size={7} color="white" strokeWidth={3} />}</span>
                    <span className="text-[11px]" style={{ color: active ? "#173d78" : "#7188a8", fontWeight: active ? 700 : 400 }}>{t(`admin.purchaseOrders.status.${step}`)}</span>
                  </div>;
                })}
              </div>
              <div className="my-3 border-t" style={{ borderColor: "#edf2f9" }} />
              <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>{t("admin.purchaseOrders.view.paymentStatus")}</span><Badge value={payStatus} /></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#edf3fb" }}><div className="h-full rounded-full" style={{ width: `${po.total > 0 ? Math.min(100, Math.max(0, (Number(po.paid_amount || 0) / Number(po.total)) * 100)) : 0}%`, background: "#0bb98f" }} /></div>
              <div className="mt-2 space-y-1 text-xs"><div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.view.paidAmount")}</span><span className="font-semibold" style={primary}>{money(po.paid_amount, locale)}</span></div><div className="flex justify-between"><span style={muted}>{t("admin.purchaseOrders.view.dueAmount")}</span><span className="font-semibold" style={primary}>{money(po.due_amount, locale)}</span></div></div>
            </div>
          </Panel>

          <Panel title={t("admin.purchaseOrders.view.vendorSnapshot")} icon={UserRound}>
            <div className="space-y-1 px-4 py-3 text-sm">
              <LabelValue label={t("admin.purchaseOrders.detail.name")} value={vendor.name || po.vendor_id?.name} />
              <LabelValue label={t("admin.purchaseOrders.view.companyName")} value={vendor.company_name} />
              <LabelValue label={t("admin.purchaseOrders.detail.phone")} value={vendor.phone} />
              <LabelValue label={t("admin.purchaseOrders.detail.email")} value={vendor.email} />
              <LabelValue label={t("admin.purchaseOrders.detail.address")} value={vendor.address} />
              <LabelValue label={t("admin.purchaseOrders.view.city")} value={vendor.city} />
            </div>
          </Panel>

          <Panel title={t("admin.purchaseOrders.view.paymentHistory")} icon={Wallet} trailing={<span className="text-xs font-semibold" style={accent}>{t("admin.purchaseOrders.view.totalCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(payments.length) })}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead style={{ background: "#f8fbff", color: "#627b9f" }}><tr>{["#", "admin.purchaseOrders.page.date", "admin.purchaseOrders.detail.total"].map((key) => <th key={key} className="whitespace-nowrap px-2 py-2 font-semibold">{key === "#" ? key : t(key)}</th>)}</tr></thead>
                <tbody>{payments.map((payment, index) => <tr key={payment._id || index} className="border-t" style={{ borderColor: "#eaf0f8" }}><td className="px-2 py-2" style={muted}>{new Intl.NumberFormat(intlLocale(locale)).format(index + 1)}</td><td className="whitespace-nowrap px-2 py-2" style={primary}>{dateTime(payment.paid_at || payment.created_at, locale)}</td><td className="whitespace-nowrap px-2 py-2 font-semibold" style={primary}>{money(payment.amount, locale)}</td></tr>)}
                  {!payments.length && <tr><td colSpan={3} className="p-4 text-center" style={muted}>{t("admin.purchaseOrders.view.noPayments")}</td></tr>}</tbody>
              </table>
            </div>
            <div className="space-y-2 border-t p-3" style={{ borderColor: "#e5eef9" }}>
              {canPay && <button onClick={() => setPayOpen(true)} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white hover:opacity-90 print:hidden" style={{ background: "#2878f0" }}><CreditCard size={14} />{t("admin.purchaseOrders.view.addPayment")}</button>}
              {["pending", "confirmed"].includes(status) && <div className="flex gap-1.5 print:hidden"><input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t("admin.purchaseOrders.view.cancelReason")} className="h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none" style={{ borderColor: "#dce8f8", color: "#173d78" }} /><button disabled={cancelM.isPending || !cancelReason.trim()} onClick={() => cancelM.mutate()} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: "#ffc9d0", color: "#cf3348" }}><XCircle size={13} />{t("admin.purchaseOrders.view.cancelPO")}</button></div>}
            </div>
          </Panel>
        </aside>
      </div>
    {deliverOpen && <Modal title={t("admin.purchaseOrders.view.receiveTitle")} icon={Truck} onClose={() => setDeliverOpen(false)}><div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-3 rounded-2xl border p-4 sm:p-5" style={{ borderColor: "#bfdbfe", background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)" }}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "#dbeafe", color: "#2563eb" }}><PackageCheck size={19} /></div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold" style={primary}>{t("admin.purchaseOrders.view.readyInventory")}</p>
          <p className="mt-1 text-xs leading-5" style={muted}>{t("admin.purchaseOrders.view.receiveInfo")}</p>
        </div>
      </div>
      <label className="block text-xs font-bold" style={primary}>
        <span className="mb-2 block">{t("admin.purchaseOrders.view.invoiceNumber")} <span className="font-medium" style={muted}>{t("admin.purchaseOrders.view.optional")}</span></span>
        <div className="relative">
          <FileText size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder={t("admin.purchaseOrders.view.invoicePlaceholder")} className="h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-blue-100" style={{ borderColor: "#cfe0f8", color: "#0f172a" }} />
        </div>
      </label>
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end" style={{ borderColor: "#e5eef9" }}>
        <button disabled={deliverM.isPending} onClick={() => deliverM.mutate("")} className="h-10 rounded-xl border bg-white px-4 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "#dce8f8", color: "#36567f" }}>{deliverM.isPending && deliverM.variables === "" ? t("admin.purchaseOrders.view.receiving") : t("admin.purchaseOrders.view.skipInvoice")}</button>
        <button disabled={deliverM.isPending || !invoiceNo.trim()} onClick={() => deliverM.mutate(invoiceNo.trim())} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-45" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", boxShadow: "0 4px 14px rgba(37,99,235,0.28)" }}><CheckCircle2 size={16} />{deliverM.isPending && deliverM.variables !== "" ? t("admin.purchaseOrders.view.receiving") : t("admin.purchaseOrders.view.addInvoiceReceive")}</button>
      </div>
    </div></Modal>}

    {payOpen && <Modal title={t("admin.purchaseOrders.view.recordPayment")} icon={CreditCard} onClose={() => setPayOpen(false)}><div className="space-y-5 p-5 sm:p-6">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border p-3 sm:gap-3 sm:p-4" style={{ borderColor: "#dce8f8", background: "linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%)" }}>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider" style={muted}>{t("admin.purchaseOrders.view.poTotal")}</p><p className="mt-1 truncate text-sm font-extrabold sm:text-base" style={primary}>{money(po.total, locale)}</p></div>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider" style={muted}>{t("admin.purchaseOrders.view.paid")}</p><p className="mt-1 truncate text-sm font-extrabold sm:text-base" style={{ color: "#059669" }}>{money(po.paid_amount, locale)}</p></div>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider" style={muted}>{t("admin.purchaseOrders.view.balanceDue")}</p><p className="mt-1 truncate text-sm font-extrabold sm:text-base" style={{ color: "#b5760a" }}>{money(dueAmount, locale)}</p></div>
      </div>

      <label className="block text-xs font-bold" style={primary}>{t("admin.purchaseOrders.view.paymentAmount")}
        <div className="relative mt-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={muted}>Rs.</span>
          <input type="number" min={0.01} max={dueAmount} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={t("admin.purchaseOrders.view.enterAmount")} className="h-12 w-full rounded-xl border bg-white pl-12 pr-3 text-base font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={{ borderColor: "#cfe0f8", color: "#0f172a" }} />
        </div>
      </label>

      <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
        <span className="text-xs font-semibold" style={muted}>{t("admin.purchaseOrders.view.balanceAfter")}</span>
        <strong className="text-sm font-extrabold" style={{ color: Math.max(0, dueAmount - Number(payAmount || 0)) === 0 && Number(payAmount) > 0 ? "#059669" : "#0f172a" }}>{money(Math.max(0, dueAmount - Number(payAmount || 0)), locale)}</strong>
      </div>
      {Number(payAmount) >= dueAmount && Number(payAmount) > 0 && <p className="-mt-3 text-xs leading-5" style={{ color: "#059669" }}>{t("admin.purchaseOrders.view.settleBalance")}</p>}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end" style={{ borderColor: "#e5eef9" }}>
        <button onClick={() => setPayOpen(false)} disabled={payM.isPending} className="h-10 rounded-xl border bg-white px-4 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "#dce8f8", color: "#36567f" }}>{t("common.cancel")}</button>
        <button disabled={payM.isPending || !(Number(payAmount) > 0) || Number(payAmount) > dueAmount} onClick={() => payM.mutate({ amount: Number(payAmount), method: "bank" })} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-45" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", boxShadow: "0 4px 14px rgba(37,99,235,0.28)" }}><CreditCard size={16} />{payM.isPending ? t("admin.purchaseOrders.view.recordingPayment") : t("admin.purchaseOrders.view.recordPayment")}</button>
      </div>
    </div></Modal>}
  </div>;
}
