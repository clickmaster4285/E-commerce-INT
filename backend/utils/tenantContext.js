// ==========================================================
// TENANT CONTEXT — "abhi kaun sa store chal raha hai?"
// ----------------------------------------------------------
// AsyncLocalStorage har HTTP request / socket event ke saath current storeId
// le kar chalta hai. Mongoose tenantScope plugin isi se har query me
// `storeId = <current store>` khud laga deta hai — controllers ko kuch
// karna nahi padta.
//
//   runWithStore(storeId, fn) → fn (aur uske saare async kaam) us store me
//   getStoreId()              → current storeId ya null (platform / script)
//   runUnscoped(fn)           → jaan boojh kar saare stores (sirf system kaam)
// ==========================================================

const { AsyncLocalStorage } = require("async_hooks");

const als = new AsyncLocalStorage();

function runWithStore(storeId, fn) {
  if (!storeId) return fn();
  return als.run({ storeId: String(storeId), unscoped: false }, fn);
}

function runUnscoped(fn) {
  return als.run({ storeId: null, unscoped: true }, fn);
}

function getStoreId() {
  const ctx = als.getStore();
  if (!ctx || ctx.unscoped) return null;
  return ctx.storeId || null;
}

/**
 * Kya koi ALS context (store ya runUnscoped) active hai? Plugin isse fail-closed
 * decide karta hai: context hi na ho → query chalne se pehle error.
 */
function hasContext() {
  return Boolean(als.getStore());
}

/**
 * Callback ko current context ke saath bind karo. Stream-based libraries
 * (multer/busboy) apna callback alag async chain se bulate hain jahan
 * AsyncLocalStorage ka context kho jata hai — ye usay wapas laata hai.
 */
function bindToContext(fn) {
  const ctx = als.getStore();
  if (!ctx) return fn;
  return (...args) => als.run(ctx, () => fn(...args));
}

module.exports = { runWithStore, runUnscoped, getStoreId, hasContext, bindToContext };
