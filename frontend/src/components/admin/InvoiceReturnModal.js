"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { useMemo, useState } from "react";

import { Check, Package, RotateCcw, X } from "lucide-react";

const money = (value) => new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => !url || /^(https?:|blob:|data:)/i.test(url)
  ? url || ""
  : API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;
const fieldClass = "h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-xs text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-card)] focus:ring-4 focus:ring-blue-500/10";

export default function InvoiceReturnModal({ invoice, isPending, onClose, onSubmit }) {
  const [quantities, setQuantities] = useState({});
  const initiallyFullyPaid = Number(invoice.amount_paid || 0) > 0 && Number(invoice.amount_paid || 0) >= Number(invoice.total || 0);
  const [refundMethod, setRefundMethod] = useState(initiallyFullyPaid ? "Cash Refund" : "Balance Adjustment");
  const [cashRefundMethod, setCashRefundMethod] = useState("Cash");
  const [reason, setReason] = useState("Damaged");
  const [otherReason, setOtherReason] = useState("");
  const [notes, setNotes] = useState("");
  const items = invoice.items || [];

  const returnedByItem = useMemo(() => {
    const totals = new Map();
    for (const record of invoice.returns || []) {
      for (const returned of record.items_returned || []) {
        const id = String(returned.item_id || "");
        const current = totals.get(id) || { quantity: 0, value: 0 };
        const returnedQty = Number(returned.qty || 0);
        const returnedValue = Number(returned.return_value ?? (Number(returned.unit_price || 0) * returnedQty));
        totals.set(id, { quantity: current.quantity + returnedQty, value: current.value + returnedValue });
      }
    }
    return totals;
  }, [invoice.returns]);

  const selectedItems = items.map((item) => {
    const prior = returnedByItem.get(String(item._id)) || { quantity: 0, value: 0 };
    const quantity = Number(item.quantity || 0);
    const available = Math.max(0, quantity - prior.quantity);
    const lineTotal = Number(item.total ?? quantity * Number(item.unit_price || 0));
    const remainingValue = Math.max(0, Math.round((lineTotal - prior.value) * 100) / 100);
    const qty = Number(quantities[String(item._id)] || 0);
    const returnValue = qty <= 0 || available <= 0 ? 0 : Math.round((qty >= available ? remainingValue : remainingValue * qty / available) * 100) / 100;
    return { item, qty, available, remainingValue, effectiveUnitPrice: available ? remainingValue / available : 0, returnValue };
  }).filter(({ qty }) => qty > 0);
  const rawRefundAmount = Math.round(selectedItems.reduce((sum, { returnValue }) => sum + returnValue, 0) * 100) / 100;
  const totalPaid = Number(invoice.amount_paid || 0);
  const invoiceTotal = Number(invoice.total || 0);
  const isUnpaid = totalPaid === 0;
  const remainingBalance = Number(invoice.remaining_balance ?? Math.max(0, invoiceTotal - totalPaid));
  const isFullyPaid = totalPaid > 0 && totalPaid >= invoiceTotal;
  const refundCap = Math.max(0, invoiceTotal);
  const refundAmount = Math.min(rawRefundAmount, refundCap);
  const isRefundCapped = rawRefundAmount > refundCap;
  const projectedTotal = Math.max(0, Math.round((invoiceTotal - refundAmount) * 100) / 100);
  const projectedBalanceBeforeRefund = projectedTotal - totalPaid;
  const excessAmount = Math.max(0, Math.round(-projectedBalanceBeforeRefund * 100) / 100);
  const netCashRefund = Math.min(Math.max(0, totalPaid), excessAmount);
  const effectiveRefundMethod = netCashRefund > 0 ? "Cash Refund" : refundMethod;
  const finalReason = reason === "Other" ? otherReason.trim() : reason;
  const canSubmit = selectedItems.length > 0 && refundAmount > 0 && Boolean(finalReason) && !isPending;

  const changeQuantity = (itemId, quantity, max) => {
    const next = quantity === "" ? "" : String(Math.min(max, Math.max(0, Math.floor(Number(quantity) || 0))));
    setQuantities((current) => ({ ...current, [itemId]: next }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      items_returned: selectedItems.map(({ item, qty }) => ({ item_id: item._id, qty })),
      refund_method: effectiveRefundMethod,
      refund_payment_method: cashRefundMethod,
      reason: finalReason,
      notes: notes.trim(),
    });
  };

  return <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onClose(); }}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="invoice-return-title" className="flex h-[min(94vh,900px)] max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20"><RotateCcw size={18} /></span><div><h2 id="invoice-return-title" className="text-base font-extrabold text-slate-900">{isUnpaid ? "Return & Bill Adjustment" : "Return & Refund"}</h2><p className="mt-0.5 text-xs text-slate-500">{invoice.invoice_number} · {invoice.customer_name}</p></div></div>
        <button type="button" disabled={isPending} onClick={onClose} aria-label="Close return form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid min-h-full items-stretch gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] lg:gap-5">
          <section className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)] lg:min-h-[520px]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-4 py-4 sm:px-5"><div><h3 className="text-sm font-bold tracking-tight text-slate-900">Items to return</h3><p className="mt-1 text-[11px] text-slate-500">Select items and quantities to calculate the refund.</p></div><span className="shrink-0 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm">{selectedItems.length} selected</span></div>
            <div className="flex flex-1 flex-col overflow-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.08)]"><tr><th className="w-12 px-3 py-3.5">Return</th><th className="px-3 py-3.5">Item</th><th className="px-3 py-3.5 text-center">Purchased</th><th className="px-3 py-3.5 text-center">Return qty</th><th className="px-3 py-3.5 text-right">Paid / unit</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{items.map((item, index) => {
                  const id = String(item._id || index);
                  const prior = returnedByItem.get(id) || { quantity: 0, value: 0 };
                  const alreadyReturned = prior.quantity;
                  const available = Math.max(0, Number(item.quantity || 0) - alreadyReturned);
                  const lineTotal = Number(item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0));
                  const remainingValue = Math.max(0, Math.round((lineTotal - prior.value) * 100) / 100);
                  const effectiveUnitPrice = available > 0 ? remainingValue / available : 0;
                  const qty = quantities[id] ?? "";
                  const checked = Number(qty) > 0;
                  return <tr key={id} className={`transition-colors duration-150 ${available === 0 ? "bg-slate-50/80 opacity-60" : checked ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-gray-50"}`}>
                    <td className="px-3 py-3.5"><input type="checkbox" checked={checked} disabled={!available || isPending} onChange={(event) => changeQuantity(id, event.target.checked ? 1 : 0, available)} aria-label={`Select ${item.name} for return`} className="h-4 w-4 rounded accent-blue-600" /></td>
                    <td className="max-w-[280px] border-b border-[var(--border-color)] px-3 py-3"><div className="flex min-w-0 items-center gap-3">{item.image ? <FallbackImage nextImage src={getImageUrl(item.image)} alt="" width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] object-cover shadow-sm" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Package size={19} /></span>}<span className="min-w-0"><span className="block truncate text-xs font-bold text-[var(--text-primary)]">{item.name || `Item ${index + 1}`}</span><span className="mt-1 block truncate text-[10px] text-[var(--text-muted)]">{alreadyReturned ? `${alreadyReturned} already returned · ` : ""}{available} available</span></span></div></td>
                    <td className="border-b border-[var(--border-color)] px-3 py-3 text-center text-xs font-medium tabular-nums text-[var(--text-secondary)]">{item.quantity}</td>
                    <td className="border-b border-[var(--border-color)] px-3 py-3 text-center"><div className={`mx-auto flex h-10 w-[132px] items-center overflow-hidden rounded-xl border bg-[var(--bg-card)] shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 ${checked ? "border-blue-300" : "border-[var(--border-color)]"}`}><button type="button" disabled={!available || isPending || Number(qty) <= 0} onClick={() => changeQuantity(id, Number(qty) - 1, available)} aria-label={`Decrease return quantity for ${item.name}`} className="h-full w-10 shrink-0 text-base font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)]">−</button><input type="number" min={0} max={available} step={1} disabled={!available || isPending} value={qty || "0"} onChange={(event) => changeQuantity(id, event.target.value, available)} aria-label={`Return quantity for ${item.name}`} className="h-full min-w-0 flex-1 border-x border-[var(--border-color)] bg-transparent px-1 text-center text-xs font-bold tabular-nums text-[var(--text-primary)] outline-none disabled:text-[var(--text-muted)]" /><button type="button" disabled={!available || isPending || Number(qty) >= available} onClick={() => changeQuantity(id, Number(qty) + 1, available)} aria-label={`Increase return quantity for ${item.name}`} className="h-full w-10 shrink-0 text-base font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:hover:bg-transparent">+</button></div></td>
                    <td className="whitespace-nowrap border-b border-[var(--border-color)] px-3 py-3 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">{money(effectiveUnitPrice)}</td>
                  </tr>;
                })}
                  {!items.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-500">This invoice has no items to return.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex h-full min-h-[320px] flex-col gap-4 lg:min-h-[520px]">
            <section className="flex-[1.15] rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/80 p-4 shadow-[0_4px_18px_rgba(37,99,235,0.07)] sm:p-5">
              <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white"><Check size={15} /></span><div><h3 className="text-sm font-bold text-slate-900">{isUnpaid ? "Bill adjustment" : "Refund summary"}</h3><p className="text-[10px] text-slate-500">{isUnpaid ? "Adjusted from the items selected below" : "Calculated from selected items and quantities"}</p></div></div>
              <div className="space-y-2.5">
                {isUnpaid ? <>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Original invoice total</span><span className="font-semibold tabular-nums text-slate-800">{money(invoiceTotal)}</span></div>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Return deduction (items selected)</span><span className="font-semibold tabular-nums text-slate-800">{money(refundAmount)}</span></div>
                  <div className="flex items-center justify-between gap-3 border-t border-blue-100 pt-2.5 text-xs"><span className="font-bold text-slate-700">New adjusted total</span><span className="font-bold tabular-nums text-slate-900">{money(projectedTotal)}</span></div>
                </> : <>
                  {[ ["Invoice total", invoiceTotal], ["Amount paid", totalPaid], ["Remaining balance", remainingBalance] ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{label}</span><span className="font-semibold tabular-nums text-slate-800">{money(value)}</span></div>)}
                </>}
                {isRefundCapped && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium leading-5 text-amber-800">Maximum return value reached. You cannot return items exceeding the paid amount.</p>}
                <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3.5 text-white shadow-lg shadow-blue-600/20"><span className="text-xs font-semibold tracking-wide text-blue-50">{isUnpaid ? "Total bill reduction" : "Item Deduction from Bill"}</span><span className="text-right text-base font-extrabold tabular-nums tracking-tight">{money(refundAmount)}</span></div>
                {!isUnpaid && <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3.5 shadow-sm"><span className="text-xs font-bold tracking-wide text-emerald-800">Cash to give customer</span><span className="text-right text-base font-extrabold tabular-nums tracking-tight text-emerald-700">{money(netCashRefund)}</span></div>}
              </div>
            </section>

            <section className="flex-1 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.05)] sm:p-5">
              <div><h3 className="text-sm font-bold text-slate-900">{isUnpaid ? "Adjustment details" : "Refund details"}</h3><p className="mt-0.5 text-[11px] text-slate-500">Choose how and why the return is being processed.</p></div>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Refund method<select value={effectiveRefundMethod} onChange={(event) => setRefundMethod(event.target.value)} className={fieldClass} disabled={isPending}><option value="Cash Refund" disabled={!isFullyPaid && netCashRefund <= 0}>Cash Refund{!isFullyPaid && netCashRefund <= 0 ? " · excess payment only" : ""}</option><option value="Balance Adjustment" disabled={netCashRefund > 0}>Balance Adjustment</option></select></label>
              {effectiveRefundMethod === "Cash Refund" && <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Refund payment method<select value={cashRefundMethod} onChange={(event) => setCashRefundMethod(event.target.value)} className={fieldClass} disabled={isPending}><option value="Cash">Cash</option><option value="Bank">Bank</option></select></label>}
              {excessAmount <= 0 && <p className={`rounded-lg px-3 py-2.5 text-[11px] leading-5 ${effectiveRefundMethod === "Cash Refund" ? "border border-blue-100 bg-blue-50/70 text-blue-800" : "border border-slate-200 bg-slate-50 text-slate-600"}`}>{effectiveRefundMethod === "Cash Refund" ? `A negative ${cashRefundMethod.toLowerCase()} transaction will be added to payment history and amount paid will decrease.` : "No cash refund. The selected amount reduces the invoice total."}</p>}
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Reason for return<select value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} disabled={isPending}><option>Damaged</option><option>Wrong Item</option><option>Defective</option><option>Not as Described</option><option>Changed Mind</option><option>Other</option></select></label>
              {reason === "Other" && <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Describe reason<textarea required value={otherReason} onChange={(event) => setOtherReason(event.target.value)} rows={2} maxLength={500} disabled={isPending} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Enter the return reason" /></label>}
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Notes <span className="font-normal text-slate-400">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} disabled={isPending} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Add any additional details" /></label>
            </section>
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-4px_14px_rgba(15,23,42,0.025)] sm:px-6">
        <div className="flex gap-2"><button type="button" disabled={isPending} onClick={onClose} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!canSubmit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"><RotateCcw size={14} />{isPending ? "Processing..." : isUnpaid ? "Confirm adjustment" : "Confirm refund"}</button></div>
      </footer>
    </form>
  </div>;
}
