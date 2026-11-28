// ==========================================================
// METRICS (stub) — in-process counters, koi external dependency nahi
// ----------------------------------------------------------
// Abhi sirf requestCount / errorCount (5xx) / statusClasses. Baad me Prometheus
// (prom-client) lagana ho to sirf snapshot() ko /metrics se expose karo.
//   app.use(metrics.middleware)  → har response par counters badhte hain
//   metrics.snapshot()           → { requestCount, errorCount, byStatusClass, startedAt }
// Note: per-process hain (cluster/multi-server me aggregate nahi hote).
// ==========================================================

const state = {
  requestCount: 0,
  errorCount: 0,
  byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
  startedAt: new Date().toISOString(),
};

function increment(statusCode) {
  state.requestCount += 1;
  const cls = `${Math.floor(Number(statusCode) / 100)}xx`;
  if (cls in state.byStatusClass) state.byStatusClass[cls] += 1;
  if (statusCode >= 500) state.errorCount += 1;
}

function middleware(req, res, next) {
  res.on("finish", () => increment(res.statusCode));
  next();
}

function snapshot() {
  return { ...state, byStatusClass: { ...state.byStatusClass } };
}

function reset() {
  state.requestCount = 0;
  state.errorCount = 0;
  state.byStatusClass = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
}

module.exports = { increment, middleware, snapshot, reset };
