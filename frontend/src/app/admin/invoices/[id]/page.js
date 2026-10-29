"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3,
  CreditCard, FileText, Printer, RotateCcw, Send, Pencil, ShoppingBag, Eye, X,
  UserRound, PackageCheck } from
"lucide-react";
import { toast } from "sonner";
import { invoiceApi } from "@/apis/admin/invoiceApi";
import { downloadInvoicePdf, printInvoicePdf } from "@/lib/invoicePdf";
import { storeApi } from "@/apis/admin/storeApi";
import InvoicePaymentModal from "@/components/admin/InvoicePaymentModal";
import InvoiceReturnModal from "@/components/admin/InvoiceReturnModal";
import QuoteTemplateDesigner, { INVOICE_TEMPLATE_STORAGE_KEY } from "@/components/admin/QuoteTemplateDesigner";
import { renderRichHtml } from "@/lib/termsContent";

const edge = { border: "1px solid var(--border-color)" };
const card = {
  ...edge,
  background: "var(--bg-card)",
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)"
};
const muted = { color: "var(--text-muted)" };
const primary = { color: "var(--text-primary)" };
const accent = { color: "#2563eb" };
const money = (value, locale) => new Intl.NumberFormat(locale || "en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value) || 0);
const bidiIsolate = (value) => `\u2068${String(value ?? "")}\u2069`;
const date = (value, locale) => value && !Number.isNaN(new Date(value).getTime()) ?
new Date(value).toLocaleDateString(locale || [], { year: "numeric", month: "2-digit", day: "2-digit" }) :
"-";
const paymentDateTime = (payment, locale) => {
  const value = payment?.payment_date;
  if (!value || Number.isNaN(new Date(value).getTime())) return { date: "-", time: "-" };
  return { date: date(value, locale), time: payment.payment_time || new Date(value).toLocaleTimeString(locale || [], { hour: "2-digit", minute: "2-digit" }) };
};
const statusStyles = {
  Unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  "Partially Paid": "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  Overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
};

function Badge({ value, status = value }) {
  const style = statusStyles[status] || statusStyles.Unpaid;
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold shadow-sm ${style}`}>{value}</span>;
}

function Panel({ title, icon: Icon, trailing, className = "", children }) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl shadow-lg transition hover:shadow-xl ${className}`} style={card}>
    <div className="flex min-h-10 items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card-alt)" }}>
      {Icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><Icon size={15} strokeWidth={2.5} style={{ color: "#fff" }} /></div>}
      <h2 className="text-sm font-extrabold tracking-tight" style={primary}>{title}</h2>
      <div className="ml-auto">{trailing}</div>
    </div>
    {children}
  </section>;
}

function PreviewModal({ onClose, children }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Invoice preview" className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Eye size={17} /></span><div><h2 className="text-sm font-extrabold text-[var(--text-primary)]">Invoice preview</h2><p className="text-[10px] text-[var(--text-muted)]">Review the customer-facing invoice</p></div></div><button type="button" onClick={onClose} aria-label="Close preview" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"><X size={17} /></button></header>
      <div className="min-h-0 overflow-auto bg-[var(--bg-secondary)] p-3 sm:p-5">{children}</div>
    </section>
  </div>;
}

export default function InvoiceDetailsPage({ params }) {const { t, locale } = useTranslation();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const printHandled = useRef(false);
  const invoicePreviewRef = useRef(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), payment_time: new Date().toTimeString().slice(0, 5), payment_method: "Cash", note: "" });
  const { data: invoice, isLoading, isError, refetch } = useQuery({
    queryKey: ["invoice-admin", id],
    queryFn: () => invoiceApi.getById(id)
  });
  const { data: store = null, isLoading: isStoreLoading } = useQuery({
    queryKey: ["store-public"],
    queryFn: () => storeApi.getPublic(),
    staleTime: 5 * 60 * 1000
  });
  const remaining = Math.max(0, Number(invoice?.remaining_balance ?? invoice?.total ?? 0));

  useEffect(() => {
    if (!invoice?.sent_at || searchParams.get("returnRefund") !== "1") return;
    setReturnOpen(true);
    router.replace(`/admin/invoices/${id}`, { scroll: false });
  }, [invoice, id, router, searchParams, t]);

  useEffect(() => {
    if (searchParams.get("print") !== "1" || !invoice || isLoading || isStoreLoading || printHandled.current) return undefined;
    const timer = window.setTimeout(() => {
      if (printHandled.current) return;
      printHandled.current = true;
      printInvoicePdf(invoice, store, invoicePreviewRef.current)
        .catch((printError) => { console.error("Could not print invoice PDF:", printError); toast.error("Could not print invoice"); })
        .finally(() => {
          printHandled.current = false;
          setIsGeneratingPdf(false);
          router.replace(`/admin/invoices/${id}`, { scroll: false });
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [id, invoice, isLoading, isStoreLoading, router, searchParams, store]);

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

  const downloadPdf = async () => {
    if (isGeneratingPdf || isStoreLoading) return;
    setIsGeneratingPdf(true);
    try {
      await downloadInvoicePdf(invoice, store, invoicePreviewRef.current);
      toast.success("Invoice PDF downloaded");
    } catch (downloadError) {
      console.error("Could not generate invoice PDF:", downloadError);
      toast.error("Could not generate invoice PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const printInvoice = async () => {
    if (isGeneratingPdf || isStoreLoading) return;
    setIsGeneratingPdf(true);
    try {
      await printInvoicePdf(invoice, store, invoicePreviewRef.current);
    } catch (printError) {
      console.error("Could not print invoice PDF:", printError);
      toast.error("Could not print invoice");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) return <div className="space-y-3"><div className="skeleton h-8 w-1/3" /><div className="skeleton h-28 w-full" /><div className="skeleton h-52 w-full" /></div>;
  if (isError || !invoice) return <div className="rounded-xl border bg-[var(--bg-card)] p-8 text-center" style={edge}>
    <p className="text-sm" style={primary}>{t("admin.quoteInvoice.ui.could_not_load_this_invoice_b761111d")}</p>
    <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-semibold" style={accent}>{t("admin.quoteInvoice.ui.try_again_042c862e")}</button>
    <div><Link href="/admin/invoices" className="mt-3 inline-block text-sm underline" style={muted}>{t("admin.quoteInvoice.ui.back_to_invoices_8371e902")}</Link></div>
  </div>;

  const rawStatus = invoice.status || "Unpaid";
  const displayStatus = rawStatus === "Draft" ? "Unpaid" : rawStatus;
  const normalizedStatus = displayStatus.toLowerCase();
  const displayStatusLabel = t(`admin.invoiceDetail.status.${normalizedStatus === "partially paid" ? "partiallyPaid" : normalizedStatus}`);
  const paymentTermsText = String(invoice.payment_terms || "").trim();
  const paymentTermsLabel = /^due on receipt$/i.test(paymentTermsText)
    ? t("admin.invoiceDetail.common.dueOnReceipt")
    : paymentTermsText || t("admin.invoiceDetail.common.dueOnReceipt");
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
  const subtotal = Number(invoice.subtotal || 0);
  const discountTotal = Number(invoice.discount || 0);
  const taxTotal = Number(invoice.tax || 0);
  const originalTotal = Number(invoice.original_total ?? (subtotal - discountTotal + taxTotal));
  const returnAdjustment = Math.max(0, originalTotal - total);
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
  const storedActivity = Array.isArray(invoice.activity) ? invoice.activity : [];
  const invoiceActivity = storedActivity.length ? storedActivity : [
    { _id: "legacy-created", type: "created", at: invoice.created_at || invoice.invoice_date, actor_name: invoice.createdby?.name || invoice.updatedby?.name || "", changes: items.map((item) => ({ action: "added", field: "item", product_name: item.name, sku: item.sku, from_quantity: 0, to_quantity: item.quantity })) },
    ...(invoice.sent_at ? [{ _id: "legacy-sent", type: "sent", at: invoice.sent_at, actor_name: invoice.updatedby?.name || "" }] : []),
    ...payments.map((payment, index) => ({ _id: `legacy-payment-${index}`, type: "payment", at: payment.payment_date, actor_name: "", changes: [{ action: "payment_recorded", field: "Payment", before: "—", after: `${payment.payment_method} · ${money(payment.amount, locale)}${payment.note ? ` · ${payment.note}` : ""}` }] })),
    ...returns.map((record, index) => ({ _id: `legacy-return-${index}`, type: "return", at: record.date, actor_name: "", changes: (record.items_returned || []).map((item) => ({ action: "returned", field: "item", product_name: item.name, from_quantity: 0, to_quantity: item.qty, before: "—", after: `${item.qty} returned · ${money(item.return_value, locale)}` })) })),
  ].sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime());
  const invoiceActivityLabel = (change) => {
    const product = [change.product_name, change.variant_title || change.sku].filter(Boolean).join(" · ") || t("admin.pos.ui.product");
    if (change.action === "added") return t("admin.invoiceDetail.activity.productAdded", { product: bidiIsolate(product), quantity: bidiIsolate(change.to_quantity || 0) });
    if (change.action === "removed") return t("admin.invoiceDetail.activity.productRemoved", { product: bidiIsolate(product), quantity: bidiIsolate(change.from_quantity || 0) });
    if (change.action === "quantity") return t("admin.invoiceDetail.activity.quantityChanged", { product: bidiIsolate(product), from: bidiIsolate(change.from_quantity || 0), to: bidiIsolate(change.to_quantity || 0) });
    if (change.action === "returned") return t("admin.invoiceDetail.activity.productReturned", { product: bidiIsolate(product), quantity: bidiIsolate(change.to_quantity || 0) });
    if (change.action === "item_field") {
      const formatValue = (value) => {
        if (value === "—") return value;
        if (change.field === "Unit price") return money(value, locale);
        if (["Discount", "Tax"].includes(change.field)) {
          const match = String(value).match(/^([\d.]+)%\s*·\s*([\d.]+)$/);
          if (match) return `${match[1]}% · ${money(match[2], locale)}`;
        }
        return value;
      };
      const before = formatValue(change.before);
      const after = formatValue(change.after);
      const fieldLabels = { "Unit price": t("admin.documentDetail.field.unitPrice"), Discount: t("admin.documentDetail.field.discount"), Tax: t("admin.documentDetail.field.tax"), Quantity: t("admin.documentDetail.field.quantity") };
      return t("admin.invoiceDetail.activity.itemFieldChanged", { field: bidiIsolate(fieldLabels[change.field] || change.field), product: bidiIsolate(product), before: bidiIsolate(before), after: bidiIsolate(after) });
    }
    if (change.action === "field") {
      const moneyFields = ["Subtotal", "Total discount", "Total tax", "Invoice total"];
      const before = moneyFields.includes(change.field) && change.before !== "—" ? money(change.before, locale) : change.before;
      const after = moneyFields.includes(change.field) && change.after !== "—" ? money(change.after, locale) : change.after;
      const fieldLabels = { Subtotal: t("admin.documentDetail.field.subtotal"), "Total discount": t("admin.documentDetail.field.totalDiscount"), "Total tax": t("admin.documentDetail.field.tax"), "Invoice total": t("admin.documentDetail.field.invoiceTotal"), Status: t("admin.documentDetail.field.currentStatus") };
      const localizeStatus = (value) => {
        const normalized = String(value ?? "").trim().toLowerCase();
        const statusKey = normalized === "partially paid" ? "partiallyPaid" : normalized;
        if (["pending", "draft", "sent", "accepted", "rejected"].includes(statusKey)) return t(`admin.quoteInvoice.status.${statusKey}`);
        if (["unpaid", "partiallyPaid", "paid", "overdue"].includes(statusKey)) return t(`admin.invoiceDetail.status.${statusKey}`);
        return value;
      };
      return t("admin.invoiceDetail.activity.fieldChanged", { field: bidiIsolate(fieldLabels[change.field] || change.field), before: bidiIsolate(change.field === "Status" ? localizeStatus(before) : before), after: bidiIsolate(change.field === "Status" ? localizeStatus(after) : after) });
    }
    if (change.action === "payment_recorded") return t("admin.invoiceDetail.activity.paymentRecorded", { detail: bidiIsolate(change.after) });
    if (change.action === "balance") return t("admin.invoiceDetail.activity.balanceChanged", { before: bidiIsolate(money(change.before, locale)), after: bidiIsolate(money(change.after, locale)) });
    if (change.action === "refund") return t("admin.invoiceDetail.activity.refundProcessed", { detail: bidiIsolate(change.after) });
    if (change.action === "sent") return t("admin.invoiceDetail.activity.sentToCustomer");
    return change.after ? `${change.field}: ${change.after}` : change.field;
  };

  const smallAction = (label, onClick, Icon, primaryAction = false, disabled = false, title) => {
    const button = <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-45"
      style={{ borderColor: primaryAction ? "color-mix(in srgb, var(--accent) 30%, var(--border-color))" : "var(--border-color)", color: primaryAction ? "var(--accent)" : "var(--text-secondary)", background: primaryAction ? "var(--accent-soft)" : "var(--bg-card)" }}>
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--border-color)", color: "#2878f0" }}><FileText size={18} /></div>
          <h1 className="font-mono text-xl font-bold" style={primary}>{t("admin.quoteInvoice.ui.invoice_51d86044")}{invoice.invoice_number}</h1>
          <Badge value={displayStatusLabel} status={rawStatus} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs" style={muted}>
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{t("admin.invoiceDetail.field.created")} {date(invoice.created_at || invoice.invoice_date, locale)}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{t("admin.invoiceDetail.field.dueDate")} {date(invoice.due_date, locale)}</span>
          {invoice.sent_at && <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} />{t("admin.invoiceDetail.timeline.sent")} {date(invoice.sent_at, locale)}</span>}
          {invoice.paid_at && <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} />{t("admin.invoiceDetail.status.paid")} {date(invoice.paid_at, locale)}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"><Eye size={15} />{t("admin.invoiceDetail.action.preview")}</button>
        {!invoice.sent_at && smallAction(t("common.edit"), () => router.push(`/admin/invoices/new?invoice=${encodeURIComponent(id)}`), Pencil)}
        <button type="button" disabled={isGeneratingPdf || isStoreLoading} onClick={() => { void printInvoice(); }} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-45" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)", background: "var(--bg-card)" }}><Printer size={16} />{isGeneratingPdf ? t("admin.invoiceDetail.action.preparing") : t("admin.pos.ui.print")}</button>
        <button type="button" disabled={isGeneratingPdf || isStoreLoading} onClick={() => { void downloadPdf(); }} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-45" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)", background: "var(--bg-card)" }}><FileText size={16} />{t("admin.invoiceDetail.action.downloadPdf")}</button>
        {canReturn && smallAction(t("admin.invoiceDetail.action.returnRefund"), () => setReturnOpen(true), RotateCcw, true)}
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
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t("admin.quoteInvoice.ui.customer_information_c996cd10")} icon={UserRound}>
            <div className="space-y-4 px-5 py-4 text-[13px]">
              <div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base font-bold text-blue-600">{String(invoice.customer_name || "C").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><div className="truncate text-base font-semibold text-[var(--text-primary)]">{invoice.customer_name || "—"}</div><div className="mt-0.5 text-xs text-[var(--text-muted)]">{t("admin.documentDetail.field.customer")}</div></div></div>
              <div className="grid gap-x-5 gap-y-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: "var(--border-color)" }}>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide" style={muted}>{t("admin.invoiceDetail.field.email")}</p><p className="mt-1 break-words text-[13px] leading-5" style={primary}>{invoice.customer_email || invoice.customer_id?.email || t("admin.documentDetail.field.notProvided")}</p></div>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide" style={muted}>{t("admin.invoiceDetail.field.phone")}</p><p className="mt-1 break-words text-[13px] leading-5" style={primary}>{invoice.customer_phone || invoice.customer_id?.phone || t("admin.documentDetail.field.notProvided")}</p></div>
                <div className="min-w-0 sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide" style={muted}>{t("admin.invoiceDetail.field.address")}</p><p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5" style={primary}>{invoice.customer_address || invoice.customer_id?.address || t("admin.documentDetail.field.notProvided")}</p></div>
                {invoice.customer_id?.notes && <div className="min-w-0 border-t pt-3 sm:col-span-2" style={{ borderColor: "var(--border-color)" }}><p className="text-[10px] font-semibold uppercase tracking-wide" style={muted}>{t("admin.documentDetail.field.customerNotes")}</p><p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5" style={primary}>{invoice.customer_id.notes}</p></div>}
              </div>
            </div>
          </Panel>
          <Panel title={t("admin.documentDetail.panel.invoiceSummary")} icon={FileText}>
            <div className="space-y-2.5 p-4 text-[12px]">
              <div className="flex justify-between gap-3"><span style={muted}>{t("admin.invoiceDetail.field.invoiceDate")}</span><span className="text-right" style={primary}>{date(invoice.invoice_date, locale)}</span></div>
              <div className="flex justify-between gap-3"><span style={muted}>{t("admin.invoiceDetail.field.dueDate")}</span><span className="text-right" style={primary}>{date(invoice.due_date, locale)}</span></div>
              <div className="flex justify-between gap-3"><span style={muted}>{t("admin.invoiceDetail.field.paymentTerms")}</span><span className="max-w-[60%] text-right" style={primary}>{paymentTermsLabel}</span></div>
              <div className="flex justify-between gap-3"><span style={muted}>{t("admin.documentDetail.field.items")}</span><span style={primary}>{items.length}</span></div>
              <div className="space-y-2 border-t pt-2.5" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex justify-between gap-3"><span style={muted}>{t("admin.documentDetail.field.subtotal")}</span><span style={primary}>{money(subtotal, locale)}</span></div>
                <div className="flex justify-between gap-3"><span style={muted}>{t("admin.documentDetail.field.totalDiscount")}</span><span className="font-medium text-rose-600">− {money(discountTotal, locale)}</span></div>
                <div className="flex justify-between gap-3"><span style={muted}>{t("admin.documentDetail.field.tax")}</span><span style={primary}>{money(taxTotal, locale)}</span></div>
                {returnAdjustment > 0 ? <>
                  <div className="flex justify-between gap-3 border-t pt-2 text-[12px] font-bold" style={{ borderColor: "var(--border-color)" }}><span style={primary}>{t("admin.documentDetail.field.originalTotal")}</span><span style={{ color: "#079878" }}>{money(originalTotal, locale)}</span></div>
                  <div className="flex justify-between gap-3"><span style={muted}>{t("admin.documentDetail.field.returnAdjustment")}</span><span className="font-medium text-rose-600">− {money(returnAdjustment, locale)}</span></div>
                  <div className="flex justify-between gap-3 text-sm font-bold"><span style={primary}>{t("admin.documentDetail.field.adjustedTotal")}</span><span style={{ color: "#079878" }}>{money(total, locale)}</span></div>
                </> : <div className="flex justify-between gap-3 border-t pt-2 text-sm font-bold" style={{ borderColor: "var(--border-color)" }}><span style={primary}>{t("admin.documentDetail.field.invoiceTotal")}</span><span style={{ color: "#079878" }}>{money(total, locale)}</span></div>}
              </div>
              {invoice.bank_details && <div className="border-t pt-2.5" style={{ borderColor: "var(--border-color)" }}><p className="text-[10px] font-semibold uppercase tracking-wide" style={muted}>{t("admin.documentDetail.field.paymentInstructions")}</p><p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-4" style={primary}>{invoice.bank_details}</p></div>}
            </div>
          </Panel>
        </div>
        <div className="mt-4">
          <Panel title={t("admin.documentDetail.panel.productsItems")} icon={PackageCheck} trailing={<span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{items.length} {t("admin.documentDetail.field.items")}</span>}>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-start text-xs"><thead style={{ background: "var(--bg-card-alt)", color: "var(--text-secondary)" }}><tr>{["#", t("admin.invoiceDetail.column.product"), t("admin.invoiceDetail.column.sku"), t("admin.documentDetail.field.quantity"), t("admin.documentDetail.field.unitPrice"), t("admin.documentDetail.field.discount"), t("admin.documentDetail.field.tax"), t("admin.documentDetail.field.total")].map((heading) => <th key={heading} dir="auto" className="whitespace-nowrap px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead><tbody>{previewItems.map((item, index) => <tr key={item._id || index} className="border-t" style={{ borderColor: "var(--border-color)" }}><td className="px-3 py-3" style={muted}><bdi dir="ltr">{index + 1}</bdi></td><td className="max-w-[200px] px-3 py-3"><bdi dir="auto" className="block truncate font-semibold" style={primary}>{item.name || "—"}</bdi><bdi dir="auto" className="block truncate text-[10px]" style={muted}>{item.variant_name || ""}</bdi></td><td className="whitespace-nowrap px-3 py-3 font-mono" style={muted}><bdi dir="ltr">{item.sku || "—"}</bdi></td><td className="px-3 py-3"><bdi dir="ltr">{item.quantity ?? item.qty ?? 0}</bdi></td><td className="whitespace-nowrap px-3 py-3"><bdi dir="ltr">{money(item.unit_price, locale)}</bdi></td><td className="whitespace-nowrap px-3 py-3"><bdi dir="ltr" className="block">{money(item.discount, locale)}</bdi>{Number(item.discount_rate) > 0 && <span className="mt-0.5 block text-[10px]" style={muted}><bdi dir="ltr">{Number(item.discount_rate)}%</bdi> {t("admin.documentDetail.field.discountRate")}</span>}</td><td className="whitespace-nowrap px-3 py-3"><bdi dir="ltr" className="block">{money(item.tax, locale)}</bdi>{Number(item.tax_rate) > 0 && <span className="mt-0.5 block text-[10px]" style={muted}><bdi dir="ltr">{Number(item.tax_rate)}%</bdi> {t("admin.documentDetail.field.taxRate")}</span>}</td><td className="whitespace-nowrap px-3 py-3 font-semibold"><bdi dir="ltr">{money(item.total ?? item.line_total, locale)}</bdi></td></tr>)}{!previewItems.length && <tr><td colSpan={8} className="p-8 text-center text-sm" style={muted}>{t("admin.documentDetail.empty.noInvoiceItems")}</td></tr>}</tbody></table></div>
          </Panel>
        </div>
        {invoice.terms && <div className="mt-4"><Panel title={t("admin.documentDetail.panel.termsConditions")} icon={FileText}><div className="p-4 text-xs leading-5" style={muted}>{/<[a-z][\s\S]*>/i.test(invoice.terms) ? <div className="invoice-rich-terms break-words [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_li]:my-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_a]:text-blue-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: renderRichHtml(invoice.terms) }} /> : <p className="whitespace-pre-wrap">{invoice.terms}</p>}</div></Panel></div>}
      </main>

      <aside className="space-y-3.5 lg:col-span-4">
        <Panel title={t("admin.quoteInvoice.ui.status_payment_cb7d8510")} icon={CheckCircle2}>
          <div className="p-4">
            <div className="flex items-center gap-2"><span className="text-sm font-semibold" style={primary}>{t("admin.quoteInvoice.ui.invoice_status_a5a0bffa")}</span><Badge value={displayStatusLabel} status={rawStatus} /></div>
            <div className="relative mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}>
              <div className="absolute top-[5px] h-px" style={{ left: `${50 / timeline.length}%`, right: `${50 / timeline.length}%`, background: "var(--border-color)" }} />
              {timeline.map(([label, value, complete]) => <div key={label} className="relative flex flex-col items-center gap-1.5 text-center">
                <span className="z-[1] flex h-[11px] w-[11px] items-center justify-center rounded-full border-2" style={{ borderColor: complete ? "#08b88e" : "var(--border-color)", background: complete ? "#08b88e" : "var(--bg-card)" }}>{complete && <Check size={7} color="white" strokeWidth={3} />}</span>
                <span className="text-[11px]" style={{ color: complete ? "var(--accent)" : "var(--text-muted)", fontWeight: complete ? 700 : 400 }}>{label}</span>
                <span className="text-[10px]" style={muted}>{value}</span>
              </div>)}
            </div>
            <div className="my-3 border-t" style={{ borderColor: "var(--border-color)" }} />
            <div className="flex items-center justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.amount_paid_d39013c6")}</span><span className="font-semibold" style={{ color: "#079878" }}>{money(paidAmount, locale)}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-tertiary)" }}><div className="h-full rounded-full" style={{ width: `${paymentProgress}%`, background: "#0bb98f" }} /></div>
            <div className="mt-2 flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.remaining_balance_939fea83")}</span><span className="font-semibold" style={remaining > 0 ? { color: "#b5760a" } : { color: "#079878" }}>{money(remaining, locale)}</span></div>
            {canReturn && <button type="button" onClick={() => setReturnOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-left text-rose-800 transition hover:border-rose-300 hover:bg-rose-100/80 print:hidden dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-card)] text-rose-600 shadow-sm"><RotateCcw size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-rose-800">Return &amp; Refund</span><span className="mt-0.5 block text-[10px] text-rose-700/80">Process returned items and adjust the bill</span></span>
              <ChevronRight size={15} className="shrink-0 text-rose-500" />
            </button>}
          </div>
        </Panel>

          <Panel title={t("admin.invoiceDetail.activity.title")} icon={Clock3} trailing={<span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{invoiceActivity.length}</span>} className="print:hidden">
          <div className="max-h-[480px] overflow-y-auto px-4 py-4">
            <ol className="space-y-1">
              {[...invoiceActivity].reverse().map((event, index, events) => {
                const visibleChanges = (event.changes || []).filter((change) => {
                  if (event.type === "created") return change.action === "added";
                  if (!["Discount", "Tax", "Total discount", "Total tax"].includes(change.field)) return true;
                  const isEmptyOrZero = (value) => {
                    const text = String(value ?? "").trim();
                    if (!text || text === "—") return true;
                    const numeric = text.replace(/[^\d.-]/g, "");
                    return numeric !== "" && Number(numeric) === 0;
                  };
                  return !(isEmptyOrZero(change.before) && isEmptyOrZero(change.after));
                });
                const created = event.type === "created";
                const sent = event.type === "sent";
                const payment = event.type === "payment";
                const returned = event.type === "return";
                const Icon = created ? ShoppingBag : sent ? Send : payment ? CreditCard : returned ? RotateCcw : Pencil;
                const title = t(`admin.invoiceDetail.activity.type.${event.type}`);
                const eventDate = event.at && !Number.isNaN(new Date(event.at).getTime())
                  ? new Date(event.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
                  : t("common.notProvided");
                return <li key={event._id || `${event.type}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
                  {index < events.length - 1 && <span aria-hidden="true" className="absolute start-[11px] top-6 h-[calc(100%-16px)] w-px bg-slate-200 dark:bg-slate-700" />}
                  <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-[var(--bg-card)] ${created ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : returned ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"}`}><Icon size={13} /></span>
                  <div className="min-w-0 flex-1 border-b border-[var(--border-color)] pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"><p dir="auto" className="min-w-0 text-[13px] font-semibold leading-5 text-[var(--text-primary)]">{title}</p><time dir="auto" className="text-[11px] leading-4 text-[var(--text-muted)]"><bdi>{eventDate}</bdi></time></div>
                    <p dir="auto" className="mt-0.5 text-[12px] text-[var(--text-muted)]">{t("admin.invoiceDetail.activity.by", { name: bidiIsolate(event.actor_name || t("admin.pos.ui.unknownStaff")) })}</p>
                    {visibleChanges.length > 0 && <ul className="mt-2 space-y-1.5">{visibleChanges.map((change, changeIndex) => <li key={`${event._id || index}-${changeIndex}`} className="flex items-start gap-2 text-[12px] leading-5 text-[var(--text-secondary)]"><span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${change.action === "removed" ? "bg-rose-400" : change.action === "added" || change.action === "returned" ? "bg-emerald-500" : "bg-blue-400"}`} /><span dir="auto" className="min-w-0 break-words">{invoiceActivityLabel(change)}</span></li>)}</ul>}
                  </div>
                </li>;
              })}
            </ol>
          </div>
        </Panel>

        <Panel title={t("admin.quoteInvoice.ui.payment_history_cfeba031")} icon={CreditCard} trailing={<span className="text-xs font-semibold" style={accent}>{payments.length} {t("admin.quoteInvoice.ui.payments_44357ae5")}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
            <thead style={{ background: "var(--bg-card-alt)", color: "var(--text-secondary)" }}><tr>{["#", t("admin.invoiceDetail.field.dateTime"), t("admin.invoiceDetail.field.amount"), t("admin.invoiceDetail.field.method"), t("admin.invoiceDetail.field.note")].map((heading) => <th key={heading} className="whitespace-nowrap px-2 py-2 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{payments.map((payment, index) => <tr key={payment._id || index} className="border-t transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/30" style={{ borderColor: "var(--border-color)" }}>
                <td className="px-2 py-2.5" style={muted}>{index + 1}</td>
                <td className="whitespace-nowrap px-2 py-2.5" style={primary}><span className="block">{paymentDateTime(payment).date}</span><span className="mt-0.5 block text-[10px]" style={muted}>{paymentDateTime(payment).time}</span></td>
                <td className="whitespace-nowrap px-2 py-2.5 font-semibold" style={{ color: Number(payment.amount) < 0 ? "#dc2626" : "var(--text-primary)" }}>{money(payment.amount)}</td>
                <td className="px-2 py-2.5" style={muted}>{payment.payment_method || "-"}</td>
                <td className="max-w-24 truncate px-2 py-2.5" style={muted} title={payment.note || "-"}>{payment.note || "-"}</td>
              </tr>)}
                {!payments.length && <tr><td colSpan={5} className="p-4 text-center" style={muted}>{t("admin.quoteInvoice.ui.no_payments_recorded_yet_a556690f")}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t p-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.total_paid_3c6c32fd")}</span><span className="font-semibold" style={{ color: "#079878" }}>{money(paidAmount, locale)}</span></div>
            <div className="flex justify-between text-xs"><span style={muted}>{t("admin.quoteInvoice.ui.remaining_balance_939fea83")}</span><span className="font-semibold" style={primary}>{money(remaining, locale)}</span></div>
            {remaining > 0 && <button type="button" onClick={() => setPaymentOpen(true)} className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white transition hover:opacity-90 print:hidden" style={{ background: "#2878f0" }}><CreditCard size={14} />{t("admin.quoteInvoice.ui.add_payment_b5118402")}</button>}
          </div>
        </Panel>

        <Panel title={t("admin.quoteInvoice.ui.return_refund_history_e7a94538")} icon={RotateCcw} trailing={<span className="text-xs font-semibold" style={accent}>{returns.length} {t("admin.quoteInvoice.ui.returns_9582a02f")}</span>}>
          <div className="space-y-2 p-3">
            {returns.length ? [...returns].reverse().map((record) => <article key={record.return_id || record._id} className="rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-tertiary)" }}>
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-medium" style={muted}>Item deduction: <span className="text-xs font-bold" style={primary}>{money(record.refund_amount)}</span></p>{record.refund_method === "Cash Refund" && <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">Cash paid back: {money(record.amount_to_refund ?? record.refund_amount)}</p>}<p className="mt-0.5 text-[10px]" style={muted}>{record.refund_method} · {record.reason}</p></div><span className="rounded-full px-2 py-1 text-[9px] font-bold" style={{ color: record.status === "Completed" ? "#079878" : "#b5760a", background: record.status === "Completed" ? "#e1f8f0" : "#fff5df" }}>{record.status}</span></div>
              <p className="mt-2 text-[10px]" style={muted}>{new Date(record.date).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "var(--border-color)" }}>{(record.items_returned || []).map((item, index) => <div key={`${item.item_id || index}`} className="flex justify-between gap-3 text-[10px]"><span className="truncate" style={muted}>{item.name || invoice.items?.find((invoiceItem) => String(invoiceItem._id) === String(item.item_id))?.name || "Invoice item"}</span><span className="shrink-0 font-semibold" style={primary}>Ã— {item.qty}</span></div>)}</div>
              {record.notes && <p className="mt-2 whitespace-pre-wrap text-[10px]" style={muted}>{record.notes}</p>}
            </article>) : <p className="py-6 text-center text-xs" style={muted}>{t("admin.quoteInvoice.ui.no_returns_or_refunds_recorded_yet_18614002")}</p>}
          </div>
        </Panel>
      </aside>
    </div>

    {previewOpen && <PreviewModal onClose={() => setPreviewOpen(false)}><div ref={invoicePreviewRef} className="mx-auto w-full max-w-5xl"><QuoteTemplateDesigner previewOnly documentType="invoice" storageKey={INVOICE_TEMPLATE_STORAGE_KEY} form={{ customer_name: invoice.customer_name || "", customer_email: invoice.customer_email || "", customer_phone: invoice.customer_phone || "", customer_address: invoice.customer_address || "", invoice_date: invoice.invoice_date || "", due_date: invoice.due_date || "", terms: invoice.terms || "", notes: "", items: previewItems }} totals={{ subtotal: invoice.subtotal, discount: invoice.discount, tax: invoice.tax, total: invoice.total }} quoteNumber={invoice.invoice_number} quoteStatus={displayStatus} savedDesign={invoice.pdf_design || {}} money={(value) => money(value, locale)} /></div></PreviewModal>}

    {paymentOpen && <InvoicePaymentModal invoice={invoice} form={paymentForm} setForm={setPaymentForm} isPending={paymentMutation.isPending} onClose={() => setPaymentOpen(false)} onSubmit={() => paymentMutation.mutate(paymentForm)} />}
    {returnOpen && canReturn && <InvoiceReturnModal invoice={invoice} isPending={returnMutation.isPending} onClose={() => setReturnOpen(false)} onSubmit={(payload) => returnMutation.mutate(payload)} />}

    <style jsx global>{`
      @page { size: A4 portrait; margin: 10mm; }
      @media print {
        html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
        body * { visibility: hidden !important; }
        #invoice-document-preview [data-quote-document-page="true"],
        #invoice-document-preview [data-quote-document-page="true"] * { visibility: visible !important; }
        #invoice-print-area > .grid { display: block !important; }
        #invoice-print-area > .grid > main { display: block !important; width: 100% !important; max-width: none !important; }
        #invoice-print-area > .grid > aside,
        #invoice-print-area > :not(.grid) { display: none !important; }
        #invoice-document-preview { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        #invoice-document-preview .quote-saved-preview { margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
        #invoice-document-preview .quote-saved-preview > div { padding: 0 !important; background: #fff !important; }
        #invoice-document-preview .quote-no-print,
        #invoice-document-preview button,
        #invoice-document-preview a { display: none !important; }
        #invoice-document-preview .quote-preview-page-break { display: none !important; }
        #invoice-document-preview [data-quote-document-page="true"] { width: 100% !important; max-width: none !important; height: auto !important; min-height: 0 !important; aspect-ratio: var(--quote-page-ratio) !important; margin: 0 !important; overflow: hidden !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; zoom: 1 !important; break-after: page; page-break-after: always; }
        #invoice-document-preview .quote-preview-page-number { display: block !important; position: absolute !important; right: 8mm !important; bottom: 6mm !important; margin: 0 !important; padding: 0 !important; }
        #invoice-document-preview [data-quote-document-page="true"]:last-child { break-after: auto; page-break-after: auto; }
        #invoice-document-preview, #invoice-document-preview * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>
  </div>;
}
