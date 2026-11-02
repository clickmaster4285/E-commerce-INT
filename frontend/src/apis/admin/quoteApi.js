import adminHttp from "../axiosInstance";

const normalizeQuote = (quote) => {
  if (!quote || typeof quote !== "object") return quote;
  const quoteNumber = quote.quote_number ?? quote.quoteNumber ?? quote.quotation_number
    ?? quote.quote_no ?? quote.quoteNo ?? quote.quotation_no ?? quote.quotationNo ?? quote.number ?? "";
  return {
    ...quote,
    // Preserve the database's independent fields; status is never a number fallback.
    quote_number: String(quoteNumber).trim(),
    status: String(quote.status || "Pending").trim(),
  };
};

const unwrap = (response) => {
  const result = response.data?.data ?? response.data;
  return Array.isArray(result) ? result.map(normalizeQuote) : normalizeQuote(result);
};

export const quoteApi = {
  list: () => adminHttp.get("/quotes").then(unwrap),
  reserveNumber: (token) => adminHttp.post("/quotes/reserve-number", { token }).then(unwrap),
  getById: (id) => adminHttp.get(`/quotes/${id}`).then(unwrap),
  create: (payload) => adminHttp.post("/quotes", payload).then(unwrap),
  update: (id, payload) => adminHttp.put(`/quotes/${id}`, payload).then(unwrap),
  updateStatus: (id, status) => adminHttp.patch(`/quotes/${id}/status`, { status }).then(unwrap),
};
