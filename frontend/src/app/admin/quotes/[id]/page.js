"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/apis/admin/quoteApi";
import { variantApi } from "@/apis/admin/variantApi";
import { storeApi } from "@/apis/admin/storeApi";
import QuoteTemplateDesigner from "@/components/admin/QuoteTemplateDesigner";
import ActivityTimeline from "@/components/admin/ActivityTimeline";
import { downloadQuotePdf, printQuotePdf } from "@/lib/invoicePdf";
import { toast } from "sonner";
import {
  ArrowLeft, Check, Download, Printer, FilePlus2, Pencil, ReceiptText, X,
  Send } from
"lucide-react";

const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const card = "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const statusStyle = { Pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300", Draft: "border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]", Sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300", Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300", Rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300" };

export default function QuoteDetailPage({ params }) {const { t } = useTranslation();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printHandled = useRef(false);
  const quotePreviewRef = useRef(null);
  const { data: quote, isLoading, isError, error } = useQuery({ queryKey: ["quote-admin", id], queryFn: () => quoteApi.getById(id) });
  const { data: store = null, isLoading: isStoreLoading } = useQuery({ queryKey: ["store-public"], queryFn: () => storeApi.getPublic(), staleTime: 5 * 60 * 1000 });
  const { data: variants = [], isLoading: isVariantsLoading } = useQuery({ queryKey: ["quote-all-variants"], queryFn: () => variantApi.getAll(), staleTime: 5 * 60 * 1000 });
  const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]));
  const quoteWithVariantNames = quote ? {
    ...quote,
    items: (quote.items || []).map((item) => {
      const variant = variantsById.get(String(item.variant_id?._id || item.variant_id || ""));
      return { ...item, variant_name: item.variant_name || variant?.title || "" };
    }),
  } : null;
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
    <div id="quote-print-area" className="-mx-3 w-[calc(100%+1.5rem)] max-w-none space-y-3 pb-6 text-[var(--text-primary)] sm:-mx-5 sm:w-[calc(100%+2.5rem)]">
    <header className="quote-no-print rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <nav aria-label={t("admin.quoteInvoice.ui.breadcrumb_c766e665")} className="mb-2 flex items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]"><button type="button" onClick={() => router.push("/admin/quotes")} className="hover:text-blue-600">{t("admin.quoteInvoice.ui.quotes_7b0257ce")}</button><span aria-hidden="true">â€º</span><span>{t("admin.quoteInvoice.ui.quote_details_4443d16a")}</span></nav>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><ReceiptText size={20} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl text-[var(--text-primary)]">{quote.quote_number}</h1><span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusStyle[quote.status] || statusStyle.Draft}`}>{quote.status}</span></div><p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{t("admin.quoteInvoice.ui.quote_for_aaca8b54")} {quote.customer_name}</p></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={isGeneratingPdf || isStoreLoading || isVariantsLoading} onClick={printQuote} className="quote-no-print inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"><Printer size={14} /> {isGeneratingPdf ? "Preparing..." : t("admin.pos.ui.print")}</button>
          <button type="button" disabled={isGeneratingPdf || isStoreLoading || isVariantsLoading} onClick={downloadPdf} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950"><Download size={14} /> {isGeneratingPdf || isStoreLoading || isVariantsLoading ? "Preparing PDF..." : "Download PDF"}</button>
          <button type="button" onClick={() => router.push("/admin/quotes")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-transparent bg-[var(--bg-tertiary)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-slate-200 dark:hover:bg-[var(--bg-tertiary)]"><ArrowLeft size={14} /> {t("admin.quoteInvoice.ui.all_quotes_0900db5f")}</button>
          {quote.status === "Accepted" && <button type="button" onClick={() => router.push(`/admin/invoices/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md"><FilePlus2 size={14} /> {t("admin.quoteInvoice.ui.convert_to_invoice_ff42ae9b")}</button>}
          {["Pending", "Draft"].includes(quote.status) && <><button type="button" onClick={() => router.push(`/admin/quotes/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><Pencil size={13} /> {t("admin.quoteInvoice.ui.edit_quote_540f4206")}</button><button type="button" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-60"><Send size={13} /> {sendMutation.isPending ? "Updating..." : "Mark as Sent"}</button></>}
          {quote.status === "Sent" && <><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Accepted")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={14} /> {t("admin.quoteInvoice.ui.accept_bb54db51")}</button><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Rejected")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-[var(--bg-card)] px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><X size={14} /> {t("admin.quoteInvoice.ui.reject_2b03b592")}</button></>}
        </div>
      </div>
    </header>

    <div ref={quotePreviewRef} className="w-full">
      <QuoteTemplateDesigner
        previewOnly
        form={{
          customer_name: quote.customer_name || "",
          customer_email: quote.customer_email || "",
          customer_phone: quote.customer_phone || "",
          customer_address: quote.customer_address || "",
          quote_date: quote.quote_date ? String(quote.quote_date).slice(0, 10) : "",
          expiry_date: quote.expiry_date ? String(quote.expiry_date).slice(0, 10) : "",
          terms: quote.terms || "",
          notes: quote.notes || "",
          items: quoteWithVariantNames.items.map((item, index) => ({ ...item, row_id: item._id || "saved-" + index })),
        }}
        totals={{ subtotal: quote.subtotal, discount: quote.discount, tax: quote.tax, total: quote.total }}
        quoteNumber={quote.quote_number}
        quoteStatus={quote.status}
        savedDesign={quote.pdf_design || {}}
        money={money}
      />
      </div>
      <div className="quote-no-print ml-auto w-full max-w-md">
        <ActivityTimeline events={quote.activity?.length ? quote.activity : [{ type: "created", at: quote.created_at, actor_name: quote.createdby?.name || "Staff", changes: [] }]} title="Quote activity" />
      </div>
      <style jsx global>{`
        @page { size: ${["tabloid", "legal", "letter", "a0", "a1", "a2", "a3", "a4", "a5"].includes(String(quote.pdf_design?.pageSize || "a4").toLowerCase()) ? String(quote.pdf_design?.pageSize || "a4").toLowerCase() : "a4"} ${quote.pdf_design?.orientation === "landscape" ? "landscape" : "portrait"}; margin: 10mm; }
        @media print {
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #quote-print-area, #quote-print-area * { visibility: visible !important; }
          #quote-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; color: #111827 !important; background: #fff !important; }
          #quote-print-area .quote-no-print, #quote-print-area button, #quote-print-area a { display: none !important; }
          #quote-print-area .quote-saved-preview { margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
          #quote-print-area .quote-saved-preview > div { padding: 0 !important; background: #fff !important; }
          #quote-print-area .quote-saved-preview [data-quote-document-page="true"] { width: 100% !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; box-shadow: none !important; zoom: 1 !important; break-after: page; page-break-after: always; }
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
