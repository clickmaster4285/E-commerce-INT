"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { quoteApi } from "@/apis/admin/quoteApi";
import { variantApi } from "@/apis/admin/variantApi";
import { storeApi } from "@/apis/admin/storeApi";
import { downloadQuotePdf } from "@/lib/invoicePdf";
import { toast } from "sonner";
import {
  ArrowLeft, BadgeCheck, CalendarDays, Check, Clock3, Download, FileText, Printer,
  FilePlus2, Mail, MapPin, Package, Pencil, Phone, ReceiptText, UserRound, X,
  Send } from
"lucide-react";

const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const date = (value, withTime = false) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString([], withTime ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { year: "numeric", month: "short", day: "numeric" }) : "—";
const card = "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const statusStyle = { Pending: "border-amber-200 bg-amber-50 text-amber-700", Draft: "border-slate-200 bg-slate-100 text-slate-700", Sent: "border-blue-200 bg-blue-50 text-blue-700", Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700", Rejected: "border-rose-200 bg-rose-50 text-rose-700" };
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => !url || /^(https?:|blob:|data:)/i.test(url) ? url || "" : API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;

export default function QuoteDetailPage({ params }) {const { t } = useTranslation();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [showAllItems, setShowAllItems] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printHandled = useRef(false);
  const { data: quote, isLoading, isError, error } = useQuery({ queryKey: ["quote-admin", id], queryFn: () => quoteApi.getById(id) });
  const { data: store = null, isLoading: isStoreLoading } = useQuery({ queryKey: ["store-public"], queryFn: () => storeApi.getPublic(), staleTime: 5 * 60 * 1000 });
  const { data: variants = [] } = useQuery({ queryKey: ["quote-all-variants"], queryFn: () => variantApi.getAll(), staleTime: 2 * 60 * 1000 });
  useEffect(() => {
    if (searchParams.get("print") !== "1" || !quote || isLoading || printHandled.current) return undefined;
    printHandled.current = true;
    const timer = window.setTimeout(() => {
      window.print();
      router.replace(`/admin/quotes/${id}`, { scroll: false });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [id, isLoading, quote, router, searchParams]);
  const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]));
  const visibleItems = showAllItems ? quote?.items || [] : (quote?.items || []).slice(0, 10);
  const statusMutation = useMutation({
    mutationFn: (status) => quoteApi.updateStatus(id, status),
    onSuccess: () => {toast.success("Quote status updated");qc.invalidateQueries({ queryKey: ["quote-admin", id] });qc.invalidateQueries({ queryKey: ["quotes-admin"] });},
    onError: (e) => toast.error(e?.response?.data?.message || "Could not update quote")
  });
  const sendMutation = useMutation({
    mutationFn: () => quoteApi.update(id, { ...quote, status: "Sent" }),
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
      await downloadQuotePdf(quote, store);
      toast.success("Quote PDF downloaded");
    } catch (downloadError) {
      console.error("Could not generate quote PDF:", downloadError);
      toast.error("Could not generate quote PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const printQuote = () => window.print();

  if (isLoading) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>{t("admin.quoteInvoice.ui.loading_quote_674da72a")}</div>;
  if (isError || !quote) return <div className={`${card} p-8 text-center`}><p className="text-sm font-semibold">{error?.response?.data?.message || "Quote not found"}</p><button type="button" onClick={() => router.push("/admin/quotes")} className="mt-3 text-sm font-semibold text-[var(--accent)]">{t("admin.quoteInvoice.ui.back_to_quotes_433f26bf")}</button></div>;

  return <div id="quote-print-area" className="-mx-3 w-[calc(100%+1.5rem)] max-w-none space-y-3 pb-6 text-[var(--text-primary)] sm:-mx-5 sm:w-[calc(100%+2.5rem)]">
    <header className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="min-w-0">
          <nav aria-label={t("admin.quoteInvoice.ui.breadcrumb_c766e665")} className="mb-3 flex items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]"><button type="button" onClick={() => router.push("/admin/quotes")} className="hover:text-blue-600">{t("admin.quoteInvoice.ui.quotes_7b0257ce")}</button><span aria-hidden="true">›</span><span>{t("admin.quoteInvoice.ui.quote_details_4443d16a")}</span></nav>
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ReceiptText size={21} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{quote.quote_number}</h1><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle[quote.status] || statusStyle.Draft}`}>{quote.status}</span></div><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.quote_for_aaca8b54")} {quote.customer_name}</p></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={printQuote} className="quote-no-print inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><Printer size={14} /> {t("admin.pos.ui.print")}</button>
          <button type="button" disabled={isGeneratingPdf || isStoreLoading} onClick={downloadPdf} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"><Download size={14} /> {isGeneratingPdf || isStoreLoading ? "Preparing PDF..." : "Download PDF"}</button>
          <button type="button" onClick={() => router.push("/admin/quotes")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><ArrowLeft size={14} /> {t("admin.quoteInvoice.ui.all_quotes_0900db5f")}</button>
          {["Pending", "Draft"].includes(quote.status) && <><button type="button" onClick={() => router.push(`/admin/quotes/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><Pencil size={13} /> {t("admin.quoteInvoice.ui.edit_quote_540f4206")}</button><button type="button" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-60"><Send size={13} /> {sendMutation.isPending ? "Updating..." : "Mark as Sent"}</button></>}
          {quote.status === "Sent" && <><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Accepted")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={14} /> {t("admin.quoteInvoice.ui.accept_bb54db51")}</button><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Rejected")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><X size={14} /> {t("admin.quoteInvoice.ui.reject_2b03b592")}</button></>}
          {quote.status === "Accepted" && <button type="button" onClick={() => router.push(`/admin/invoices/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md"><FilePlus2 size={14} /> {t("admin.quoteInvoice.ui.convert_to_invoice_ff42ae9b")}</button>}
        </div>
      </div>
    </header>

    <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("admin.quoteInvoice.ui.quote_overview_db001afc")}>
      <Overview icon={ReceiptText} label="Quote number" value={quote.quote_number} />
      <Overview icon={CalendarDays} label="Quote date" value={date(quote.quote_date)} />
      <Overview icon={Clock3} label="Valid until" value={date(quote.expiry_date)} accent="emerald" />
      <Overview icon={BadgeCheck} label="Current status" value={quote.status} badge={statusStyle[quote.status] || statusStyle.Draft} />
    </section>

    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={Package} title={t("admin.quoteInvoice.ui.quote_items_72bea172")} detail={`${quote.items.length} ${quote.items.length === 1 ? "item" : "items"}`} />
          <div className="overflow-x-auto p-2.5 sm:p-3"><table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
            <thead><tr className="bg-slate-50 text-[9px] font-bold uppercase tracking-wide text-slate-500"><th className="rounded-l-lg px-2.5 py-2.5">{t("admin.quoteInvoice.ui.product_variant_fa53c5ab")}</th><th className="px-2.5 py-2.5">{t("admin.quoteInvoice.ui.sku_d59192b9")}</th><th className="px-2.5 py-2.5 text-center">{t("admin.quoteInvoice.ui.qty_1e5ff9e5")}</th><th className="px-2.5 py-2.5 text-right">{t("admin.quoteInvoice.ui.unit_price_3c6c777f")}</th><th className="px-2.5 py-2.5 text-right">{t("admin.quoteInvoice.ui.discount_b524936d")}</th><th className="px-2.5 py-2.5 text-right">{t("admin.quoteInvoice.ui.tax_9be70f66")}</th><th className="rounded-r-lg px-2.5 py-2.5 text-right">{t("admin.quoteInvoice.ui.total_b25928c6")}</th></tr></thead>
            <tbody>{visibleItems.map((item, index) => {const variant = variantsById.get(String(item.variant_id?._id || item.variant_id));const image = variant?.images?.[0]?.img_url || variant?.image || "";return <tr key={item._id || `${item.variant_id}-${index}`} className="group transition hover:bg-blue-50/40"><td className="border-b border-[var(--border-color)] px-2.5 py-2"><div className="flex items-center gap-2.5">{image ? <Image src={getImageUrl(image)} alt={item.name || "Product variant"} width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-color)] bg-slate-50 object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><Package size={16} /></span>}<span className="min-w-0"><span className="block max-w-sm truncate text-xs font-bold">{item.name}</span><span className="mt-0.5 block text-[9px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.variant_cc91b1ea")} {String(index + 1).padStart(2, "0")}</span></span></div></td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-[10px] text-[var(--text-muted)]">{item.sku || variant?.sku || "—"}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-center text-xs font-semibold tabular-nums">{item.quantity}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs tabular-nums">{money(item.unit_price)}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs tabular-nums">{money(item.discount)}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs tabular-nums">{money(item.tax)}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs font-bold tabular-nums">{money(item.total)}</td></tr>;})}</tbody>
          </table>{quote.items.length > 10 && <div className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] px-1 pt-3"><span className="text-[10px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.showing_163d8174")} {visibleItems.length} {t("admin.quoteInvoice.ui.of_de04fa0e")} {quote.items.length} {t("admin.quoteInvoice.ui.items_7316c8b2")}</span><button type="button" onClick={() => setShowAllItems((shown) => !shown)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100">{showAllItems ? "Show less" : `Show more (${quote.items.length - 10})`}</button></div>}</div>
        </section>

        {(quote.terms || quote.notes) && <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={FileText} title={t("admin.quoteInvoice.ui.quote_notes_terms_05fb624f")} detail="Information entered for this quote" />
          <div className="grid gap-3 p-4 md:grid-cols-2">{quote.terms && <TextPanel title={t("admin.quoteInvoice.ui.terms_conditions_01d5a15f")} value={quote.terms} />}{quote.notes && <TextPanel title={t("admin.quoteInvoice.ui.additional_notes_41b5f2e6")} value={quote.notes} />}</div>
        </section>}
      </div>

      <aside className="space-y-3">
        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={UserRound} title={t("admin.quoteInvoice.ui.customer_information_49a89ca9")} />
          <div className="space-y-0 px-4 py-1">
            <ContactRow icon={UserRound} label="Customer" value={quote.customer_name} />
            <ContactRow icon={Mail} label="Email" value={quote.customer_email} empty="No email provided" />
            <ContactRow icon={Phone} label="Phone" value={quote.customer_phone} empty="No phone provided" />
            <ContactRow icon={MapPin} label="Address" value={quote.customer_address} empty="No address provided" last />
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={ReceiptText} title={t("admin.quoteInvoice.ui.quote_summary_fb4dc1e8")} />
          <div className="space-y-2.5 p-3.5">
            <AmountRow label="Subtotal" value={money(quote.subtotal)} />
            {Number(quote.overall_discount) > 0 && <AmountRow label="Overall discount" value={`− ${money(quote.overall_discount)}`} />}
            {Number(quote.discount) > Number(quote.overall_discount) && <AmountRow label="Item discounts" value={`− ${money(Number(quote.discount) - Number(quote.overall_discount))}`} />}
            <AmountRow label={`Tax${Number(quote.tax_rate) ? ` (${Number(quote.tax_rate)}%)` : ""}`} value={`+ ${money(quote.tax)}`} />
            <div className="border-t border-dashed border-slate-300 pt-3"><div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 py-3 text-white shadow-[0_6px_16px_rgba(37,99,235,0.2)]"><span className="text-xs font-bold">{t("admin.quoteInvoice.ui.grand_total_650fe991")}</span><strong className="text-base font-extrabold tabular-nums">{money(quote.total)}</strong></div></div>
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={Clock3} title={t("admin.quoteInvoice.ui.record_activity_e571f414")} />
          <div className="space-y-2.5 p-3.5"><Activity label="Quote created" value={date(quote.created_at, true)} /><Activity label="Last updated" value={date(quote.updated_at, true)} last /></div>
        </section>
      </aside>
    </div>
    <style jsx global>{`
      @page { size: A4 portrait; margin: 14mm; }
      @media print {
        html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
        body * { visibility: hidden !important; }
        #quote-print-area, #quote-print-area * { visibility: visible !important; }
        #quote-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; color: #111827 !important; background: #fff !important; }
        #quote-print-area .quote-no-print, #quote-print-area button, #quote-print-area a { display: none !important; }
        #quote-print-area > div.grid { display: block !important; }
        #quote-print-area > div.grid > div, #quote-print-area aside { display: block !important; break-inside: auto !important; }
        #quote-print-area section { break-inside: auto !important; box-shadow: none !important; }
        #quote-print-area header { break-inside: avoid; box-shadow: none !important; }
        #quote-print-area section > div:first-child { break-after: avoid; }
        #quote-print-area tr { break-inside: avoid; }
        #quote-print-area .overflow-x-auto { overflow: visible !important; }
        #quote-print-area table { width: 100% !important; min-width: 0 !important; border-collapse: collapse !important; }
        #quote-print-area th, #quote-print-area td { color: #111827 !important; border-color: #d1d5db !important; }
        #quote-print-area img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>
  </div>;
}

function SectionHeading({ icon: Icon, title, detail }) {const { t } = useTranslation();return <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-3.5 py-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon size={15} /></span><div className="min-w-0"><h2 className="text-xs font-extrabold text-[var(--text-primary)]">{title}</h2>{detail && <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">{detail}</p>}</div></div>;}
function Overview({ icon: Icon, label, value, badge, accent = "blue" }) {const { t } = useTranslation();const tones = accent === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600";return <div className={`${card} flex min-w-0 items-center gap-2.5 p-3`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones}`}><Icon size={15} /></span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>{badge ? <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge}`}>{value}</span> : <p className="mt-1 truncate text-xs font-bold text-[var(--text-primary)]">{value || "—"}</p>}</div></div>;}
function ContactRow({ icon: Icon, label, value, empty, last }) {const { t } = useTranslation();return <div className={`flex items-center gap-3 py-3 ${last ? "" : "border-b border-[var(--border-color)]"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon size={14} /></span><div className="min-w-0"><p className="text-[9px] font-medium text-[var(--text-muted)]">{label}</p><p className={`mt-0.5 break-all text-xs font-semibold ${value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{value || empty}</p></div></div>;}
function AmountRow({ label, value }) {const { t } = useTranslation();return <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-[var(--text-secondary)]">{label}</span><span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">{value}</span></div>;}
function TextPanel({ title, value }) {const { t } = useTranslation();return <div className="rounded-xl border border-[var(--border-color)] bg-slate-50/70 p-3.5"><h3 className="text-[10px] font-bold text-[var(--text-secondary)]">{title}</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-primary)]">{value}</p></div>;}
function Activity({ label, value, last }) {const { t } = useTranslation();return <div className="relative flex gap-3"><span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Clock3 size={12} /></span>{!last && <span className="absolute left-3 top-6 h-[calc(100%+4px)] w-px bg-slate-200" />}<div className="min-w-0 pb-1"><p className="text-[10px] font-semibold text-[var(--text-primary)]">{label}</p><p className="mt-0.5 text-[9px] text-[var(--text-muted)]">{value}</p></div></div>;}
