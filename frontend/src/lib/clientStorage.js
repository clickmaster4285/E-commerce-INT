// ==========================================================
// CLIENT STORAGE HYGIENE (optimizeplan.md §9.1)
// ----------------------------------------------------------
// AUDIT: auth tokens (u_at/a_at/*_rt) httpOnly cookies me hain — localStorage /
// sessionStorage me koi access/refresh token nahi. Jo browser me hai:
//   localStorage : cart + selection (public data), UI prefs (sidebar, theme),
//                  guest chat token (guest ka apna, auth nahi), POS held carts (admin)
//   sessionStorage: admin quote number reservation, theme preview share token
// Logout par shared-computer par admin ka kaam / preview token na rahe:
// ==========================================================

const ADMIN_LOCAL_KEYS = ["admin-pos-held-carts"];
const ADMIN_SESSION_PREFIXES = ["admin-new-quote-number-reservation", "store-theme-preview"];

function removeByPrefix(storage, prefixes) {
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i));
    keys.filter((k) => k && prefixes.some((p) => k.startsWith(p))).forEach((k) => storage.removeItem(k));
  } catch {
    // private mode / storage blocked
  }
}

/** @param {"admin"|"user"} aud */
export function clearSensitiveClientStorage(aud = "user") {
  if (typeof window === "undefined") return;
  try {
    if (aud === "admin") {
      ADMIN_LOCAL_KEYS.forEach((k) => window.localStorage.removeItem(k));
      removeByPrefix(window.sessionStorage, ADMIN_SESSION_PREFIXES);
    } else {
      // Customer: preview/share token session se; cart rakhte hain (guest bhi use karta hai)
      removeByPrefix(window.sessionStorage, ["store-theme-preview"]);
    }
  } catch {
    // ignore
  }
}
