"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronRight,
  CreditCard, FileText, Printer, RotateCcw, Send } from
"lucide-react";
import { toast } from "sonner";
import { invoiceApi } from "@/apis/admin/invoiceApi";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import InvoicePaymentModal from "@/components/admin/InvoicePaymentModal";
import InvoiceReturnModal from "@/components/admin/InvoiceReturnModal";
import QuoteTemplateDesigner, { INVOICE_TEMPLATE_STORAGE_KEY } from "@/components/admin/QuoteTemplateDesigner";

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
  const returns = invoice.returns || [];
  const returnedQuantityByItem = new Map();
  returns.forEach((record) => {
    (record.items_returned || []).forEach((returnedItem) => {
      const itemId = String(returnedItem.item_id?._id || returnedItem.item_id || "");
      if (itemId) returnedQuantityByItem.set(itemId, (returnedQuantityByItem.get(itemId) || 0) + Number(returnedItem.qty || 0));
    });
  });
  const previewItems = items.map((item, index) => {
    const [productName, ...variantParts] = String(item.name || "").split(" / ");
    return {
      ...item,
      row_id: item._id || `invoice-item-${index}`,
      name: productName || item.name || "",
      variant_name: item.variant_name || variantParts.join(" / "),
      returned_quantity: returnedQuantityByItem.get(String(item._id || "")) || 0,
    };
  });
  const payments = invoice.payments || [];
  const paidAmount = Number(invoice.amount_paid || 0);
  const total = Number(invoice.total || 0);
  const paymentProgress = total > 0 ? Math.min(100, Math.max(0, (paidAmount / total) * 100)) : 0;
  const lastPayment = payments[payments.length - 1];
  const returnedItemCount = returns.reduce((count, record) => count + (record.items_returned || []).reduce((itemCount, item) => itemCount + Number(item.qty || 0), 0), 0);
  const latestReturnDate = returns.reduce((latest, record) => {
    const returnDate = new Date(record.date);
    return !Number.isNaN(returnDate.getTime()) && (!latest || returnDate > latest) ? returnDate : latest;
  }, null);
  const returnedTimelineStep = returnedItemCount > 0
    ? [
      t(returnedItemCount === 1 ? "admin.invoiceDetail.timeline.returnedOne" : "admin.invoiceDetail.timeline.returnedMany", { count: returnedItemCount }),
      date(latestReturnDate, locale),
      true,
    ]
    : null;
  const paymentTimelineStep = [
    t("admin.invoiceDetail.timeline.paymentReceived"),
    lastPayment ? date(lastPayment.payment_date, locale) : t("admin.invoiceDetail.timeline.awaitingPayment"),
    Boolean(lastPayment),
  ];
  const timeline = [
  [t("admin.invoiceDetail.timeline.invoiceCreated"), date(invoice.created_at || invoice.invoice_date, locale), true],
  [t("admin.invoiceDetail.timeline.sent"), date(invoice.sent_at, locale), Boolean(invoice.sent_at)],
  ...(returnedTimelineStep && paidAmount === 0 ? [returnedTimelineStep] : []),
  paymentTimelineStep,
  ...(returnedTimelineStep && paidAmount > 0 ? [returnedTimelineStep] : [])];

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
      <main className="min-w-0 lg:col-span-8">
        <QuoteTemplateDesigner
          previewOnly
          documentType="invoice"
          storageKey={INVOICE_TEMPLATE_STORAGE_KEY}
          form={{
            customer_name: invoice.customer_name || "",
            customer_email: invoice.customer_email || "",
            customer_phone: invoice.customer_phone || "",
            customer_address: invoice.customer_address || "",
            invoice_date: invoice.invoice_date || "",
            due_date: invoice.due_date || "",
            terms: invoice.terms || "",
            notes: "",
            items: previewItems,
          }}
          totals={{ subtotal: invoice.subtotal, discount: invoice.discount, tax: invoice.tax, total: invoice.total }}
          quoteNumber={invoice.invoice_number}
          quoteStatus={displayStatus}
          savedDesign={invoice.pdf_design || {}}
          money={(value) => money(value, locale)}
        />
      </main>

      <aside className="space-y-3.5 lg:col-span-4">
        <Panel title={t("admin.quoteInvoice.ui.status_payment_cb7d8510")} icon={CheckCircle2}>
          <div className="p-4">
            <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>{t("admin.quoteInvoice.ui.invoice_status_a5a0bffa")}</span><Badge value={displayStatus} status={rawStatus} /></div>
            <div className="relative mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}>
              <div className="absolute top-[5px] h-px" style={{ left: `${50 / timeline.length}%`, right: `${50 / timeline.length}%`, background: "#d9e7fa" }} />
              {timeline.map(([label, value, complete]) => <div key={label} className="relative flex flex-col items-center gap-1.5 text-center">
                <span className="z-[1] flex h-[11px] w-[11px] items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: complete ? "#08b88e" : "#cbdaf0", background: complete ? "#08b88e" : "white" }}>{complete && <Check size={7} color="white" strokeWidth={3} />}</span>
                <span className="text-[11px]" style={{ color: complete ? "#173d78" : "#7188a8", fontWeight: complete ? 700 : 400 }}>{label}</span>
                <span className="text-[10px]" style={muted}>{value}</span>
              </div>)}
            </div>
            <div className="my-3 border-t" style={{ borderColor: "#edf2f9" }} />
            <div className="flex items-center justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.amount_paid_d39013c6")}</span><span className="font-semibold" style={{ color: "#079878" }}>{money(paidAmount, locale)}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#edf3fb" }}><div className="h-full rounded-full" style={{ width: `${paymentProgress}%`, background: "#0bb98f" }} /></div>
            <div className="mt-2 flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.remaining_balance_939fea83")}</span><span className="font-semibold" style={remaining > 0 ? { color: "#b5760a" } : { color: "#079878" }}>{money(remaining, locale)}</span></div>
            {canReturn && <button type="button" onClick={() => setReturnOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-left transition hover:border-rose-300 hover:bg-rose-100/80 print:hidden">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 shadow-sm"><RotateCcw size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-rose-800">Return &amp; Refund</span><span className="mt-0.5 block text-[10px] text-rose-700/80">Process returned items and adjust the bill</span></span>
              <ChevronRight size={15} className="shrink-0 text-rose-500" />
            </button>}
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
