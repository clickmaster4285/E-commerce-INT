// ==========================================================
// ORIGIN CHECK — stores ke beech CSRF (optimizeplan.md §9.1)
// ----------------------------------------------------------
// Auth cookies host-only + SameSite=Lax hain, lekin store A aur store B ek hi
// registrable domain (<root>) ke subdomains hain → browser unhein "same-site"
// maanta hai, SameSite=Lax cross-store POST nahi rokta. CORS bhi har registered
// store ko allow karta hai. Is liye: state-changing request (POST/PUT/PATCH/DELETE)
// jis par `Origin` header ho, uska hostname is API request ke hostname se match
// kare (frontend `alignBackendUrl` se API ko page ke hi hostname par bhejta hai),
// ya CLIENT_URL / ALLOWED_ORIGINS me ho.
//
// - Origin header nahi (server-to-server, curl, SSR with secret) → pass (browser
//   cross-site POST hamesha Origin bhejta hai).
// - Google OAuth: `/users/google-login` page se same-origin POST hota hai (credential
//   body me) — koi redirect callback nahi, is liye break nahi hota.
// - OPT-IN: ENFORCE_ORIGIN_CHECK=1 (production me API alag host par ho to
//   ALLOWED_ORIGINS set karo, warna legit requests 403 hongi).
// ==========================================================

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

const hostnameOf = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

function allowedOrigins() {
  const list = [process.env.CLIENT_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")]
    .map((o) => String(o || "").trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return new Set(list);
}

function originCheck(req, res, next) {
  if (process.env.ENFORCE_ORIGIN_CHECK !== "1") return next();
  if (SAFE.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();

  const originHost = hostnameOf(origin);
  const requestHost = String(req.hostname || "").toLowerCase();
  if (originHost && requestHost && originHost === requestHost) return next();
  if (allowedOrigins().has(String(origin).replace(/\/+$/, ""))) return next();

  return res.status(403).json({ success: false, code: "CORS_REJECTED", message: "Origin not allowed." });
}

module.exports = originCheck;
