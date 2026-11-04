"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  Download, Eye, FileText, MoreVertical, Plus, Printer, Receipt, RotateCcw, Search, Send, X } from
"lucide-react";
import { invoiceApi } from "@/apis/admin/invoiceApi";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import InvoicePaymentModal from "@/components/admin/InvoicePaymentModal";
import InvoiceReturnModal from "@/components/admin/InvoiceReturnModal";
import { renderRichHtml } from "@/lib/termsContent";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";
import { localizedStrictField } from "@/i18n/localize";

const DEFAULT_PAGE_SIZE = 10;
const currentTime = () => new Date().toTimeString().slice(0, 5);
const statuses = ["Unpaid", "Partially Paid", "Paid", "Overdue"];
const statusStyle = {
  Unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  "Partially Paid": "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  Cancelled: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
};
const date = (value) => value && !Number.isNaN(new Date(value).getTime()) ?
new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) :
"—";
const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const getStatus = (invoice) => {
  const status = invoice.status === "Draft" || !invoice.status ? "Unpaid" : invoice.status;
  return ["Unpaid", "Partially Paid"].includes(status) && new Date(invoice.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) ? "Overdue" : status;
};
const originalTotal = (invoice) => Number(invoice.original_total ?? (
  Number(invoice.total || 0) + (invoice.returns || []).reduce(
    (sum, record) => sum + Number(record.total_adjustment ?? record.refund_amount ?? 0),
    0,
  )
));
const areAllInvoiceItemsReturned = (invoice) => {
  const items = invoice.items || [];
  const returns = invoice.returns || [];
  if (!items.length || !returns.length) return false;

  const returnedQuantities = new Map();
  returns.forEach((record) => (record.items_returned || []).forEach((returned) => {
    const itemId = String(returned.item_id?._id || returned.item_id || "");
    returnedQuantities.set(itemId, (returnedQuantities.get(itemId) || 0) + Number(returned.qty || 0));
  }));

  return items.every((item) => {
    const itemId = String(item._id || "");
    if (!itemId) return false;
    return (returnedQuantities.get(itemId) || 0) >= Number(item.quantity || 0);
  });
};
const today = () => {const d = new Date();return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;};

function InvoiceRowMenu({ invoice, onView, onPrint, onPayment, onReturnRefund, onDownload, onSend, isSending }) {const { t } = useTranslation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);};
    const escape = (event) => {if (event.key === "Escape") setOpen(false);};
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("mousedown", close);document.removeEventListener("keydown", escape);};
  }, [open]);
  const showMenu = () => {
    const rect = buttonRef.current.getBoundingClientRect();
    const itemCount = 3 + Number(!invoice.sent_at) + Number(Number(invoice.remaining_balance ?? invoice.total) > 0) + Number(Boolean(invoice.sent_at));
    const width = 190, height = itemCount * 40 + 6;
    setPosition({ top: window.innerHeight - rect.bottom < height ? rect.top - height - 5 : rect.bottom + 5, left: Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width)) });
    setOpen(true);
  };
  const action = (fn) => (event) => {event.stopPropagation();setOpen(false);fn();};
  const item = "flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-row-hover)] hover:text-blue-600";
  return <><button ref={buttonRef} type="button" onClick={(event) => { event.stopPropagation(); open ? setOpen(false) : showMenu(); }} aria-label={`Actions for ${invoice.invoice_number}`} aria-expanded={open} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-blue-600"><MoreVertical size={18}/></button>{open && createPortal(<div ref={menuRef} style={{ top: position.top, left: position.left, backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }} className="fixed z-[12000] w-[205px] overflow-hidden rounded-xl border py-1 shadow-xl"><button className={item} onClick={action(onView)}><Eye size={14}/> View Details</button><button className={item} onClick={action(onPrint)}><Printer size={14}/> {t("admin.pos.ui.print")}</button>{!invoice.sent_at && <button className={item} onClick={action(onSend)} disabled={isSending}><Send size={14}/>{isSending ? "Sending..." : "Send to Customer"}</button>}{Number(invoice.remaining_balance ?? invoice.total) > 0 && <button className={item} onClick={action(onPayment)}><CircleDollarSign size={14}/> Add Payment</button>}{invoice.sent_at && <button className={item} onClick={action(onReturnRefund)}><RotateCcw size={14}/> Return &amp; Refund</button>}<button className={item} onClick={action(onDownload)}><Download size={14}/> Download PDF</button></div>, document.body)}</>;
}

export default function InvoicesPage() {const { t, locale } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnInvoiceId, setReturnInvoiceId] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" });
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const invoiceQueryKey = ["invoices-admin", "paginated", locale, page, pageSize, debouncedSearch, status, dateFrom, dateTo];
  const { data: invoicesResponse, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: invoiceQueryKey,
    queryFn: () => invoiceApi.listPaginated({ page, limit: pageSize, search: debouncedSearch, status, dateFrom, dateTo, locale }),
    retry: false,
  });
  const invoices = Array.isArray(invoicesResponse?.data) ? invoicesResponse.data : [];
  const pageAlreadyTranslated = locale === "en" || (invoices.length > 0 && invoices.every((invoice) => !invoice.customer_name?.trim() || Boolean(invoice.translations?.customer_name?.[locale]?.trim())));
  const pageTranslationsReady = usePageTranslations({ model: "Invoice", records: invoices, locale, ready: !isLoading && !isFetching, queryKey: invoiceQueryKey, queryClient, alreadyTranslated: pageAlreadyTranslated, fallbackAfterRetries: true });
  const translatedInvoiceCount = invoices.filter((invoice) => Boolean(invoice.translations?.customer_name?.[locale]?.trim())).length;
  const invoicePageMostlyUntranslated = locale !== "en" && invoices.length > 0 && translatedInvoiceCount / invoices.length <= 0.2;
  const hasInvoiceNameTranslation = (invoice) => locale === "en" || pageTranslationsReady || !invoicePageMostlyUntranslated || Boolean(invoice.translations?.customer_name?.[locale]?.trim());
  const { data: returnInvoice, isLoading: isReturnInvoiceLoading, isError: isReturnInvoiceError } = useQuery({
    queryKey: ["invoice-admin", returnInvoiceId],
    queryFn: () => invoiceApi.getById(returnInvoiceId),
    enabled: Boolean(returnInvoiceId),
  });

  const rows = invoices;
  const pagination = invoicesResponse?.pagination || { total: 0, page, limit: pageSize, pages: 1 };
  const currentPage = pagination.page || page;
  const pages = Math.max(1, pagination.pages || 1);
  const startIndex = pagination.total > 0 ? (currentPage - 1) * pagination.limit + 1 : 0;
  const endIndex = Math.min(currentPage * pagination.limit, pagination.total);
  const summary = invoicesResponse?.stats || { total: 0, paid: 0, unpaid: 0, overdue: 0 };
  const stats = [
    { label: "Total Invoices", value: summary.total },
    { label: "Paid", value: summary.paid, valueColor: "var(--success-text)" },
    { label: "Unpaid", value: summary.unpaid, valueColor: "var(--warning-text)" },
    { label: "Overdue", value: summary.overdue, valueColor: "var(--danger-text)" },
  ];
  const pageNumbers = pages <= 5
    ? Array.from({ length: pages }, (_, index) => index + 1)
    : currentPage <= 3 ? [1, 2, 3, 4, "...", pages]
      : currentPage >= pages - 2 ? [1, "...", pages - 3, pages - 2, pages - 1, pages]
        : [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", pages];

  useEffect(() => {
    if (Number.isInteger(pagination.page) && pagination.page > 0 && pagination.page !== page) setPage(pagination.page);
  }, [pagination.page, page]);

  const paymentMutation = useMutation({
    mutationFn: ({ id, payment }) => invoiceApi.recordPayment(id, payment),
    onSuccess: (invoice) => {
      setSelectedInvoice(null);
      setPaymentOpen(false);
      setPaymentForm({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" });
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not record payment")
  });
  const returnMutation = useMutation({
    mutationFn: ({ id, payload }) => invoiceApi.recordReturn(id, payload),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData(["invoice-admin", id], updated);
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      setReturnInvoiceId("");
      toast.success("Return and refund recorded");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not record return and refund"),
  });
  const sendMutation = useMutation({
    mutationFn: (id) => invoiceApi.send(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      queryClient.setQueryData(["invoice-admin", updated._id], updated);
      toast.success("Invoice marked as sent to customer");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not send invoice")
  });
  const download = async (invoice) => {
    try {
      const completeInvoice = invoice?._id ? await invoiceApi.getById(invoice._id) : invoice;
      await downloadInvoicePdf(completeInvoice);
      toast.success("Invoice PDF downloaded");
    }
    catch {toast.error("Could not generate invoice PDF");}
  };

  return <div className="space-y-4 pb-6 text-[var(--text-primary)]">
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-[24px] font-bold leading-7 tracking-tight text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.invoices_35f8f37b")}</h1><p className="mt-1 text-[13px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.create_track_and_manage_customer_invoices_2ac27c0e")}</p></div>
      <button type="button" onClick={() => router.push("/admin/invoices/new")} className="inline-flex h-9 items-center gap-2 self-start rounded-lg px-4 text-[13px] font-semibold text-white transition hover:opacity-90 md:self-auto" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Plus size={15} /> {t("admin.quoteInvoice.ui.create_invoice_32815b0b")}</button>
    </header>

    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4" aria-label={t("admin.quoteInvoice.ui.invoice_status_summary_bd8f524d")}>
      {stats.map(({ label, value, valueColor }) => <article key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4"><p className="truncate text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">{label}</p><p className="mt-1 truncate text-lg font-bold leading-tight sm:text-xl" style={{ color: valueColor || "var(--text-primary)" }}>{value}</p></article>)}
    </section>

    <div className="flex min-w-0 flex-col items-start justify-between gap-3 md:flex-row md:items-center">
      <label className="relative block w-full min-w-0 md:w-[400px]"><Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input value={search} onChange={(event) => {setSearch(event.target.value);setPage(1);}} placeholder={t("admin.quoteInvoice.ui.search_invoice_customer_or_email_40065e80")} aria-label={t("admin.quoteInvoice.ui.search_invoices_0e6f44a5")} className="h-9 w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-9 pe-3 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:gap-3">
        <select value={status} onChange={(event) => {setStatus(event.target.value);setPage(1);}} aria-label={t("admin.quoteInvoice.ui.filter_by_invoice_status_21095705")} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/40 md:w-[140px] md:flex-none"><option value="all">{t("admin.quoteInvoice.ui.all_status_6b308de7")}</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="relative block min-w-0 flex-1 md:w-[150px] md:flex-none"><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => {setDateFrom(event.target.value);setPage(1);}} aria-label={t("admin.quoteInvoice.ui.start_date_ff99f5b5")} className="h-9 w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
        <label className="relative block min-w-0 flex-1 md:w-[150px] md:flex-none"><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => {setDateTo(event.target.value);setPage(1);}} aria-label={t("admin.quoteInvoice.ui.end_date_89d10cd6")} className="h-9 w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
      </div>
    </div>

    <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] table-fixed text-start text-[13px]">
          <colgroup><col className="w-[14%]"/><col className="w-[20%]"/><col className="w-[15%]"/><col className="w-[15%]"/><col className="w-[14%]"/><col className="w-[13%]"/><col className="w-[9%]"/></colgroup>
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]"><tr><th className="whitespace-nowrap px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.invoice_51d86044")}</th><th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.customer_0e85749a")}</th><th className="whitespace-nowrap px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.invoice_date_844828da")}</th><th className="whitespace-nowrap px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.due_date_a1b308ec")}</th><th className="whitespace-nowrap px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.total_b25928c6")}</th><th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.payment_status_584e9778")}</th><th className="min-w-20 whitespace-nowrap px-2 py-3 text-end text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.actions_c3cd636a")}</th></tr></thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {isLoading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.loading_invoices_de149b79")}</td></tr> :
            isError ? <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-[var(--danger-text)]">{t("admin.quoteInvoice.ui.could_not_load_invoices_2b4083bc")} <button type="button" onClick={() => refetch()} className="font-semibold underline">{t("admin.quoteInvoice.ui.retry_9f5cd8a2")}</button></td></tr> :
            !rows.length ? <tr><td colSpan={7} className="px-3 py-12 text-center"><span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Receipt size={17} /></span><p className="text-xs font-semibold">{search || status !== "all" || dateFrom || dateTo ? "No matching invoices" : "No invoices yet"}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search || status !== "all" || dateFrom || dateTo ? "Try changing your search or filters." : "Create your first invoice to track customer payments."}</p>{!search && status === "all" && !dateFrom && !dateTo && <button type="button" onClick={() => router.push("/admin/invoices/new")} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--accent)]"><Plus size={12} /> {t("admin.quoteInvoice.ui.create_invoice_32815b0b")}</button>}</td></tr> :
            rows.map((invoice) => {const displayStatus = getStatus(invoice);return <tr key={invoice._id} onClick={() => router.push(`/admin/invoices/${invoice._id}`)} className="cursor-pointer border-b border-[var(--border-color)] bg-[var(--bg-card)] transition-colors duration-150 hover:bg-[var(--bg-row-hover)]"><td className="whitespace-nowrap px-4 py-2.5 text-start font-mono text-xs font-semibold text-blue-600">{invoice.invoice_number}</td><td className="max-w-56 px-4 py-2.5 text-start"><p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{hasInvoiceNameTranslation(invoice) ? localizedStrictField(invoice.customer_name, invoice.translations?.customer_name, locale) : <span className="inline-block h-3.5 w-28 animate-pulse rounded bg-[var(--bg-tertiary)]" aria-label={t("common.loading")} />}</p>{invoice.customer_phone && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{invoice.customer_phone}</p>}</td><td className="whitespace-nowrap px-4 py-2.5 text-start text-xs text-[var(--text-secondary)]">{date(invoice.invoice_date)}</td><td className="whitespace-nowrap px-4 py-2.5 text-start text-xs text-[var(--text-secondary)]">{date(invoice.due_date)}</td><td className="whitespace-nowrap px-4 py-2.5 text-start text-[13px] font-bold text-[var(--text-primary)]">{money(invoice.total)}</td><td className="px-4 py-2.5 text-start"><span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusStyle[displayStatus] || statusStyle.Unpaid}`}>{displayStatus}</span></td><td className="min-w-20 whitespace-nowrap px-2 py-2.5 text-end" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-end"><InvoiceRowMenu invoice={invoice} onView={() => router.push(`/admin/invoices/${invoice._id}`)} onPrint={() => router.push(`/admin/invoices/${invoice._id}?print=1`)} onPayment={() => {setSelectedInvoice(invoice);setPaymentForm({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" });setPaymentOpen(true);}} onReturnRefund={() => router.push(`/admin/invoices/${invoice._id}?returnRefund=1`)} onDownload={() => download(invoice)} onSend={() => sendMutation.mutate(invoice._id)} isSending={sendMutation.isPending && sendMutation.variables === invoice._id} /></div></td></tr>;})}
          </tbody>
        </table>
      </div>
      {pagination.total > 10 && <footer className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-3 xl:flex-row">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <span className="text-[12px] text-[var(--text-muted)]">{t("admin.shared.pagination.showingRange", { from: startIndex.toLocaleString(locale), to: endIndex.toLocaleString(locale), total: pagination.total.toLocaleString(locale) })}{isFetching && !isLoading ? <span className="ms-2 text-[var(--accent)]">{t("admin.brands.ui.updating")}</span> : null}</span>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><span>{t("admin.shared.pagination.rowsPerPage")}</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 w-[100px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-[13px] text-[var(--text-primary)] outline-none"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
        </div>
        <nav aria-label={t("admin.quoteInvoice.ui.invoices_pagination_02a19d81")} className="flex items-center gap-1.5">
          <button type="button" disabled={currentPage <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.quoteInvoice.ui.previous_page_81f54719")}><ChevronLeft size={14} /></button>
          {pageNumbers.map((pageNumber, index) => pageNumber === "..." ? <span key={`ellipsis-${index}`} className="px-1 text-sm text-[var(--text-muted)]">…</span> : <button key={pageNumber} type="button" disabled={isFetching && currentPage !== pageNumber} aria-current={currentPage === pageNumber ? "page" : undefined} onClick={() => setPage(pageNumber)} className="flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2 text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: currentPage === pageNumber ? "var(--accent)" : "var(--bg-tertiary)", color: currentPage === pageNumber ? "var(--accent-text)" : "var(--text-primary)", borderColor: currentPage === pageNumber ? "var(--accent)" : "var(--border-color)" }}>{pageNumber}</button>)}
          <span className="text-xs text-[var(--text-secondary)] sm:hidden">{t("admin.shared.pagination.pageOf", { page: currentPage.toLocaleString(locale), total: pages.toLocaleString(locale) })}</span>
          <button type="button" disabled={currentPage >= pages || isFetching} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.quoteInvoice.ui.next_page_4bfc194b")}><ChevronRight size={14} /></button>
        </nav>
      </footer>}
    </section>

    {selectedInvoice && !paymentOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => {if (event.target === event.currentTarget) setSelectedInvoice(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-view-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-color)] p-5"><div><p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{t("admin.quoteInvoice.ui.invoice_details_2325ca61")}</p><h2 id="invoice-view-title" className="mt-1 text-xl font-extrabold">{selectedInvoice.invoice_number}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{selectedInvoice.customer_name} Â· {getStatus(selectedInvoice)}</p></div><button type="button" onClick={() => setSelectedInvoice(null)} className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)]" aria-label={t("admin.quoteInvoice.ui.close_invoice_details_fc5e1f36")}><X size={17} /></button></header>
        <div className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Original Total", money(originalTotal(selectedInvoice))], ["Amount Paid", money(selectedInvoice.amount_paid)], ["Remaining Balance", money(selectedInvoice.remaining_balance ?? selectedInvoice.total)]].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-3"><p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-[var(--text-muted)]">Invoice date: {date(selectedInvoice.invoice_date)} Â· Due: {date(selectedInvoice.due_date)} Â· {selectedInvoice.payment_terms}</div>{Number(selectedInvoice.remaining_balance ?? selectedInvoice.total) > 0 && <button type="button" onClick={() => { setPaymentForm({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" }); setPaymentOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><CircleDollarSign size={15}/> Record Payment</button>}</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-[var(--bg-tertiary)] text-[10px] uppercase text-[var(--text-muted)]"><tr><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Unit price</th><th className="px-3 py-2.5 text-right">Discount</th><th className="px-3 py-2.5 text-right">Tax</th><th className="px-3 py-2.5 text-right">Total</th></tr></thead><tbody className="divide-y divide-[var(--border-color)]">{(selectedInvoice.items || []).map((item, index) => <tr key={item._id || index}><td className="px-3 py-2.5 font-semibold">{item.name}</td><td className="px-3 py-2.5 text-right">{item.quantity}</td><td className="px-3 py-2.5 text-right">{money(item.unit_price)}</td><td className="px-3 py-2.5 text-right">{money(item.discount)}</td><td className="px-3 py-2.5 text-right">{money(item.tax)}</td><td className="px-3 py-2.5 text-right font-bold">{money(item.total)}</td></tr>)}</tbody></table></div>
          <section><h3 className="mb-2 text-sm font-bold">Payment History</h3><div className="overflow-x-auto rounded-xl border border-[var(--border-color)]"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-[var(--bg-tertiary)] text-[10px] uppercase text-[var(--text-muted)]"><tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Method</th><th className="px-3 py-2.5">Note</th><th className="px-3 py-2.5 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[var(--border-color)]">{(selectedInvoice.payments || []).length ? selectedInvoice.payments.map((payment, index) => <tr key={payment._id || index}><td className="px-3 py-2.5">{date(payment.payment_date)}</td><td className="px-3 py-2.5">{payment.payment_method}</td><td className="px-3 py-2.5">{payment.note || "—"}</td><td className={`px-3 py-2.5 text-right font-bold ${Number(payment.amount) < 0 ? "text-rose-600" : ""}`}>{money(payment.amount)}</td></tr>) : <tr><td colSpan={4} className="px-3 py-5 text-center text-[var(--text-muted)]">No payments recorded yet.</td></tr>}</tbody></table></div></section>
          {(selectedInvoice.bank_details || selectedInvoice.terms) && <div className="grid gap-3 sm:grid-cols-2">{selectedInvoice.bank_details && <div className="rounded-xl border border-[var(--border-color)] p-3"><h3 className="text-xs font-bold">Bank details</h3><p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{selectedInvoice.bank_details}</p></div>}{selectedInvoice.terms && <div className="rounded-xl border border-[var(--border-color)] p-3"><h3 className="text-xs font-bold">Terms & conditions</h3><div className="mt-1 text-xs text-[var(--text-secondary)] [&_a]:text-blue-600 [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: renderRichHtml(selectedInvoice.terms) }} /></div>}</div>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] p-4"><button type="button" onClick={() => download(selectedInvoice)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"><Download size={14} /> {t("admin.quoteInvoice.ui.download_pdf_98e5ef06")}</button></footer>
      </section>
    </div>}
    {paymentOpen && selectedInvoice && <InvoicePaymentModal invoice={selectedInvoice} form={paymentForm} setForm={setPaymentForm} isPending={paymentMutation.isPending} onClose={() => {setPaymentOpen(false);setSelectedInvoice(null);}} onSubmit={() => paymentMutation.mutate({ id: selectedInvoice._id, payment: paymentForm })} />}
    {returnInvoiceId && (isReturnInvoiceLoading || !returnInvoice ? <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/55 p-4" role="status"><div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-4 text-sm text-[var(--text-primary)] shadow-xl">{isReturnInvoiceError ? <><p>Could not load this invoice.</p><button type="button" onClick={() => setReturnInvoiceId("")} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Close</button></> : "Loading invoice…"}</div></div> : <InvoiceReturnModal invoice={returnInvoice} isPending={returnMutation.isPending} onClose={() => setReturnInvoiceId("")} onSubmit={(payload) => returnMutation.mutate({ id: returnInvoiceId, payload })} />)}
  </div>;
}
