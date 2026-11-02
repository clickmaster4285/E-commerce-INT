"use client";

import { FileText } from "lucide-react";

/** Shared calculation summary used by Quotes and Invoices. */
export default function CalculationSummaryCard({
  itemCount,
  documentLabel = "quote",
  totals,
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
  taxRate,
  onTaxRateChange,
  money,
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.045)] bg-gradient-to-br from-white via-white to-blue-50/40">
      <div className="flex items-center gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.24)]"><FileText size={16}/></span>
        <div className="min-w-0"><h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">Calculation Summary</h2><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{itemCount} {itemCount === 1 ? "item" : "items"} included in this {documentLabel}</p></div>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_58px_86px] items-center gap-1.5"><span className="text-[10px] font-medium text-[var(--text-secondary)]">Subtotal</span><span className="col-span-2 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">{money(totals.subtotal)}</span></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor={`${documentLabel}-overall-discount`} className="text-[11px] font-bold text-[var(--text-secondary)]">Discount</label><span className="text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">− {money(totals.overallDiscount)}</span></div>
          <div className="flex items-center gap-2">
            <div className="inline-flex shrink-0 rounded-lg border border-[var(--border-color)] bg-white p-0.5" role="group" aria-label="Discount type">
              <button type="button" aria-pressed={discountType === "percent"} onClick={() => onDiscountTypeChange("percent")} className={`h-7 rounded-md px-2.5 text-[10px] font-semibold transition ${discountType === "percent" ? "bg-blue-600 text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-slate-100"}`}>Percent</button>
              <button type="button" aria-pressed={discountType === "flat"} onClick={() => onDiscountTypeChange("flat")} className={`h-7 rounded-md px-2.5 text-[10px] font-semibold transition ${discountType === "flat" ? "bg-blue-600 text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-slate-100"}`}>Flat</button>
            </div>
            <div className="relative min-w-0 flex-1"><input id={`${documentLabel}-overall-discount`} type="number" min="0" max={discountType === "percent" ? 100 : undefined} step="0.01" value={discountValue} onChange={(event) => onDiscountValueChange(event.target.value)} className="h-8 w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-white px-3 pr-9 text-left text-xs font-semibold tabular-nums outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" aria-label={`Overall discount ${discountType === "percent" ? "percentage" : "flat amount"}`}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--text-muted)]">{discountType === "percent" ? "%" : "Rs"}</span></div>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_86px_92px] items-center gap-1.5"><label htmlFor={`${documentLabel}-overall-tax`} className="text-[10px] font-medium text-[var(--text-secondary)]">Tax rate</label><div className="relative"><input id={`${documentLabel}-overall-tax`} type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => onTaxRateChange(event.target.value)} className="h-8 w-full rounded-lg border border-[var(--border-color)] bg-white px-2 pr-6 text-right text-[11px] font-semibold tabular-nums outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--text-muted)]">%</span></div><span className="whitespace-nowrap text-right text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">Tax + {money(totals.tax)}</span></div>
        <div className="border-t border-dashed border-slate-300 pt-3"><div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 py-3 text-white shadow-[0_6px_16px_rgba(37,99,235,0.2)]"><div><p className="text-[10px] font-semibold text-blue-100">Grand Total</p><p className="mt-0.5 text-[9px] text-blue-100/80">Tax included</p></div><strong className="text-lg font-extrabold tabular-nums">{money(totals.total)}</strong></div></div>
      </div>
    </section>
  );
}
