"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/apis/admin/quoteApi";
import { localizedVariantTitleOf, useLocalized } from "@/i18n/localize";
import { variantApi } from "@/apis/admin/variantApi";
import { storeApi } from "@/apis/admin/storeApi";
import QuoteTemplateDesigner, { getSavedQuotePdfDesign, QUOTE_TEMPLATE_STORAGE_KEY } from "@/components/admin/QuoteTemplateDesigner";
import ActivityTimeline from "@/components/admin/ActivityTimeline";
import { renderRichHtml } from "@/lib/termsContent";
import { downloadQuotePdf, getDocumentPageSpec, printQuotePdf } from "@/lib/invoicePdf";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, Check, Download, Printer, FilePlus2, Pencil, ReceiptText, X,
  Send, Eye, UserRound, CalendarDays, PackageCheck, Wallet, FileText } from
"lucide-react";

const money = (value, locale = "en-PK") => new Intl.NumberFormat(locale, { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const card = "rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm";
const statusStyle = { Pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300", Draft: "border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]", Sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300", Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300", Rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300" };

function getStatusEventDate(quote, targetStatus) {
  const events = Array.isArray(quote?.activity) ? quote.activity : [];
  const event = [...events].reverse().find((entry) =>
    (entry.changes || []).some((change) => String(change.field || "").toLowerCase() === "status" && String(change.after || "").toLowerCase() === targetStatus.toLowerCase())
  );
  return event?.at || null;
}

function Panel({ title, icon: Icon, trailing, children }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
    <div className="flex min-h-10 items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-3 py-2.5">
      {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"><Icon size={15} strokeWidth={2.4} /></span>}
      <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2><div className="ms-auto">{trailing}</div>
    </div>{children}
  </section>;
}

function PreviewModal({ onClose, children }) {
  return <div id="quote-preview-modal" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Quote preview" className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
      <header className="document-preview-modal-header flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Eye size={17} /></span><div><h2 className="text-sm font-extrabold text-[var(--text-primary)]">Quote preview</h2><p className="text-[10px] text-[var(--text-muted)]">Review the customer-facing quote</p></div></div><button type="button" onClick={onClose} aria-label="Close preview" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"><X size={17} /></button></header>
      <div className="min-h-0 overflow-auto bg-[var(--bg-secondary)] p-3 sm:p-5">{children}</div>
    </section>
  </div>;
}

export default function QuoteDetailPage({ params }) {const { t, locale } = useTranslation();
  const { productNameOf } = useLocalized();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloadQueued, setDownloadQueued] = useState(false);
  const [printQueued, setPrintQueued] = useState(false);
  const printHandled = useRef(false);
  const downloadPreviewRef = useRef(null);
  const quotePreviewRef = useRef(null);
  const { data: quote, isLoading, isError, error } = useQuery({ queryKey: ["quote-admin", id], queryFn: () => quoteApi.getById(id) });
  const { data: store = null, isLoading: isStoreLoading } = useQuery({ queryKey: ["store-public"], queryFn: () => storeApi.getPublic(), staleTime: 5 * 60 * 1000 });
  const { data: variants = [], isLoading: isVariantsLoading } = useQuery({ queryKey: ["quote-all-variants"], queryFn: () => variantApi.getAll(), staleTime: 5 * 60 * 1000 });
  const variantsById = useMemo(() => new Map(variants.map((variant) => [String(variant._id), variant])), [variants]);
  const quoteWithVariantNames = useMemo(() => quote ? {
    ...quote,
    items: (quote.items || []).map((item) => {
      const variant = variantsById.get(String(item.variant_id?._id || item.variant_id || ""));
      return {
        ...item,
        name: productNameOf(item.product_id || item.variant_id?.product_id) || item.name,
        variant_name:
          localizedVariantTitleOf(item.variant_id, locale) ||
          localizedVariantTitleOf(variant, locale) ||
          item.variant_name || "",
      };
    }),
  } : null, [quote, variantsById, productNameOf, locale]);
  const itemDiscountTotal = Math.round((quoteWithVariantNames?.items || []).reduce((sum, item) => sum + (Number(item.discount) || 0), 0) * 100) / 100;
  const additionalQuoteDiscount = Number(quote?.overall_discount) || 0;
  const taxableAmount = Math.round(Math.max(0, (Number(quote?.subtotal) || 0) - itemDiscountTotal - additionalQuoteDiscount) * 100) / 100;
  const localizedQuoteActivity = useMemo(() => {
    if (!quote) return [];
    const activityItems = quoteWithVariantNames?.items || [];
    const itemsBySku = new Map(activityItems.filter((item) => item.sku).map((item) => [String(item.sku), item]));
    return (quote.activity || []).map((event) => ({
      ...event,
      changes: (event.changes || []).map((change) => {
        const item = itemsBySku.get(String(change.sku || "")) ||
          activityItems.find((entry) => String(entry.name || "").trim().toLowerCase() === String(change.product_name || "").trim().toLowerCase());
        if (!item) return change;
        return {
          ...change,
          product_name: item.name || change.product_name,
          variant_title: item.variant_name || change.variant_title,
        };
      }),
    }));
  }, [quote, quoteWithVariantNames]);
  const sentAt = quote?.sent_at || getStatusEventDate(quote, "Sent") || (quote?.status === "Sent" ? quote.updated_at : null);
  useEffect(() => {
    if (searchParams.get("print") !== "1" || !quote || isLoading || isStoreLoading || isVariantsLoading || printHandled.current) return undefined;
    printHandled.current = true;
    const timer = window.setTimeout(() => {
      setIsGeneratingPdf(true);
      setPrintQueued(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoading, isStoreLoading, isVariantsLoading, quote, searchParams]);
  useEffect(() => {
    if (!downloadQueued || !downloadPreviewRef.current) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        if (cancelled) return;
        const pdfQuote = quoteWithVariantNames || quote;
        const quoteDesign = pdfQuote.pdf_design && Object.keys(pdfQuote.pdf_design).length
          ? pdfQuote.pdf_design
          : getSavedQuotePdfDesign(QUOTE_TEMPLATE_STORAGE_KEY);
        await downloadQuotePdf({ ...pdfQuote, pdf_design: quoteDesign }, store, downloadPreviewRef.current);
        toast.success("Quote PDF downloaded");
      } catch (downloadError) {
        console.error("Could not generate quote PDF:", downloadError);
        toast.error("Could not generate quote PDF");
      } finally {
        if (!cancelled) {
          setDownloadQueued(false);
          setIsGeneratingPdf(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [downloadQueued, quote, quoteWithVariantNames, store]);
  useEffect(() => {
    if (!printQueued || !downloadPreviewRef.current) return undefined;
    let cancelled = false;
    const finishPrint = () => {
      if (cancelled) return;
      setPrintQueued(false);
      setIsGeneratingPdf(false);
      printHandled.current = false;
      if (searchParams.get("print") === "1") router.replace(`/admin/quotes/${id}`, { scroll: false });
    };
    window.addEventListener("afterprint", finishPrint);
    const timer = window.setTimeout(async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        if (!cancelled) {
          const pdfQuote = quoteWithVariantNames || quote;
          const quoteDesign = pdfQuote.pdf_design && Object.keys(pdfQuote.pdf_design).length
            ? pdfQuote.pdf_design
            : getSavedQuotePdfDesign(QUOTE_TEMPLATE_STORAGE_KEY);
          await printQuotePdf({ ...pdfQuote, pdf_design: quoteDesign }, store, downloadPreviewRef.current);
        }
      } catch (printError) {
        console.error("Could not print quote:", printError);
        toast.error("Could not print quote");
        finishPrint();
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finishPrint);
    };
  }, [id, printQueued, router, searchParams, quote, quoteWithVariantNames, store]);
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
    if (isGeneratingPdf || isStoreLoading || isVariantsLoading) return;
    setIsGeneratingPdf(true);
    setDownloadQueued(true);
  };
  const printQuote = async () => {
    if (isGeneratingPdf || isStoreLoading || isVariantsLoading) return;
    setIsGeneratingPdf(true);
    setPrintQueued(true);
  };

  if (isLoading) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>{t("admin.quoteInvoice.ui.loading_quote_674da72a")}</div>;
  if (isError || !quote) return <div className={`${card} p-8 text-center`}><p className="text-sm font-semibold">{error?.response?.data?.message || "Quote not found"}</p><button type="button" onClick={() => router.push("/admin/quotes")} className="mt-3 text-sm font-semibold text-[var(--accent)]">{t("admin.quoteInvoice.ui.back_to_quotes_433f26bf")}</button></div>;

  return (
    <div id="quote-print-area" className="space-y-3 pb-4 text-[var(--text-primary)]">
    <header className="quote-no-print overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <nav aria-label={t("admin.quoteInvoice.ui.breadcrumb_c766e665")} className="mb-1.5 flex items-center gap-1.5 text-sm text-[var(--text-muted)]"><button type="button" onClick={() => router.push("/admin/quotes")} className="inline-flex items-center gap-1 hover:text-blue-600"><ArrowLeft size={14} />{t("admin.quoteInvoice.ui.quotes_7b0257ce")}</button><ChevronRight size={13} /><span className="text-[var(--text-primary)]">{quote.quote_number}</span></nav>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><ReceiptText size={20} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl text-[var(--text-primary)]">{quote.quote_number}</h1><span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusStyle[quote.status] || statusStyle.Draft}`}>{t(`admin.quoteInvoice.status.${String(quote.status || "Draft").toLowerCase()}`)}</span></div><p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{t("admin.quoteInvoice.ui.quote_for_aaca8b54")} {quote.customer_name}</p></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setPreviewOpen(true)} className="quote-no-print inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"><Eye size={14} /> Preview</button>
          <button type="button" disabled={isGeneratingPdf || isStoreLoading || isVariantsLoading} onClick={printQuote} className="quote-no-print inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"><Printer size={14} /> {isGeneratingPdf ? "Preparing..." : t("admin.pos.ui.print")}</button>
          <button type="button" disabled={isGeneratingPdf || isStoreLoading || isVariantsLoading} onClick={downloadPdf} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950"><Download size={14} /> {isGeneratingPdf || isStoreLoading || isVariantsLoading ? "Preparing PDF..." : "Download PDF"}</button>
          {quote.status === "Accepted" && <button type="button" onClick={() => router.push(`/admin/invoices/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md"><FilePlus2 size={14} /> {t("admin.quoteInvoice.ui.convert_to_invoice_ff42ae9b")}</button>}
          {["Pending", "Draft"].includes(quote.status) && <><button type="button" onClick={() => router.push(`/admin/quotes/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><Pencil size={13} /> {t("admin.quoteInvoice.ui.edit_quote_540f4206")}</button><button type="button" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-60"><Send size={13} /> {sendMutation.isPending ? "Updating..." : "Mark as Sent"}</button></>}
          {quote.status === "Sent" && <><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Accepted")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={14} /> {t("admin.quoteInvoice.ui.accept_bb54db51")}</button><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Rejected")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-[var(--bg-card)] px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><X size={14} /> {t("admin.quoteInvoice.ui.reject_2b03b592")}</button></>}
        </div>
      </div>
    </header>

    <div className="grid items-start gap-3 lg:grid-cols-12">
      <main className="min-w-0 space-y-3 lg:col-span-8">
        <div className="grid gap-3 md:grid-cols-2">
          <Panel title={t("admin.quoteInvoice.ui.customer_information_c996cd10")} icon={UserRound}>
            <div className="space-y-3 p-3 text-[13px] sm:p-4">
              <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{String(quote.customer_name || "C").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><div className="truncate text-base font-semibold text-[var(--text-primary)]">{quote.customer_name || "—"}</div><div className="mt-0.5 text-xs text-[var(--text-muted)]">{t("admin.documentDetail.field.customer")}</div></div></div>
              <div className="grid gap-x-4 gap-y-3 border-t border-[var(--border-color)] pt-3 sm:grid-cols-2">
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.invoiceDetail.field.email")}</p><p className="mt-1 break-words text-[13px] leading-5">{quote.customer_email || t("admin.documentDetail.field.notProvided")}</p></div>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.invoiceDetail.field.phone")}</p><p className="mt-1 break-words text-[13px] leading-5">{quote.customer_phone || t("admin.documentDetail.field.notProvided")}</p></div>
                <div className="min-w-0 sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.invoiceDetail.field.address")}</p><p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5">{quote.customer_address || t("admin.documentDetail.field.notProvided")}</p></div>
              </div>
            </div>
          </Panel>
          <Panel title={t("admin.documentDetail.panel.quoteSummary")} icon={FileText}>
            <div className="space-y-2 p-3 text-[12px] sm:p-4">
              <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.quoteDate")}</span><span className="text-right font-medium">{quote.quote_date ? new Date(quote.quote_date).toLocaleDateString(locale || undefined) : "—"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.validUntil")}</span><span className="text-right font-medium">{quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString(locale || undefined) : "—"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.items")}</span><span className="font-medium">{quoteWithVariantNames.items.length}</span></div>
              <div className="space-y-2 border-t border-[var(--border-color)] pt-2.5">
                <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.subtotal")}</span><bdi dir="ltr" className="text-end tabular-nums">{money(quote.subtotal, locale)}</bdi></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.itemDiscount")}</span><bdi dir="ltr" className="text-end tabular-nums text-rose-600">− {money(itemDiscountTotal, locale)}</bdi></div>
                {additionalQuoteDiscount > 0 && <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.overallDiscount")}{Number(quote.overall_discount_rate) > 0 ? ` (${Number(quote.overall_discount_rate)}%)` : ""}</span><bdi dir="ltr" className="text-end tabular-nums text-rose-600">− {money(additionalQuoteDiscount, locale)}</bdi></div>}
                <div className="flex justify-between gap-3 border-t border-[var(--border-color)] pt-2"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.taxableAmount")}</span><bdi dir="ltr" className="text-end tabular-nums">{money(taxableAmount, locale)}</bdi></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.totalTax")}</span><bdi dir="ltr" className="text-end tabular-nums">{money(quote.tax, locale)}</bdi></div>
                <div className="flex justify-between gap-3 border-t border-[var(--border-color)] pt-2 text-sm font-bold"><span>{t("admin.quoteDesigner.grandTotal")}</span><bdi dir="ltr" className="text-end tabular-nums text-emerald-600">{money(quote.total, locale)}</bdi></div>
              </div>
            </div>
          </Panel>
        </div>
        <Panel title={t("admin.documentDetail.panel.productsItems")} icon={PackageCheck} trailing={<span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{quoteWithVariantNames.items.length} {t("admin.documentDetail.field.items")}</span>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed text-start text-xs"><colgroup><col className="w-[4%]"/><col className="w-[30%]"/><col className="w-[8%]"/><col className="w-[8%]"/><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[14%]"/></colgroup><thead className="bg-[var(--bg-card-alt)] text-[var(--text-secondary)]"><tr>{["#", t("admin.invoiceDetail.column.product"), t("admin.invoiceDetail.column.sku"), t("admin.documentDetail.field.quantity"), t("admin.documentDetail.field.unitPrice"), t("admin.documentDetail.field.discount"), t("admin.documentDetail.field.tax"), t("admin.documentDetail.field.total")].map((heading, index) => <th key={heading} dir="auto" className={`whitespace-nowrap px-2.5 py-2.5 font-semibold ${index >= 3 ? "text-end" : "text-start"}`}>{heading}</th>)}</tr></thead><tbody>{quoteWithVariantNames.items.map((item, index) => <tr key={item._id || index} className="border-t border-[var(--border-color)]"><td className="px-2.5 py-2.5 text-[var(--text-muted)]"><bdi dir="ltr">{index + 1}</bdi></td><td className="min-w-0 px-2.5 py-2.5 align-top"><bdi dir="auto" className="block whitespace-normal break-words font-semibold leading-5">{item.name || "—"}</bdi><bdi dir="auto" className="mt-0.5 block whitespace-normal break-words text-[10px] leading-4 text-[var(--text-muted)]">{item.variant_name || ""}</bdi></td><td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-[var(--text-muted)]"><bdi dir="ltr">{item.sku || "—"}</bdi></td><td className="px-2.5 py-2.5 text-end"><bdi dir="ltr" className="tabular-nums">{item.quantity ?? item.qty ?? 0}</bdi></td><td className="whitespace-nowrap px-2.5 py-2.5 text-end"><bdi dir="ltr" className="tabular-nums">{money(item.unit_price, locale)}</bdi></td><td className="whitespace-nowrap px-2.5 py-2.5 text-end"><bdi dir="ltr" className="block tabular-nums text-rose-600">− {money(item.discount, locale)}</bdi><span className="mt-0.5 block text-[10px] text-[var(--text-muted)]"><bdi dir="ltr">{Number(item.discount_rate) || 0}%</bdi></span></td><td className="whitespace-nowrap px-2.5 py-2.5 text-end"><bdi dir="ltr" className="block tabular-nums">{money(item.tax, locale)}</bdi><span className="mt-0.5 block text-[10px] text-[var(--text-muted)]"><bdi dir="ltr">{Number(item.tax_rate) || 0}%</bdi></span></td><td className="whitespace-nowrap px-2.5 py-2.5 text-end font-semibold"><bdi dir="ltr" className="tabular-nums">{money(item.total ?? item.line_total ?? ((Number(item.quantity ?? item.qty) || 0) * (Number(item.unit_price) || 0) - (Number(item.discount) || 0) + (Number(item.tax) || 0)), locale)}</bdi></td></tr>)}{!quoteWithVariantNames.items.length && <tr><td colSpan={8} className="p-8 text-center text-sm text-[var(--text-muted)]">{t("admin.documentDetail.empty.noQuoteItems")}</td></tr>}</tbody></table></div>
        </Panel>
        {(quote.notes || quote.terms) && <Panel title={t("admin.documentDetail.panel.notesTerms")} icon={FileText}><div className="space-y-2.5 p-3 text-xs leading-5 text-[var(--text-secondary)] sm:p-4">{quote.notes && <p className="whitespace-pre-wrap">{quote.notes}</p>}{quote.terms && (/<[a-z][\s\S]*>/i.test(quote.terms) ? <div className="quote-rich-terms break-words [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_li]:my-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_a]:text-blue-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: renderRichHtml(quote.terms) }} /> : <p className="whitespace-pre-wrap">{quote.terms}</p>)}</div></Panel>}
      </main>
      <aside className="min-w-0 space-y-3 lg:col-span-4">
        <Panel title={t("admin.documentDetail.panel.quoteStatus")} icon={CalendarDays}>
          <div className="space-y-2.5 p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{t("admin.documentDetail.field.currentStatus")}</span><span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${statusStyle[quote.status] || statusStyle.Draft}`}>{t(`admin.quoteInvoice.status.${String(quote.status || "Draft").toLowerCase()}`)}</span></div>
            <div className="space-y-2 border-t border-[var(--border-color)] pt-2.5 text-xs"><div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.invoiceDetail.field.created")}</span><span className="text-right">{quote.created_at ? new Date(quote.created_at).toLocaleString(locale || undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}</span></div>{quote.status === "Sent" && <div className="flex justify-between gap-3"><span className="text-[var(--text-muted)]">{t("admin.documentDetail.field.sent")}</span><span className="text-right">{sentAt ? new Date(sentAt).toLocaleString(locale || undefined, { dateStyle: "medium", timeStyle: "short" }) : t("admin.documentDetail.field.notAvailable")}</span></div>}</div>
          </div>
        </Panel>
        <ActivityTimeline events={localizedQuoteActivity.length ? localizedQuoteActivity : [{ type: "created", at: quote.created_at, actor_name: quote.createdby?.name || "", changes: [] }]} title={t("admin.documentDetail.panel.quoteActivity")} emptyText={t("admin.documentDetail.activity.empty")} />
      </aside>
    </div>
    {(downloadQueued || printQueued) && <div aria-hidden="true" data-quote-pdf-capture-root="true" style={{ position: "fixed", left: "-12000px", top: 0, width: `${Math.round(getDocumentPageSpec(quote.pdf_design || {}).width / 25.4 * 96)}px`, pointerEvents: "none", zIndex: -1 }}><div ref={downloadPreviewRef} className="w-full"><QuoteTemplateDesigner previewOnly form={{ customer_name: quote.customer_name || "", customer_email: quote.customer_email || "", customer_phone: quote.customer_phone || "", customer_address: quote.customer_address || "", quote_date: quote.quote_date ? String(quote.quote_date).slice(0, 10) : "", expiry_date: quote.expiry_date ? String(quote.expiry_date).slice(0, 10) : "", terms: quote.terms || "", notes: quote.notes || "", items: quoteWithVariantNames.items.map((item, index) => ({ ...item, row_id: item._id || "saved-" + index })) }} totals={{ subtotal: quote.subtotal, itemDiscount: itemDiscountTotal, overallDiscount: additionalQuoteDiscount, taxableAmount, discount: quote.discount, tax: quote.tax, total: quote.total }} quoteNumber={quote.quote_number} quoteStatus={quote.status} savedDesign={quote.pdf_design || {}} money={money} /></div></div>}
    {previewOpen && <PreviewModal onClose={() => { if (printQueued) { setPrintQueued(false); setIsGeneratingPdf(false); printHandled.current = false; } setPreviewOpen(false); }}><div id="quote-document-preview" ref={quotePreviewRef} className="mx-auto w-full max-w-5xl"><QuoteTemplateDesigner previewOnly form={{ customer_name: quote.customer_name || "", customer_email: quote.customer_email || "", customer_phone: quote.customer_phone || "", customer_address: quote.customer_address || "", quote_date: quote.quote_date ? String(quote.quote_date).slice(0, 10) : "", expiry_date: quote.expiry_date ? String(quote.expiry_date).slice(0, 10) : "", terms: quote.terms || "", notes: quote.notes || "", items: quoteWithVariantNames.items.map((item, index) => ({ ...item, row_id: item._id || "saved-" + index })) }} totals={{ subtotal: quote.subtotal, itemDiscount: itemDiscountTotal, overallDiscount: additionalQuoteDiscount, taxableAmount, discount: quote.discount, tax: quote.tax, total: quote.total }} quoteNumber={quote.quote_number} quoteStatus={quote.status} savedDesign={quote.pdf_design || {}} money={money} /></div></PreviewModal>}
      <style jsx global>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #quote-print-area > :not(#quote-preview-modal), #quote-print-area > :not(#quote-preview-modal) * { display: none !important; }
          #quote-preview-modal { display: block !important; position: absolute !important; inset: 0 !important; z-index: auto !important; overflow: visible !important; padding: 0 !important; background: #fff !important; backdrop-filter: none !important; }
          #quote-preview-modal, #quote-preview-modal * { visibility: visible !important; }
          #quote-preview-modal > section { display: block !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
          #quote-preview-modal .document-preview-modal-header { display: none !important; }
          #quote-preview-modal > section > div { overflow: visible !important; padding: 0 !important; background: #fff !important; }
          #quote-document-preview { display: block !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          #quote-document-preview .quote-no-print, #quote-document-preview button, #quote-document-preview a { display: none !important; }
          #quote-document-preview .quote-preview-page-break { display: none !important; }
          #quote-document-preview .quote-saved-preview { display: block !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
          #quote-document-preview .quote-saved-preview [data-quote-document-page="true"] { display: block !important; width: 100% !important; max-width: none !important; height: auto !important; min-height: 0 !important; aspect-ratio: var(--quote-page-ratio) !important; margin: 0 !important; box-shadow: none !important; zoom: 1 !important; break-after: page; page-break-after: always; }
          #quote-document-preview .quote-preview-page-number { display: block !important; position: absolute !important; right: 8mm !important; bottom: 6mm !important; margin: 0 !important; padding: 0 !important; }
          #quote-document-preview .quote-saved-preview [data-quote-document-page="true"]:last-child { break-after: auto; page-break-after: auto; }
          #quote-document-preview, #quote-document-preview * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};
