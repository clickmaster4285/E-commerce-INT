"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { imageUrl } from "@/utils/homeCatalog";
import { ChevronDown, ClipboardList, CreditCard, RotateCcw, Search, X } from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LanguageProvider";
import PosReturnHistoryPanel from "./PosReturnHistoryPanel";

const money = (value, locale) => `Rs. ${(Number(value) || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}`;
const paymentLabel = (method, t) => {
  const normalized = String(method || "cash").toLowerCase();
  const key = { cash: "cash", card: "card", bank_transfer: "bankTransfer" }[normalized];
  return key ? t(`admin.pos.payment.${key}`) : normalized.replaceAll("_", " ");
};
const getLineRefund = (sale, item, quantity) => {
  const itemQuantity = Number(item.quantity) || 0;
  if (!itemQuantity || !quantity) return 0;
  const grossTotal = (sale.items || []).reduce((sum, line) => sum + (Number(line.line_total) || 0) * (1 + (Number(line.tax_rate) || 0) / 100), 0);
  const itemDiscounts = (sale.items || []).reduce((sum, line) => sum + (Number(line.discount_amount) || 0), 0);
  const saleWideDiscount = Math.max(0, (Number(sale.discount_amount) || 0) - itemDiscounts);
  const lineGross = (Number(item.line_total) || 0) * (1 + (Number(item.tax_rate) || 0) / 100);
  const allocatedDiscount = grossTotal > 0 ? saleWideDiscount * lineGross / grossTotal : 0;
  return Math.round(Math.max(0, lineGross - allocatedDiscount) / itemQuantity * quantity);
};

function SalePicker({ sales, value, onChange }) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const selectedSale = sales.find((sale) => sale._id === value);
  const filteredSales = sales.filter((sale) => {
    const haystack = [sale.sale_number, sale.customer_snapshot?.name, sale.customer_snapshot?.phone, sale.payment?.method, sale.total, sale.created_at && new Date(sale.created_at).toLocaleDateString(locale)].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const outsideClick = (event) => { if (!wrapperRef.current?.contains(event.target)) setOpen(false); };
    const escapeKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outsideClick);
    document.addEventListener("keydown", escapeKey);
    return () => {
      document.removeEventListener("mousedown", outsideClick);
      document.removeEventListener("keydown", escapeKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-2 block text-xs font-semibold text-slate-700">{t("admin.pos.ui.originalSale")}</label>
      <div className={`flex h-12 w-full items-center gap-2 rounded-xl border bg-white px-3 transition ${open ? "border-blue-400 ring-2 ring-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
        <Search size={16} className="shrink-0 text-slate-400" />
        <input ref={searchRef} role="combobox" aria-label={t("admin.pos.ui.searchAndSelectOriginalSale")} aria-haspopup="listbox" aria-expanded={open} aria-controls="pos-return-sale-options" value={open ? search : selectedSale ? `${selectedSale.sale_number} · ${selectedSale.customer_snapshot?.name || t("admin.pos.ui.walkInCustomer")}` : ""} onFocus={() => { if (!open) { setSearch(""); setOpen(true); } }} onClick={() => { if (!open) { setSearch(""); setOpen(true); } }} onChange={(event) => { setSearch(event.target.value); if (!open) setOpen(true); }} onKeyDown={(event) => { if (event.key === "ArrowDown" && !open) { setSearch(""); setOpen(true); } }} placeholder={t("admin.pos.ui.searchSaleNumberCustomerPhoneDateOrAmount")} className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400" />
        {selectedSale && <button type="button" aria-label="Clear selected sale" title="Clear selected sale" onClick={() => { onChange(""); setSearch(""); setOpen(false); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={15}/></button>}
        <button type="button" aria-label={t("admin.pos.ui.searchAndSelectOriginalSale")} aria-haspopup="listbox" aria-expanded={open} onClick={() => { if (open) setOpen(false); else { setSearch(""); setOpen(true); } searchRef.current?.focus(); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`}/></button>
      </div>
      {open && <div className="absolute start-0 end-0 z-[90] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5">
        <div id="pos-return-sale-options" role="listbox" aria-label={t("admin.pos.ui.completedPOSSales")} className="max-h-80 space-y-1 overflow-y-auto">{filteredSales.length ? filteredSales.map((sale) => {
          const selected = sale._id === value;
          const itemCount = (sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          const returnedCount = (sale.returns || []).flatMap((entry) => entry.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          return <button key={sale._id} type="button" role="option" aria-selected={selected} onClick={() => { onChange(sale._id); setOpen(false); setSearch(""); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition ${selected ? "border-blue-100 bg-blue-50" : "border-transparent hover:border-slate-100 hover:bg-slate-50"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><ClipboardList size={17}/></span>
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2"><strong className="text-sm font-extrabold text-slate-800">{sale.sale_number}</strong><span className="truncate text-xs text-slate-600">{sale.customer_snapshot?.name || t("admin.pos.ui.walkInCustomer")}</span></span><span className="mt-1 block truncate text-[10px] text-slate-400">{sale.created_at ? new Date(sale.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("admin.pos.ui.dateUnavailable")} · {paymentLabel(sale.payment?.method, t)} · {returnedCount}/{itemCount} {t("admin.pos.ui.returned")}</span></span>
            <span className="shrink-0 text-end"><strong className="block text-sm font-extrabold tabular-nums text-slate-800">{money(sale.total, locale)}</strong><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{t("admin.pos.ui.originalTotal")}</span></span>
          </button>;
        }) : <div className="px-3 py-9 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Search size={16}/></span><p className="mt-2 text-sm font-bold text-slate-700">{t("admin.pos.ui.noMatchingSales")}</p><p className="mt-1 text-xs text-slate-400">{t("admin.pos.ui.tryAnotherReceiptNumberCustomerNamePhoneDateOrAmount")}</p></div>}</div>
        <div className="mt-2 border-t border-slate-100 px-2 pt-2 text-[10px] text-slate-400">{t("admin.pos.ui.completedSalesAvailable", { count: filteredSales.length })}</div>
      </div>}
    </div>
  );
}

export default function PosReturnPanel({ sales, selectedSale, returnSaleId, setReturnSaleId, returnQuantities, setReturnQuantities, returnNote, setReturnNote, returnMutation, historySales, historyLoading, historyError }) {
  const { t, locale } = useTranslation();
  const [reasonError, setReasonError] = useState(false);
  const reasonInputRef = useRef(null);
  const previousRefund = (selectedSale?.returns || []).reduce((sum, entry) => sum + (Number(entry.refund_total) || 0), 0);
  const priorQuantity = (selectedSale?.returns || []).flatMap((entry) => entry.items || []).reduce((result, item) => {
    const id = String(item.variant_id);
    result[id] = (result[id] || 0) + (Number(item.quantity) || 0);
    return result;
  }, {});
  const chosenItems = (selectedSale?.items || []).map((item) => {
    const id = String(item.variant_id?._id || item.variant_id);
    const available = Math.max(0, (Number(item.quantity) || 0) - (priorQuantity[id] || 0));
    const quantity = Math.max(0, Math.min(available, Number(returnQuantities[id]) || 0));
    return { item, id, available, quantity, refund: getLineRefund(selectedSale, item, quantity) };
  });
  const selectedCount = chosenItems.reduce((sum, row) => sum + row.quantity, 0);
  const refundTotal = chosenItems.reduce((sum, row) => sum + row.refund, 0);
  const returnedCount = Object.values(priorQuantity).reduce((sum, quantity) => sum + quantity, 0);
  const totalCount = (selectedSale?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div className="space-y-4 pb-1">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 shadow-sm dark:border-slate-700 dark:bg-[var(--bg-card)]"><RotateCcw size={18}/></span><div><h2 className="text-base font-bold leading-5 text-slate-900 dark:text-slate-100">{t("admin.pos.ui.processAReturn")}</h2><p className="mt-1 text-xs leading-4 text-slate-500">{t("admin.pos.ui.findTheReceiptChooseItemsAndConfirmTheRefund")}</p></div></div>
      </header>

      <div className="space-y-4">
        <SalePicker sales={sales} value={returnSaleId} onChange={(id) => { setReturnSaleId(id); setReturnQuantities({}); setReasonError(false); }}/>
        {!selectedSale ? <PosReturnHistoryPanel sales={historySales || []} isLoading={historyLoading} isError={historyError} /> : <div className="space-y-4 bg-white dark:bg-[var(--bg-card)]">
          <div className="grid gap-x-8 gap-y-4 border-b border-slate-200 px-4 pb-4 pt-3 sm:grid-cols-2 xl:grid-cols-4">{[
            ["receipt", selectedSale.sale_number, ClipboardList],
            ["customer", selectedSale.customer_snapshot?.name || t("admin.pos.ui.walkInCustomer"), null],
            ["purchased", selectedSale.created_at ? new Date(selectedSale.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("admin.pos.ui.dateUnavailable"), null],
            ["originalTotal", money(selectedSale.total), CreditCard],
          ].map(([label, value, Icon]) => <div key={label} className="min-w-0"><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{Icon && <Icon size={12} />}{t(({ receipt: "admin.pos.receipt.receipt", customer: "admin.pos.ui.customer", purchased: "admin.pos.ui.saleDate", originalTotal: "admin.pos.ui.originalTotal" })[label])}</span><strong className="mt-2 block truncate text-xs font-bold text-slate-800">{value}</strong>{label === "customer" && <span className="mt-1.5 block truncate text-[10px] text-slate-400">{selectedSale.customer_snapshot?.phone || t("admin.pos.ui.noPhoneOnReceipt")}</span>}{label === "originalTotal" && <span className="mt-1.5 block text-[10px] capitalize text-slate-400">{paymentLabel(selectedSale.payment?.method, t)} · {selectedSale.cashier_name || t("admin.pos.ui.posCashier")}</span>}</div>)}</div>

          <section className="overflow-hidden border-y border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:px-4"><div><h3 className="text-sm font-extrabold text-slate-900">{t("admin.pos.ui.itemsOnThisReceipt")}</h3><p className="mt-0.5 text-[10px] text-slate-500">{t("admin.pos.ui.selectWholeItemQuantitiesToReturn")}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{totalCount - returnedCount} {t("admin.pos.ui.of")} {totalCount} {t("admin.pos.ui.itemsReturnable")}</span></div>
            <div className="space-y-2 p-2.5 sm:p-3">{chosenItems.map(({ item, id, available, quantity, refund }) => <article key={id} className={`grid items-center gap-3 border-b border-slate-100 px-1 py-3 transition last:border-0 ${quantity ? "bg-emerald-50/30" : "hover:bg-slate-50/60"} sm:grid-cols-[minmax(0,1fr)_115px_140px]`}>
              <div className="flex min-w-0 items-center gap-3"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50"><FallbackImage nextImage src={imageUrl(item.product_image || item.variant_id?.images?.[0]?.img_url)} alt={item.product_name || t("admin.pos.ui.product")} fill unoptimized sizes="48px" className="object-cover"/></span><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{item.product_name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{item.variant_title || t("admin.pos.ui.defaultVariant")}{item.sku ? ` · SKU ${item.sku}` : ""}</p><p className="mt-1 text-[10px] text-slate-400">{t("admin.pos.ui.sold")} {item.quantity} {t("admin.pos.ui.returned2")} {priorQuantity[id] || 0} · <strong className="text-slate-600">{available} {t("admin.pos.ui.left")}</strong></p></div></div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{t("admin.pos.ui.returnQuantity")}<input aria-label={t("admin.pos.ui.returnQuantityForProduct", { product: item.product_name })} type="number" min="0" max={available} step="1" placeholder="0" disabled={!available} value={returnQuantities[id] ?? ""} onChange={(event) => { const raw = event.target.value; const quantityValue = raw === "" ? "" : String(Math.min(available, Math.max(0, Math.floor(Number(raw) || 0)))); setReturnQuantities((current) => ({ ...current, [id]: quantityValue })); }} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-extrabold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"/></label>
              <div className="text-end"><span className={`block text-[9px] font-bold uppercase tracking-wider ${quantity ? "text-emerald-700" : "text-slate-400"}`}>{t("admin.pos.ui.refundAmount")}</span><strong className={`mt-0.5 block text-sm font-black tabular-nums ${quantity ? "text-emerald-800" : "text-slate-500"}`}>{money(refund, locale)}</strong><span className="text-[9px] text-slate-400">{money(getLineRefund(selectedSale, item, 1), locale)} {t("admin.pos.ui.unitApprox")}</span></div>
            </article>)}</div>
          </section>


          <div className={`grid items-start gap-x-4 gap-y-3 border-t border-slate-200 px-4 pt-4 transition-[grid-template-columns] duration-200 ease-out ${reasonError ? "md:grid-cols-[minmax(0,1fr)_minmax(160px,220px)]" : "md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.9fr)_minmax(138px,auto)]"}`}>
            <label className={`min-w-0 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all duration-200 ${reasonError ? "md:col-span-2" : ""}`}>{t("admin.pos.ui.reason2")} <span className="text-rose-500">*</span><input ref={reasonInputRef} required maxLength={300} aria-invalid={reasonError} aria-describedby={reasonError ? "pos-return-reason-error" : undefined} value={returnNote} onChange={(event) => { setReturnNote(event.target.value); if (event.target.value.trim()) setReasonError(false); }} placeholder={t("admin.pos.ui.eGDamagedItemWrongSize")} className={`mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-400 focus:ring-4 ${reasonError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-400 focus:ring-blue-50"}`}/>{reasonError ? <span id="pos-return-reason-error" role="alert" className="mt-1 block text-[10px] font-medium normal-case tracking-normal text-rose-600">{t("admin.pos.validation.returnReasonRequired")}</span> : <span className="mt-1 block text-[9px] font-normal normal-case tracking-normal text-slate-400">{returnNote.trim().length}{t("admin.pos.ui.300Characters")}</span>}</label>
            <div className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t("admin.pos.ui.refundSummary")}</span><div className="flex h-11 items-center justify-between gap-2 border-b border-slate-200 px-1"><span className="min-w-0 truncate text-[10px] font-semibold text-emerald-800">{t("admin.pos.ui.selectedItemCount", { count: selectedCount })}<span className="mx-1 text-emerald-300">·</span>{t("admin.pos.ui.prev")} {money(previousRefund, locale)}</span><strong className="shrink-0 text-base font-black tabular-nums tracking-tight text-emerald-800">{money(refundTotal, locale)}</strong></div></div>
            <div><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-transparent" aria-hidden="true">{t("admin.pos.ui.action")}</span><button type="button" disabled={!selectedSale || selectedCount === 0 || refundTotal <= 0 || returnMutation.isPending} onClick={() => { if (!returnNote.trim()) { setReasonError(true); reasonInputRef.current?.focus(); return; } setReasonError(false); returnMutation.mutate(); }} className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white shadow-md shadow-blue-600/15 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45">{returnMutation.isPending ? <><RotateCcw size={14} className="animate-spin"/>{t("admin.pos.ui.recording")}</> : <><RotateCcw size={14}/>{t("admin.pos.ui.confirmReturn")}</>}</button></div>
          </div>
        </div>}
      </div>
    </div>
  );
}
