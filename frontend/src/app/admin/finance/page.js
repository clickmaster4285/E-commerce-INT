"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays, CheckCircle2,
  Clock3, CreditCard, DollarSign, FileText, HandCoins, History,
  LoaderCircle, Package, Search, ShoppingBag, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { financeApi } from "@/apis/admin/financeApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";

const periods = [
  { value: "today", key: "admin.finance.today" },
  { value: "yesterday", key: "admin.finance.yesterday" },
  { value: "7d", key: "admin.finance.last7Days" },
  { value: "30d", key: "admin.finance.last30Days" },
  { value: "month", key: "admin.finance.thisMonth" },
  { value: "lastMonth", key: "admin.finance.lastMonth" },
  { value: "year", key: "admin.finance.thisYear" },
  { value: "custom", key: "admin.finance.customRange" },
  { value: "all", key: "admin.finance.all" },
];

const categoryIcons = {
  "Invoice payment": FileText,
  "Invoice refund": ArrowDownLeft,
  "POS sale": ShoppingBag,
  "POS refund": ArrowDownLeft,
  "Online order payment": CreditCard,
  "Vendor payment": Package,
};

const categoryKeys = {
  "Invoice payment": "admin.finance.category.invoicePayment",
  "Invoice refund": "admin.finance.category.invoiceRefund",
  "POS sale": "admin.finance.category.posSale",
  "POS refund": "admin.finance.category.posRefund",
  "Online order payment": "admin.finance.category.onlineOrderPayment",
  "Vendor payment": "admin.finance.category.vendorPayment",
};

const titleKeys = {
  "Customer refund": "admin.finance.title.invoiceRefund",
  "Invoice payment received": "admin.finance.title.invoicePayment",
  "Recorded invoice payment": "admin.finance.title.recordedInvoicePayment",
  "POS sale": "admin.finance.title.posSale",
  "POS refund": "admin.finance.title.posRefund",
  "Online order payment": "admin.finance.title.onlineOrderPayment",
  "Purchase order payment": "admin.finance.title.purchaseOrderPayment",
  "Recorded purchase payment": "admin.finance.title.recordedPurchasePayment",
};

const historyTitleKeys = {
  "Invoice created": "admin.finance.history.invoiceCreated",
  "Payment recorded": "admin.finance.history.paymentRecorded",
  "Return processed": "admin.finance.history.returnProcessed",
  "Invoice sent": "admin.finance.history.invoiceSent",
  "Invoice updated": "admin.finance.history.invoiceUpdated",
  "POS sale completed": "admin.finance.history.posSaleCompleted",
  "POS sale edited": "admin.finance.history.posSaleEdited",
  "POS refund processed": "admin.finance.history.posRefundProcessed",
  "Online payment marked paid": "admin.finance.history.onlinePaymentMarkedPaid",
  "Purchase order created": "admin.finance.history.purchaseOrderCreated",
  "Purchase order updated": "admin.finance.history.purchaseOrderUpdated",
  "Items received": "admin.finance.history.itemsReceived",
  "Purchase items received": "admin.finance.history.purchaseItemsReceived",
  "Vendor payment recorded": "admin.finance.history.vendorPaymentRecorded",
  "Recorded purchase payment": "admin.finance.history.recordedPurchasePayment",
};

const statusKeys = {
  paid: "admin.shared.status.paid",
  unpaid: "admin.shared.status.unpaid",
  "partially paid": "admin.shared.status.partiallyPaid",
};

const methodKeys = {
  cash: "admin.finance.method.cash",
  bank: "admin.finance.method.bank",
  "bank transfer": "admin.finance.method.bankTransfer",
  card: "admin.finance.method.card",
  "mobile wallet": "admin.finance.method.mobileWallet",
};

const translated = (t, map, value) => map[value] ? t(map[value]) : (value || t("admin.finance.notRecorded"));
const translatedMethod = (t, value) => {
  const key = methodKeys[String(value || "").trim().toLowerCase()];
  return key ? t(key) : (value || t("admin.finance.notRecorded"));
};

const localeTag = (locale = "en") => `${locale}-${locale === "zh" ? "CN" : "PK"}`;

const formatCurrency = (amount, locale = "en") => new Intl.NumberFormat(localeTag(locale), {
  style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(amount) || 0);

const formatDateTime = (value, locale = "en", t = (key) => key) => {
  if (!value) return t("admin.finance.dateNotRecorded");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("admin.finance.dateNotRecorded");
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
};

const collapseRepeatedLabel = (value) => {
  const text = String(value || "").trim();
  for (let length = Math.floor(text.length / 2); length > 0; length -= 1) {
    if (text.length % length !== 0) continue;
    const part = text.slice(0, length);
    if (part.repeat(text.length / length) === text) return part.trim();
  }
  return text;
};

const financeItemLabel = (item, t) => {
  const rawName = String(item.name || item.product_name || item.title || t("admin.finance.item")).trim();
  const [rawProductName, ...inlineVariantParts] = rawName.split(/\s+\/\s+/);
  const productName = collapseRepeatedLabel(rawProductName);
  const inlineVariant = inlineVariantParts.join(" / ").trim();
  const explicitVariant = String(item.variant_name || item.variant_title || item.variantTitle || "").trim();
  const variant = explicitVariant || inlineVariant;
  return {
    title: [productName, variant].filter(Boolean).join(" / "),
    metadata: [item.sku, explicitVariant && !inlineVariant ? explicitVariant : ""].filter(Boolean),
  };
};

const todayAsInputDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function SummaryCard({ title, value, note, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  };
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{title}</p>
          <p className="mt-2 truncate text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{note}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
    </article>
  );
}

function FinanceDrawer({ transaction, onClose, locale, t }) {
  useEffect(() => {
    if (!transaction) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [transaction, onClose]);
  if (!transaction) return null;
  const Icon = categoryIcons[transaction.category] || Banknote;
  const isIncome = transaction.amount >= 0;
  const source = transaction.source || {};
  const history = transaction.history || [];
  const description = String(transaction.description || "").trim();
  const showDescription = description && !/^\d+$/.test(description);
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="finance-drawer-title" className="flex h-full w-full max-w-xl flex-col border-s border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isIncome ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">{translated(t, categoryKeys, transaction.category)}</p>
              <h2 id="finance-drawer-title" className="mt-1 truncate text-lg font-semibold text-[var(--text-primary)]">{transaction.reference}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("admin.finance.closeDetails")} className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-muted)]">{translated(t, titleKeys, transaction.title)}</p>
                <p className={`mt-1 text-3xl font-semibold ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{isIncome ? "+" : "−"}{formatCurrency(Math.abs(transaction.amount), locale)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isIncome ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"}`}>{statusKeys[String(transaction.status || "").toLowerCase()] ? t(statusKeys[String(transaction.status).toLowerCase()]) : transaction.status}</span>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t("admin.finance.transactionDetails")}</h3>
            <div className="grid grid-cols-2 gap-3 text-start">
              {[
                [t("admin.finance.customerVendor"), transaction.counterparty],
                [t("admin.finance.paymentMethod"), translatedMethod(t, transaction.method)],
                [t("admin.finance.dateTime"), formatDateTime(transaction.date, locale, t)],
                [t("admin.finance.recordType"), translated(t, categoryKeys, transaction.category)],
                ...(source.cashier ? [[t("admin.finance.recordedBy"), source.cashier]] : []),
                ...(source.vendor?.email ? [[t("admin.finance.vendorEmail"), source.vendor.email]] : []),
                ...(source.customerEmail ? [[t("admin.finance.customerEmail"), source.customerEmail]] : []),
                ...(source.customerPhone ? [[t("admin.finance.phone"), source.customerPhone]] : []),
                ...(source.balance != null ? [[t("admin.finance.invoiceBalance"), formatCurrency(source.balance, locale)]] : []),
                ...(source.dueAmount != null ? [[t("admin.finance.vendorBalance"), formatCurrency(source.dueAmount, locale)]] : []),
                ...(source.historicalRecord ? [[t("admin.finance.historyNote"), t("admin.finance.historicalRecordText")]] : []),
              ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 py-3"><p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-sm leading-5 text-[var(--text-primary)]">{value || t("admin.finance.notRecorded")}</p></div>)}
            </div>
            {showDescription && <p className="mt-3 text-start text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
          </section>

          {!!transaction.items?.length && <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><ShoppingBag className="h-4 w-4 text-[var(--accent)]" />{t("admin.finance.itemsOnRecord")}</h3>
            <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
              {transaction.items.map((item, index) => { const label = financeItemLabel(item, t); return <div key={`${item._id || item.product_id || item.name || item.product_name || index}-${index}`} className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-3.5 py-3 last:border-0">
                <div className="min-w-0 flex-1"><p className="break-words text-sm leading-5 text-[var(--text-primary)]">{label.title}</p><p className="mt-1 flex flex-wrap gap-x-1.5 text-xs leading-4 text-[var(--text-muted)]">{label.metadata.length ? label.metadata.map((value, metadataIndex) => <span key={`${value}-${metadataIndex}`}>{metadataIndex > 0 && <span className="me-1.5">·</span>}{value}</span>) : t("admin.finance.noSku")}</p></div>
                <p className="shrink-0 text-sm text-[var(--text-secondary)]">×{item.quantity || item.qty || item.qty_ordered || 1}</p>
              </div>; })}
            </div>
          </section>}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><History className="h-4 w-4 text-[var(--accent)]" />{t("admin.finance.history")}</h3>
            {history.length ? <ol className="space-y-0">
              {history.map((event, index) => <li key={`${event.type}-${event.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                {index < history.length - 1 && <span className="absolute start-[9px] top-5 h-[calc(100%-8px)] w-px bg-[var(--border-color)]" />}
                <span className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${event.type === "payment" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : event.type === "return" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}><CheckCircle2 className="h-3 w-3" /></span>
                <div className="min-w-0 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 py-3.5 text-start">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="text-sm font-medium leading-5 text-[var(--text-primary)]">{translated(t, historyTitleKeys, event.title)}</p><time className="text-xs leading-5 text-[var(--text-muted)]">{formatDateTime(event.at, locale, t)}</time></div>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--text-muted)]">{t("admin.finance.by", { actor: event.actor || t("admin.finance.notRecorded") })}</p>
                  {event.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">{event.description}</p>}
                </div>
              </li>)}
            </ol> : <div className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-5 text-center text-sm text-[var(--text-muted)]"><Clock3 className="mx-auto mb-2 h-5 w-5" />{t("admin.finance.noDetailedActivity")}</div>}
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function FinancePage() {
  const { locale = "en", t } = useTranslation();
  const [period, setPeriod] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-finance-overview", period, startDate, endDate, search, kind, page],
    queryFn: () => financeApi.getOverview({ period, startDate, endDate, search, kind, page }),
    staleTime: 30_000,
  });
  const summary = data?.summary || {};
  const transactions = useMemo(() => data?.transactions || [], [data?.transactions]);
  const pagination = data?.pagination || { page: 1, pageSize: 20, total: 0, pages: 1 };
  const changePeriod = (value) => {
    setPeriod(value);
    setPage(1);
    if (value === "custom" && (!startDate || !endDate)) {
      const today = todayAsInputDate();
      setStartDate(today);
      setEndDate(today);
    }
  };

  return (
    <div className="min-h-full w-full min-w-0 space-y-5 pb-8">
      <AdminPageHeader className="min-w-0" title={t("admin.finance.title")} subtitle={t("admin.finance.intro")} actions={<div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <label className="flex min-w-[180px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-muted)]"><CalendarDays className="h-4 w-4 shrink-0" /><select aria-label={t("admin.finance.date")} value={period} onChange={(event) => changePeriod(event.target.value)} className="w-full bg-transparent font-semibold text-[var(--text-primary)] outline-none">{periods.map((option) => <option key={option.value} value={option.value} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">{t(option.key)}</option>)}</select></label>
          {period === "custom" && <div className="flex flex-wrap justify-end gap-2"><label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]"><span>{t("admin.finance.from")}</span><input aria-label={t("admin.finance.from")} type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="bg-transparent text-sm text-[var(--text-primary)] outline-none" /></label><label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]"><span>{t("admin.finance.to")}</span><input aria-label={t("admin.finance.to")} type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="bg-transparent text-sm text-[var(--text-primary)] outline-none" /></label></div>}
        </div>} />

      {isError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><p className="font-semibold">{t("admin.finance.loadError")}</p><p className="mt-1">{t("admin.finance.accessError")}</p><button type="button" onClick={() => refetch()} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white">{t("admin.finance.tryAgain")}</button></section> : <>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard title={t("admin.finance.moneyIn")} value={isLoading ? "—" : formatCurrency(summary.income, locale)} note={t("admin.finance.recordedMovements", { count: summary.transactionCount ?? 0 })} icon={TrendingUp} tone="green" />
          <SummaryCard title={t("admin.finance.moneyOut")} value={isLoading ? "—" : formatCurrency(summary.expenses, locale)} note={t("admin.finance.vendorPaymentsRefunds")} icon={TrendingDown} tone="red" />
          <SummaryCard title={t("admin.finance.netCashFlow")} value={isLoading ? "—" : formatCurrency(summary.net, locale)} note={t("admin.finance.moneyInMinusOut")} icon={DollarSign} tone={Number(summary.net) >= 0 ? "blue" : "red"} />
          <SummaryCard title={t("admin.finance.toCollect")} value={isLoading ? "—" : formatCurrency(summary.receivable, locale)} note={t("admin.finance.openInvoiceBalances")} icon={HandCoins} tone="amber" />
          <SummaryCard title={t("admin.finance.toPay")} value={isLoading ? "—" : formatCurrency(summary.payable, locale)} note={t("admin.finance.purchaseOrderBalances")} icon={ArrowUpRight} tone="violet" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border-color)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-base font-semibold text-[var(--text-primary)]">{t("admin.finance.cashFlowHistory")}</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("admin.finance.entryHint")}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("admin.finance.searchPlaceholder")} className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] ps-9 pe-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]" /></label>
              <select aria-label={t("admin.finance.transaction")} value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"><option value="all">{t("admin.finance.allActivity")}</option><option value="income">{t("admin.finance.moneyIn")}</option><option value="expense">{t("admin.finance.moneyOut")}</option></select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-start">
              <thead className="bg-[var(--bg-secondary)]"><tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]"><th scope="col" className="px-4 py-3 text-start">{t("admin.finance.transaction")}</th><th scope="col" className="px-4 py-3 text-start">{t("admin.finance.customerVendor")}</th><th scope="col" className="px-4 py-3 text-start">{t("admin.finance.date")}</th><th scope="col" className="px-4 py-3 text-start">{t("admin.finance.method")}</th><th scope="col" className="px-4 py-3 text-end">{t("admin.finance.amount")}</th><th scope="col" className="px-4 py-3 text-end">{t("admin.finance.history")}</th></tr></thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {isLoading ? <tr><td colSpan={6} className="px-4 py-16 text-center text-sm text-[var(--text-muted)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />{t("admin.finance.loadingRecords")}</td></tr> : transactions.length ? transactions.map((entry) => {
                  const Icon = categoryIcons[entry.category] || Banknote;
                  return <tr key={entry.id} onClick={() => setSelected(entry)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(entry); } }} className="cursor-pointer transition hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none">
                    <td className="px-4 py-3.5"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${entry.kind === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"}`}><Icon className="h-4 w-4" /></span><div><p className="text-sm font-medium text-[var(--text-primary)]">{translated(t, titleKeys, entry.title)}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{entry.reference} · {translated(t, categoryKeys, entry.category)}</p></div></div></td>
                    <td className="px-4 py-3.5 text-start text-sm text-[var(--text-primary)]">{entry.counterparty}</td>
                    <td className="px-4 py-3.5 text-start text-sm text-[var(--text-secondary)]">{formatDateTime(entry.date, locale, t)}</td>
                    <td className="px-4 py-3.5 text-start"><span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--text-secondary)]">{translatedMethod(t, entry.method)}</span></td>
                    <td className={`px-4 py-3.5 text-end text-sm font-semibold ${entry.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{entry.amount >= 0 ? "+" : "−"}{formatCurrency(Math.abs(entry.amount), locale)}</td>
                    <td className="px-4 py-3.5 text-end"><span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"><History className="h-3.5 w-3.5" />{entry.history?.length || 0}</span></td>
                  </tr>;
                }) : <tr><td colSpan={6} className="px-4 py-16 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--text-muted)]"><Banknote className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{t("admin.finance.noActivityFound")}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{t("admin.finance.noActivityHint")}</p></td></tr>}
              </tbody>
            </table>
          </div>
          {!isLoading && pagination.total > pagination.pageSize && <div className="flex flex-col gap-3 border-t border-[var(--border-color)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[var(--text-muted)]">{t("admin.finance.showingTransactions", { from: (pagination.page - 1) * pagination.pageSize + 1, to: Math.min(pagination.page * pagination.pageSize, pagination.total), total: pagination.total })}</p><div className="flex items-center justify-end gap-2"><button type="button" disabled={pagination.page <= 1 || isFetching} onClick={() => setPage(1)} className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40">{t("admin.finance.first")}</button><button type="button" disabled={pagination.page <= 1 || isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40">{t("admin.finance.previous")}</button><span className="min-w-[76px] text-center text-xs font-semibold text-[var(--text-primary)]">{t("admin.finance.pageOf", { page: pagination.page, pages: pagination.pages })}</span><button type="button" disabled={pagination.page >= pagination.pages || isFetching} onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40">{t("admin.finance.next")}</button><button type="button" disabled={pagination.page >= pagination.pages || isFetching} onClick={() => setPage(pagination.pages)} className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40">{t("admin.finance.last")}</button></div></div>}
          {isFetching && !isLoading && <div className="h-0.5 w-full overflow-hidden bg-[var(--bg-secondary)]"><div className="h-full w-1/3 animate-pulse bg-[var(--accent)]" /></div>}
        </section>
      </>}
      <FinanceDrawer transaction={selected} onClose={() => setSelected(null)} locale={locale} t={t} />
    </div>
  );
}
