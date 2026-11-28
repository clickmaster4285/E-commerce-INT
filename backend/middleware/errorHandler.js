// ==========================================================
// CENTRAL ERROR HANDLER (optimizeplan.md §5.2)
// ----------------------------------------------------------
// Jo error `next(err)` tak pahunchta hai (CORS reject, multer, resolveStore DB
// fail, JSON body parse error, ya koi bhi throw jo route ne pakda nahi) pehle
// Express ka default HTML 500 page deta tha. Ab hamesha JSON:
//   { success: false, code, message, requestId [, details] }
// Production me 500 ka asli message client ko nahi (Mongo internals leak),
// sirf log me — reqId ke sath, taake support ticket se log dhoondha ja sake.
// ==========================================================

const log = require("../utils/logger");
const AppError = require("../utils/AppError");
const { captureError } = require("../utils/errorTracker");

function classify(err) {
  if (err instanceof AppError) {
    const extra = err.details && typeof err.details === "object" ? { ...err.details } : {};
    return {
      status: err.status ?? 400,
      code: err.code ?? "BAD_REQUEST",
      message: err.message,
      extra: Object.keys(extra).length ? extra : undefined,
    };
  }
  // express.json() body parse
  if (err?.type === "entity.parse.failed") return { status: 400, code: "INVALID_JSON", message: "Request body is not valid JSON." };
  if (err?.type === "entity.too.large") return { status: 413, code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." };
  // multer
  if (err?.name === "MulterError") {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return { status, code: err.code || "UPLOAD_ERROR", message: err.message || "Upload failed." };
  }
  // fileFilter / CORS jaise plain Error messages jo client ke liye bane hain
  if (/^Only .* allowed!?$/i.test(String(err?.message || ""))) return { status: 400, code: "INVALID_FILE_TYPE", message: err.message };
  if (err?.message === "Not allowed by CORS" || err?.message === "Invalid request origin") {
    return { status: 403, code: "CORS_REJECTED", message: "Origin not allowed." };
  }
  // mongoose
  if (err?.name === "CastError") return { status: 400, code: "INVALID_ID", message: `Invalid ${err.path || "id"}.` };
  if (err?.name === "ValidationError") {
    const errors = Object.fromEntries(Object.entries(err.errors || {}).map(([k, v]) => [k, v.message]));
    return { status: 400, code: "VALIDATION_ERROR", message: "Validation failed.", extra: { errors } };
  }
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || err.keyPattern || {}).filter((k) => k !== "storeId");
    return { status: 409, code: "DUPLICATE", message: fields.length ? `${fields.join(", ")} already exists.` : "Duplicate value." };
  }
  const status = Number(err?.status || err?.statusCode);
  if (status >= 400 && status < 500) return { status, code: err.code || "BAD_REQUEST", message: err.message || "Bad request." };
  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { status, code, message, extra } = classify(err);
  const logPayload = {
    err,
    reqId: req.id,
    method: req.method,
    path: req.originalUrl,
    storeId: req.store?._id ? String(req.store._id) : undefined,
  };
  if (status >= 500) {
    log.error(logPayload, "Unhandled request error");
    // §7.1: optional Sentry (SENTRY_DSN + @sentry/node) / global.__errorTracker — 5xx hi
    captureError(err, { reqId: req.id, method: req.method, path: req.originalUrl, storeId: logPayload.storeId });
  }
  else log.warn({ reqId: req.id, code, path: req.originalUrl }, message);

  if (res.headersSent) return undefined;
  const body = { success: false, code, message, ...(extra || {}) };
  if (req.id) body.requestId = req.id;
  return res.status(status).json(body);
}

module.exports = { errorHandler, AppError, classify };