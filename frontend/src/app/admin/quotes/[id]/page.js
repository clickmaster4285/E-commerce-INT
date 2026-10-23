"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { quoteApi } from "@/apis/admin/quoteApi";
import { variantApi } from "@/apis/admin/variantApi";
import { storeApi } from "@/apis/admin/storeApi";
import { toast } from "sonner";
import {
  ArrowLeft, BadgeCheck, CalendarDays, Check, Clock3, Download, FileText,
  FilePlus2, Mail, MapPin, Package, Pencil, Phone, ReceiptText, UserRound, X,
  Send,
} from "lucide-react";

const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const date = (value, withTime = false) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString([], withTime ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { year: "numeric", month: "short", day: "numeric" }) : "—";
const card = "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const statusStyle = { Pending: "border-amber-200 bg-amber-50 text-amber-700", Draft: "border-slate-200 bg-slate-100 text-slate-700", Sent: "border-blue-200 bg-blue-50 text-blue-700", Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700", Rejected: "border-rose-200 bg-rose-50 text-rose-700" };
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => !url || /^(https?:|blob:|data:)/i.test(url) ? url || "" : API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;

function createQuotePdf(quote, store, JsPDF) {
  const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const columns = [57, 25, 12, 25, 20, 15, 24];
  let y = 0;

  const write = (value, x, yPosition, width, size = 8, style = "normal", color = [15, 23, 42], align = "left") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(String(value || "—").replace(/\u00a0/g, " "), width);
    pdf.text(lines, x, yPosition, align === "right" ? { align: "right" } : undefined);
    return lines.length;
  };
  const pageHeading = (continued = false) => {
    pdf.setFillColor(15, 35, 70);
    pdf.rect(0, 0, pageWidth, continued ? 23 : 42, "F");
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, pageWidth, 3, "F");
    const companyName = store?.store_name || "Your Company";
    if (continued) {
      write(companyName, margin, 11, 100, 10, "bold", [255, 255, 255]);
      write(`QUOTE ${quote.quote_number}  |  CONTINUED`, margin, 18, contentWidth, 7, "normal", [191, 219, 254]);
      return 30;
    }

    const initials = companyName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CO";
    pdf.setFillColor(37, 99, 235);
    pdf.roundedRect(margin, 9, 14, 14, 3, 3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(initials, margin + 7, 18, { align: "center" });
    write(companyName, margin + 19, 12, 95, 12, "bold", [255, 255, 255]);
    if (store?.tagline) write(store.tagline, margin + 19, 18, 95, 6.5, "normal", [203, 213, 225]);
    const companyPhone = store?.phone || store?.support_phone;
    const companyEmail = store?.email || store?.support_email;
    if (companyPhone) write(`Phone: ${companyPhone}`, margin + 19, 24, 94, 6.5, "normal", [226, 232, 240]);
    if (companyEmail) write(`Email: ${companyEmail}`, margin + 19, 30, 94, 6.5, "normal", [226, 232, 240]);
    const companyAddress = [store?.address, store?.city, store?.state, store?.zip_code, store?.country].filter(Boolean).join(", ");
    if (companyAddress) write(companyAddress, margin + 19, 36, 94, 6, "normal", [203, 213, 225]);

    const quoteBlockRight = pageWidth - margin;
    write("QUOTATION", quoteBlockRight, 11, 58, 7, "bold", [147, 197, 253], "right");
    write(quote.quote_number, quoteBlockRight, 20, 58, 13, "bold", [255, 255, 255], "right");
    write(String(quote.status || "Pending").toUpperCase(), quoteBlockRight, 28, 58, 6.5, "bold", [191, 219, 254], "right");

    const cardY = 47;
    const gap = 5;
    const leftWidth = 104;
    const rightX = margin + leftWidth + gap;
    const rightWidth = contentWidth - leftWidth - gap;
    pdf.setDrawColor(219, 228, 241);
    pdf.setFillColor(248, 250, 253);
    pdf.roundedRect(margin, cardY, leftWidth, 35, 3, 3, "FD");
    pdf.roundedRect(rightX, cardY, rightWidth, 35, 3, 3, "FD");
    write("PREPARED FOR", margin + 5, cardY + 7, leftWidth - 10, 6.5, "bold", [100, 116, 139]);
    write(quote.customer_name, margin + 5, cardY + 14, leftWidth - 10, 10, "bold");
    const customerContact = [quote.customer_email, quote.customer_phone].filter(Boolean).join("  |  ");
    if (customerContact) write(customerContact, margin + 5, cardY + 21, leftWidth - 10, 7, "normal", [71, 85, 105]);
    if (quote.customer_address) write(quote.customer_address, margin + 5, cardY + 28, leftWidth - 10, 6.5, "normal", [71, 85, 105]);

    const metadata = [
      ["QUOTE DATE", date(quote.quote_date)],
      ["VALID UNTIL", date(quote.expiry_date)],
      ["CUSTOMER TYPE", quote.customer_type || "Other"],
      ["PREPARED BY", quote.createdby?.name || "Staff"],
    ];
    metadata.forEach(([label, value], index) => {
      const rowY = cardY + 7 + index * 7;
      write(label, rightX + 5, rowY, 27, 5.2, "bold", [100, 116, 139]);
      write(value, rightX + 33, rowY, rightWidth - 38, 6.2, "bold", [15, 23, 42]);
    });
    return 89;
  };
  const drawTableHeading = () => {
    const headerHeight = 10;
    pdf.setFillColor(30, 64, 175);
    pdf.roundedRect(margin, y, contentWidth, headerHeight, 2, 2, "F");
    const labels = ["PRODUCT / VARIANT", "SKU", "QTY", "UNIT PRICE", "DISCOUNT", "TAX", "TOTAL"];
    let x = margin;
    labels.forEach((label, index) => {
      const rightAligned = index > 1;
      write(label, rightAligned ? x + columns[index] - 3 : x + 3, y + 6.5, columns[index] - 6, 6.5, "bold", [255, 255, 255], rightAligned ? "right" : "left");
      x += columns[index];
    });
    y += headerHeight;
  };
  const nextItemsPage = () => {
    pdf.addPage();
    y = pageHeading(true);
    drawTableHeading();
  };

  y = pageHeading();
  drawTableHeading();
  (quote.items || []).forEach((item, index) => {
    const nameLines = pdf.splitTextToSize(String(item.name || `Item ${index + 1}`).replace(/\u00a0/g, " "), columns[0] - 8);
    const rowHeight = Math.max(11, nameLines.length * 4.2 + 5);
    if (y + rowHeight > pageHeight - 17) nextItemsPage();
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, y, contentWidth, rowHeight, "F");
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
    const cells = [item.name || `Item ${index + 1}`, item.sku || "—", String(item.quantity ?? 0), money(item.unit_price), money(item.discount), money(item.tax), money(item.total)];
    let x = margin;
    cells.forEach((value, cellIndex) => {
      const rightAligned = cellIndex > 1;
      const textX = rightAligned ? x + columns[cellIndex] - 3 : x + 3;
      write(value, textX, y + 5.5, columns[cellIndex] - 7, 7.5, cellIndex === 6 ? "bold" : "normal", [15, 23, 42], rightAligned ? "right" : "left");
      x += columns[cellIndex];
    });
    y += rowHeight;
  });

  const summaryRows = [["Subtotal", money(quote.subtotal)]];
  if (Number(quote.overall_discount) > 0) summaryRows.push([`Overall discount (${Number(quote.overall_discount_rate) || 0}%)`, `- ${money(quote.overall_discount)}`]);
  const itemDiscount = Number(quote.discount || 0) - Number(quote.overall_discount || 0);
  if (itemDiscount > 0) summaryRows.push(["Item discounts", `- ${money(itemDiscount)}`]);
  summaryRows.push([`Tax${Number(quote.tax_rate) ? ` (${Number(quote.tax_rate)}%)` : ""}`, `+ ${money(quote.tax)}`]);
  if (y + 30 + summaryRows.length * 6 > pageHeight - 15) {
    pdf.addPage();
    y = pageHeading(true);
  }
  y += 7;
  const summaryWidth = 88;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryTop = y;
  const summaryBoxHeight = summaryRows.length * 6 + 19;
  pdf.setDrawColor(219, 234, 254);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(summaryX, summaryTop, summaryWidth, summaryBoxHeight, 3, 3, "FD");
  summaryRows.forEach(([label, value], index) => {
    const rowY = summaryTop + 7 + index * 6;
    write(label, summaryX + 5, rowY, 45, 7, "normal", [71, 85, 105]);
    pdf.text(value.replace(/\u00a0/g, " "), summaryX + summaryWidth - 5, rowY, { align: "right" });
  });
  const totalY = summaryTop + summaryRows.length * 6 + 10;
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(summaryX + 3, totalY - 5, summaryWidth - 6, 12, 2, 2, "F");
  write("GRAND TOTAL", summaryX + 6, totalY + 2, 42, 7, "bold", [255, 255, 255]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  pdf.text(money(quote.total).replace(/\u00a0/g, " "), summaryX + summaryWidth - 6, totalY + 2, { align: "right" });
  y = totalY + 13;

  const paragraphs = [["Terms & Conditions", quote.terms], ["Additional Notes", quote.notes]].filter(([, value]) => value);
  paragraphs.forEach(([title, body]) => {
    const lines = pdf.splitTextToSize(String(body).replace(/\u00a0/g, " "), contentWidth - 10);
    let cursor = 0;
    while (cursor < lines.length) {
      if (y + 20 > pageHeight - 15) {
        pdf.addPage();
        y = pageHeading(true);
      }
      const availableLines = Math.max(1, Math.floor((pageHeight - 18 - (y + 12)) / 4.2));
      const pageLines = lines.slice(cursor, cursor + availableLines);
      const boxHeight = 12 + pageLines.length * 4.2;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");
      write(cursor === 0 ? title : `${title} (continued)`, margin + 5, y + 6, contentWidth - 10, 7.5, "bold", [51, 65, 85]);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text(pageLines, margin + 5, y + 11);
      cursor += pageLines.length;
      y += boxHeight + 4;
    }
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    write("Thank you for considering our offer.", margin, pageHeight - 6, contentWidth - 20, 6.5, "normal", [100, 116, 139]);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }
  return pdf;
}

export default function QuoteDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [showAllItems, setShowAllItems] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { data: quote, isLoading, isError, error } = useQuery({ queryKey: ["quote-admin", id], queryFn: () => quoteApi.getById(id) });
  const { data: store = null, isLoading: isStoreLoading } = useQuery({ queryKey: ["store-public"], queryFn: () => storeApi.getPublic(), staleTime: 5 * 60 * 1000 });
  const { data: variants = [] } = useQuery({ queryKey: ["quote-all-variants"], queryFn: () => variantApi.getAll(), staleTime: 2 * 60 * 1000 });
  const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]));
  const visibleItems = showAllItems ? quote?.items || [] : (quote?.items || []).slice(0, 10);
  const statusMutation = useMutation({
    mutationFn: (status) => quoteApi.updateStatus(id, status),
    onSuccess: () => { toast.success("Quote status updated"); qc.invalidateQueries({ queryKey: ["quote-admin", id] }); qc.invalidateQueries({ queryKey: ["quotes-admin"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Could not update quote"),
  });
  const sendMutation = useMutation({
    mutationFn: () => quoteApi.update(id, { ...quote, status: "Sent" }),
    onSuccess: (saved) => {
      toast.success("Quote marked as sent");
      qc.invalidateQueries({ queryKey: ["quote-admin", id] });
      qc.invalidateQueries({ queryKey: ["quotes-admin"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Could not send quote"),
  });
  const downloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      createQuotePdf(quote, store, jsPDF).save(`${String(quote.quote_number || "quote").replace(/[^a-z0-9_-]/gi, "_")}.pdf`);
      toast.success("Quote PDF downloaded");
    } catch (downloadError) {
      console.error("Could not generate quote PDF:", downloadError);
      toast.error("Could not generate quote PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>Loading quote...</div>;
  if (isError || !quote) return <div className={`${card} p-8 text-center`}><p className="text-sm font-semibold">{error?.response?.data?.message || "Quote not found"}</p><button type="button" onClick={() => router.push("/admin/quotes")} className="mt-3 text-sm font-semibold text-[var(--accent)]">Back to quotes</button></div>;

  return <div className="-mx-3 w-[calc(100%+1.5rem)] max-w-none space-y-3 pb-6 text-[var(--text-primary)] sm:-mx-5 sm:w-[calc(100%+2.5rem)]">
    <header className={`${card} overflow-hidden`}>
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]"><button type="button" onClick={() => router.push("/admin/quotes")} className="hover:text-blue-600">Quotes</button><span aria-hidden="true">›</span><span>Quote details</span></nav>
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ReceiptText size={21} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{quote.quote_number}</h1><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle[quote.status] || statusStyle.Draft}`}>{quote.status}</span></div><p className="mt-1 truncate text-xs text-[var(--text-muted)]">Quote for {quote.customer_name}</p></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={isGeneratingPdf || isStoreLoading} onClick={downloadPdf} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"><Download size={14} /> {isGeneratingPdf || isStoreLoading ? "Preparing PDF..." : "Download PDF"}</button>
          <button type="button" onClick={() => router.push("/admin/quotes")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><ArrowLeft size={14} /> All quotes</button>
          {["Pending", "Draft"].includes(quote.status) && <><button type="button" onClick={() => router.push(`/admin/quotes/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:text-blue-700"><Pencil size={13} /> Edit quote</button><button type="button" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-60"><Send size={13} /> {sendMutation.isPending ? "Updating..." : "Mark as Sent"}</button></>}
          {quote.status === "Sent" && <><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Accepted")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={14} /> Accept</button><button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("Rejected")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><X size={14} /> Reject</button></>}
          {quote.status === "Accepted" && <button type="button" onClick={() => router.push(`/admin/invoices/new?quote=${quote._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md"><FilePlus2 size={14} /> Convert to Invoice</button>}
        </div>
      </div>
    </header>

    <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Quote overview">
      <Overview icon={ReceiptText} label="Quote number" value={quote.quote_number} />
      <Overview icon={CalendarDays} label="Quote date" value={date(quote.quote_date)} />
      <Overview icon={Clock3} label="Valid until" value={date(quote.expiry_date)} accent="emerald" />
      <Overview icon={BadgeCheck} label="Current status" value={quote.status} badge={statusStyle[quote.status] || statusStyle.Draft} />
    </section>

    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={Package} title="Quote items" detail={`${quote.items.length} ${quote.items.length === 1 ? "item" : "items"}`} />
          <div className="overflow-x-auto p-2.5 sm:p-3"><table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
            <thead><tr className="bg-slate-50 text-[9px] font-bold uppercase tracking-wide text-slate-500"><th className="rounded-l-lg px-2.5 py-2.5">Product / Variant</th><th className="px-2.5 py-2.5">SKU</th><th className="px-2.5 py-2.5 text-center">Qty</th><th className="px-2.5 py-2.5 text-right">Unit price</th><th className="px-2.5 py-2.5 text-right">Discount</th><th className="px-2.5 py-2.5 text-right">Tax</th><th className="rounded-r-lg px-2.5 py-2.5 text-right">Total</th></tr></thead>
            <tbody>{visibleItems.map((item, index) => { const variant = variantsById.get(String(item.variant_id?._id || item.variant_id)); const image = variant?.images?.[0]?.img_url || variant?.image || ""; return <tr key={item._id || `${item.variant_id}-${index}`} className="group transition hover:bg-blue-50/40"><td className="border-b border-[var(--border-color)] px-2.5 py-2"><div className="flex items-center gap-2.5">{image ? <Image src={getImageUrl(image)} alt={item.name || "Product variant"} width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-color)] bg-slate-50 object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><Package size={16} /></span>}<span className="min-w-0"><span className="block max-w-sm truncate text-xs font-bold">{item.name}</span><span className="mt-0.5 block text-[9px] text-[var(--text-muted)]">Variant {String(index + 1).padStart(2, "0")}</span></span></div></td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-[10px] text-[var(--text-muted)]">{item.sku || variant?.sku || "—"}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-center text-xs font-semibold tabular-nums">{item.quantity}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs tabular-nums">{money(item.unit_price)}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs tabular-nums">{money(item.discount)}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs tabular-nums">{money(item.tax)}</td><td className="border-b border-[var(--border-color)] px-2.5 py-2 text-right text-xs font-bold tabular-nums">{money(item.total)}</td></tr>; })}</tbody>
          </table>{quote.items.length > 10 && <div className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] px-1 pt-3"><span className="text-[10px] text-[var(--text-muted)]">Showing {visibleItems.length} of {quote.items.length} items</span><button type="button" onClick={() => setShowAllItems((shown) => !shown)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100">{showAllItems ? "Show less" : `Show more (${quote.items.length - 10})`}</button></div>}</div>
        </section>

        {(quote.terms || quote.notes) && <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={FileText} title="Quote notes & terms" detail="Information entered for this quote" />
          <div className="grid gap-3 p-4 md:grid-cols-2">{quote.terms && <TextPanel title="Terms & conditions" value={quote.terms} />}{quote.notes && <TextPanel title="Additional notes" value={quote.notes} />}</div>
        </section>}
      </div>

      <aside className="space-y-3">
        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={UserRound} title="Customer information" />
          <div className="space-y-0 px-4 py-1">
            <ContactRow icon={UserRound} label="Customer" value={quote.customer_name} />
            <ContactRow icon={Mail} label="Email" value={quote.customer_email} empty="No email provided" />
            <ContactRow icon={Phone} label="Phone" value={quote.customer_phone} empty="No phone provided" />
            <ContactRow icon={MapPin} label="Address" value={quote.customer_address} empty="No address provided" last />
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={ReceiptText} title="Quote summary" />
          <div className="space-y-2.5 p-3.5">
            <AmountRow label="Subtotal" value={money(quote.subtotal)} />
            {Number(quote.overall_discount) > 0 && <AmountRow label="Overall discount" value={`− ${money(quote.overall_discount)}`} />}
            {Number(quote.discount) > Number(quote.overall_discount) && <AmountRow label="Item discounts" value={`− ${money(Number(quote.discount) - Number(quote.overall_discount))}`} />}
            <AmountRow label={`Tax${Number(quote.tax_rate) ? ` (${Number(quote.tax_rate)}%)` : ""}`} value={`+ ${money(quote.tax)}`} />
            <div className="border-t border-dashed border-slate-300 pt-3"><div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 py-3 text-white shadow-[0_6px_16px_rgba(37,99,235,0.2)]"><span className="text-xs font-bold">Grand total</span><strong className="text-base font-extrabold tabular-nums">{money(quote.total)}</strong></div></div>
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <SectionHeading icon={Clock3} title="Record activity" />
          <div className="space-y-2.5 p-3.5"><Activity label="Quote created" value={date(quote.created_at, true)} /><Activity label="Last updated" value={date(quote.updated_at, true)} last /></div>
        </section>
      </aside>
    </div>
  </div>;
}

function SectionHeading({ icon: Icon, title, detail }) { return <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-3.5 py-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon size={15} /></span><div className="min-w-0"><h2 className="text-xs font-extrabold text-[var(--text-primary)]">{title}</h2>{detail && <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">{detail}</p>}</div></div>; }
function Overview({ icon: Icon, label, value, badge, accent = "blue" }) { const tones = accent === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"; return <div className={`${card} flex min-w-0 items-center gap-2.5 p-3`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones}`}><Icon size={15} /></span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>{badge ? <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge}`}>{value}</span> : <p className="mt-1 truncate text-xs font-bold text-[var(--text-primary)]">{value || "—"}</p>}</div></div>; }
function ContactRow({ icon: Icon, label, value, empty, last }) { return <div className={`flex items-center gap-3 py-3 ${last ? "" : "border-b border-[var(--border-color)]"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon size={14} /></span><div className="min-w-0"><p className="text-[9px] font-medium text-[var(--text-muted)]">{label}</p><p className={`mt-0.5 break-all text-xs font-semibold ${value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{value || empty}</p></div></div>; }
function AmountRow({ label, value }) { return <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-[var(--text-secondary)]">{label}</span><span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">{value}</span></div>; }
function TextPanel({ title, value }) { return <div className="rounded-xl border border-[var(--border-color)] bg-slate-50/70 p-3.5"><h3 className="text-[10px] font-bold text-[var(--text-secondary)]">{title}</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-primary)]">{value}</p></div>; }
function Activity({ label, value, last }) { return <div className="relative flex gap-3"><span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Clock3 size={12} /></span>{!last && <span className="absolute left-3 top-6 h-[calc(100%+4px)] w-px bg-slate-200" />}<div className="min-w-0 pb-1"><p className="text-[10px] font-semibold text-[var(--text-primary)]">{label}</p><p className="mt-0.5 text-[9px] text-[var(--text-muted)]">{value}</p></div></div>; }
