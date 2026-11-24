/* ==========================================================
   SERVER-SIDE STORE FETCH (Next server components only)
   ----------------------------------------------------------
   Backend ko platform address par call karte hain aur asli store
   host `x-store-host` header me (src/proxy.js set karta hai).
   Backend ye header sirf INTERNAL_PROXY_SECRET ke saath maanta hai.

   cache: "no-store" — Next ka data/ISR cache host-wise alag nahi
   hota tha (ek store ka data doosre ko milta). Caching backend par
   (publicCache / HTTP headers) hoti hai.

   Kabhi throw nahi karta: fail → null (caller default par chale).
   ========================================================== */

// next/headers ki wajah se ye module sirf server components me chalta hai
import { headers } from "next/headers";
import { cache } from "react";

// Har storefront SSR is par wait karta hai — backend slow ho to jaldi default par
const DEFAULT_TIMEOUT_MS = 1500;

// proxy.js jaisa: server-side calls NEXT_INTERNAL_API_URL (localhost http) se —
// public HTTPS (NEXT_PUBLIC_SERVERURL) ka dev/self-signed cert Node me fail hota hai
// (UNABLE_TO_VERIFY_LEAF_SIGNATURE) aur storefront chupke se default theme dikhata tha.
export const SERVER_API_BASE = (process.env.NEXT_INTERNAL_API_URL || process.env.NEXT_PUBLIC_SERVERURL || "")
  .trim()
  .replace(/\/+$/, "");

export async function serverApiGet(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const base = SERVER_API_BASE;
  if (!base) return null;
  try {
    const storeHost = (await headers()).get("x-store-host") || "";
    if (!storeHost) return null;
    const res = await fetch(`${base}${path}`, {
      headers: {
        "x-store-host": storeHost,
        "x-internal-proxy-secret": process.env.INTERNAL_PROXY_SECRET || "",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Published store theme + translations — fail / missing → { theme: null, translations: {} }
 * (StoreThemeProvider default use karta hai). React cache(): layout + generateMetadata
 * ek hi request share karte hain.
 */
export const getPublishedThemeData = cache(async () => {
  const body = await serverApiGet("/theme/public");
  return { theme: body?.data?.theme || null, translations: body?.data?.translations || {} };
});

export async function getPublishedTheme() {
  return (await getPublishedThemeData()).theme;
}

/** Public store info (name, SEO, logo) — metadata ke liye; fail → null */
export const getPublicStore = cache(async () => {
  const body = await serverApiGet("/store/public");
  return body?.data || null;
});

/** Browser-facing uploads origin (NEXT_PUBLIC_SERVERURL bina /api) */
export const PUBLIC_ASSET_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
