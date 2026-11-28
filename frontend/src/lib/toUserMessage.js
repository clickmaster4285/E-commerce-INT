// ==========================================================
// toUserMessage — backend error `code` → friendly message
// ----------------------------------------------------------
// Backend error responses { success:false, code, message } bhejte hain
// (middleware/errorHandler.js). Technical/5xx message user ko seedha na dikhao;
// known `code` ka friendly text, warna server ka (safe) 4xx message, warna fallback.
// ==========================================================

const CODE_MESSAGES = {
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
  VALIDATION_ERROR: "Please check the form and try again.",
  DUPLICATE: "This value already exists.",
  INVALID_ID: "This item is no longer available.",
  INVALID_JSON: "Something went wrong with your request. Please try again.",
  PAYLOAD_TOO_LARGE: "That upload is too large.",
  LIMIT_FILE_SIZE: "That image is too large.",
  INVALID_FILE_TYPE: "That file type is not allowed.",
  INVALID_IMAGE: "That image could not be used. Try a different one.",
  CORS_REJECTED: "This request was blocked. Please reload the page.",
  STORE_NOT_FOUND: "This store could not be found.",
  STORE_REQUIRED: "Please open this from your store.",
  STORE_SUSPENDED: "This store is suspended. Please contact support.",
  SELLER_PENDING: "Your store is awaiting approval.",
  PLAN_FEATURE_DISABLED: "This feature is not included in your plan.",
  PRICE_CHANGED: "Some prices changed. Please review your cart and try again.",
  STOCK_CHANGED: "Stock changed while you were ordering. Please review and try again.",
  DEAL_LIMIT_REACHED: "This deal has reached its limit. Please update your cart.",
  DISCOUNT_LIMIT_REACHED: "This discount has reached its limit.",
  CARD_DATA_REJECTED: "Card details cannot be sent here. Please use a supported payment method.",
  ORDER_CHANGED: "This order was just changed. Refresh and try again.",
  INVOICE_CHANGED: "This invoice was just changed. Refresh and try again.",
  PO_CHANGED: "This purchase order was just changed. Refresh and try again.",
  THEME_REVISION_CONFLICT: "Someone else edited this. Reload and try again.",
  THEME_PUBLISH_CONFLICT: "Another publish just happened. Reload and try again.",
  PREVIEW_EXPIRED: "This preview link has expired.",
  INVALID_SETUP_LINK: "This setup link is invalid or has expired.",
  INVALID_EMAIL: "Please enter a valid email address.",
};

/**
 * @param {any} err axios error (ya Error / string)
 * @param {string} [fallback]
 */
export function toUserMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const res = err.response;
  if (!res) {
    // Network / timeout — server tak request pohunchi hi nahi
    if (err.code === "ECONNABORTED" || err.code === "ERR_NETWORK") {
      return "Cannot reach the server. Check your connection and try again.";
    }
    return err.isGuest ? fallback : err.message && !/^Request failed|^Network Error/i.test(err.message) ? err.message : fallback;
  }
  const data = res.data && typeof res.data === "object" ? res.data : {};
  const code = data.code;
  // VALIDATION_ERROR/DUPLICATE par server ka specific message behtar hai
  if (code && CODE_MESSAGES[code] && !["VALIDATION_ERROR", "DUPLICATE", "INVALID_ID"].includes(code)) {
    return CODE_MESSAGES[code];
  }
  if (res.status >= 500) return CODE_MESSAGES.INTERNAL_ERROR;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  return fallback;
}

export default toUserMessage;
