"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const PAGE_SIZE = 20;
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
  const totalRefunded = returnRecords.reduce((sum, record) => sum + (Number(record.refund_total) || 0), 0);
  const visibleReturns = filteredReturns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4 pb-1">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><History size={18} className="text-blue-600"/><div><h2 className="text-lg font-extrabold tracking-tight text-slate-900">{t("admin.pos.ui.recentReturnHistory")}</h2></div></div>
        <span className="text-xs font-medium text-slate-500">{t("admin.pos.ui.returnCount", { count: returnRecords.length })} <span className="px-1 text-slate-300">·</span> {t("admin.pos.ui.refunded")} <strong className="font-semibold text-slate-700">{money(totalRefunded, locale)}</strong></span>
      </header>

      <div className="mb-1 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
        <label className="relative min-w-0"><Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("admin.pos.ui.searchReturnSaleCustomerReasonOrItem")} aria-label={t("admin.pos.ui.searchReturnHistory")} className="h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"/></label>
        <label className="relative"><CalendarDays size={14} className="absolute start-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"/><select value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }} aria-label={t("admin.pos.ui.filterReturnsByDate")} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white ps-9 pe-8 text-xs font-semibold text-slate-600 shadow-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"><option value="all">{t("admin.pos.ui.timeAll")}</option><option value="today">{t("admin.pos.ui.timeToday")}</option><option value="7days">{t("admin.pos.ui.timeLast7Days")}</option><option value="30days">{t("admin.pos.ui.timeLast30Days")}</option></select><ChevronDown size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400"/></label>
        <button type="button" onClick={() => { setSearch(""); setDateRange("all"); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{t("admin.pos.ui.resetFilters")}</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-start">
          <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["return", "originalSale", "date", "customer", "reason", "items", "refund", ""].map((label) => <th key={label} className="px-3 py-3 text-start font-bold">{label ? t(`admin.pos.ui.table.${label}`) : ""}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-500">{t("admin.pos.ui.loadingReturnHistory")}</td></tr>
              : isError ? <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-rose-600">{t("admin.pos.ui.couldNotLoadReturnHistoryPleaseRetry")}</td></tr>
                : visibleReturns.length ? visibleReturns.map((record) => {
                  const date = record.returned_at ? new Date(record.returned_at) : null;
                  const returnedQuantity = (record.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  const displayId = record._id ? `RET-${String(record._id).slice(-6).toUpperCase()}` : t("admin.pos.ui.return");
                  const expanded = expandedReturnId === record._rowId;
                  return <Fragment key={record._rowId}>
                    <tr className={`border-b border-slate-200 text-xs transition-colors ${expanded ? "bg-blue-50/40" : "hover:bg-white/70"}`}>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><button type="button" aria-label={t(`admin.pos.ui.${expanded ? "hide" : "show"}ReturnDetails`, { id: displayId })} aria-expanded={expanded} onClick={() => setExpandedReturnId(expanded ? null : record._rowId)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${expanded ? "border-blue-200 bg-blue-100 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"}`}><ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`}/></button><div><strong className="font-mono text-[11px] font-bold text-slate-800">{displayId}</strong><span className="mt-1 block text-[10px] text-slate-400">{t("admin.pos.ui.returnTransaction")}</span></div></div></td>
                      <td className="px-3 py-3"><Link href={`/admin/pos/history/${record._saleId}`} className="font-mono text-[11px] font-bold text-blue-700 hover:text-blue-800">{record._saleNumber}</Link></td>
                      <td className="whitespace-nowrap px-3 py-3"><span className="block font-medium text-slate-700">{date ? date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—"}</span><span className="mt-1 block text-[10px] text-slate-500">{date ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : ""}</span></td>
                      <td className="px-3 py-3"><span className="block max-w-[150px] truncate font-semibold text-slate-800">{record._customer.name || t("admin.pos.ui.walkInCustomer")}</span>{record._customer.phone && <span className="mt-1 block text-[10px] text-slate-500">{record._customer.phone}</span>}</td>
                      <td className="px-3 py-3"><span className="block max-w-[160px] truncate text-slate-600" title={record.reason}>{record.reason || t("common.notProvided")}</span></td>
                      <td className="px-3 py-3"><span className="text-[11px] font-semibold tabular-nums text-slate-700">{returnedQuantity}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 font-extrabold tabular-nums text-emerald-700">{money(record.refund_total, locale)}</td>
                      <td className="px-3 py-3 text-end"><button type="button" onClick={() => setExpandedReturnId(expanded ? null : record._rowId)} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-50">{t("admin.pos.ui.details")} <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`}/></button></td>
                    </tr>
                    {expanded && <tr key={`${record._rowId}-details`} className="border-b border-slate-200 bg-slate-50/40"><td colSpan={8} className="px-4 py-4 sm:px-6"><div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
                      <section className="min-w-0"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("admin.pos.ui.returnedItemsCount", { count: returnedQuantity })}</h3></div><div className="grid grid-cols-[minmax(0,1fr)_72px_112px] gap-3 border-b border-slate-200 px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-400"><span>{t("admin.pos.ui.product")}</span><span className="text-end">{t("admin.pos.ui.qty")}</span><span className="text-end">{t("admin.pos.ui.refundAmount")}</span></div><div>{(record.items || []).map((item, index) => <div key={`${item.variant_id || item.sku || item.product_name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_72px_112px] items-center gap-3 border-b border-slate-100 px-2 py-2.5 last:border-0"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{item.product_name || t("admin.pos.ui.product")}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{item.variant_title || t("admin.pos.ui.defaultVariant")}{item.sku ? ` · SKU ${item.sku}` : ""}</p></div><span className="text-end text-xs font-semibold tabular-nums text-slate-700">{item.quantity}</span><strong className="text-end text-xs font-bold tabular-nums text-emerald-700">{money(item.refund_amount, locale)}</strong></div>)}</div></section>
                      <aside className="min-w-0 border-t border-slate-200 pt-3 md:border-s md:border-t-0 md:ps-5 md:pt-0"><h3 className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("admin.pos.ui.returnSummary")}</h3><dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 text-xs"><dt className="text-slate-500">{t("admin.pos.ui.originalSaleTotal")}</dt><dd className="text-end font-semibold tabular-nums text-slate-800">{money(record._saleTotal, locale)}</dd><dt className="text-slate-500">{t("admin.pos.ui.originalPayment")}</dt><dd className="text-end font-semibold capitalize text-slate-800">{paymentLabel(record._salePayment, t)}</dd><dt className="text-slate-500">{t("admin.pos.ui.processedBy")}</dt><dd className="max-w-[150px] truncate text-end font-semibold text-slate-800">{record._cashier}</dd></dl><div className="mt-3 border-t border-slate-200 pt-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{t("admin.pos.ui.reason2")}</p><p className="mt-1 break-words text-xs leading-5 text-slate-700">{record.reason || t("admin.pos.ui.noReasonRecorded")}</p></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs font-extrabold text-slate-900"><span>{t("admin.pos.ui.refundTotal")}</span><span className="whitespace-nowrap text-emerald-700">{money(record.refund_total, locale)}</span></div></aside>
                    </div></td></tr>}
                  </Fragment>;
                }) : <tr><td colSpan={8} className="px-4 py-14 text-center"><span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><History size={18}/></span><span className="block text-sm font-semibold text-slate-700">{t(search || dateRange !== "all" ? "admin.pos.ui.noReturnsMatchFilters" : "admin.pos.ui.noReturnsRecorded")}</span><span className="mt-1 block text-xs text-slate-500">{t(search || dateRange !== "all" ? "admin.pos.ui.tryChangingSearchOrDateRange" : "admin.pos.ui.completedReturnsAppearHere")}</span></td></tr>}
          </tbody>
        </table>
      </div>

      {filteredReturns.length > PAGE_SIZE && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500"><span>{t("admin.pos.ui.showing")} <strong className="font-semibold text-slate-700">{filteredReturns.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filteredReturns.length)}</strong> {t("admin.pos.ui.of")} <strong className="font-semibold text-slate-700">{filteredReturns.length}</strong> {t("admin.pos.ui.returns")}</span><div className="flex items-center gap-1"><button type="button" aria-label={t("admin.pos.ui.previousReturnsPage")} disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15}/></button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((pageNumber) => <button key={pageNumber} type="button" aria-current={pageNumber === page ? "page" : undefined} onClick={() => setPage(pageNumber)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${pageNumber === page ? "bg-blue-600 text-white shadow-sm" : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"}`}>{pageNumber}</button>)}<button type="button" aria-label={t("admin.pos.ui.nextReturnsPage")} disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={15}/></button></div></div>}
    </div>
  );
}
