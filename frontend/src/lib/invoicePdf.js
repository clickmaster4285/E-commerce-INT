import { storeApi } from "@/apis/admin/storeApi";
import { getQuoteHeaderData } from "@/lib/quoteHeaderData";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const PAGE_MARGIN = 14;
const COLORS = {
  ink: [20, 20, 20],
  muted: [85, 85, 85],
  line: [190, 190, 190],
};
const EMBEDDED_QUOTE_FONTS = {
  lato: { normal: "Lato-Regular.ttf", bold: "Lato-Bold.ttf", italic: "Lato-Italic.ttf", bolditalic: "Lato-BoldItalic.ttf" },
  ubuntu: { normal: "Ubuntu-Regular.ttf", bold: "Ubuntu-Bold.ttf", italic: "Ubuntu-Italic.ttf", bolditalic: "Ubuntu-BoldItalic.ttf" },
};
const fontAssetCache = new Map();

async function loadFontAsset(filename) {
  if (!fontAssetCache.has(filename)) {
    fontAssetCache.set(filename, fetch(`/fonts/${filename}`).then(async (response) => {
      if (!response.ok) throw new Error(`Could not load PDF font: ${filename}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return binary;
    }).catch((error) => {
      fontAssetCache.delete(filename);
      throw error;
    }));
  }
  return fontAssetCache.get(filename);
}

async function registerEmbeddedFont(pdf, fontFamily) {
  const fontFiles = EMBEDDED_QUOTE_FONTS[fontFamily.toLowerCase()];
  if (!fontFiles) return;
  await Promise.all(Object.entries(fontFiles).map(async ([style, filename]) => {
    const binary = await loadFontAsset(filename);
    pdf.addFileToVFS(filename, binary);
    pdf.addFont(filename, fontFamily, style);
  }));
}

const resolveAssetUrl = (url) => {
  if (!url || /^(https?:|data:|blob:)/i.test(url)) return url || "";
  return API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;
};

async function loadImageData(url, opacity = 1) {
  if (!url || typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.globalAlpha = Math.max(0, Math.min(1, opacity));
        context.drawImage(image, 0, 0);
        resolve({ data: canvas.toDataURL("image/png"), width: image.naturalWidth, height: image.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = resolveAssetUrl(url);
  });
}

const safeText = (value, fallback = "-") => String(value ?? "").trim() || fallback;
const dateLabel = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
  : "-";
const hexToRgb = (value, fallback = [36, 63, 103]) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value || ""));
  return match ? [parseInt(match[1].slice(0, 2), 16), parseInt(match[1].slice(2, 4), 16), parseInt(match[1].slice(4, 6), 16)] : fallback;
};
const tintRgb = (color, whiteRatio = 0.9) => color.map((channel) => Math.round(channel + (255 - channel) * whiteRatio));

export async function createBusinessDocumentPdf(invoice, suppliedStore = null, options = {}) {
  const [{ jsPDF }, storeResult] = await Promise.all([
    import("jspdf"),
    suppliedStore ? Promise.resolve(suppliedStore) : storeApi.getPublic().catch(() => null),
  ]);
  const store = storeResult?.data || storeResult || {};
  const isQuote = options.documentType === "quote";
  const isDesigned = isQuote || options.applyDesign === true;
  const quoteHeader = isQuote ? getQuoteHeaderData(invoice) : null;
  const design = isDesigned ? (options.design || {}) : {};
  const headerLayout = design.headerLayout || "split";
  const template = design.template || "corporate";
  const bandHeader = isDesigned && headerLayout === "band";
  const minimalHeader = isDesigned && headerLayout === "minimal";
  const centeredHeader = isDesigned && headerLayout === "centered";
  const accent = isDesigned ? hexToRgb(design.accentColor) : [20, 20, 20];
  const templateEmphasis = isDesigned && ["dark", "bold", "sunset", "agency", "creative"].includes(template);
  const tableHeaderFill = templateEmphasis ? accent : tintRgb(accent, 0.92);
  const tableHeaderText = templateEmphasis ? [255, 255, 255] : accent;
  let fontFamily = ({ helvetica: "helvetica", times: "times", courier: "courier", lato: "Lato", ubuntu: "Ubuntu" })[design.fontFamily] || "helvetica";
  const fontScale = isDesigned ? Math.max(0.75, Math.min(1.45, (Number(design.fontSize) || 9) / 9)) : 1;
  const documentTitle = isQuote ? "QUOTE" : "INVOICE";
  const documentNumber = isQuote
    ? quoteHeader.quoteNumber
    : safeText(invoice.invoice_number, "DRAFT");
  const numberLabel = isQuote ? "Quote Number" : "Invoice Number";
  const dateLabelText = isQuote ? "Quote Date" : "Invoice Date";
  const dueLabelText = isQuote ? "Valid Until" : "Due Date";
  const pageFormat = isDesigned && design.pageSize === "letter" ? "letter" : "a4";
  const pageOrientation = isDesigned && design.orientation === "landscape" ? "landscape" : "portrait";
  const [shortPageSide, longPageSide] = pageFormat === "letter" ? [215.9, 279.4] : [210, 297];
  const requestedPageWidth = isDesigned && pageOrientation === "landscape" ? longPageSide : shortPageSide;
  const defaultPageHeight = isDesigned && pageOrientation === "landscape" ? shortPageSide : longPageSide;
  const requestedPageHeight = isDesigned && Number(design.pageHeight) > 0
    ? Math.max(180, Math.min(420, Number(design.pageHeight)))
    : defaultPageHeight;
  const baseMargin = PAGE_MARGIN;
  const agencySidebar = isDesigned && template === "agency";
  const sidebarWidth = agencySidebar ? Math.min(66, requestedPageWidth * 0.3) : 0;
  const margin = baseMargin + sidebarWidth;
  const spacingScale = isDesigned ? fontScale : 1;
  const pdf = new jsPDF({ orientation: pageOrientation, unit: "mm", format: isDesigned ? [requestedPageWidth, requestedPageHeight] : pageFormat, compress: true });
  if (isDesigned && EMBEDDED_QUOTE_FONTS[fontFamily.toLowerCase()]) {
    try { await registerEmbeddedFont(pdf, fontFamily); }
    catch { fontFamily = "helvetica"; }
  }
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin - baseMargin;
  const footerY = pageHeight - Math.max(8, baseMargin * 0.65);
  const bottomLimit = footerY - 8;
  const companyName = safeText(store.store_name, "My Store");
  const companyAddressParts = [store.address, store.city, store.state, store.zip_code].filter(Boolean);
  const countryCodes = { PK: "Pakistan", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates", IN: "India", CA: "Canada", AU: "Australia" };
  const countryName = countryCodes[String(store.country || "").toUpperCase()] || store.country;
  if (countryName && (companyAddressParts.length || String(countryName).length > 2)) companyAddressParts.push(countryName);
  const companyAddress = companyAddressParts.join(", ");
  const companyEmail = store.support_email || store.email || "";
  const companyPhone = store.support_phone || store.phone || "";
  const companyWebsite = store.website || store.website_url || store.store_url || "";
  const logoUrl = isDesigned
    ? (design.logoData || store.logo?.img_url || "")
    : (store.logo?.img_url || "");
  const logo = await loadImageData(logoUrl);
  const logoTargetWidth = isDesigned ? Math.max(12, Math.min(50, Number(design.logoWidth) || 24)) : 23;
  const logoAlignment = isDesigned ? (design.logoAlignment || "left") : "left";
  const logoOffset = isDesigned ? Math.max(-16, Math.min(16, Number(design.logoOffset) || 0)) : 0;
  const alignedLogoX = (slotX, slotWidth, logoWidth) => {
    const baseX = logoAlignment === "center"
      ? slotX + (slotWidth - logoWidth) / 2
      : logoAlignment === "right" ? slotX + slotWidth - logoWidth : slotX;
    return Math.max(slotX, Math.min(slotX + slotWidth - logoWidth, baseX + logoOffset));
  };
  const watermarkLogo = isDesigned && design.watermark && design.watermarkUseLogo !== false
    ? await loadImageData(logoUrl, Math.max(0.03, Math.min(0.4, (Number(design.watermarkOpacity) || 8) / 100)))
    : null;
  const currencyCode = safeText(store.currency, "PKR").toUpperCase();
  const currencySymbol = isDesigned && design.currencySymbol ? String(design.currencySymbol).trim().slice(0, 3) : currencyCode;
  const precision = isDesigned ? Math.max(0, Math.min(3, Number(design.decimalPrecision ?? 2))) : 2;
  const money = (value) => `${currencySymbol} ${Number(value || 0).toLocaleString("en", { minimumFractionDigits: precision, maximumFractionDigits: precision })}`;
  const formatDate = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return "-";
    if (!isDesigned || design.dateFormat === "locale") return dateLabel(value);
    const rawDate = String(value).slice(0, 10);
    const [year, month, day] = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate.split("-")
      : (() => { const date = new Date(value); return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")]; })();
    if (design.dateFormat === "iso") return `${year}-${month}-${day}`;
    return design.dateFormat === "month-first" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  };
  let y = 0;

  const setText = (size, color = COLORS.ink, style = "normal") => {
    const bold = style === "bold" ? (!isDesigned || design.boldTitles !== false) : isDesigned && Boolean(design.boldBody);
    const italic = style === "italic" || (isDesigned && style === "normal" && Boolean(design.italicBody));
    const adjustedStyle = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
    pdf.setFont(fontFamily, adjustedStyle);
    const bodyScale = isDesigned && style !== "bold" && style !== "italic"
      ? Math.max(0.75, Math.min(1.45, ((Number(design.bodyFontSize) || 9) / 9) * fontScale))
      : fontScale;
    pdf.setFontSize(size * bodyScale);
    pdf.setTextColor(...color);
  };
  const drawLogoOrMonogram = () => {
    if (logo) {
      const ratio = logo.width / Math.max(logo.height, 1);
      const width = logoTargetWidth;
      const height = Math.min(23, width / ratio);
      const logoX = alignedLogoX(margin, Math.max(40, logoTargetWidth), width);
      pdf.addImage(logo.data, "PNG", logoX, 10 + (23 - height) / 2, width, height);
      return;
    }
    const initials = companyName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "MS";
    setText(13, bandHeader ? [255, 255, 255] : COLORS.ink, "bold");
    pdf.text(initials, alignedLogoX(margin, 40, 10), 23);
  };
  const drawFirstPageHeader = () => {
    if (isDesigned && template === "mono") {
      pdf.setFillColor(24, 24, 27);
      pdf.rect(0, 0, pageWidth, 2, "F");
    }
    if (isDesigned && template === "elegant") {
      pdf.setFillColor(252, 249, 243);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setFillColor(247, 242, 233);
      pdf.rect(0, 0, pageWidth, 48, "F");
    }
    if (agencySidebar) {
      pdf.setFillColor(...accent);
      pdf.rect(0, 0, sidebarWidth, pageHeight, "F");
      if (logo) {
        const width = Math.min(34, logoTargetWidth);
        const height = Math.min(18, width * logo.height / Math.max(1, logo.width));
        pdf.addImage(logo.data, "PNG", baseMargin, 10, width, height);
      }
      setText(11, [255, 255, 255], "bold");
      pdf.text(pdf.splitTextToSize(companyName, sidebarWidth - baseMargin * 2).slice(0, 2), baseMargin, 37);
      setText(6.5, [235, 238, 255]);
      setText(22, accent, "bold");
      pdf.text(documentTitle, pageWidth - baseMargin, 18, { align: "right" });
      setText(6.5, COLORS.muted, "bold");
      pdf.text(`${numberLabel}: ${documentNumber}`, pageWidth - baseMargin, 25, { align: "right" });
      pdf.text(`${dateLabelText}: ${formatDate(invoice.invoice_date)}`, pageWidth - baseMargin, 31, { align: "right" });
      pdf.text(`${dueLabelText}: ${formatDate(invoice.due_date)}`, pageWidth - baseMargin, 37, { align: "right" });
      const sidebarDetails = [["TOTAL", money(invoice.total)]];
      sidebarDetails.forEach(([label, value], index) => {
        const top = pageHeight - 42 + index * 12;
        setText(6, [222, 228, 248], "bold");
        pdf.text(label, baseMargin, top);
        setText(10, [255, 255, 255], "bold");
        pdf.text(pdf.splitTextToSize(String(value), sidebarWidth - baseMargin * 2).slice(0, 2), baseMargin, top + 6);
      });
      y = 48;
      return;
    }
    if (isDesigned && template === "bold") {
      pdf.setFillColor(...accent);
      pdf.rect(pageWidth - 55, 0, 55, 65, "F");
      pdf.triangle(pageWidth - 84, 0, pageWidth - 55, 0, pageWidth - 55, 65, "F");
      drawLogoOrMonogram();
      const textX = margin + Math.max(43, Math.min(logoTargetWidth + 3, contentWidth * 0.55));
      setText(12, COLORS.ink, "bold");
      pdf.text(companyName, textX, 17);
      setText(23, [255, 255, 255], "bold");
      pdf.text(documentTitle, pageWidth - baseMargin, 18, { align: "right" });
      setText(6.2, [255, 255, 255], "bold");
      pdf.text(`${numberLabel}: ${documentNumber}`, pageWidth - baseMargin, 27, { align: "right" });
      pdf.text(`${dateLabelText}: ${formatDate(invoice.invoice_date)}`, pageWidth - baseMargin, 34, { align: "right" });
      pdf.text(`${dueLabelText}: ${formatDate(invoice.due_date)}`, pageWidth - baseMargin, 41, { align: "right" });
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(0.7);
      pdf.line(margin, 49, pageWidth - baseMargin, 49);
      y = 55;
      return;
    }
    if (bandHeader) {
      pdf.setFillColor(...accent);
      pdf.rect(0, 0, pageWidth, 42, "F");
    } else if (isDesigned && headerLayout === "split") {
      pdf.setFillColor(242, 245, 249);
      pdf.rect(pageWidth - 78, 0, 78, 42, "F");
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(0.7);
      pdf.line(0, 42, pageWidth, 42);
    } else if (isDesigned && headerLayout === "plain") {
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(0.7);
      pdf.line(0, 42, pageWidth, 42);
    }
    if (centeredHeader) {
      const ratio = logo ? logo.width / Math.max(logo.height, 1) : 1;
      const logoWidth = logo ? Math.min(logoTargetWidth, 50) : 0;
      const logoHeight = logo ? Math.min(18, logoWidth / ratio) : 0;
      const elegant = isDesigned && template === "elegant";
      if (logo) pdf.addImage(logo.data, "PNG", pageWidth / 2 - logoWidth / 2, elegant ? 4 : 5, logoWidth, logoHeight);
      if (elegant) {
        setText(9, COLORS.ink, "bold");
        pdf.text(companyName, pageWidth / 2, logo ? 25 : 14, { align: "center" });
        setText(26, accent, "bold");
        pdf.text(documentTitle, pageWidth - margin, logo ? 23 : 18, { align: "right" });
        setText(6.5, COLORS.muted, "bold");
        pdf.text(`${numberLabel}: ${documentNumber}`, pageWidth - margin, logo ? 30 : 25, { align: "right" });
        pdf.text(`${dateLabelText}: ${formatDate(invoice.invoice_date)}`, pageWidth - margin, logo ? 35 : 30, { align: "right" });
        pdf.text(`${dueLabelText}: ${formatDate(invoice.due_date)}`, pageWidth - margin, logo ? 40 : 35, { align: "right" });
        y = 64;
      } else {
        const titleY = logo ? 30 : 17;
        setText(isDesigned ? 20 : 14, accent, "bold");
        pdf.text(companyName, pageWidth / 2, titleY, { align: "center" });
        setText(isDesigned ? 18 : 8, accent, "bold");
        if (isDesigned) {
          pdf.text(documentTitle, pageWidth - margin, titleY, { align: "right" });
          setText(6.5, COLORS.muted, "bold");
          pdf.text(`${numberLabel}: ${documentNumber}`, pageWidth - margin, titleY + 6, { align: "right" });
          pdf.text(`${dateLabelText}: ${formatDate(invoice.invoice_date)}`, pageWidth - margin, titleY + 11, { align: "right" });
          pdf.text(`${dueLabelText}: ${formatDate(invoice.due_date)}`, pageWidth - margin, titleY + 16, { align: "right" });
        } else pdf.text(`${documentTitle}  ${documentNumber}`, pageWidth / 2, titleY + 6, { align: "center" });
        if (!isDesigned && !minimalHeader && store.tagline) {
          setText(7, COLORS.muted);
          pdf.text(String(store.tagline), pageWidth / 2, titleY + 10, { align: "center" });
        }
        setText(7, COLORS.muted);
        if (!isDesigned && companyEmail && !minimalHeader) pdf.text(companyEmail, pageWidth / 2, titleY + 14, { align: "center" });
        y = logo ? 48 : 42;
      }
      return;
    }

    drawLogoOrMonogram();

    const textX = margin + Math.max(43, Math.min(logoTargetWidth + 3, contentWidth * 0.55));
    const headerColor = bandHeader ? [255, 255, 255] : isDesigned ? accent : COLORS.ink;
    const secondaryHeaderColor = bandHeader ? [232, 238, 248] : COLORS.muted;
    setText(14, headerColor, "bold");
    pdf.text(pdf.splitTextToSize(companyName, 78).slice(0, 1), textX, 17);
    if (!isDesigned && store.tagline && !minimalHeader) {
      setText(7.5, secondaryHeaderColor);
      pdf.text(pdf.splitTextToSize(String(store.tagline), 78).slice(0, 1), textX, 23);
    }
    const contact = [companyPhone && `Phone: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`, companyWebsite].filter(Boolean).join("  |  ");
    if (!isDesigned && contact && !minimalHeader) {
      setText(6.4, secondaryHeaderColor);
      pdf.text(pdf.splitTextToSize(contact, 96).slice(0, 2), textX, 29);
    }
    if (!isDesigned && companyAddress && !minimalHeader) {
      setText(6.4, secondaryHeaderColor);
      pdf.text(pdf.splitTextToSize(companyAddress, 82).slice(0, 2), textX, 35);
    }

    const rightX = pageWidth - margin;
    if (isDesigned) {
      setText(17, headerColor, "bold");
      pdf.text(documentTitle, rightX, 13, { align: "right" });
      setText(6.5, headerColor, "bold");
      pdf.text(`${numberLabel}: ${documentNumber}`, rightX, 21, { align: "right" });
      pdf.text(`${dateLabelText}: ${formatDate(invoice.invoice_date)}`, rightX, 27, { align: "right" });
      pdf.text(`${dueLabelText}: ${formatDate(invoice.due_date)}`, rightX, 33, { align: "right" });
    } else {
      setText(8, headerColor, "bold");
      pdf.text(documentTitle, rightX, 13, { align: "right" });
      setText(17, headerColor, "bold");
      pdf.text(pdf.splitTextToSize(documentNumber, 58), rightX, 21, { align: "right" });
    }
    const status = safeText(invoice.status, "Unpaid").toUpperCase();
    if (!isDesigned && !minimalHeader) {
      setText(7.5, headerColor, "bold");
      pdf.text(`Status: ${status}`, rightX, 29, { align: "right" });
    }
    y = 46;
  };
  const drawContinuedHeader = () => {
    // Quote continuation pages start clean; the full quote header belongs on page one only.
    if (isQuote) { y = margin; return; }
    if (agencySidebar) {
      pdf.setFillColor(...accent);
      pdf.rect(0, 0, sidebarWidth, pageHeight, "F");
      setText(9, [255, 255, 255], "bold");
      pdf.text(pdf.splitTextToSize(companyName, sidebarWidth - baseMargin * 2).slice(0, 2), baseMargin, 16);
      setText(6.5, [235, 238, 255]);
      pdf.text(`${documentTitle} ${documentNumber}`, baseMargin, 30);
      y = 12;
      return;
    }
    if (isDesigned && template === "elegant") {
      pdf.setFillColor(252, 249, 243);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
    }
    setText(9, COLORS.ink, "bold");
    pdf.text(companyName, margin, 12);
    setText(7, COLORS.muted);
    pdf.text(`${documentTitle} ${documentNumber}`, margin, 18);
    y = 25;
  };
  const addPage = () => {
    pdf.addPage(isDesigned ? [pageWidth, pageHeight] : pageFormat, pageOrientation);
    drawContinuedHeader();
  };
  const ensureSpace = (height) => {
    if (y + height > bottomLimit) addPage();
  };
  const split = (value, width, size = 8) => {
    setText(size);
    return pdf.splitTextToSize(safeText(value), width);
  };
  const drawLabel = (value, x, yPos) => {
    setText(6.3, COLORS.muted, "bold");
    pdf.text(value.toUpperCase(), x, yPos);
  };

  drawFirstPageHeader();

  // Place the customer's information beside the invoice metadata.
  const gap = 5;
  const panelWidth = (contentWidth - gap) / 2;
  const customerLines = [
    invoice.customer_name && { value: invoice.customer_name, primary: true },
    invoice.customer_email && { value: invoice.customer_email },
    invoice.customer_phone && { value: `Phone: ${invoice.customer_phone}` },
    invoice.customer_address && { value: invoice.customer_address },
  ].filter(Boolean);
  const customerLineCount = customerLines.reduce((total, line) => total + split(line.value, panelWidth - 10, line.primary ? 9 : 7.2).length, 0);
  const detailRows = (isQuote ? [
    ["Quote date", formatDate(invoice.invoice_date)],
    ["Valid until", formatDate(invoice.due_date)],
    ["Customer type", safeText(invoice.customer_type, "Other")],
    ["Prepared by", safeText(invoice.prepared_by, "Staff")],
    ["Status", safeText(invoice.status, "Pending")],
  ] : [
    ["Invoice date", formatDate(invoice.invoice_date)],
    ["Due date", formatDate(invoice.due_date)],
    ["Payment terms", safeText(invoice.payment_terms, "Due on receipt")],
    ["Currency", currencyCode],
    ["Payment status", safeText(invoice.status, "Unpaid")],
  ]).map(([label, value]) => ({ label, value, lines: split(value, panelWidth - 42, 6.5) }));
  const detailLineCount = detailRows.reduce((total, row) => total + row.lines.length, 0);
  const panelHeight = Math.max(40 * spacingScale, (15 + Math.max(customerLineCount * 3.8, detailLineCount * 5.2)) * spacingScale);
  if (isDesigned) {
    const infoGap = 4;
    const infoWidth = (contentWidth - infoGap * 2) / 3;
    const fromLines = [
      companyName && { value: companyName, primary: true },
      companyPhone && { value: `Phone: ${companyPhone}` },
      companyEmail && { value: `Email: ${companyEmail}` },
      companyAddress && { value: companyAddress },
      companyWebsite && { value: companyWebsite },
    ].filter(Boolean);
    const quoteDetails = [
      { label: dateLabelText, value: formatDate(invoice.invoice_date) },
      { label: dueLabelText, value: formatDate(invoice.due_date) },
      ...(!isQuote ? [{ label: "Payment terms", value: safeText(invoice.payment_terms, "Due on receipt") }, { label: "Status", value: safeText(invoice.status, "Unpaid") }] : []),
    ];
    const columns = [
      { label: "From", x: margin + 3, lines: fromLines },
      { label: "Bill To", x: margin + infoWidth + infoGap + 2, lines: customerLines },
      { label: "Quote details", x: margin + (infoWidth + infoGap) * 2 + 1, details: quoteDetails },
    ];
    let infoBottom = y + 12;
    columns.forEach((column) => {
      drawLabel(column.label, column.x, y + 6);
      let lineY = y + 12;
      if (column.lines) {
        column.lines.forEach((line) => {
          const wrapped = split(line.value, infoWidth - 5, line.primary ? 8.5 : 6.8);
          setText(line.primary ? 8.5 : 6.8, line.primary ? COLORS.ink : COLORS.muted, line.primary ? "bold" : "normal");
          pdf.text(wrapped, column.x, lineY);
          lineY += wrapped.length * (line.primary ? 4 : 3.4) * spacingScale;
        });
      } else {
        column.details.forEach(({ label, value }) => {
          setText(6.1, COLORS.muted);
          pdf.text(label, column.x, lineY);
          const wrapped = split(value, infoWidth - 5, 6.7);
          setText(6.7, COLORS.ink, "bold");
          pdf.text(wrapped, column.x, lineY + 4);
          lineY += 10 * spacingScale;
        });
      }
      infoBottom = Math.max(infoBottom, lineY);
    });
    y = infoBottom + 5 * spacingScale;
  } else {
    drawLabel("Bill To", margin + 5, y + 7);
    let customerY = y + 14 * spacingScale;
    customerLines.forEach((line) => {
      const lines = split(line.value, panelWidth - 10, line.primary ? 9 : 7.2);
      setText(line.primary ? 9 : 7.2, line.primary ? COLORS.ink : COLORS.muted, line.primary ? "bold" : "normal");
      pdf.text(lines, margin + 5, customerY);
      customerY += lines.length * (line.primary ? 4 : 3.5) * spacingScale;
    });
    const customerX = margin + panelWidth + gap + 5;
    const detailsRight = margin + contentWidth - 5;
    drawLabel("Invoice Details", customerX, y + 7);
    let detailsY = y + 12 * spacingScale;
    detailRows.forEach(({ label, lines }) => {
      const rowY = detailsY;
      setText(6.2, COLORS.muted);
      pdf.text(label, customerX, rowY);
      setText(6.5, COLORS.ink, "bold");
      pdf.text(lines, detailsRight, rowY, { align: "right" });
      detailsY += Math.max(5.2, lines.length * 3.2) * spacingScale;
    });
    y += panelHeight + 7 * spacingScale;
  }

  // Detailed line item table, with repeated heading on every page.
  const tableColumns = [
    { key: "description", label: "DESCRIPTION", weight: 4.2, visible: !isDesigned || design.showDescription !== false },
    { key: "sku", label: "SKU", weight: 1.3, visible: !isDesigned || design.showSku !== false },
    { key: "quantity", label: "QTY", weight: 0.8, visible: true },
    { key: "unit", label: "UNIT PRICE", weight: 1.45, visible: true },
    { key: "discount", label: "DISCOUNT", weight: 1.3, visible: !isDesigned || design.showDiscount !== false },
    { key: "tax", label: "TAX", weight: 1.1, visible: !isDesigned || design.showTax !== false },
    { key: "total", label: isQuote ? "TOTAL" : "LINE TOTAL", weight: 1.55, visible: true },
  ].filter((column) => column.visible);
  const totalWeight = tableColumns.reduce((sum, column) => sum + column.weight, 0);
  const columns = tableColumns.map((column) => contentWidth * column.weight / totalWeight);
  const drawTableHeader = () => {
    if (isDesigned) {
      pdf.setFillColor(...tableHeaderFill);
      pdf.rect(margin, y, contentWidth, 8 * spacingScale, "F");
    }
    pdf.setDrawColor(...(isDesigned ? accent : COLORS.ink));
    pdf.setLineWidth(isDesigned ? 0.45 : 0.35);
    let x = margin;
    tableColumns.forEach((column, index) => {
      setText(6.5, isDesigned ? tableHeaderText : COLORS.ink, "bold");
      const right = ["quantity", "unit", "discount", "tax", "total"].includes(column.key);
      pdf.text(column.label, right ? x + columns[index] - 2 : x + 2, y + 5.5, { align: right ? "right" : "left" });
      x += columns[index];
    });
    pdf.line(margin, y + 8, margin + contentWidth, y + 8);
    y += 9 * spacingScale;
  };
  drawTableHeader();
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((item, index) => {
    const descriptionIndex = tableColumns.findIndex((column) => column.key === "description");
    const itemDescription = [item.name, item.variant_name].filter(Boolean).join(" / ") || `Item ${index + 1}`;
    const description = descriptionIndex < 0 ? [""] : split(itemDescription, columns[descriptionIndex] - 5, Number(design.bodyFontSize) || 7.4);
    const cells = tableColumns.map((column) => ({
      description: itemDescription,
      sku: item.sku || "-",
      quantity: String(item.quantity ?? 0),
      unit: money(item.unit_price),
      discount: `${money(item.discount)}${Number(item.discount_rate) ? ` (${Number(item.discount_rate)}%)` : ""}`,
      tax: `${money(item.tax)}${Number(item.tax_rate) ? ` (${Number(item.tax_rate)}%)` : ""}`,
      total: money(item.total),
    })[column.key]);
    let offset = 0;
    let firstChunk = true;
    while (offset < description.length) {
      if (bottomLimit - y < 10) {
        addPage();
        drawTableHeader();
      }
      const lineHeight = 3.8 * spacingScale * (Number(design.lineSpacing) || 1.15);
      const rowPadding = 4.5 * spacingScale;
      const availableLines = Math.max(1, Math.floor((bottomLimit - y - rowPadding) / lineHeight));
      const chunk = description.slice(offset, offset + availableLines);
      const rowHeight = Math.max(10 * spacingScale, chunk.length * lineHeight + rowPadding);
      pdf.setDrawColor(...COLORS.line);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
      let x = margin;
      if (firstChunk) {
        cells.forEach((value, columnIndex) => {
          const column = tableColumns[columnIndex];
          const right = ["quantity", "unit", "discount", "tax", "total"].includes(column.key);
          setText(column.key === "description" ? Number(design.bodyFontSize) || 7.4 : 6.8, COLORS.ink, column.key === "total" ? "bold" : "normal");
          const maxWidth = columns[columnIndex] - 4;
          const lines = pdf.splitTextToSize(String(value), maxWidth);
          const displayLines = column.key === "description" ? chunk : lines.slice(0, 2);
          pdf.text(displayLines, right ? x + columns[columnIndex] - 2 : x + 2, y + 5.2, { align: right ? "right" : "left" });
          x += columns[columnIndex];
        });
      }
      y += rowHeight;
      offset += chunk.length;
      firstChunk = false;
      if (offset < description.length) {
        addPage();
        drawTableHeader();
      }
    }
  });
  if (!items.length) {
    setText(8, COLORS.muted);
    pdf.text("No line items are recorded on this invoice.", margin + 3, y + 7);
    y += 14;
  }

  // Keep only the essential payment summary; omit bank instructions and notes.
  const paymentRecords = Array.isArray(invoice.payments) ? invoice.payments : [];
  y += 7 * spacingScale;
  const summaryWidth = 82;
  const summaryX = margin + contentWidth - summaryWidth;
  const summaryRows = [["Subtotal", money(invoice.subtotal)]];
  if (!isDesigned || design.showDiscount !== false) summaryRows.push(["Discount", `- ${money(invoice.discount)}`]);
  if (!isDesigned || design.showTax !== false) summaryRows.push([`Tax${Number(invoice.tax_rate) ? ` (${Number(invoice.tax_rate)}%)` : ""}`, `+ ${money(invoice.tax)}`]);
  if (Number(invoice.shipping)) summaryRows.push(["Shipping", `+ ${money(invoice.shipping)}`]);
  const paidAmount = invoice.amount_paid == null
    ? paymentRecords.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    : Number(invoice.amount_paid) || 0;
  const balanceDue = Math.max(0, Number(invoice.remaining_balance ?? (Number(invoice.total) - paidAmount)) || 0);
  const showBalanceRows = paidAmount > 0 || balanceDue > 0;
  const summaryRowHeight = 6.5 * spacingScale;
  const summaryHeight = summaryRows.length * summaryRowHeight + 22 * spacingScale + (showBalanceRows ? 15 * spacingScale : 0);
  const termsText = String(isDesigned && design.showTerms === false ? "" : invoice.terms || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .split("\n")
    .filter((line) => !/^\s*terms\s*&\s*conditions\s*:?\s*$/i.test(line))
    .join("\n")
    .trim();
  const termsLines = termsText ? split(termsText, contentWidth, 7) : [];
  ensureSpace(Math.max(45, summaryHeight + 10));
  pdf.setDrawColor(...COLORS.line);
  pdf.setLineWidth(0.35);
  pdf.line(summaryX, y, summaryX + summaryWidth, y);
  summaryRows.forEach(([label, value], index) => {
    const rowY = y + 7 * spacingScale + index * summaryRowHeight;
    setText(7, COLORS.muted);
    pdf.text(label, summaryX + 4, rowY);
    setText(7, COLORS.ink, "bold");
    pdf.text(value, summaryX + summaryWidth - 4, rowY, { align: "right" });
  });
  const totalBarY = y + summaryHeight - (showBalanceRows ? 28 : 13) * spacingScale;
  if (isDesigned) {
    pdf.setFillColor(...tableHeaderFill);
    pdf.roundedRect(summaryX, totalBarY, summaryWidth, 8 * spacingScale, 1, 1, "F");
  }
  setText(8, isDesigned ? tableHeaderText : COLORS.ink, "bold");
  pdf.text(isQuote ? "GRAND TOTAL" : "TOTAL", summaryX + 2, totalBarY + 5);
  pdf.text(money(invoice.total), summaryX + summaryWidth - 2, totalBarY + 5, { align: "right" });
  if (showBalanceRows) {
    const paidY = totalBarY + 16 * spacingScale;
    setText(7, COLORS.muted);
    pdf.text("Amount paid", summaryX + 3, paidY);
    setText(7, COLORS.ink, "bold");
    pdf.text(money(paidAmount), summaryX + summaryWidth - 3, paidY, { align: "right" });
    setText(7, COLORS.muted);
    pdf.text("Balance due", summaryX + 3, paidY + 6);
    setText(7, COLORS.ink, "bold");
    pdf.text(money(balanceDue), summaryX + summaryWidth - 3, paidY + 6 * spacingScale, { align: "right" });
  }
  y += summaryHeight + 5 * spacingScale;

  if (termsLines.length) {
    const termsLineHeight = 3.7 * spacingScale * (Number(design.lineSpacing) || 1.15);
    const termsBlockHeight = (14 + termsLines.length * 3.7) * spacingScale * (Number(design.lineSpacing) || 1.15);
    const fitsOnOnePage = termsBlockHeight <= bottomLimit - 25;
    const termsParagraphCount = termsText.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
    const termsNeedOwnPage = isDesigned && (termsText.length > 650 || termsParagraphCount > 8);
    if ((termsNeedOwnPage && y > 35) || (fitsOnOnePage && y + termsBlockHeight > bottomLimit)) addPage();
    let offset = 0;
    while (offset < termsLines.length) {
      if (y + 14 > bottomLimit) addPage();
      const availableLines = fitsOnOnePage
        ? termsLines.length
        : Math.max(1, Math.floor((bottomLimit - y - 12) / termsLineHeight));
      const chunk = termsLines.slice(offset, offset + availableLines);
      setText(8, COLORS.ink, "bold");
      pdf.text(offset ? "Terms & Conditions (continued)" : "Terms & Conditions", margin, y + 5);
      setText(7.2, COLORS.muted, isDesigned && design.italicNotes ? "italic" : "normal");
      pdf.text(chunk, margin, y + 10);
      y += (10 + chunk.length * 3.7 + 4) * spacingScale * (Number(design.lineSpacing) || 1.15);
      offset += chunk.length;
    }
  }

  // Plain text footer and page numbering on every page.
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    if (isDesigned && design.watermark && (watermarkLogo || String(design.watermarkText || "").trim())) {
      if (watermarkLogo) {
        const requestedWidth = contentWidth * Math.max(0.2, Math.min(0.85, (Number(design.watermarkSize) || 50) / 100));
        const requestedHeight = pageHeight * 0.38;
        const scale = Math.min(requestedWidth / Math.max(1, watermarkLogo.width), requestedHeight / Math.max(1, watermarkLogo.height));
        const width = watermarkLogo.width * scale;
        const height = watermarkLogo.height * scale;
        const position = design.watermarkPosition || "center";
        const x = position.endsWith("right") ? pageWidth - margin - width : position === "center" || position === "diagonal" ? (pageWidth - width) / 2 : margin;
        const yPosition = position.startsWith("top") ? pageHeight * 0.25 - height / 2 : position.startsWith("bottom") ? pageHeight * 0.72 - height / 2 : (pageHeight - height) / 2;
        pdf.addImage(watermarkLogo.data, "PNG", x, yPosition, width, height, undefined, "FAST", position === "diagonal" ? 35 : 0);
      } else {
        const opacity = Math.max(0.03, Math.min(0.4, (Number(design.watermarkOpacity) || 8) / 100));
        const paleAccent = accent.map((channel) => Math.round(255 - (255 - channel) * opacity));
        setText(28 * Math.max(0.5, Math.min(1.3, (Number(design.watermarkSize) || 50) / 50)), paleAccent, "bold");
        const position = design.watermarkPosition || "center";
        const watermarkX = position.endsWith("right") || position === "right" ? pageWidth - margin - 10 : position === "left" || position.endsWith("left") ? margin + 10 : pageWidth / 2;
        const watermarkY = position.startsWith("top") ? pageHeight * 0.25 : position.startsWith("bottom") ? pageHeight * 0.72 : pageHeight / 2;
        pdf.text(String(design.watermarkText || companyName).toUpperCase(), watermarkX, watermarkY, { align: "center", angle: position === "diagonal" ? 35 : 0 });
      }
    }
    setText(7, COLORS.ink, "bold");
    if (!isDesigned || design.showPageNumbers !== false) {
      pdf.text(`${page} / ${pageCount}`, pageWidth - margin, footerY, { align: "right" });
    }
  }

  return pdf;
}

export async function createInvoicePdf(invoice, suppliedStore = null) {
  return createBusinessDocumentPdf(invoice, suppliedStore, {
    design: invoice.pdf_design || {},
    applyDesign: Boolean(invoice.pdf_design && Object.keys(invoice.pdf_design).length),
  });
}

export async function downloadInvoicePdf(invoice, suppliedStore = null) {
  const pdf = await createInvoicePdf(invoice, suppliedStore);
  const fileName = String(invoice.invoice_number || "invoice-draft").replace(/[^a-z0-9_-]/gi, "_");
  pdf.save(`${fileName}.pdf`);
}

async function createQuoteBusinessPdf(quote, suppliedStore = null) {
  const quoteHeader = getQuoteHeaderData(quote);
  const normalizedQuote = {
    ...quote,
    // Keep these mapped independently: quote_number is identity; status is state.
    quote_number: quoteHeader.quoteNumber === "Assigned when saved" ? "" : quoteHeader.quoteNumber,
    invoice_date: quote.quote_date,
    due_date: quote.expiry_date,
    payment_terms: "Quote",
    status: quoteHeader.status,
    prepared_by: quote.createdby?.name || "Staff",
    terms: quote.pdf_design?.showTerms === false
      ? ""
      : [quote.terms, quote.notes && `Additional Notes: ${quote.notes}`].filter(Boolean).join("\n\n"),
    items: (quote.items || []).map((item) => ({ ...item, total: item.total ?? item.line_total })),
    shipping: 0,
    amount_paid: 0,
    remaining_balance: 0,
  };
  return createBusinessDocumentPdf(normalizedQuote, suppliedStore, { documentType: "quote", design: quote.pdf_design || {} });
}

async function createQuotePdfDocument(quote, suppliedStore = null, previewRoot = null) {
  let pdf;
  const pages = previewRoot?.querySelectorAll?.("[data-quote-document-page='true']");
  if (pages?.length) {
    const [{ jsPDF }, html2canvasModule] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const html2canvas = html2canvasModule.default;
    const design = quote.pdf_design || {};
    const format = design.pageSize === "letter" ? "letter" : "a4";
    const orientation = design.orientation === "landscape" ? "landscape" : "portrait";
    pdf = new jsPDF({ orientation, unit: "mm", format, compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    try {
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: Math.max(document.documentElement.clientWidth, page.scrollWidth),
          onclone: (clonedDocument) => {
            const colorContext = clonedDocument.createElement("canvas").getContext("2d");
            const clonedPage = clonedDocument.querySelectorAll("[data-quote-document-page='true']")[index];
            if (!clonedPage) return;
            const sourceNodes = [page, ...page.querySelectorAll("*")];
            const clonedNodes = [clonedPage, ...clonedPage.querySelectorAll("*")];
            const colorProperties = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "text-decoration-color", "fill", "stroke"];
            sourceNodes.forEach((sourceNode, nodeIndex) => {
              const clonedNode = clonedNodes[nodeIndex];
              if (!clonedNode) return;
              const computed = window.getComputedStyle(sourceNode);
              colorProperties.forEach((property) => {
                let value = computed.getPropertyValue(property);
                if (value && colorContext && value !== "none" && !value.startsWith("url(")) {
                  colorContext.fillStyle = "#000000";
                  colorContext.fillStyle = value;
                  value = colorContext.fillStyle;
                }
                if (value) clonedNode.style.setProperty(property, value, "important");
              });
              const image = computed.getPropertyValue("background-image");
              if (/oklch|oklab|color\(/i.test(image)) clonedNode.style.setProperty("background-image", "none", "important");
              clonedNode.style.setProperty("box-shadow", "none", "important");
              clonedNode.style.setProperty("text-shadow", "none", "important");
            });
          },
        });
        if (index > 0) pdf.addPage(format, orientation);
        const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        const x = (pageWidth - width) / 2;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", x, margin, width, height, undefined, "FAST");
      }
    } catch (captureError) {
      console.error("Quote preview capture failed; using the PDF renderer instead:", captureError);
      return createQuoteBusinessPdf(quote, suppliedStore);
    }
  } else {
    pdf = await createQuoteBusinessPdf(quote, suppliedStore);
  }
  return pdf;
}

export async function downloadQuotePdf(quote, suppliedStore = null, previewRoot = null) {
  const pdf = await createQuotePdfDocument(quote, suppliedStore, previewRoot);
  const fileName = String(quote.quote_number || "quote").replace(/[^a-z0-9_-]/gi, "_");
  pdf.save(`${fileName}.pdf`);
}

export async function printQuotePdf(quote, suppliedStore = null, previewRoot = null) {
  if (typeof window === "undefined") throw new Error("Quote printing is only available in a browser.");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    insetInlineEnd: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(frame);

  let pdfUrl;
  const cleanup = () => {
    frame.remove();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  };

  try {
    const pdf = await createQuotePdfDocument(quote, suppliedStore, previewRoot);
    pdfUrl = URL.createObjectURL(pdf.output("blob"));
    frame.onload = () => {
      window.setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      }, 250);
    };
    frame.src = pdfUrl;
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 5 * 60 * 1000);
  } catch (error) {
    cleanup();
    throw error;
  }
}
