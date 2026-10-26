/**
 * Keep quote identity and lifecycle state sourced from their own record fields.
 * In particular, never fall back to `status` when the quote number is absent.
 */
export function getQuoteHeaderData(record = {}) {
  const quoteNumber = record.quote_number
    ?? record.quoteNumber
    ?? record.quotation_number
    ?? record.quote_no
    ?? record.quoteNo
    ?? record.quotation_no
    ?? record.quotationNo
    ?? record.number;
  const status = record.status;

  return {
    quoteNumber: String(quoteNumber || "Assigned when saved").trim(),
    status: String(status || "Draft").trim().toUpperCase(),
  };
}
