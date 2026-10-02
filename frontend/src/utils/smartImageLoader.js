/* next/image loader — public hosts (picsum…) default optimizer se,
   private/backend hosts (192.168.x, localhost…) direct src.
   Wajah: Next ka optimizer SSRF protection me private-IP fetch block karta
   hai (400 "resolved to private ip"). Backend jab public domain/CDN par
   hoga to ye images bhi auto-optimize hongi — code change nahi chahiye. */

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|\[::1\])$/i;

// LAN/dev me optimizer ko local-IP allowed hai (NEXT_PUBLIC_* mirror flag).
// Production (public domain) me public IPs waise hi allowed — wahan ye
// flag OFF hona chahiye.
const LOCAL_OPTIMIZE = process.env.NEXT_PUBLIC_IMAGE_LOCAL_OPTIMIZE === "1";

export function smartImageLoader({ src, width, quality }) {
  const q = quality || 75;
  // Relative /uploads paths ko backend origin se absolute karo — warna
  // optimizer "not a valid image" 400 deta hai (plain <img> jaisa fallback
  // nahi, is liye yahan handle karna zaroori hai).
  let absolute = src;
  if (typeof src === "string" && src.startsWith("/")) {
    const base = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
    if (!base) return src;
    absolute = `${base}${src}`;
  }
  try {
    const host = new URL(absolute, "http://localhost").hostname;
    // Optimizer block karega (400) → direct src (koi regression nahi)
    if (PRIVATE_HOST.test(host) && !LOCAL_OPTIMIZE) return absolute;
  } catch {
    return src;
  }
  return `/_next/image?url=${encodeURIComponent(absolute)}&w=${width}&q=${q}`;
}
