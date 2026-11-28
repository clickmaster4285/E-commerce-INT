// ==========================================================
// ERROR TRACKING HOOK (optimizeplan.md §7.1)
// ----------------------------------------------------------
// Optional: SENTRY_DSN set ho aur `@sentry/node` installed ho to 5xx errors Sentry ko jate hain.
// Package install karna ZARURI NAHI — na ho to sirf log (errorHandler me pehle se hota hai).
// Custom tracker: global.__errorTracker = (err, ctx) => {...} (tests / doosre providers).
// Tracker kabhi request fail nahi karta (try/catch).
// ==========================================================

const log = require("./logger");

let sentry; // undefined = abhi try nahi kiya, null = unavailable
function getSentry() {
  if (sentry !== undefined) return sentry;
  sentry = null;
  if (!String(process.env.SENTRY_DSN || "").trim()) return sentry;
  try {
    const mod = require("@sentry/node"); // optional peer
    mod.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
    sentry = mod;
  } catch {
    log.warn("[errorTracker] SENTRY_DSN set hai par @sentry/node install nahi (npm i @sentry/node) — sirf logs.");
  }
  return sentry;
}

function captureError(err, context = {}) {
  try {
    if (typeof global.__errorTracker === "function") global.__errorTracker(err, context);
    const client = getSentry();
    if (client?.captureException) {
      client.captureException(err, { extra: context });
    }
  } catch (_) {
    // tracker fail → request par asar nahi
  }
}

const _resetForTests = () => { sentry = undefined; };

module.exports = { captureError, _resetForTests };
