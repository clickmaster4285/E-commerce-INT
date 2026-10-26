"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  Download, Eye, FileText, MoreHorizontal, Plus, Receipt, RotateCcw, Search, Send, X } from
"lucide-react";
import { invoiceApi } from "@/apis/admin/invoiceApi";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import InvoicePaymentModal from "@/components/admin/InvoicePaymentModal";

const PAGE_SIZE = 20;
const currentTime = () => new Date().toTimeString().slice(0, 5);
const statuses = ["Unpaid", "Partially Paid", "Paid", "Overdue"];
const statusStyle = {
  Unpaid: "bg-amber-100 text-amber-800",
  "Partially Paid": "bg-blue-100 text-blue-700",
  Overdue: "bg-rose-100 text-rose-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-slate-200 text-slate-600"
};
const date = (value) => value && !Number.isNaN(new Date(value).getTime()) ?
new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) :
"â€”";
const dateKey = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : "";
const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const getStatus = (invoice) => {
  const status = invoice.status === "Draft" || !invoice.status ? "Unpaid" : invoice.status;
  return ["Unpaid", "Partially Paid"].includes(status) && new Date(invoice.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) ? "Overdue" : status;
};
const today = () => {const d = new Date();return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;};

function InvoiceRowMenu({ invoice, onView, onPayment, onReturnRefund, onDownload, onSend, isSending }) {const { t } = useTranslation();
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
    const itemCount = 2 + Number(!invoice.sent_at) + Number(Number(invoice.remaining_balance ?? invoice.total) > 0) + Number(Boolean(invoice.sent_at));
    const width = 190, height = itemCount * 40 + 6;
    setPosition({ top: window.innerHeight - rect.bottom < height ? rect.top - height - 5 : rect.bottom + 5, left: Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width)) });
    setOpen(true);
  };
  const action = (fn) => (event) => {event.stopPropagation();setOpen(false);fn();};
  const item = "flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700";
  return <><button ref={buttonRef} type="button" onClick={(event) => { event.stopPropagation(); open ? setOpen(false) : showMenu(); }} aria-label={`Actions for ${invoice.invoice_number}`} aria-expanded={open} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><MoreHorizontal size={17}/></button>{open && createPortal(<div ref={menuRef} style={{ top: position.top, left: position.left }} className="fixed z-[12000] w-[205px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"><button className={item} onClick={action(onView)}><Eye size={14}/> View Details</button>{!invoice.sent_at && <button className={item} onClick={action(onSend)} disabled={isSending}><Send size={14}/>{isSending ? "Sending..." : "Send to Customer"}</button>}{Number(invoice.remaining_balance ?? invoice.total) > 0 && <button className={item} onClick={action(onPayment)}><CircleDollarSign size={14}/> Add Payment</button>}{invoice.sent_at && <button className={item} onClick={action(onReturnRefund)}><RotateCcw size={14}/> Return &amp; Refund</button>}<button className={item} onClick={action(onDownload)}><Download size={14}/> Download PDF</button></div>, document.body)}</>;
}

export default function InvoicesPage() {const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" });
  const { data: rawInvoices, isLoading, isError, refetch } = useQuery({ queryKey: ["invoices-admin"], queryFn: invoiceApi.list });
  const invoices = useMemo(() => Array.isArray(rawInvoices) ? rawInvoices : rawInvoices?.invoices || [], [rawInvoices]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesStatus = status === "all" || getStatus(invoice) === status;
      const haystack = [invoice.invoice_number, invoice.customer_name, invoice.customer_email, invoice.customer_phone].filter(Boolean).join(" ").toLowerCase();
      const invoiceDate = dateKey(invoice.invoice_date || invoice.created_at);
      return matchesStatus && (!term || haystack.includes(term)) && (!dateFrom || invoiceDate >= dateFrom) && (!dateTo || invoiceDate <= dateTo);
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [invoices, search, status, dateFrom, dateTo]);

  const stats = useMemo(() => [
  { label: "Total Invoices", value: invoices.length, note: "All invoices", icon: Receipt, tint: "bg-blue-100", color: "text-blue-600" },
  { label: "Paid", value: invoices.filter((invoice) => invoice.status === "Paid").length, note: "Payment received", icon: CheckCircle2, tint: "bg-emerald-100", color: "text-emerald-600" },
  { label: "Unpaid", value: invoices.filter((invoice) => invoice.status === "Unpaid" && getStatus(invoice) !== "Overdue").length, note: "Awaiting payment", icon: CircleDollarSign, tint: "bg-orange-100", color: "text-orange-500" },
  { label: "Overdue", value: invoices.filter((invoice) => getStatus(invoice) === "Overdue").length, note: "Past due date", icon: CalendarDays, tint: "bg-rose-100", color: "text-rose-600" }],
  [invoices]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageStart = Math.max(1, Math.min(currentPage - 1, pages - 3));
  const pageNumbers = Array.from({ length: Math.min(4, pages) }, (_, index) => pageStart + index);

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
  const sendMutation = useMutation({
    mutationFn: (id) => invoiceApi.send(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoices-admin"], (current) => {
        const list = Array.isArray(current) ? current : current?.invoices;
        if (!Array.isArray(list)) return current;
        const updatedInvoices = list.map((invoice) => invoice._id === updated._id ? updated : invoice);
        return Array.isArray(current) ? updatedInvoices : { ...current, invoices: updatedInvoices };
      });
      queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      queryClient.setQueryData(["invoice-admin", updated._id], updated);
      toast.success("Invoice marked as sent to customer");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not send invoice")
  });
  const resetFilters = () => {setSearch("");setStatus("all");setDateFrom("");setDateTo("");setPage(1);};
  const download = async (invoice) => {
    try {
      const completeInvoice = invoice?._id ? await invoiceApi.getById(invoice._id) : invoice;
      await downloadInvoicePdf(completeInvoice);
      toast.success("Invoice PDF downloaded");
    }
    catch {toast.error("Could not generate invoice PDF");}
  };

  return <div className="space-y-4 pb-6 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t("admin.quoteInvoice.ui.invoices_35f8f37b")}</h1><p className="mt-1 text-xs font-medium text-slate-500">{t("admin.quoteInvoice.ui.create_track_and_manage_customer_invoices_2ac27c0e")}</p></div>
      <button type="button" onClick={() => router.push("/admin/invoices/new")} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-[13px] font-extrabold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"><Plus size={16} strokeWidth={2.5} /> {t("admin.quoteInvoice.ui.create_invoice_32815b0b")}</button>
    </header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("admin.quoteInvoice.ui.invoice_status_summary_bd8f524d")}>
      {stats.map(({ label, value, note, icon: Icon, tint, color }) => <article key={label} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${tint} ${color}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 text-xl font-extrabold leading-tight text-slate-900">{value}</p><p className="mt-1 truncate text-[10px] font-medium text-slate-500">{note}</p></div></article>)}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-lg shadow-slate-900/5">
      <div className="grid min-w-0 grid-cols-1 gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_160px_160px_auto]">
        <label className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => {setSearch(event.target.value);setPage(1);}} placeholder={t("admin.quoteInvoice.ui.search_invoice_customer_or_email_40065e80")} aria-label={t("admin.quoteInvoice.ui.search_invoices_0e6f44a5")} className="h-10 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" /></label>
        <select value={status} onChange={(event) => {setStatus(event.target.value);setPage(1);}} aria-label={t("admin.quoteInvoice.ui.filter_by_invoice_status_21095705")} className="h-10 min-w-0 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-blue-200"><option value="all">{t("admin.quoteInvoice.ui.all_status_6b308de7")}</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="relative block min-w-0"><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => {setDateFrom(event.target.value);setPage(1);}} aria-label={t("admin.quoteInvoice.ui.start_date_ff99f5b5")} className="h-10 min-w-0 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-blue-200" /></label>
        <label className="relative block min-w-0"><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => {setDateTo(event.target.value);setPage(1);}} aria-label={t("admin.quoteInvoice.ui.end_date_89d10cd6")} className="h-10 min-w-0 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-blue-200" /></label>
        <button type="button" onClick={resetFilters} className="h-10 whitespace-nowrap rounded-2xl border-[1.5px] border-slate-200 bg-white px-4 text-[13px] font-extrabold text-slate-500 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]">{t("admin.quoteInvoice.ui.reset_44c57abd")}</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-100"><tr><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.invoice_51d86044")}</th><th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.customer_0e85749a")}</th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.invoice_date_844828da")}</th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.due_date_a1b308ec")}</th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.total_b25928c6")}</th><th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.payment_status_584e9778")}</th><th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("admin.quoteInvoice.ui.actions_c3cd636a")}</th></tr></thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {isLoading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.loading_invoices_de149b79")}</td></tr> :
            isError ? <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-[var(--danger-text)]">{t("admin.quoteInvoice.ui.could_not_load_invoices_2b4083bc")} <button type="button" onClick={() => refetch()} className="font-semibold underline">{t("admin.quoteInvoice.ui.retry_9f5cd8a2")}</button></td></tr> :
            !rows.length ? <tr><td colSpan={7} className="px-3 py-12 text-center"><span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Receipt size={17} /></span><p className="text-xs font-semibold">{search || status !== "all" || dateFrom || dateTo ? "No matching invoices" : "No invoices yet"}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search || status !== "all" || dateFrom || dateTo ? "Try changing your search or filters." : "Create your first invoice to track customer payments."}</p>{!search && status === "all" && !dateFrom && !dateTo && <button type="button" onClick={() => router.push("/admin/invoices/new")} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--accent)]"><Plus size={12} /> {t("admin.quoteInvoice.ui.create_invoice_32815b0b")}</button>}</td></tr> :
            rows.map((invoice) => {const displayStatus = getStatus(invoice);return <tr key={invoice._id} onClick={() => router.push(`/admin/invoices/${invoice._id}`)} className="cursor-pointer border-b border-slate-200 transition-colors duration-150 hover:bg-blue-50/60"><td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-blue-600">{invoice.invoice_number}</td><td className="max-w-56 px-4 py-2.5"><p className="truncate text-[13px] font-semibold text-slate-900">{invoice.customer_name}</p>{invoice.customer_phone && <p className="mt-0.5 truncate text-[11px] text-slate-500">{invoice.customer_phone}</p>}</td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">{date(invoice.invoice_date)}</td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">{date(invoice.due_date)}</td><td className="whitespace-nowrap px-4 py-2.5 text-[13px] font-bold text-slate-900">{money(invoice.total)}</td><td className="px-4 py-2.5"><span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusStyle[displayStatus] || statusStyle.Unpaid}`}>{displayStatus}</span></td><td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-end"><InvoiceRowMenu invoice={invoice} onView={() => router.push(`/admin/invoices/${invoice._id}`)} onPayment={() => {setSelectedInvoice(invoice);setPaymentForm({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" });setPaymentOpen(true);}} onReturnRefund={() => router.push(`/admin/invoices/${invoice._id}?returnRefund=1`)} onDownload={() => download(invoice)} onSend={() => sendMutation.mutate(invoice._id)} isSending={sendMutation.isPending && sendMutation.variables === invoice._id} /></div></td></tr>;})}
          </tbody>
        </table>
      </div>
      {filtered.length > PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-slate-500"><span>{t("admin.quoteInvoice.ui.showing_163d8174")} {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} {t("admin.quoteInvoice.ui.to_4374aaee")} {Math.min(currentPage * PAGE_SIZE, filtered.length)} {t("admin.quoteInvoice.ui.of_de04fa0e")} {filtered.length} {t("admin.quoteInvoice.ui.invoices_c3e815af")}</span><nav aria-label={t("admin.quoteInvoice.ui.invoices_pagination_02a19d81")} className="flex items-center gap-1"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.quoteInvoice.ui.previous_page_81f54719")}><ChevronLeft size={14} /></button>{pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" aria-current={currentPage === pageNumber ? "page" : undefined} onClick={() => setPage(pageNumber)} className={`h-8 min-w-8 rounded-md border px-2 text-[13px] font-bold transition ${currentPage === pageNumber ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>{pageNumber}</button>)}<button type="button" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.quoteInvoice.ui.next_page_4bfc194b")}><ChevronRight size={14} /></button></nav></footer>}
    </section>

    {selectedInvoice && !paymentOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => {if (event.target === event.currentTarget) setSelectedInvoice(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-view-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-color)] p-5"><div><p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{t("admin.quoteInvoice.ui.invoice_details_2325ca61")}</p><h2 id="invoice-view-title" className="mt-1 text-xl font-extrabold">{selectedInvoice.invoice_number}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{selectedInvoice.customer_name} Â· {getStatus(selectedInvoice)}</p></div><button type="button" onClick={() => setSelectedInvoice(null)} className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)]" aria-label={t("admin.quoteInvoice.ui.close_invoice_details_fc5e1f36")}><X size={17} /></button></header>
        <div className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Total Amount", money(selectedInvoice.total)], ["Amount Paid", money(selectedInvoice.amount_paid)], ["Remaining Balance", money(selectedInvoice.remaining_balance ?? selectedInvoice.total)]].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-3"><p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-[var(--text-muted)]">Invoice date: {date(selectedInvoice.invoice_date)} Â· Due: {date(selectedInvoice.due_date)} Â· {selectedInvoice.payment_terms}</div>{Number(selectedInvoice.remaining_balance ?? selectedInvoice.total) > 0 && <button type="button" onClick={() => { setPaymentForm({ amount: "", payment_date: today(), payment_time: currentTime(), payment_method: "Cash", note: "" }); setPaymentOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><CircleDollarSign size={15}/> Record Payment</button>}</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-[var(--bg-tertiary)] text-[10px] uppercase text-[var(--text-muted)]"><tr><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Unit price</th><th className="px-3 py-2.5 text-right">Discount</th><th className="px-3 py-2.5 text-right">Tax</th><th className="px-3 py-2.5 text-right">Total</th></tr></thead><tbody className="divide-y divide-[var(--border-color)]">{(selectedInvoice.items || []).map((item, index) => <tr key={item._id || index}><td className="px-3 py-2.5 font-semibold">{item.name}</td><td className="px-3 py-2.5 text-right">{item.quantity}</td><td className="px-3 py-2.5 text-right">{money(item.unit_price)}</td><td className="px-3 py-2.5 text-right">{money(item.discount)}</td><td className="px-3 py-2.5 text-right">{money(item.tax)}</td><td className="px-3 py-2.5 text-right font-bold">{money(item.total)}</td></tr>)}</tbody></table></div>
          <section><h3 className="mb-2 text-sm font-bold">Payment History</h3><div className="overflow-x-auto rounded-xl border border-[var(--border-color)]"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-[var(--bg-tertiary)] text-[10px] uppercase text-[var(--text-muted)]"><tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Method</th><th className="px-3 py-2.5">Note</th><th className="px-3 py-2.5 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[var(--border-color)]">{(selectedInvoice.payments || []).length ? selectedInvoice.payments.map((payment, index) => <tr key={payment._id || index}><td className="px-3 py-2.5">{date(payment.payment_date)}</td><td className="px-3 py-2.5">{payment.payment_method}</td><td className="px-3 py-2.5">{payment.note || "â€”"}</td><td className={`px-3 py-2.5 text-right font-bold ${Number(payment.amount) < 0 ? "text-rose-600" : ""}`}>{money(payment.amount)}</td></tr>) : <tr><td colSpan={4} className="px-3 py-5 text-center text-[var(--text-muted)]">No payments recorded yet.</td></tr>}</tbody></table></div></section>
          {(selectedInvoice.bank_details || selectedInvoice.terms) && <div className="grid gap-3 sm:grid-cols-2">{selectedInvoice.bank_details && <div className="rounded-xl border border-[var(--border-color)] p-3"><h3 className="text-xs font-bold">Bank details</h3><p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{selectedInvoice.bank_details}</p></div>}{selectedInvoice.terms && <div className="rounded-xl border border-[var(--border-color)] p-3"><h3 className="text-xs font-bold">Terms & conditions</h3><p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{selectedInvoice.terms}</p></div>}</div>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] p-4"><button type="button" onClick={() => download(selectedInvoice)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"><Download size={14} /> {t("admin.quoteInvoice.ui.download_pdf_98e5ef06")}</button></footer>
      </section>
    </div>}
    {paymentOpen && selectedInvoice && <InvoicePaymentModal invoice={selectedInvoice} form={paymentForm} setForm={setPaymentForm} isPending={paymentMutation.isPending} onClose={() => {setPaymentOpen(false);setSelectedInvoice(null);}} onSubmit={() => paymentMutation.mutate({ id: selectedInvoice._id, payment: paymentForm })} />}
  </div>;
}
