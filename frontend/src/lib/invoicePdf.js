import { storeApi } from "@/apis/admin/storeApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const PAGE_MARGIN = 14;
const COLORS = {
  navy: [18, 48, 91],
  blue: [37, 99, 235],
  ink: [23, 37, 62],
  muted: [100, 116, 139],
  line: [218, 227, 239],
  pale: [245, 248, 252],
  watermark: [232, 239, 249],
  white: [255, 255, 255],
  green: [5, 150, 105],
};

const resolveAssetUrl = (url) => {
  if (!url || /^(https?:|data:|blob:)/i.test(url)) return url || "";
  return API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;
};

async function loadImageData(url) {
  if (!url || typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        const watermarkCanvas = document.createElement("canvas");
        watermarkCanvas.width = image.naturalWidth;
        watermarkCanvas.height = image.naturalHeight;
        const watermarkContext = watermarkCanvas.getContext("2d");
        watermarkContext.globalAlpha = 0.11;
        watermarkContext.drawImage(image, 0, 0);
        resolve({
          data: canvas.toDataURL("image/png"),
          watermarkData: watermarkCanvas.toDataURL("image/png"),
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
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

export async function downloadInvoicePdf(invoice, suppliedStore = null) {
  const [{ jsPDF }, storeResult] = await Promise.all([
    import("jspdf"),
    suppliedStore ? Promise.resolve(suppliedStore) : storeApi.getPublic().catch(() => null),
  ]);
  const store = storeResult?.data || storeResult || {};
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const bottomLimit = pageHeight - 19;
  const companyName = safeText(store.store_name, "My Store");
  const companyAddressParts = [store.address, store.city, store.state, store.zip_code].filter(Boolean);
  const countryCodes = { PK: "Pakistan", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates", IN: "India", CA: "Canada", AU: "Australia" };
  const countryName = countryCodes[String(store.country || "").toUpperCase()] || store.country;
  if (countryName && (companyAddressParts.length || String(countryName).length > 2)) companyAddressParts.push(countryName);
  const companyAddress = companyAddressParts.join(", ");
  const companyEmail = store.support_email || store.email || "";
  const companyPhone = store.support_phone || store.phone || "";
  const logo = await loadImageData(store.logo?.img_url || "");
  const money = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let y = 0;

  const setText = (size, color = COLORS.ink, style = "normal") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };
  const drawWatermark = () => {
    if (logo?.watermarkData) {
      // Keep the mark visible in the open area beside the totals instead of
      // letting the opaque totals card cover its center.
      const openAreaWidth = contentWidth - 89;
      const maxWidth = openAreaWidth * 0.96;
      const maxHeight = pageHeight * 0.27;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
      const width = logo.width * scale;
      const height = logo.height * scale;
      const x = PAGE_MARGIN + (openAreaWidth - width) / 2;
      const y = pageHeight * 0.64 - height / 2;
      pdf.addImage(logo.watermarkData, "PNG", x, y, width, height);
      return;
    }
    setText(27, COLORS.watermark, "bold");
    pdf.text(companyName.toUpperCase(), pageWidth / 2, pageHeight / 2, { align: "center", angle: 32, charSpace: 0.7 });
  };
  const drawLogoOrMonogram = () => {
    if (logo) {
      const ratio = logo.width / Math.max(logo.height, 1);
      const width = ratio >= 1 ? 23 : 20 * ratio;
      const height = ratio >= 1 ? 23 / ratio : 20;
      pdf.addImage(logo.data, "PNG", PAGE_MARGIN + (23 - width) / 2, 10 + (23 - height) / 2, width, height);
      return;
    }
    pdf.setFillColor(...COLORS.blue);
    pdf.roundedRect(PAGE_MARGIN, 10, 23, 23, 4, 4, "F");
    const initials = companyName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "MS";
    setText(11, COLORS.white, "bold");
    pdf.text(initials, PAGE_MARGIN + 11.5, 24.5, { align: "center" });
  };
  const drawFirstPageHeader = () => {
    pdf.setFillColor(...COLORS.navy);
    pdf.rect(0, 0, pageWidth, 3, "F");
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(pageWidth - 27, 3, 27, 3, "F");
    drawLogoOrMonogram();

    const textX = PAGE_MARGIN + 29;
    setText(14, COLORS.navy, "bold");
    pdf.text(pdf.splitTextToSize(companyName, 78).slice(0, 1), textX, 17);
    if (store.tagline) {
      setText(7.5, COLORS.muted);
      pdf.text(pdf.splitTextToSize(String(store.tagline), 78).slice(0, 1), textX, 23);
    }
    const contact = [companyPhone && `Phone: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`].filter(Boolean).join("  |  ");
    if (contact) {
      setText(6.4, COLORS.muted);
      pdf.text(pdf.splitTextToSize(contact, 82).slice(0, 1), textX, 29);
    }
    if (companyAddress) {
      setText(6.4, COLORS.muted);
      pdf.text(pdf.splitTextToSize(companyAddress, 82).slice(0, 2), textX, 35);
    }

    const rightX = pageWidth - PAGE_MARGIN;
    setText(8, COLORS.blue, "bold");
    pdf.text("INVOICE", rightX, 13, { align: "right" });
    setText(17, COLORS.navy, "bold");
    pdf.text(pdf.splitTextToSize(safeText(invoice.invoice_number, "DRAFT"), 58), rightX, 21, { align: "right" });
    const status = safeText(invoice.status, "Unpaid").toUpperCase();
    pdf.setFillColor(...(status === "PAID" ? [225, 248, 240] : [239, 246, 255]));
    pdf.roundedRect(pageWidth - PAGE_MARGIN - 38, 25, 38, 7, 3.5, 3.5, "F");
    setText(6.5, status === "PAID" ? COLORS.green : COLORS.blue, "bold");
    pdf.text(status, rightX - 19, 29.7, { align: "center" });
    pdf.setDrawColor(...COLORS.line);
    pdf.line(PAGE_MARGIN, 46, pageWidth - PAGE_MARGIN, 46);
    y = 53;
  };
  const drawContinuedHeader = () => {
    pdf.setFillColor(...COLORS.navy);
    pdf.rect(0, 0, pageWidth, 3, "F");
    setText(9, COLORS.navy, "bold");
    pdf.text(companyName, PAGE_MARGIN, 12);
    setText(7, COLORS.muted);
    pdf.text(`INVOICE ${safeText(invoice.invoice_number, "DRAFT")}  |  CONTINUED`, PAGE_MARGIN, 18);
    pdf.setDrawColor(...COLORS.line);
    pdf.line(PAGE_MARGIN, 23, pageWidth - PAGE_MARGIN, 23);
    y = 29;
  };
  const addPage = () => {
    pdf.addPage("a4", "portrait");
    drawWatermark();
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

  drawWatermark();
  drawFirstPageHeader();

  // Place the customer's information beside the invoice metadata.
  const gap = 5;
  const panelWidth = (contentWidth - gap) / 2;
  const customerLines = [invoice.customer_name, invoice.customer_email, invoice.customer_phone, invoice.customer_address].filter(Boolean);
  const customerLineCount = customerLines.reduce((total, value, index) => total + split(value, panelWidth - 10, index === 0 ? 9 : 7.2).length, 0);
  const panelHeight = Math.max(37, 15 + customerLineCount * 4.1);
  pdf.setDrawColor(...COLORS.line);
  pdf.setFillColor(...COLORS.pale);
  pdf.roundedRect(PAGE_MARGIN, y, panelWidth, panelHeight, 2.5, 2.5, "FD");
  pdf.roundedRect(PAGE_MARGIN + panelWidth + gap, y, panelWidth, panelHeight, 2.5, 2.5, "FD");
  drawLabel("Bill To", PAGE_MARGIN + 5, y + 7);
  let customerY = y + 14;
  customerLines.forEach((value, index) => {
    const lines = split(value, panelWidth - 10, index === 0 ? 9 : 7.2);
    setText(index === 0 ? 9 : 7.2, index === 0 ? COLORS.ink : COLORS.muted, index === 0 ? "bold" : "normal");
    pdf.text(lines, PAGE_MARGIN + 5, customerY);
    customerY += lines.length * (index === 0 ? 4 : 3.5);
  });
  const customerX = PAGE_MARGIN + panelWidth + gap + 5;
  const detailsRight = PAGE_MARGIN + contentWidth - 5;
  drawLabel("Invoice Details", customerX, y + 7);
  const details = [
    ["Invoice date", dateLabel(invoice.invoice_date)],
    ["Due date", dateLabel(invoice.due_date)],
    ["Payment terms", safeText(invoice.payment_terms, "Due on receipt")],
    ["Currency", safeText(store.currency, "PKR")],
  ];
  details.forEach(([label, value], index) => {
    const rowY = y + 14 + index * 5.2;
    setText(7, COLORS.muted);
    pdf.text(label, customerX, rowY);
    setText(7.2, COLORS.ink, "bold");
    pdf.text(pdf.splitTextToSize(value, panelWidth - 42), detailsRight, rowY, { align: "right" });
  });
  y += panelHeight + 7;

  // Detailed line item table, with repeated heading on every page.
  const columns = [54, 24, 12, 25, 22, 18, 27];
  const headings = ["DESCRIPTION", "SKU", "QTY", "UNIT PRICE", "DISCOUNT", "TAX", "LINE TOTAL"];
  const drawTableHeader = () => {
    pdf.setFillColor(...COLORS.navy);
    pdf.roundedRect(PAGE_MARGIN, y, contentWidth, 9, 1.8, 1.8, "F");
    let x = PAGE_MARGIN;
    headings.forEach((heading, index) => {
      setText(6.1, COLORS.white, "bold");
      const right = index >= 2;
      pdf.text(heading, right ? x + columns[index] - 2 : x + 2, y + 5.8, { align: right ? "right" : "left" });
      x += columns[index];
    });
    y += 9;
  };
  drawTableHeader();
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((item, index) => {
    const description = split(item.name || `Item ${index + 1}`, columns[0] - 5, 7.4);
    const rowHeight = Math.max(10, description.length * 3.8 + 4.5);
    if (y + rowHeight > bottomLimit) {
      addPage();
      drawTableHeader();
    }
    if (index % 2 === 0) {
      pdf.setFillColor(249, 251, 254);
      pdf.rect(PAGE_MARGIN, y, contentWidth, rowHeight, "F");
    }
    pdf.setDrawColor(...COLORS.line);
    pdf.line(PAGE_MARGIN, y + rowHeight, PAGE_MARGIN + contentWidth, y + rowHeight);
    setText(7.4, COLORS.ink, "bold");
    pdf.text(description, PAGE_MARGIN + 2.5, y + 5.3);
    const cells = [
      item.sku || "-",
      String(item.quantity ?? 0),
      money(item.unit_price),
      `${money(item.discount)}${Number(item.discount_rate) ? ` (${Number(item.discount_rate)}%)` : ""}`,
      `${money(item.tax)}${Number(item.tax_rate) ? ` (${Number(item.tax_rate)}%)` : ""}`,
      money(item.total),
    ];
    let x = PAGE_MARGIN + columns[0];
    cells.forEach((value, cellIndex) => {
      const columnIndex = cellIndex + 1;
      const right = columnIndex >= 2;
      setText(6.6, columnIndex === 6 ? COLORS.navy : COLORS.ink, columnIndex === 6 ? "bold" : "normal");
      const maxWidth = columns[columnIndex] - 4;
      const lines = pdf.splitTextToSize(String(value), maxWidth);
      pdf.text(lines.slice(0, 2), right ? x + columns[columnIndex] - 2 : x + 2, y + 5.2, { align: right ? "right" : "left" });
      x += columns[columnIndex];
    });
    y += rowHeight;
  });
  if (!items.length) {
    setText(8, COLORS.muted);
    pdf.text("No line items are recorded on this invoice.", PAGE_MARGIN + 3, y + 7);
    y += 14;
  }

  // Bank instructions and totals are placed side by side on the first available page.
  const paymentRecords = Array.isArray(invoice.payments) ? invoice.payments : [];
  const paymentRowsHeight = paymentRecords.length ? Math.min(paymentRecords.length, 4) * 5 + 9 : 0;
  y += 7;
  const summaryWidth = 82;
  const summaryX = PAGE_MARGIN + contentWidth - summaryWidth;
  const infoWidth = contentWidth - summaryWidth - 7;
  let infoY = y + 6;
  if (invoice.bank_details) {
    drawLabel("Payment / Bank Details", PAGE_MARGIN + 2, infoY);
    infoY += 5;
    const lines = split(invoice.bank_details, infoWidth - 4, 7.2);
    setText(7.2, COLORS.ink);
    pdf.text(lines, PAGE_MARGIN + 2, infoY);
    infoY += lines.length * 3.7 + 4;
  }
  if (invoice.notes) {
    drawLabel("Notes", PAGE_MARGIN + 2, infoY);
    infoY += 5;
    const lines = split(invoice.notes, infoWidth - 4, 7.2);
    setText(7.2, COLORS.ink);
    pdf.text(lines, PAGE_MARGIN + 2, infoY);
    infoY += lines.length * 3.7 + 4;
  }

  const summaryRows = [
    ["Subtotal", money(invoice.subtotal)],
    ["Discount", `- ${money(invoice.discount)}`],
    [`Tax${Number(invoice.tax_rate) ? ` (${Number(invoice.tax_rate)}%)` : ""}`, `+ ${money(invoice.tax)}`],
  ];
  if (Number(invoice.shipping)) summaryRows.push(["Shipping", `+ ${money(invoice.shipping)}`]);
  const paidAmount = Number(invoice.amount_paid) || 0;
  const balanceDue = Math.max(0, Number(invoice.remaining_balance ?? (Number(invoice.total) - paidAmount)) || 0);
  const showBalanceRows = paidAmount > 0 || balanceDue > 0;
  const summaryHeight = summaryRows.length * 6.5 + 22 + (showBalanceRows ? 15 : 0);
  ensureSpace(Math.max(45, summaryHeight + paymentRowsHeight + 10));
  pdf.setDrawColor(...COLORS.line);
  pdf.setFillColor(...COLORS.pale);
  pdf.roundedRect(summaryX, y, summaryWidth, summaryHeight, 2.5, 2.5, "FD");
  summaryRows.forEach(([label, value], index) => {
    const rowY = y + 7 + index * 6.5;
    setText(7, COLORS.muted);
    pdf.text(label, summaryX + 4, rowY);
    setText(7, COLORS.ink, "bold");
    pdf.text(value, summaryX + summaryWidth - 4, rowY, { align: "right" });
  });
  const totalBarY = y + summaryHeight - (showBalanceRows ? 28 : 13);
  pdf.setFillColor(...COLORS.navy);
  pdf.roundedRect(summaryX + 2, totalBarY, summaryWidth - 4, 11, 1.5, 1.5, "F");
  setText(7, COLORS.white, "bold");
  pdf.text("GRAND TOTAL", summaryX + 5, totalBarY + 7);
  pdf.text(money(invoice.total), summaryX + summaryWidth - 5, totalBarY + 7, { align: "right" });
  if (showBalanceRows) {
    const paidY = totalBarY + 16;
    setText(7, COLORS.muted);
    pdf.text("Amount paid", summaryX + 3, paidY);
    setText(7, COLORS.green, "bold");
    pdf.text(money(paidAmount), summaryX + summaryWidth - 3, paidY, { align: "right" });
    setText(7, COLORS.muted);
    pdf.text("Balance due", summaryX + 3, paidY + 6);
    setText(7, COLORS.navy, "bold");
    pdf.text(money(balanceDue), summaryX + summaryWidth - 3, paidY + 6, { align: "right" });
  }
  y += summaryHeight + 5;

  if (paymentRecords.length) {
    ensureSpace(14 + Math.min(paymentRecords.length, 4) * 5);
    y += 3;
    drawLabel("Payment History", PAGE_MARGIN, y + 4);
    y += 8;
    paymentRecords.slice(-4).forEach((payment) => {
      ensureSpace(6);
      setText(7, COLORS.muted);
      const label = `${dateLabel(payment.payment_date)}  |  ${safeText(payment.payment_method, "Payment")}`;
      pdf.text(pdf.splitTextToSize(label, infoWidth - 5), PAGE_MARGIN, y + 4);
      setText(7, COLORS.ink, "bold");
      pdf.text(money(payment.amount), PAGE_MARGIN + infoWidth, y + 4, { align: "right" });
      y += 5;
    });
  }

  for (const [heading, body] of [["Terms & Conditions", invoice.terms]]) {
    if (!body) continue;
    const lines = split(body, contentWidth - 10, 7.2);
    let offset = 0;
    while (offset < lines.length) {
      if (y + 20 > bottomLimit) addPage();
      const maxLines = Math.max(1, Math.floor((bottomLimit - y - 12) / 3.8));
      const chunk = lines.slice(offset, offset + maxLines);
      const blockHeight = 12 + chunk.length * 3.8;
      pdf.setDrawColor(...COLORS.line);
      pdf.setFillColor(...COLORS.pale);
      pdf.roundedRect(PAGE_MARGIN, y, contentWidth, blockHeight, 2, 2, "FD");
      drawLabel(offset ? `${heading} (continued)` : heading, PAGE_MARGIN + 4, y + 6);
      setText(7.2, COLORS.ink);
      pdf.text(chunk, PAGE_MARGIN + 4, y + 11);
      y += blockHeight + 4;
      offset += chunk.length;
    }
  }

  // Consistent branded footer and page numbering on every page.
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...COLORS.line);
    pdf.line(PAGE_MARGIN, pageHeight - 14, pageWidth - PAGE_MARGIN, pageHeight - 14);
    setText(6.5, COLORS.muted);
    pdf.text(companyName, PAGE_MARGIN, pageHeight - 8);
    pdf.text("Thank you for your business", pageWidth / 2, pageHeight - 8, { align: "center" });
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 8, { align: "right" });
  }

  const fileName = String(invoice.invoice_number || "invoice-draft").replace(/[^a-z0-9_-]/gi, "_");
  pdf.save(`${fileName}.pdf`);
}
