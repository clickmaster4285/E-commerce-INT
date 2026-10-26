"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronRight,
  Clock3, CreditCard, FileText, Mail, MapPin,
  Package, Percent, Phone, Printer, Receipt, RotateCcw, Send, UserRound } from
"lucide-react";
import { toast } from "sonner";
import { invoiceApi } from "@/apis/admin/invoiceApi";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import InvoicePaymentModal from "@/components/admin/InvoicePaymentModal";
import InvoiceReturnModal from "@/components/admin/InvoiceReturnModal";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const edge = { border: "1px solid #dce8f8" };
const card = {
  ...edge,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)"
};
const muted = { color: "#64748b" };
const primary = { color: "#0f172a" };
const accent = { color: "#2563eb" };
const money = (value, locale) => new Intl.NumberFormat(locale || "en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value) || 0);
const date = (value, locale) => value && !Number.isNaN(new Date(value).getTime()) ?
new Date(value).toLocaleDateString(locale || [], { year: "numeric", month: "2-digit", day: "2-digit" }) :
"-";
const paymentDateTime = (payment, locale) => {
  const value = payment?.payment_date;
  if (!value || Number.isNaN(new Date(value).getTime())) return { date: "-", time: "-" };
  return { date: date(value, locale), time: payment.payment_time || new Date(value).toLocaleTimeString(locale || [], { hour: "2-digit", minute: "2-digit" }) };
};
const imageUrl = (url) => !url || /^(https?:|blob:|data:)/i.test(url) ?
url || "" :
API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;

const statusStyles = {
  Unpaid: { bg: "#fff5df", fg: "#b5760a" },
  "Partially Paid": { bg: "#fff5df", fg: "#b5760a" },
  Paid: { bg: "#e1f8f0", fg: "#079878" },
  Overdue: { bg: "#ffebed", fg: "#cf3348" }
};

function Badge({ value, status = value }) {
  const style = statusStyles[status] || statusStyles.Unpaid;
  return <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold shadow-sm" style={{ backgroundColor: style.bg, color: style.fg }}>{value}</span>;
}

function Panel({ title, icon: Icon, trailing, className = "", children }) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl shadow-lg transition hover:shadow-xl ${className}`} style={card}>
    <div className="flex min-h-10 items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "#e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      {Icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><Icon size={15} strokeWidth={2.5} style={{ color: "#fff" }} /></div>}
      <h2 className="text-sm font-extrabold tracking-tight" style={primary}>{title}</h2>
      <div className="ml-auto">{trailing}</div>
    </div>
    {children}
  </section>;
}

function LabelValue({ label, value, icon: Icon }) {
  return <div className="grid grid-cols-[minmax(84px,.8fr)_minmax(0,1.2fr)] items-center gap-2 text-[13px] leading-6">
    <span className="inline-flex items-center gap-1.5" style={muted}>{Icon && <Icon size={13} />}{label}</span>
    <span className="min-w-0 truncate font-medium" style={primary} title={value || "-"}>{value || "-"}</span>
  </div>;
}

export default function InvoiceDetailsPage({ params }) {const { t, locale } = useTranslation();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const printHandled = useRef(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), payment_time: new Date().toTimeString().slice(0, 5), payment_method: "Cash", note: "" });
  const { data: invoice, isLoading, isError, refetch } = useQuery({
    queryKey: ["invoice-admin", id],
    queryFn: () => invoiceApi.getById(id)
  });
  const remaining = Math.max(0, Number(invoice?.remaining_balance ?? invoice?.total ?? 0));

  useEffect(() => {
    if (!invoice?.sent_at || searchParams.get("returnRefund") !== "1") return;
    setReturnOpen(true);
    router.replace(`/admin/invoices/${id}`, { scroll: false });
  }, [invoice, id, router, searchParams, t]);

  useEffect(() => {
    if (searchParams.get("print") !== "1" || !invoice || isLoading || printHandled.current) return undefined;
    printHandled.current = true;
    const timer = window.setTimeout(() => {
      window.print();
      router.replace(`/admin/invoices/${id}`, { scroll: false });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [id, invoice, isLoading, router, searchParams]);

  const paymentMutation = useMutation({
    mutationFn: (payment) => invoiceApi.recordPayment(id, payment),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoice-admin", id], updated);
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      setPaymentOpen(false);
      setPaymentForm({ amount: "", payment_date: new Date().toISOString().slice(0, 10), payment_time: new Date().toTimeString().slice(0, 5), payment_method: "Cash", note: "" });
      toast.success(t("admin.invoiceDetail.message.paymentRecorded"));
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.invoiceDetail.message.paymentFailed"))
  });

  const returnMutation = useMutation({
    mutationFn: (payload) => invoiceApi.recordReturn(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoice-admin", id], updated);
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      setReturnOpen(false);
      toast.success(t("admin.invoiceDetail.message.refundRecorded"));
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.invoiceDetail.message.refundFailed"))
  });

  const sendMutation = useMutation({
    mutationFn: () => invoiceApi.send(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoice-admin", id], updated);
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      toast.success(t("admin.invoiceDetail.message.invoiceSent"));
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.invoiceDetail.message.sendFailed"))
  });

  if (isLoading) return <div className="space-y-3"><div className="skeleton h-8 w-1/3" /><div className="skeleton h-28 w-full" /><div className="skeleton h-52 w-full" /></div>;
  if (isError || !invoice) return <div className="rounded-xl border bg-white p-8 text-center" style={edge}>
    <p className="text-sm" style={primary}>{t("admin.quoteInvoice.ui.could_not_load_this_invoice_b761111d")}</p>
    <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-semibold" style={accent}>{t("admin.quoteInvoice.ui.try_again_042c862e")}</button>
    <div><Link href="/admin/invoices" className="mt-3 inline-block text-sm underline" style={muted}>{t("admin.quoteInvoice.ui.back_to_invoices_8371e902")}</Link></div>
  </div>;

  const rawStatus = invoice.status || "Unpaid";
  const displayStatus = rawStatus === "Draft" ? "Unpaid" : rawStatus;
  const canReturn = Boolean(invoice.sent_at);
  const items = invoice.items || [];
  const payments = invoice.payments || [];
  const returns = invoice.returns || [];
  const paidAmount = Number(invoice.amount_paid || 0);
  const total = Number(invoice.total || 0);
  const balanceAdjustments = returns.reduce((sum, record) => sum + Number(record.total_adjustment ?? (record.refund_method === "Balance Adjustment" ? record.refund_amount : 0) ?? 0), 0);
  const paymentProgress = total > 0 ? Math.min(100, Math.max(0, (paidAmount / total) * 100)) : 0;
  const lastPayment = payments[payments.length - 1];
  const timeline = [
  [t("admin.invoiceDetail.timeline.invoiceCreated"), date(invoice.created_at || invoice.invoice_date, locale), true],
  [t("admin.invoiceDetail.timeline.sent"), date(invoice.sent_at, locale), Boolean(invoice.sent_at)],
  [t("admin.invoiceDetail.timeline.paymentReceived"), lastPayment ? date(lastPayment.payment_date, locale) : t("admin.invoiceDetail.timeline.awaitingPayment"), Boolean(lastPayment)]];

  const smallAction = (label, onClick, Icon, primaryAction = false, disabled = false, title) => {
    const button = <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition hover:bg-blue-50 disabled:opacity-45"
      style={{ borderColor: primaryAction ? "#c8dcff" : "#dce8f8", color: primaryAction ? "#2878f0" : "#36567f", background: "white" }}>
      {Icon && <Icon size={16} />}{label}</button>;
    return disabled && title ? <span key={label} title={title} className="inline-flex">{button}</span> : <span key={label} title={title}>{button}</span>;
  };
  const printInvoice = () => window.print();
  return <div id="invoice-print-area" className="space-y-4 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1.5 text-sm" style={muted}>
          <Link href="/admin/invoices" className="inline-flex items-center gap-1 transition hover:text-blue-700"><ArrowLeft size={14} />{t("admin.quoteInvoice.ui.invoices_35f8f37b")}</Link>
          <ChevronRight size={13} /> <span style={primary}>{invoice.invoice_number}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}><FileText size={18} /></div>
          <h1 className="font-mono text-xl font-bold" style={primary}>{t("admin.quoteInvoice.ui.invoice_51d86044")}{invoice.invoice_number}</h1>
          <Badge value={displayStatus} status={rawStatus} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs" style={muted}>
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{t("admin.invoiceDetail.field.created")} {date(invoice.created_at || invoice.invoice_date, locale)}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{t("admin.invoiceDetail.field.dueDate")} {date(invoice.due_date, locale)}</span>
          {invoice.sent_at && <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} />{t("admin.invoiceDetail.timeline.sent")} {date(invoice.sent_at, locale)}</span>}
          {invoice.paid_at && <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} />{t("admin.invoiceDetail.status.paid")} {date(invoice.paid_at, locale)}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        {canReturn && smallAction("Return & Refund", () => setReturnOpen(true), RotateCcw, true)}
        {smallAction("Download PDF", () => downloadInvoicePdf(invoice).catch(() => toast.error("Could not generate invoice PDF")), FileText)}
        {!invoice.sent_at && smallAction(
          sendMutation.isPending ? t("admin.invoiceDetail.action.saving") : t("admin.invoiceDetail.action.sendCustomer"),
          () => sendMutation.mutate(),
          Send,
          true,
          sendMutation.isPending
        )}
      </div>
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-12">
      <main className="space-y-3.5 lg:col-span-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel
            title={t("admin.quoteInvoice.ui.customer_information_c996cd10")}
            icon={UserRound}
            trailing={invoice.customer_id && <Link href={`/admin/customers/${invoice.customer_id}`} className="rounded border px-2 py-1 text-xs font-semibold transition hover:bg-blue-50" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}>{t("admin.quoteInvoice.ui.view_customer_26fa8d1d")}</Link>}>

            <div className="p-4">
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "#f0f4fa", color: "#4c6688" }}>{String(invoice.customer_name || "C").slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0"><div className="truncate text-[11px] font-bold" style={primary}>{invoice.customer_name || t("admin.invoiceDetail.common.customer")}</div><div className="truncate text-xs" style={muted}>{t("admin.quoteInvoice.ui.invoice_customer_4cd77f44")}</div></div>
              </div>
              <div className="space-y-0.5">
                <LabelValue icon={UserRound} label={t("admin.invoiceDetail.field.name")} value={invoice.customer_name} />
                <LabelValue icon={Phone} label={t("admin.invoiceDetail.field.phone")} value={invoice.customer_phone} />
                <LabelValue icon={Mail} label={t("admin.invoiceDetail.field.email")} value={invoice.customer_email} />
                <LabelValue icon={MapPin} label={t("admin.invoiceDetail.field.address")} value={invoice.customer_address} />
              </div>
            </div>
          </Panel>

          <Panel title={t("admin.quoteInvoice.ui.invoice_details_397a6f30")} icon={FileText}>
            <div className="space-y-1 p-4">
              <LabelValue icon={CalendarDays} label={t("admin.invoiceDetail.field.invoiceDate")} value={date(invoice.invoice_date, locale)} />
              <LabelValue icon={CalendarDays} label={t("admin.invoiceDetail.field.dueDate")} value={date(invoice.due_date, locale)} />
              <LabelValue icon={Receipt} label={t("admin.invoiceDetail.field.paymentTerms")} value={invoice.payment_terms || t("admin.invoiceDetail.common.dueOnReceipt")} />
              <LabelValue icon={CheckCircle2} label={t("admin.invoiceDetail.field.status")} value={displayStatus} />
              <LabelValue icon={Clock3} label={t("admin.invoiceDetail.field.created")} value={date(invoice.created_at || invoice.invoice_date, locale)} />
            </div>
          </Panel>
        </div>

        <Panel
          title={t("admin.quoteInvoice.ui.invoice_items_ec6e78b6")}
          icon={Package}
          trailing={<span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: "#2878f0", background: "#edf5ff" }}>{items.length} {t("admin.quoteInvoice.ui.items_44d25b5d")}</span>}>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead style={{ background: "#f8fbff", color: "#627b9f" }}>
                <tr>
                  {["#", t("admin.invoiceDetail.column.product"), t("admin.invoiceDetail.column.sku"), t("admin.invoiceDetail.column.quantity"), t("admin.invoiceDetail.column.unitPrice"), t("admin.invoiceDetail.column.discountRate"), t("admin.invoiceDetail.column.discount"), t("admin.invoiceDetail.column.taxRate"), t("admin.invoiceDetail.column.tax"), t("admin.invoiceDetail.column.total")].map((heading, index) => <th key={heading} className={`whitespace-nowrap px-2.5 py-2 font-semibold ${index >= 3 ? "text-right" : ""}`}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const nameParts = String(item.name || "").split(" / ");
                  return <tr key={item._id || index} className="border-t transition-colors hover:bg-blue-50/50" style={{ borderColor: "#eaf0f8" }}>
                    <td className="px-2.5 py-2.5" style={muted}>{index + 1}</td>
                    <td className="max-w-[220px] px-2.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {imageUrl(item.image) ?
                        <Image src={imageUrl(item.image)} alt={item.name || t("admin.invoiceDetail.common.product")} width={38} height={38} unoptimized className="h-9 w-9 shrink-0 rounded-md border bg-white object-cover" style={{ borderColor: "#dce8f8" }} /> :
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-white" style={{ borderColor: "#dce8f8", color: "#9bb0cc" }}><Package size={15} /></span>}
                        <span className="min-w-0"><span className="block truncate font-semibold" style={primary}>{nameParts[0] || "-"}</span><span className="mt-0.5 block truncate text-[10px]" style={muted}>{nameParts.slice(1).join(" / ") || t("admin.invoiceDetail.common.product")}</span></span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 font-mono" style={muted}>{item.sku || "-"}</td>
                    <td className="px-2.5 py-2.5 text-right" style={primary}>{item.quantity}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right" style={primary}>{money(item.unit_price, locale)}</td>
                    <td className="px-2.5 py-2.5 text-right" style={muted}>{Number(item.discount_rate || 0).toLocaleString(locale)}%</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right" style={primary}>{money(item.discount, locale)}</td>
                    <td className="px-2.5 py-2.5 text-right" style={muted}>{Number(item.tax_rate || 0).toLocaleString(locale)}%</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right" style={primary}>{money(item.tax, locale)}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold" style={primary}>{money(item.total, locale)}</td>
                  </tr>;
                })}
                {!items.length && <tr><td colSpan={10} className="p-8 text-center text-xs" style={muted}>{t("admin.quoteInvoice.ui.no_invoice_items_7a16164c")}</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title={t("admin.quoteInvoice.ui.additional_information_ecfe29ef")} icon={FileText}>
            <div className="space-y-3 p-4 text-[13px]">
              <div><p className="text-xs font-bold" style={primary}>{t("admin.quoteInvoice.ui.bank_details_7bc4a700")}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5" style={muted}>{invoice.bank_details || t("admin.invoiceDetail.empty.noBank")}</p></div>
              <div className="border-t pt-3" style={{ borderColor: "#e5eef9" }}><p className="text-xs font-bold" style={primary}>{t("admin.quoteInvoice.ui.terms_conditions_d35f2b98")}</p><p className="mt-1 whitespace-pre-wrap rounded-lg p-2 text-xs leading-5" style={{ ...muted, background: "#f8fafc" }}>{invoice.terms || t("admin.invoiceDetail.empty.noTerms")}</p></div>
            </div>
          </Panel>
          <Panel title={t("admin.quoteInvoice.ui.calculation_summary_fdc8fa6c")} icon={Percent}>
            <div className="space-y-2 p-4 text-[13px]">
              <div className="flex justify-between"><span style={muted}>Items subtotal</span><span style={primary}>{money(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span style={muted}>Discount</span><span style={primary}>- {money(invoice.discount)}</span></div>
              <div className="flex justify-between"><span style={muted}>Tax</span><span style={primary}>+ {money(invoice.tax)}</span></div>
              {balanceAdjustments > 0 && <div className="flex justify-between"><span style={muted}>Returned items</span><span style={{ color: "#dc2626" }}>- {money(balanceAdjustments)}</span></div>}
              <div className="mt-2 flex justify-between border-t pt-2.5 text-sm font-bold" style={{ borderColor: "#e5eef9" }}><span style={primary}>Grand Total</span><span style={{ color: "#06a981" }}>{money(invoice.total)}</span></div>
            </div>
          </Panel>
        </div>
      </main>

      <aside className="space-y-3.5 lg:col-span-4">
        <Panel title={t("admin.quoteInvoice.ui.status_payment_cb7d8510")} icon={CheckCircle2}>
          <div className="p-4">
            <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>{t("admin.quoteInvoice.ui.invoice_status_a5a0bffa")}</span><Badge value={displayStatus} status={rawStatus} /></div>
            <div className="relative mt-5 grid grid-cols-3 gap-1">
              <div className="absolute left-[16%] right-[16%] top-[5px] h-px" style={{ background: "#d9e7fa" }} />
              {timeline.map(([label, value, complete], index) => <div key={label} className="relative flex flex-col items-center gap-1.5 text-center">
                <span className="z-[1] flex h-[11px] w-[11px] items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: complete ? "#08b88e" : "#cbdaf0", background: complete ? "#08b88e" : "white" }}>{complete && <Check size={7} color="white" strokeWidth={3} />}</span>
                <span className="text-[11px]" style={{ color: complete ? "#173d78" : "#7188a8", fontWeight: complete ? 700 : 400 }}>{label}</span>
                <span className="text-[10px]" style={muted}>{value}</span>
              </div>)}
            </div>
            <div className="my-3 border-t" style={{ borderColor: "#edf2f9" }} />
            <div className="flex items-center justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.amount_paid_d39013c6")}</span><span className="font-semibold" style={{ color: "#079878" }}>{money(paidAmount, locale)}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#edf3fb" }}><div className="h-full rounded-full" style={{ width: `${paymentProgress}%`, background: "#0bb98f" }} /></div>
            <div className="mt-2 flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.remaining_balance_939fea83")}</span><span className="font-semibold" style={remaining > 0 ? { color: "#b5760a" } : { color: "#079878" }}>{money(remaining, locale)}</span></div>
          </div>
        </Panel>

        <Panel title={t("admin.quoteInvoice.ui.payment_history_cfeba031")} icon={CreditCard} trailing={<span className="text-xs font-semibold" style={accent}>{payments.length} {t("admin.quoteInvoice.ui.payments_44357ae5")}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead style={{ background: "#f8fbff", color: "#627b9f" }}><tr>{["#", t("admin.invoiceDetail.field.dateTime"), t("admin.invoiceDetail.field.amount"), t("admin.invoiceDetail.field.method"), t("admin.invoiceDetail.field.note")].map((heading) => <th key={heading} className="whitespace-nowrap px-2 py-2 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{payments.map((payment, index) => <tr key={payment._id || index} className="border-t transition-colors hover:bg-blue-50/50" style={{ borderColor: "#eaf0f8" }}>
                <td className="px-2 py-2.5" style={muted}>{index + 1}</td>
                <td className="whitespace-nowrap px-2 py-2.5" style={primary}><span className="block">{paymentDateTime(payment).date}</span><span className="mt-0.5 block text-[10px]" style={muted}>{paymentDateTime(payment).time}</span></td>
                <td className="whitespace-nowrap px-2 py-2.5 font-semibold" style={{ color: Number(payment.amount) < 0 ? "#dc2626" : "#0f172a" }}>{money(payment.amount)}</td>
                <td className="px-2 py-2.5" style={muted}>{payment.payment_method || "-"}</td>
                <td className="max-w-24 truncate px-2 py-2.5" style={muted} title={payment.note || "-"}>{payment.note || "-"}</td>
              </tr>)}
                {!payments.length && <tr><td colSpan={5} className="p-4 text-center" style={muted}>{t("admin.quoteInvoice.ui.no_payments_recorded_yet_a556690f")}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t p-3" style={{ borderColor: "#e5eef9" }}>
            <div className="flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.total_paid_3c6c32fd")}</span><span className="font-semibold" style={{ color: "#079878" }}>{money(paidAmount, locale)}</span></div>
            <div className="flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.remaining_balance_939fea83")}</span><span className="font-semibold" style={primary}>{money(remaining, locale)}</span></div>
            {remaining > 0 && <button type="button" onClick={() => setPaymentOpen(true)} className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white transition hover:opacity-90 print:hidden" style={{ background: "#2878f0" }}><CreditCard size={14} />{t("admin.quoteInvoice.ui.add_payment_b5118402")}</button>}
          </div>
        </Panel>

        <Panel title={t("admin.quoteInvoice.ui.return_refund_history_e7a94538")} icon={RotateCcw} trailing={<span className="text-xs font-semibold" style={accent}>{returns.length} {t("admin.quoteInvoice.ui.returns_9582a02f")}</span>}>
          <div className="space-y-2 p-3">
            {returns.length ? [...returns].reverse().map((record) => <article key={record.return_id || record._id} className="rounded-xl border p-3" style={{ borderColor: "#e2eaf5", background: "#fff" }}>
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-medium" style={muted}>Item deduction: <span className="text-xs font-bold" style={primary}>{money(record.refund_amount)}</span></p>{record.refund_method === "Cash Refund" && <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">Cash paid back: {money(record.amount_to_refund ?? record.refund_amount)}</p>}<p className="mt-0.5 text-[10px]" style={muted}>{record.refund_method} · {record.reason}</p></div><span className="rounded-full px-2 py-1 text-[9px] font-bold" style={{ color: record.status === "Completed" ? "#079878" : "#b5760a", background: record.status === "Completed" ? "#e1f8f0" : "#fff5df" }}>{record.status}</span></div>
              <p className="mt-2 text-[10px]" style={muted}>{new Date(record.date).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "#edf2f9" }}>{(record.items_returned || []).map((item, index) => <div key={`${item.item_id || index}`} className="flex justify-between gap-3 text-[10px]"><span className="truncate" style={muted}>{item.name || invoice.items?.find((invoiceItem) => String(invoiceItem._id) === String(item.item_id))?.name || "Invoice item"}</span><span className="shrink-0 font-semibold" style={primary}>× {item.qty}</span></div>)}</div>
              {record.notes && <p className="mt-2 whitespace-pre-wrap text-[10px]" style={muted}>{record.notes}</p>}
            </article>) : <p className="py-6 text-center text-xs" style={muted}>{t("admin.quoteInvoice.ui.no_returns_or_refunds_recorded_yet_18614002")}</p>}
          </div>
        </Panel>
      </aside>
    </div>

    {paymentOpen && <InvoicePaymentModal invoice={invoice} form={paymentForm} setForm={setPaymentForm} isPending={paymentMutation.isPending} onClose={() => setPaymentOpen(false)} onSubmit={() => paymentMutation.mutate(paymentForm)} />}
    {returnOpen && canReturn && <InvoiceReturnModal invoice={invoice} isPending={returnMutation.isPending} onClose={() => setReturnOpen(false)} onSubmit={(payload) => returnMutation.mutate(payload)} />}
  </div>;
}
