"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, History, RotateCcw, Search } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const PAGE_SIZE = 10;
const money = (value, locale) => `Rs. ${(Number(value) || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}`;
const paymentLabel = (method, t) => {
  const normalized = String(method || "cash").toLowerCase();
  const key = { cash: "cash", card: "card", bank_transfer: "bankTransfer" }[normalized];
  return key ? t(`admin.pos.payment.${key}`) : normalized.replaceAll("_", " ");
};

export default function PosReturnHistoryPanel({ sales = [], isLoading = false, isError = false }) {
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const [expandedReturnId, setExpandedReturnId] = useState(null);

  const returnRecords = useMemo(() => sales.flatMap((sale) => (sale.returns || []).map((record, index) => ({
    ...record,
    _rowId: String(record._id || `${sale._id}-${record.returned_at || index}`),
    _saleId: sale._id,
    _saleNumber: sale.sale_number || t("admin.pos.ui.posSale"),
    _saleTotal: sale.total,
    _salePayment: sale.payment?.method || "cash",
    _customer: sale.customer_snapshot || {},
    _cashier: record.returned_by_name || sale.cashier_name || t("admin.pos.ui.posStaff"),
  }))).sort((a, b) => new Date(b.returned_at || 0) - new Date(a.returned_at || 0)), [sales, t]);

  const filteredReturns = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const from = dateRange === "today" || dateRange === "7days" || dateRange === "30days" ? new Date(now) : null;
    if (dateRange === "today") from.setHours(0, 0, 0, 0);
    if (dateRange === "7days") from.setDate(from.getDate() - 7);
    if (dateRange === "30days") from.setDate(from.getDate() - 30);
    return returnRecords.filter((record) => {
      const recordDate = new Date(record.returned_at || 0);
      const searchable = [record._saleNumber, record._customer.name, record._customer.phone, record.reason, record._cashier, record.refund_total, ...(record.items || []).flatMap((item) => [item.product_name, item.sku, item.variant_title])].filter(Boolean).join(" ").toLowerCase();
      return (!query || searchable.includes(query)) && (!from || (recordDate >= from && recordDate <= now));
    });
  }, [returnRecords, search, dateRange]);

  const pageCount = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const visibleReturns = filteredReturns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalRefunded = returnRecords.reduce((sum, record) => sum + (Number(record.refund_total) || 0), 0);
  const totalUnits = returnRecords.reduce((sum, record) => sum + (record.items || []).reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0), 0);

  return (
    <div className="space-y-4 pb-1">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><History size={18}/></span><div><h2 className="text-lg font-extrabold tracking-tight text-slate-900">{t("admin.pos.ui.returnHistory")}</h2><p className="mt-0.5 text-xs text-slate-500">{t("admin.pos.ui.reviewRefundsAndReturnedItemsRecordedAgainstPOSSales")}</p></div></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><RotateCcw size={13}/>{t("admin.pos.ui.returnCount", { count: returnRecords.length })}</span>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><RotateCcw size={16}/></span><span><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{t("admin.pos.ui.recordedReturns")}</span><strong className="mt-0.5 block text-sm text-slate-800">{returnRecords.length.toLocaleString(locale)}</strong></span></div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ClipboardList size={16}/></span><span><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{t("admin.pos.ui.unitsReturned")}</span><strong className="mt-0.5 block text-sm text-slate-800">{totalUnits.toLocaleString(locale)}</strong></span></div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><CalendarDays size={16}/></span><span><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{t("admin.pos.ui.totalRefunded")}</span><strong className="mt-0.5 block text-sm text-slate-800">{money(totalRefunded, locale)}</strong></span></div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
        <label className="relative min-w-0"><Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("admin.pos.ui.searchReturnSaleCustomerReasonOrItem")} aria-label={t("admin.pos.ui.searchReturnHistory")} className="h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"/></label>
        <label className="relative"><CalendarDays size={14} className="absolute start-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"/><select value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }} aria-label={t("admin.pos.ui.filterReturnsByDate")} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white ps-9 pe-8 text-xs font-semibold text-slate-600 shadow-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"><option value="all">{t("admin.pos.ui.timeAll")}</option><option value="today">{t("admin.pos.ui.timeToday")}</option><option value="7days">{t("admin.pos.ui.timeLast7Days")}</option><option value="30days">{t("admin.pos.ui.timeLast30Days")}</option></select><ChevronDown size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400"/></label>
        <button type="button" onClick={() => { setSearch(""); setDateRange("all"); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{t("admin.pos.ui.resetFilters")}</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-start">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["return", "originalSale", "date", "customer", "reason", "items", "refund", ""].map((label) => <th key={label} className="px-3 py-3 font-bold">{label ? t(`admin.pos.ui.table.${label}`) : ""}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-500">{t("admin.pos.ui.loadingReturnHistory")}</td></tr>
              : isError ? <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-rose-600">{t("admin.pos.ui.couldNotLoadReturnHistoryPleaseRetry")}</td></tr>
                : visibleReturns.length ? visibleReturns.map((record) => {
                  const date = record.returned_at ? new Date(record.returned_at) : null;
                  const returnedQuantity = (record.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  const displayId = record._id ? `RET-${String(record._id).slice(-6).toUpperCase()}` : t("admin.pos.ui.return");
                  const expanded = expandedReturnId === record._rowId;
                  return <Fragment key={record._rowId}>
                    <tr className={`border-b border-slate-100 text-xs transition-colors ${expanded ? "bg-amber-50/40" : "hover:bg-blue-50/40"}`}>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><button type="button" aria-label={t(`admin.pos.ui.${expanded ? "hide" : "show"}ReturnDetails`, { id: displayId })} aria-expanded={expanded} onClick={() => setExpandedReturnId(expanded ? null : record._rowId)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${expanded ? "border-amber-200 bg-amber-100 text-amber-700" : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-700"}`}><ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`}/></button><div><strong className="font-mono text-[11px] font-bold text-slate-800">{displayId}</strong><span className="mt-1 block text-[10px] text-slate-400">{t("admin.pos.ui.returnTransaction")}</span></div></div></td>
                      <td className="px-3 py-3"><Link href={`/admin/pos/history/${record._saleId}`} className="font-mono text-[11px] font-bold text-blue-700 hover:text-blue-800">{record._saleNumber}</Link></td>
                      <td className="whitespace-nowrap px-3 py-3"><span className="block font-medium text-slate-700">{date ? date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—"}</span><span className="mt-1 block text-[10px] text-slate-500">{date ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : ""}</span></td>
                      <td className="px-3 py-3"><span className="block max-w-[150px] truncate font-semibold text-slate-800">{record._customer.name || t("admin.pos.ui.walkInCustomer")}</span>{record._customer.phone && <span className="mt-1 block text-[10px] text-slate-500">{record._customer.phone}</span>}</td>
                      <td className="px-3 py-3"><span className="block max-w-[160px] truncate text-slate-600" title={record.reason}>{record.reason || t("common.notProvided")}</span></td>
                      <td className="px-3 py-3"><span className="inline-flex min-w-8 justify-center rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold tabular-nums text-amber-800">{returnedQuantity}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 font-extrabold tabular-nums text-emerald-700">{money(record.refund_total, locale)}</td>
                      <td className="px-3 py-3 text-end"><button type="button" onClick={() => setExpandedReturnId(expanded ? null : record._rowId)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-100 bg-white px-2.5 text-[10px] font-bold text-amber-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50">{t("admin.pos.ui.details")} <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`}/></button></td>
                    </tr>
                    {expanded && <tr key={`${record._rowId}-details`} className="border-b border-slate-100 bg-slate-50/70"><td colSpan={8} className="px-4 py-3 sm:px-12"><div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.8fr)]"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("admin.pos.ui.returnedItemsCount", { count: returnedQuantity })}</p><div className="space-y-1.5">{(record.items || []).map((item, index) => <div key={`${item.variant_id || item.sku || item.product_name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2"><div><p className="text-xs font-semibold text-slate-700">{item.product_name || t("admin.pos.ui.product")}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.variant_title || t("admin.pos.ui.defaultVariant")}{item.sku ? ` · SKU ${item.sku}` : ""}</p></div><span className="text-[11px] text-slate-500">{t("admin.pos.ui.qty")} <strong className="text-slate-700">{item.quantity}</strong></span><strong className="text-xs font-bold text-emerald-700">{money(item.refund_amount, locale)}</strong></div>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("admin.pos.ui.returnSummary")}</p><div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3 text-xs"><div className="flex justify-between gap-3 text-slate-500"><span>{t("admin.pos.ui.originalSaleTotal")}</span><span className="font-semibold text-slate-700">{money(record._saleTotal, locale)}</span></div><div className="flex justify-between gap-3 text-slate-500"><span>{t("admin.pos.ui.originalPayment")}</span><span className="font-semibold capitalize text-slate-700">{paymentLabel(record._salePayment, t)}</span></div><div className="flex justify-between gap-3 text-slate-500"><span>{t("admin.pos.ui.processedBy")}</span><span className="max-w-[140px] truncate font-semibold text-slate-700">{record._cashier}</span></div><div className="border-t border-slate-100 pt-2"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("admin.pos.ui.reason2")}</span><p className="mt-1 leading-5 text-slate-700">{record.reason || t("admin.pos.ui.noReasonRecorded")}</p></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-2 font-extrabold text-slate-900"><span>{t("admin.pos.ui.refundTotal")}</span><span className="text-emerald-700">{money(record.refund_total, locale)}</span></div></div></div></div></td></tr>}
                  </Fragment>;
                }) : <tr><td colSpan={8} className="px-4 py-14 text-center"><span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><History size={18}/></span><span className="block text-sm font-semibold text-slate-700">{t(search || dateRange !== "all" ? "admin.pos.ui.noReturnsMatchFilters" : "admin.pos.ui.noReturnsRecorded")}</span><span className="mt-1 block text-xs text-slate-500">{t(search || dateRange !== "all" ? "admin.pos.ui.tryChangingSearchOrDateRange" : "admin.pos.ui.completedReturnsAppearHere")}</span></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500"><span>{t("admin.pos.ui.showing")} <strong className="font-semibold text-slate-700">{filteredReturns.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filteredReturns.length)}</strong> {t("admin.pos.ui.of")} <strong className="font-semibold text-slate-700">{filteredReturns.length}</strong> {t("admin.pos.ui.returns")}</span><div className="flex items-center gap-1"><button type="button" aria-label={t("admin.pos.ui.previousReturnsPage")} disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15}/></button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((pageNumber) => <button key={pageNumber} type="button" aria-current={pageNumber === page ? "page" : undefined} onClick={() => setPage(pageNumber)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${pageNumber === page ? "bg-blue-600 text-white shadow-sm" : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"}`}>{pageNumber}</button>)}<button type="button" aria-label={t("admin.pos.ui.nextReturnsPage")} disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={15}/></button></div></div>
    </div>
  );
}
