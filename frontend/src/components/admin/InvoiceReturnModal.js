"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, Package, RotateCcw, X } from "lucide-react";

const money = (value) => new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const fieldClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

export default function InvoiceReturnModal({ invoice, isPending, onClose, onSubmit }) {
  const [quantities, setQuantities] = useState({});
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [reason, setReason] = useState("Damaged");
  const [otherReason, setOtherReason] = useState("");
  const [notes, setNotes] = useState("");
  const items = invoice.items || [];

  const returnedByItem = useMemo(() => {
    const totals = new Map();
    for (const record of invoice.returns || []) {
      for (const returned of record.items_returned || []) {
        const id = String(returned.item_id || "");
        totals.set(id, (totals.get(id) || 0) + Number(returned.qty || 0));
      }
    }
    return totals;
  }, [invoice.returns]);

  const selectedItems = items.map((item) => ({
    item,
    qty: Number(quantities[String(item._id)] || 0),
    available: Math.max(0, Number(item.quantity || 0) - (returnedByItem.get(String(item._id)) || 0)),
  })).filter(({ qty }) => qty > 0);
  const refundAmount = Math.round(selectedItems.reduce((sum, { item, qty }) => sum + Number(item.unit_price || 0) * qty, 0) * 100) / 100;
  const totalPaid = Number(invoice.amount_paid || 0);
  const invoiceTotal = Number(invoice.total || 0);
  const remainingBalance = Number(invoice.remaining_balance ?? Math.max(0, invoiceTotal - totalPaid));
  const overLimit = refundAmount > totalPaid;
  const finalReason = reason === "Other" ? otherReason.trim() : reason;
  const canSubmit = selectedItems.length > 0 && refundAmount > 0 && !overLimit && Boolean(finalReason) && !isPending;

  const changeQuantity = (itemId, quantity, max) => {
    const next = quantity === "" ? "" : String(Math.min(max, Math.max(0, Math.floor(Number(quantity) || 0))));
    setQuantities((current) => ({ ...current, [itemId]: next }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      items_returned: selectedItems.map(({ item, qty }) => ({ item_id: item._id, qty })),
      refund_method: refundMethod,
      reason: finalReason,
      notes: notes.trim(),
    });
  };

  return <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onClose(); }}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="invoice-return-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20"><RotateCcw size={18} /></span><div><h2 id="invoice-return-title" className="text-base font-extrabold text-slate-900">Return &amp; Refund</h2><p className="mt-0.5 text-xs text-slate-500">{invoice.invoice_number} · {invoice.customer_name}</p></div></div>
        <button type="button" disabled={isPending} onClick={onClose} aria-label="Close return form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
      </header>

      <div className="overflow-y-auto p-4 sm:p-6">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h3 className="text-sm font-bold text-slate-900">Items to return</h3><p className="mt-0.5 text-[11px] text-slate-500">Select items and enter quantities to calculate the refund.</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{selectedItems.length} selected</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="w-10 px-3 py-3">Return</th><th className="px-3 py-3">Item</th><th className="px-3 py-3 text-center">Purchased</th><th className="px-3 py-3 text-center">Return qty</th><th className="px-3 py-3 text-right">Unit price</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{items.map((item, index) => {
                  const id = String(item._id || index);
                  const alreadyReturned = returnedByItem.get(id) || 0;
                  const available = Math.max(0, Number(item.quantity || 0) - alreadyReturned);
                  const qty = quantities[id] ?? "";
                  const checked = Number(qty) > 0;
                  return <tr key={id} className={`transition ${checked ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                    <td className="px-3 py-3"><input type="checkbox" checked={checked} disabled={!available || isPending} onChange={(event) => changeQuantity(id, event.target.checked ? 1 : 0, available)} aria-label={`Select ${item.name} for return`} className="h-4 w-4 rounded accent-blue-600" /></td>
                    <td className="max-w-[250px] px-3 py-3"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Package size={16} /></span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800">{item.name || `Item ${index + 1}`}</span><span className="mt-0.5 block text-[10px] text-slate-500">{alreadyReturned ? `${alreadyReturned} already returned · ` : ""}{available} available</span></span></div></td>
                    <td className="px-3 py-3 text-center text-xs font-semibold text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-3 text-center"><input type="number" min={checked ? 1 : 0} max={available} step={1} disabled={!checked || isPending} value={qty} onChange={(event) => changeQuantity(id, event.target.value, available)} aria-label={`Return quantity for ${item.name}`} className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-center text-xs font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400" /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold text-slate-700">{money(item.unit_price)}</td>
                  </tr>;
                })}
                  {!items.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-500">This invoice has no items to return.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white"><Check size={15} /></span><div><h3 className="text-sm font-bold text-slate-900">Refund summary</h3><p className="text-[10px] text-slate-500">Based on this invoice payment</p></div></div>
              <div className="space-y-2.5">
                {[ ["Invoice total", invoiceTotal], ["Amount paid", totalPaid], ["Remaining balance", remainingBalance] ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-xs"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{money(value)}</span></div>)}
                <div className="flex justify-between gap-3 border-t border-blue-100 pt-2.5 text-xs"><span className="font-semibold text-slate-700">Max refundable</span><span className="font-bold text-slate-900">{money(totalPaid)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-3.5 py-3 text-white shadow-md shadow-blue-600/15"><span className="text-xs font-bold">Refund amount</span><span className="text-base font-extrabold tabular-nums">{money(refundAmount)}</span></div>
                {overLimit && <p className="flex items-start gap-1.5 text-[11px] font-medium text-rose-600"><AlertCircle size={14} className="mt-0.5 shrink-0" />Selected item value exceeds the amount paid.</p>}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div><h3 className="text-sm font-bold text-slate-900">Refund details</h3><p className="mt-0.5 text-[11px] text-slate-500">Choose how and why the return is being processed.</p></div>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Refund method<select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} className={fieldClass} disabled={isPending}><option>Bank Transfer</option><option>Cash</option><option>Store Credit</option></select></label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Reason for return<select value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} disabled={isPending}><option>Damaged</option><option>Wrong Item</option><option>Defective</option><option>Not as Described</option><option>Changed Mind</option><option>Other</option></select></label>
              {reason === "Other" && <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Describe reason<textarea required value={otherReason} onChange={(event) => setOtherReason(event.target.value)} rows={2} maxLength={500} disabled={isPending} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Enter the return reason" /></label>}
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Notes <span className="font-normal text-slate-400">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} disabled={isPending} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Add any additional details" /></label>
            </section>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
        <p className="text-[11px] text-slate-500">Refund will reduce the invoice amount paid.</p>
        <div className="flex gap-2"><button type="button" disabled={isPending} onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!canSubmit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={14} />{isPending ? "Processing..." : "Confirm refund"}</button></div>
      </footer>
    </form>
  </div>;
}
