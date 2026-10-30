"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/apis/admin/quoteApi";
import { toast } from "sonner";
import {
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleX, Eye, FilePlus2, FileText, Home, MoreVertical, Pencil, Plus, Printer, Search, Send } from
"lucide-react";

const PAGE_SIZE = 20;
const statuses = ["Pending", "Draft", "Sent", "Accepted", "Rejected"];
const statusStyle = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Draft: "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
  Sent: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
};
const customerStyle = {
  Customer: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Lead: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  Other: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
};
const date = (value) => value && !Number.isNaN(new Date(value).getTime()) ?
new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) :
"—";
const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function QuotesPage() {const { t, dir, locale } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [customerType, setCustomerType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const { data: rawQuotes, isLoading, isError, refetch } = useQuery({ queryKey: ["quotes-admin"], queryFn: quoteApi.list });
  const quotes = useMemo(() => Array.isArray(rawQuotes) ? rawQuotes : rawQuotes?.quotes || [], [rawQuotes]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      const matchesStatus = status === "all" || quote.status === status;
      const matchesType = customerType === "all" || quote.customer_type === customerType;
      const haystack = [quote.quote_number, quote.customer_name, quote.customer_email, quote.customer_phone].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const createdDate = new Date(quote.quote_date || quote.created_at).toISOString().slice(0, 10);
      const matchesFrom = !dateFrom || createdDate >= dateFrom;
      const matchesTo = !dateTo || createdDate <= dateTo;
      return matchesStatus && matchesType && matchesSearch && matchesFrom && matchesTo;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [quotes, search, status, customerType, dateFrom, dateTo]);

  const statCards = useMemo(() => [
  { label: "Total Quotes", value: quotes.length },
  { label: "Sent", value: quotes.filter((quote) => quote.status === "Sent").length, valueColor: "var(--warning-text)" },
  { label: "Accepted", value: quotes.filter((quote) => quote.status === "Accepted").length, valueColor: "var(--success-text)" },
  { label: "Rejected", value: quotes.filter((quote) => quote.status === "Rejected").length, valueColor: "var(--danger-text)" }],
  [quotes]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleSelected = rows.length > 0 && rows.every((quote) => selected.includes(quote._id));
  const pageStart = Math.max(1, Math.min(currentPage - 1, pages - 3));
  const pageNumbers = Array.from({ length: Math.min(4, pages) }, (_, index) => pageStart + index);

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }) => {
      if (nextStatus === "Sent") {
        const quote = quotes.find((item) => item._id === id);
        return quoteApi.update(id, { ...quote, status: nextStatus });
      }
      return quoteApi.updateStatus(id, nextStatus);
    },
    onSuccess: () => {toast.success("Quote status updated");qc.invalidateQueries({ queryKey: ["quotes-admin"] });},
    onError: (error) => toast.error(error?.response?.data?.message || "Could not update quote status")
  });
  const retry = async () => {
    const result = await refetch();
    if (result.isError) toast.error("Could not load quotes. Please try again.");
  };
  const resetPage = () => {setPage(1);setSelected([]);};

  return <div className="space-y-4 pb-6 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.quotes_7b0257ce")}</h1>
        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.create_track_and_manage_customer_quotations_2132eaca")}</p>
      </div>
      <button type="button" onClick={() => router.push("/admin/quotes/new")} style={{ marginInlineStart: "auto" }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"><Plus size={16} strokeWidth={2.5} /> {t("admin.quoteInvoice.ui.create_quote_b146a77e")}</button>
    </header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("admin.quoteInvoice.ui.quote_status_summary_6f594d13")}>
      {statCards.map(({ label, value, valueColor }) => <article key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4"><p className="truncate text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">{label}</p><p className="mt-1 truncate text-lg font-bold leading-tight sm:text-xl" style={{ color: valueColor || "var(--text-primary)" }}>{value}</p></article>)}
    </section>

    <div className="flex min-w-0 flex-col items-stretch justify-between gap-2 xl:flex-row xl:items-center xl:gap-3">
        <label className="relative block w-full min-w-0 xl:w-[400px] xl:shrink-0"><Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input value={search} onChange={(event) => {setSearch(event.target.value);resetPage();}} placeholder={t("admin.quoteInvoice.ui.search_quote_customer_or_email_92c16fa3")} aria-label={t("admin.quoteInvoice.ui.search_quotes_c418151c")} className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-9 pe-3 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
        <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4 xl:ms-auto xl:flex xl:w-auto xl:flex-none xl:items-center xl:justify-end xl:gap-1.5">
          <div className="relative min-w-0 xl:w-[140px]"><select value={status} onChange={(event) => {setStatus(event.target.value);resetPage();}} aria-label={t("admin.quoteInvoice.ui.filter_by_quote_status_286fabef")} className="h-9 w-full appearance-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-1 pe-6 text-[13px] font-medium text-[var(--text-primary)] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40"><option value="all">{t("admin.quoteInvoice.ui.all_status_6b308de7")}</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /></div>
          <div className="relative min-w-0 xl:w-[170px]"><select value={customerType} onChange={(event) => {setCustomerType(event.target.value);resetPage();}} aria-label={t("admin.quoteInvoice.ui.filter_by_customer_type_539b4bd0")} className="h-9 w-full appearance-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-1 pe-6 text-[13px] font-medium text-[var(--text-primary)] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40"><option value="all">{t("admin.quoteInvoice.ui.all_customer_type_f192a5d3")}</option>{["Customer", "Lead", "Other"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /></div>
          <label className="relative block min-w-0 xl:w-[160px]"><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => {setDateFrom(event.target.value);resetPage();}} aria-label={t("admin.quoteInvoice.ui.start_date_ff99f5b5")} className="h-9 min-w-0 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-1 text-[13px] font-medium text-[var(--text-primary)] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
          <label className="relative block min-w-0 xl:w-[160px]"><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => {setDateTo(event.target.value);resetPage();}} aria-label={t("admin.quoteInvoice.ui.end_date_89d10cd6")} className="h-9 min-w-0 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-1 text-[13px] font-medium text-[var(--text-primary)] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
        </div>
    </div>

    <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
      {selected.length > 0 && <div className="mb-2 flex items-center justify-between rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-[10px] font-semibold text-[var(--accent)]"><span>{selected.length} {t("admin.quoteInvoice.ui.quote_f5d98dda")}{selected.length === 1 ? "" : "s"} {t("admin.quoteInvoice.ui.selected_835f3b50")}</span><button type="button" onClick={() => setSelected([])} className="underline">{t("admin.quoteInvoice.ui.clear_selection_247fd631")}</button></div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-[13px]">
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected((current) => allVisibleSelected ? current.filter((id) => !rows.some((quote) => quote._id === id)) : [...new Set([...current, ...rows.map((quote) => quote._id)])])} aria-label={t("admin.quoteInvoice.ui.select_all_visible_quotes_6f746ed8")} className="h-4 w-4 cursor-pointer rounded accent-blue-600" /></th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.quote_0b768210")}</th><th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.customer_0e85749a")}</th><th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.customer_type_9f8a0a78")}</th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.date_eb9a4bc1")}</th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.expiry_date_8d007050")}</th><th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.total_b25928c6")}</th><th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.status_bae7d5be")}</th><th className="min-w-20 whitespace-nowrap px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.actions_c3cd636a")}</th></tr></thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {isLoading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-xs text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.loading_quotes_1854d0c6")}</td></tr> :
            isError ? <tr><td colSpan={9} className="px-3 py-10 text-center text-xs text-[var(--danger-text)]">{t("admin.quoteInvoice.ui.could_not_load_quotes_67cc69a5")} <button type="button" onClick={retry} className="font-semibold underline">{t("admin.quoteInvoice.ui.retry_9f5cd8a2")}</button></td></tr> :
            !rows.length ? <tr><td colSpan={9} className="px-3 py-12 text-center"><span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><FileText size={17} /></span><p className="text-xs font-semibold">{search || status !== "all" || customerType !== "all" || dateFrom || dateTo ? "No matching quotes" : "No quotes yet"}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search || status !== "all" || customerType !== "all" || dateFrom || dateTo ? "Try changing your search or filters." : "Create your first quote to share pricing with a customer."}</p>{!search && status === "all" && customerType === "all" && !dateFrom && !dateTo && <button type="button" onClick={() => router.push("/admin/quotes/new")} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--accent)]"><Plus size={12} /> {t("admin.quoteInvoice.ui.create_quote_b146a77e")}</button>}</td></tr> :
            rows.map((quote) => <tr key={quote._id} onClick={() => router.push(`/admin/quotes/${quote._id}`)} className="cursor-pointer border-b border-[var(--border-color)] transition-colors duration-150 hover:bg-[var(--bg-row-hover)]"><td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.includes(quote._id)} onChange={() => setSelected((current) => current.includes(quote._id) ? current.filter((id) => id !== quote._id) : [...current, quote._id])} aria-label={`Select ${quote.quote_number}`} className="h-4 w-4 cursor-pointer rounded accent-blue-600" /></td><td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-blue-600">{quote.quote_number}</td><td className="max-w-56 px-4 py-2.5"><p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{quote.customer_name}</p><p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{quote.customer_email || "No email"}</p><p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{quote.customer_phone || "No phone"}</p></td><td className="px-4 py-2.5"><span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${customerStyle[quote.customer_type] || customerStyle.Other}`}>{quote.customer_type || "Other"}</span></td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--text-secondary)]">{date(quote.quote_date)}</td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--text-secondary)]">{date(quote.expiry_date)}</td><td className="whitespace-nowrap px-4 py-2.5 text-[13px] font-semibold text-[var(--text-primary)]">{money(quote.total)}</td><td className="px-4 py-2.5"><span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusStyle[quote.status] || statusStyle.Draft}`}>{quote.status}</span></td><td className="min-w-20 whitespace-nowrap px-2 py-2.5" onClick={(event) => event.stopPropagation()}><QuoteRowActions quote={quote} onView={() => router.push(`/admin/quotes/${quote._id}`)} onPrint={() => router.push(`/admin/quotes/${quote._id}?print=1`)} onEdit={() => router.push(`/admin/quotes/new?quote=${quote._id}`)} onConvert={() => router.push(`/admin/invoices/new?quote=${quote._id}`)} onSend={() => statusMutation.mutate({ id: quote._id, nextStatus: "Sent" })} onAccept={() => statusMutation.mutate({ id: quote._id, nextStatus: "Accepted" })} onReject={() => statusMutation.mutate({ id: quote._id, nextStatus: "Rejected" })} /></td></tr>)}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-[var(--text-muted)]"><span>{t("admin.quoteInvoice.ui.showing_163d8174")} {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} {t("admin.quoteInvoice.ui.to_4374aaee")} {Math.min(currentPage * PAGE_SIZE, filtered.length)} {t("admin.quoteInvoice.ui.of_de04fa0e")} {filtered.length} {t("admin.quoteInvoice.ui.quotes_4d3ee087")}</span><nav aria-label={t("admin.quoteInvoice.ui.quotes_pagination_210ff1ec")} className="flex items-center gap-1"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.quoteInvoice.ui.previous_page_81f54719")}><ChevronLeft size={14} /></button>{pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" aria-current={currentPage === pageNumber ? "page" : undefined} onClick={() => setPage(pageNumber)} className={`h-8 min-w-8 rounded-md border px-2 text-[13px] font-semibold transition ${currentPage === pageNumber ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-blue-300 hover:text-blue-600"}`}>{pageNumber}</button>)}<button type="button" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.quoteInvoice.ui.next_page_4bfc194b")}><ChevronRight size={14} /></button></nav></footer>}
    </section>
  </div>;
}

function QuoteRowActions({ quote, onView, onPrint, onEdit, onConvert, onSend, onAccept, onReject }) {const { t } = useTranslation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);};
    const closeEscape = (event) => {if (event.key === "Escape") setOpen(false);};
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {document.removeEventListener("mousedown", closeOutside);document.removeEventListener("keydown", closeEscape);};
  }, [open]);

  const showMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = (quote.status === "Sent" ? 210 : ["Pending", "Draft"].includes(quote.status) ? 200 : quote.status === "Accepted" ? 132 : 95) + 36;
    const width = 170;
    const top = window.innerHeight - rect.bottom < menuHeight + 8 ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;
    setPosition({ top, left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8) });
    setOpen(true);
  };
  const run = (action) => () => {setOpen(false);action();};
  const itemClass = "flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]";

  return <div className="flex items-center justify-end">
    <button ref={buttonRef} type="button" onClick={() => open ? setOpen(false) : showMenu()} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={`More actions for ${quote.quote_number}`} aria-haspopup="menu" aria-expanded={open}><MoreVertical size={18} /></button>
    {open && createPortal(<div ref={menuRef} role="menu" className="fixed z-[9999] w-[170px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-1.5 shadow-xl shadow-slate-900/15" style={position}><button type="button" role="menuitem" onClick={run(onView)} className={itemClass}><Eye size={13} /> {t("admin.quoteInvoice.ui.view_details_badd3851")}</button><button type="button" role="menuitem" onClick={run(onPrint)} className={itemClass}><Printer size={13} /> {t("admin.pos.ui.print")}</button>{["Pending", "Draft"].includes(quote.status) && <><button type="button" role="menuitem" onClick={run(onEdit)} className={itemClass}><Pencil size={13} /> {t("admin.quoteInvoice.ui.edit_quote_540f4206")}</button><div className="my-1 border-t border-[var(--border-color)]" /><button type="button" role="menuitem" onClick={run(onSend)} className={`${itemClass} font-semibold text-blue-700`}><Send size={13} /> {t("admin.quoteInvoice.ui.mark_as_sent_9dbca9a9")}</button></>}{quote.status === "Sent" && <><div className="my-1 border-t border-[var(--border-color)]" /><button type="button" role="menuitem" onClick={run(onAccept)} className={`${itemClass} font-semibold text-emerald-700`}><Check size={13} /> {t("admin.quoteInvoice.ui.mark_accepted_b5b2eaf1")}</button><button type="button" role="menuitem" onClick={run(onReject)} className={`${itemClass} font-semibold text-rose-700`}><CircleX size={13} /> {t("admin.quoteInvoice.ui.mark_rejected_b5f3849b")}</button></>}{quote.status === "Accepted" && <><div className="my-1 border-t border-[var(--border-color)]" /><button type="button" role="menuitem" onClick={run(onConvert)} className={`${itemClass} font-semibold text-blue-700`}><FilePlus2 size={13} /> {t("admin.quoteInvoice.ui.convert_to_invoice_72f93348")}</button></>}</div>, document.body)}
  </div>;
}
