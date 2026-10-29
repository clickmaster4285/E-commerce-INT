"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/apis/admin/quoteApi";
import { variantApi } from "@/apis/admin/variantApi";
import { storeApi } from "@/apis/admin/storeApi";
import QuoteTemplateDesigner from "@/components/admin/QuoteTemplateDesigner";
import ActivityTimeline from "@/components/admin/ActivityTimeline";
import { renderRichHtml } from "@/lib/termsContent";
import { downloadQuotePdf, printQuotePdf } from "@/lib/invoicePdf";
import { toast } from "sonner";
import {
  ArrowLeft, Check, Download, Printer, FilePlus2, Pencil, ReceiptText, X,
  Send, Eye, UserRound, CalendarDays, PackageCheck, Wallet, FileText } from
"lucide-react";

const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const card = "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const statusStyle = { Pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300", Draft: "border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]", Sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300", Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300", Rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300" };

function getStatusEventDate(quote, targetStatus) {
  const events = Array.isArray(quote?.activity) ? quote.activity : [];
  const event = [...events].reverse().find((entry) =>
    (entry.changes || []).some((change) => String(change.field || "").toLowerCase() === "status" && String(change.after || "").toLowerCase() === targetStatus.toLowerCase())
  );
  return event?.at || null;
}

function Panel({ title, icon: Icon, trailing, children }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
    <div className="flex min-h-10 items-center gap-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-3">
      {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"><Icon size={15} strokeWidth={2.4} /></span>}
      <h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">{title}</h2><div className="ms-auto">{trailing}</div>
    </div>{children}
  </section>;
}

function PreviewModal({ onClose, children }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Quote preview" className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Eye size={17} /></span><div><h2 className="text-sm font-extrabold text-[var(--text-primary)]">Quote preview</h2><p className="text-[10px] text-[var(--text-muted)]">Review the customer-facing quote</p></div></div><button type="button" onClick={onClose} aria-label="Close preview" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"><X size={17} /></button></header>
      <div className="min-h-0 overflow-auto bg-[var(--bg-secondary)] p-3 sm:p-5">{children}</div>
    </section>
  </div>;
}

export default function QuoteDetailPage({ params }) {const { t } = useTranslation();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const printHandled = useRef(false);
  const quotePreviewRef = useRef(null);
  const { data: quote, isLoading, isError, error } = useQuery({ queryKey: ["quote-admin", id], queryFn: () => quoteApi.getById(id) });
  const { data: store = null, isLoading: isStoreLoading } = useQuery({ queryKey: ["store-public"], queryFn: () => storeApi.getPublic(), staleTime: 5 * 60 * 1000 });
  const { data: variants = [], isLoading: isVariantsLoading } = useQuery({ queryKey: ["quote-all-variants"], queryFn: () => variantApi.getAll(), staleTime: 5 * 60 * 1000 });
  const variantsById = useMemo(() => new Map(variants.map((variant) => [String(variant._id), variant])), [variants]);
  const quoteWithVariantNames = useMemo(() => quote ? {
    ...quote,
    items: (quote.items || []).map((item) => {
      const variant = variantsById.get(String(item.variant_id?._id || item.variant_id || ""));
      return { ...item, variant_name: item.variant_name || variant?.title || "" };
    }),
  } : null, [quote, variantsById]);
  const sentAt = quote?.sent_at || getStatusEventDate(quote, "Sent") || (quote?.status === "Sent" ? quote.updated_at : null);
  useEffect(() => {
    if (searchParams.get("print") !== "1" || !quote || isLoading || isStoreLoading || isVariantsLoading || printHandled.current) return undefined;
    printHandled.current = true;
    const timer = window.setTimeout(() => {
      printQuotePdf(quoteWithVariantNames || quote, store, quotePreviewRef.current)
        .catch((printError) => { console.error("Could not print quote PDF:", printError); toast.error("Could not print quote"); })
        .finally(() => router.replace(`/admin/quotes/${id}`, { scroll: false }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [id, isLoading, isStoreLoading, isVariantsLoading, quote, quoteWithVariantNames, router, searchParams, store]);
  const statusMutation = useMutation({
    mutationFn: (status) => quoteApi.updateStatus(id, status),
    onSuccess: () => {toast.success("Quote status updated");qc.invalidateQueries({ queryKey: ["quote-admin", id] });qc.invalidateQueries({ queryKey: ["quotes-admin"] });},
    onError: (e) => toast.error(e?.response?.data?.message || "Could not update quote")
  });
  const sendMutation = useMutation({
    mutationFn: () => quoteApi.update(id, { ...(quoteWithVariantNames || quote), status: "Sent" }),
    onSuccess: (saved) => {
      toast.success("Quote marked as sent");
      qc.invalidateQueries({ queryKey: ["quote-admin", id] });
      qc.invalidateQueries({ queryKey: ["quotes-admin"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Could not send quote")
  });
  const downloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await downloadQuotePdf(quoteWithVariantNames || quote, store, quotePreviewRef.current);
      toast.success("Quote PDF downloaded");
    } catch (downloadError) {
      console.error("Could not generate quote PDF:", downloadError);
      toast.error("Could not generate quote PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const printQuote = async () => {
    if (isGeneratingPdf || isStoreLoading || isVariantsLoading) return;
    setIsGeneratingPdf(true);
    try { await printQuotePdf(quoteWithVariantNames || quote, store, quotePreviewRef.current); }
    catch (printError) { console.error("Could not print quote PDF:", printError); toast.error("Could not print quote"); }
    finally { setIsGeneratingPdf(false); }
  };

  if (isLoading) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>{t("admin.quoteInvoice.ui.loading_quote_674da72a")}</div>;
  if (isError || !quote) return <div className={`${card} p-8 text-center`}><p className="text-sm font-semibold">{error?.response?.data?.message || "Quote not found"}</p><button type="button" onClick={() => router.push("/admin/quotes")} className="mt-3 text-sm font-semibold text-[var(--accent)]">{t("admin.quoteInvoice.ui.back_to_quotes_433f26bf")}</button></div>;

  return (
    <div id="quote-print-area" className="space-y-4 pb-6 text-[var(--text-primary)]">
    <header className="quote-no-print rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <nav aria-label={t("admin.quoteInvoice.ui.breadcrumb_c766e665")} className="mb-2 flex items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]"><button type="button" onClick={() => router.push("/admin/quotes")} className="hover:text-blue-600">{t("admin.quoteInvoice.ui.quotes_7b0257ce")}</button><span aria-hidden="true">â€º</span><span>{t("admin.quoteInvoice.ui.quote_details_4443d16a")}</span></nav>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><ReceiptText size={20} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl text-[var(--text-primary)]">{quote.quote_number}</h1><span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusStyle[quote.status] || statusStyle.Draft}`}>{quote.status}</span></div><p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{t("admin.quoteInvoice.ui.quote_for_aaca8b54")} {quote.customer_name}</p></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPreviewOpen(true)} className="quote-no-print inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"><Eye size={14} /> Preview</button>
          <button type="button" disabled={isGeneratingPdf || isStoreLoading || isVariantsLoading} onClick={printQuote} className="quote-no-print inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"><Printer size={14} /> {isGeneratingPdf ? "Preparing..." : t("admin.pos.ui.print")}</button>
          <button type="button" disabled={isGeneratingPdf || isStoreLoading || isVariantsLoading} onClick={downloadPdf} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950"><Download size={14} /> {isGeneratingPdf || isStoreLoading || isVariantsLoading ? "Preparing PDF..." : "Download PDF"}</button>
          <button type="button" onClick={() => router.push("/admin/quotes")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-transparent bg-[var(--bg-tertiary)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-slate-200 dark:hover:bg-[var(--bg-tertiary)]"><ArrowLeft size={14} /> {t("admin.quoteInvoice.ui.all_quotes_0900db5f")}</button>
          {quote.status === "Accepted" && <button type="button" onClick={() => router.push(`/admin/invoices/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md"><FilePlus2 size={14} /> {t("admin.quoteInvoice.ui.convert_to_invoice_ff42ae9b")}</button>}
          {["Pending", "Draft"].includes(quote.status) && <><button type="button" onClick={() => router.push(`/admin/quotes/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><Pencil size={13} /> {t("admin.quoteInvoice.ui.edit_quote_540f4206")}</button><button type="button" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-60"><Send size={13} /> {sendMutation.isPending ? "Updating..." : "Mark as Sent"}</button></>}
          {quote.status === "Sent" && <><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Accepted")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={14} /> {t("admin.quoteInvoice.ui.accept_bb54db51")}</button><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Rejected")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-[var(--bg-card)] px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><X size={14} /> {t("admin.quoteInvoice.ui.reject_2b03b592")}</button></>}
        </div>
      </div>
    </header>

    <div className="grid items-start gap-4 lg:grid-cols-12">
      <main className="space-y-3.5 lg:col-span-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Customer information" icon={UserRound}>
            <div className="space-y-1 px-4 py-3 text-[13px]">
              <div className="mb-2.5 flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{String(quote.customer_name || "C").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><div className="truncate text-[13px] font-bold text-[var(--text-primary)]">{quote.customer_name || "—"}</div><div className="truncate text-xs text-[var(--text-muted)]">{quote.customer_email || "Customer"}</div></div></div>
              {(quote.customer_phone || quote.customer_address) && <div className="grid gap-2 border-t border-[var(--border-color)] pt-2.5 sm:grid-cols-2">
                {quote.customer_phone && <div className="rounded-lg bg-[var(--bg-tertiary)]/70 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Phone</div><div className="mt-0.5 break-words text-xs font-medium text-[var(--text-primary)]">{quote.customer_phone}</div></div>}
                {quote.customer_address && <div className="rounded-lg bg-[var(--bg-tertiary)]/70 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Address</div><div className="mt-0.5 whitespace-pre-wrap break-words text-xs font-medium text-[var(--text-primary)]">{quote.customer_address}</div></div>}
              </div>}
            </div>
          </Panel>
          <Panel title="Quote summary" icon={FileText}>
            <div className="space-y-2 p-4 text-[13px]">
              <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">Quote date</span><span className="font-medium">{quote.quote_date ? new Date(quote.quote_date).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">Valid until</span><span className="font-medium">{quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">Items</span><span className="font-medium">{quoteWithVariantNames.items.length}</span></div>
              <div className="mt-2 flex justify-between border-t border-[var(--border-color)] pt-2.5 text-sm font-bold"><span>Total</span><span className="text-emerald-600">{money(quote.total)}</span></div>
            </div>
          </Panel>
        </div>
        <Panel title="Products & items" icon={PackageCheck} trailing={<span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{quoteWithVariantNames.items.length} items</span>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[var(--bg-card-alt)] text-[var(--text-secondary)]"><tr>{["#", "Product / variant", "SKU", "Quantity", "Unit price", "Discount", "Tax", "Amount"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead><tbody>{quoteWithVariantNames.items.map((item, index) => <tr key={item._id || index} className="border-t border-[var(--border-color)]"><td className="px-3 py-3 text-[var(--text-muted)]">{index + 1}</td><td className="max-w-[200px] px-3 py-3"><span className="block truncate font-semibold">{item.name || "—"}</span><span className="block truncate text-[10px] text-[var(--text-muted)]">{item.variant_name || ""}</span></td><td className="whitespace-nowrap px-3 py-3 font-mono text-[var(--text-muted)]">{item.sku || "—"}</td><td className="px-3 py-3">{item.quantity ?? item.qty ?? 0}</td><td className="whitespace-nowrap px-3 py-3">{money(item.unit_price)}</td><td className="whitespace-nowrap px-3 py-3">{money(item.discount)}</td><td className="whitespace-nowrap px-3 py-3">{money(item.tax)}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{money(item.line_total ?? item.total)}</td></tr>)}{!quoteWithVariantNames.items.length && <tr><td colSpan={8} className="p-8 text-center text-xs text-[var(--text-muted)]">No items added to this quote.</td></tr>}</tbody></table></div>
        </Panel>
        {(quote.notes || quote.terms) && <Panel title="Notes & terms" icon={FileText}><div className="space-y-3 p-4 text-xs leading-5 text-[var(--text-secondary)]">{quote.notes && <p className="whitespace-pre-wrap">{quote.notes}</p>}{quote.terms && (/<[a-z][\s\S]*>/i.test(quote.terms) ? <div className="quote-rich-terms break-words [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_li]:my-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_a]:text-blue-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: renderRichHtml(quote.terms) }} /> : <p className="whitespace-pre-wrap">{quote.terms}</p>)}</div></Panel>}
      </main>
      <aside className="space-y-3.5 lg:col-span-4">
        <Panel title="Quote status" icon={CalendarDays}>
          <div className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Current status</span><span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${statusStyle[quote.status] || statusStyle.Draft}`}>{quote.status}</span></div>
            <div className="space-y-2 border-t border-[var(--border-color)] pt-3 text-xs"><div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">Created</span><span className="text-right">{quote.created_at ? new Date(quote.created_at).toLocaleString() : "—"}</span></div>{quote.status === "Sent" && <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">Sent</span><span className="text-right">{sentAt ? new Date(sentAt).toLocaleString() : "Date unavailable"}</span></div>}</div>
          </div>
        </Panel>
        <Panel title="Quote activity" icon={Wallet}><div className="p-3"><ActivityTimeline events={quote.activity?.length ? quote.activity : [{ type: "created", at: quote.created_at, actor_name: quote.createdby?.name || "Staff", changes: [] }]} title="Quote activity" /></div></Panel>
      </aside>
    </div>
    {previewOpen && <PreviewModal onClose={() => setPreviewOpen(false)}><div ref={quotePreviewRef} className="mx-auto w-full max-w-5xl"><QuoteTemplateDesigner previewOnly form={{ customer_name: quote.customer_name || "", customer_email: quote.customer_email || "", customer_phone: quote.customer_phone || "", customer_address: quote.customer_address || "", quote_date: quote.quote_date ? String(quote.quote_date).slice(0, 10) : "", expiry_date: quote.expiry_date ? String(quote.expiry_date).slice(0, 10) : "", terms: quote.terms || "", notes: quote.notes || "", items: quoteWithVariantNames.items.map((item, index) => ({ ...item, row_id: item._id || "saved-" + index })) }} totals={{ subtotal: quote.subtotal, discount: quote.discount, tax: quote.tax, total: quote.total }} quoteNumber={quote.quote_number} quoteStatus={quote.status} savedDesign={quote.pdf_design || {}} money={money} /></div></PreviewModal>}
      <style jsx global>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #quote-print-area, #quote-print-area * { visibility: visible !important; }
          #quote-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; color: #111827 !important; background: #fff !important; }
          #quote-print-area .quote-no-print, #quote-print-area button, #quote-print-area a { display: none !important; }
          #quote-print-area .quote-preview-page-break { display: none !important; }
          #quote-print-area .quote-saved-preview { margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
          #quote-print-area .quote-saved-preview > div { padding: 0 !important; background: #fff !important; }
          #quote-print-area .quote-saved-preview [data-quote-document-page="true"] { width: 100% !important; max-width: none !important; height: auto !important; min-height: 0 !important; aspect-ratio: var(--quote-page-ratio) !important; margin: 0 !important; box-shadow: none !important; zoom: 1 !important; break-after: page; page-break-after: always; }
          #quote-print-area .quote-preview-page-number { display: block !important; position: absolute !important; right: 8mm !important; bottom: 6mm !important; margin: 0 !important; padding: 0 !important; }
          #quote-print-area .quote-saved-preview [data-quote-document-page="true"]:last-child { break-after: auto; page-break-after: auto; }
          #quote-print-area > div.grid { display: block !important; }
          #quote-print-area > div.grid > div, #quote-print-area aside { display: block !important; break-inside: auto !important; }
          #quote-print-area section { break-inside: auto !important; box-shadow: none !important; }
          #quote-print-area header { break-inside: avoid; box-shadow: none !important; }
          #quote-print-area section > div:first-child { break-after: avoid; }
          #quote-print-area tr { break-inside: avoid; }
          #quote-print-area .overflow-x-auto { overflow: visible !important; }
          #quote-print-area table { width: 100% !important; min-width: 0 !important; border-collapse: collapse !important; }
          #quote-print-area th, #quote-print-area td { color: #111827 !important; border-color: #d1d5db !important; }
          #quote-print-area, #quote-print-area * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};
