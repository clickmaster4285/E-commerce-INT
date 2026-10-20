export async function downloadInvoicePdf(invoice) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const money = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (value) => value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
    : "—";
  let y = 20;

  const addPage = () => {
    pdf.addPage("a4", "portrait");
    y = 18;
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, pageWidth, 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(37, 99, 235);
    pdf.text(`INVOICE ${invoice.invoice_number || "DRAFT"} · CONTINUED`, margin, y);
    y += 10;
  };
  const ensureSpace = (height) => { if (y + height > pageHeight - 20) addPage(); };
  const wrapped = (value, width, fontSize = 9) => {
    pdf.setFontSize(fontSize);
    return pdf.splitTextToSize(String(value || "—").replace(/\u00a0/g, " "), width);
  };

  pdf.setFillColor(37, 99, 235);
  pdf.rect(0, 0, pageWidth, 4, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(37, 99, 235);
  pdf.text("INVOICE", margin, y);
  pdf.setFontSize(22);
  pdf.setTextColor(15, 23, 42);
  pdf.text(invoice.invoice_number || "DRAFT", margin, y + 12);
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Invoice date: ${date(invoice.invoice_date)}`, pageWidth - margin, y + 2, { align: "right" });
  pdf.text(`Due date: ${date(invoice.due_date)}`, pageWidth - margin, y + 8, { align: "right" });
  y += 23;

  const addressLines = invoice.customer_address ? wrapped(invoice.customer_address, contentWidth - 10, 8) : [];
  const billToHeight = 27 + addressLines.length * 4;
  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y, contentWidth, billToHeight, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text("BILL TO", margin + 5, y + 7);
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(wrapped(invoice.customer_name, contentWidth - 10, 11), margin + 5, y + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text([invoice.customer_email, invoice.customer_phone].filter(Boolean).join(" · ") || "No contact details", margin + 5, y + 22);
  if (addressLines.length) pdf.text(addressLines, margin + 5, y + 27);
  y += billToHeight + 8;

  const columns = [72, 16, 34, 24, 32];
  const tableWidth = columns.reduce((sum, value) => sum + value, 0);
  const drawTableHeader = () => {
    pdf.setFillColor(30, 64, 175);
    pdf.roundedRect(margin, y, tableWidth, 10, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    const headings = ["PRODUCT", "QTY", "UNIT PRICE", "DISCOUNT", "TOTAL"];
    let x = margin;
    headings.forEach((heading, index) => {
      const right = index > 0;
      pdf.text(heading, right ? x + columns[index] - 3 : x + 3, y + 6.5, { align: right ? "right" : "left" });
      x += columns[index];
    });
    y += 10;
  };
  drawTableHeader();

  (invoice.items || []).forEach((item, index) => {
    const nameLines = wrapped(item.name, columns[0] - 8, 8);
    const rowHeight = Math.max(11, nameLines.length * 4 + 5);
    if (y + rowHeight > pageHeight - 35) { addPage(); drawTableHeader(); }
    if (index % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, tableWidth, rowHeight, "F"); }
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    const values = [nameLines, String(item.quantity ?? 0), money(item.unit_price), money(item.discount), money(item.total)];
    let x = margin;
    values.forEach((value, cellIndex) => {
      const right = cellIndex > 0;
      const textX = right ? x + columns[cellIndex] - 3 : x + 3;
      pdf.setFont("helvetica", cellIndex === 4 ? "bold" : "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(value, textX, y + 5.5, right ? { align: "right" } : undefined);
      x += columns[cellIndex];
    });
    y += rowHeight;
  });

  const rows = [["Subtotal", money(invoice.subtotal)], ["Tax", `+ ${money(invoice.tax)}`], ["Discount", `− ${money(invoice.discount)}`]];
  const summaryHeight = rows.length * 7 + 18;
  ensureSpace(summaryHeight + 10);
  y += 7;
  const summaryWidth = 86;
  const summaryX = pageWidth - margin - summaryWidth;
  pdf.setDrawColor(219, 234, 254);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(summaryX, y, summaryWidth, summaryHeight, 3, 3, "FD");
  rows.forEach(([label, value], index) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(label, summaryX + 5, y + 7 + index * 7);
    pdf.text(value, summaryX + summaryWidth - 5, y + 7 + index * 7, { align: "right" });
  });
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(summaryX + 3, y + summaryHeight - 15, summaryWidth - 6, 12, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text("GRAND TOTAL", summaryX + 6, y + summaryHeight - 7);
  pdf.text(money(invoice.total), summaryX + summaryWidth - 6, y + summaryHeight - 7, { align: "right" });
  y += summaryHeight + 8;

  for (const [heading, body] of [["Bank Details", invoice.bank_details], ["Terms & Conditions", invoice.terms]]) {
    if (!body) continue;
    const lines = wrapped(body, contentWidth - 10, 8);
    let offset = 0;
    while (offset < lines.length) {
      ensureSpace(22);
      const lineLimit = Math.max(1, Math.floor((pageHeight - 22 - y) / 4.2));
      const chunk = lines.slice(offset, offset + lineLimit);
      const boxHeight = 12 + chunk.length * 4.2;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      pdf.text(offset === 0 ? heading : `${heading} (continued)`, margin + 5, y + 6);
      pdf.setFont("helvetica", "normal");
      pdf.text(chunk, margin + 5, y + 11);
      y += boxHeight + 4;
      offset += chunk.length;
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Thank you for your business.", margin, pageHeight - 6);
    pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }
  const fileName = String(invoice.invoice_number || "invoice-draft").replace(/[^a-z0-9_-]/gi, "_");
  pdf.save(`${fileName}.pdf`);
}
