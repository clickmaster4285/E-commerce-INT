// ==========================================================
// TOKENS — har role (audience) ke alag access + refresh tokens
// ----------------------------------------------------------
//   aud "user"       → customer        cookies u_at / u_rt / u_sess
//   aud "admin"      → employee/admin  cookies a_at / a_rt / a_sess
//   aud "superadmin" → super admin     cookies sa_at / sa_rt / sa_sess
//
// • Har audience ka apna access secret aur apna refresh secret (.env):
//     JWT_USER_ACCESS_SECRET  JWT_USER_REFRESH_SECRET
//     JWT_ADMIN_ACCESS_SECRET JWT_ADMIN_REFRESH_SECRET
//     JWT_SA_ACCESS_SECRET    JWT_SA_REFRESH_SECRET
//   → customer token admin API par nahi chalta, refresh token access ki
//     jagah nahi chalta (aud + typ + alag secret, teeno check).
// • Payload: { userId, role, type, storeId, sid, typ } + JWT aud/sub.
//   storeId request ke store se match hota hai (authMiddleware).
// • Refresh token DB (RefreshSession) me hash ke saath; har refresh par
//   rotate. Purana token dobara aaya → poori family revoke (token chori).
// • Refresh cookie ka path sirf refresh route hai — normal API / socket
//   requests ke saath jata hi nahi. `*_sess` sirf "session hai" ka nishan
//   hai (Next proxy.js page gate ke liye), us me koi token nahi.
// ==========================================================

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
// Do tabs ek saath refresh karein to dusre ko "reuse" na samjho
const ROTATE_GRACE_MS = 30 * 1000;

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const userAccessDays = () => num(process.env.JWT_USER_ACCESS_TOKEN_EXPIREE_DAYS, 7);
const staffAccessMinutes = () => num(process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES, 60);
const refreshDays = () => num(process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS, 30);
const { API_PREFIX } = require("../config/constants");
const apiPrefix = () => API_PREFIX;

const AUDIENCES = {
  user: {
    type: "user",
    cookies: { access: "u_at", refresh: "u_rt", session: "u_sess" },
    refreshRoute: "/users/refresh-token",
    secrets: { access: "JWT_USER_ACCESS_SECRET", refresh: "JWT_USER_REFRESH_SECRET" },
    accessMs: () => userAccessDays() * DAY,
  },
  admin: {
    type: "employee",
    cookies: { access: "a_at", refresh: "a_rt", session: "a_sess" },
    refreshRoute: "/users/admin/refresh-token",
    secrets: { access: "JWT_ADMIN_ACCESS_SECRET", refresh: "JWT_ADMIN_REFRESH_SECRET" },
    accessMs: () => staffAccessMinutes() * MIN,
  },
  superadmin: {
    type: "superadmin",
    cookies: { access: "sa_at", refresh: "sa_rt", session: "sa_sess" },
    refreshRoute: "/super-admin/auth/refresh-token",
    secrets: { access: "JWT_SA_ACCESS_SECRET", refresh: "JWT_SA_REFRESH_SECRET" },
    accessMs: () => staffAccessMinutes() * MIN,
  },
};

// Purane shared cookies — migration ke dauran logout/login par saaf
const LEGACY_COOKIES = ["accessToken", "refreshToken"];

function audienceConfig(aud) {
  const cfg = AUDIENCES[aud];
  if (!cfg) throw new Error(`Unknown token audience: ${aud}`);
  return cfg;
}

function secretFor(aud, kind) {
  const name = audienceConfig(aud).secrets[kind];
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const err = new Error(`${name} is not configured.`);
    err.code = "JWT_SECRET_MISSING";
    throw err;
  }
  return value;
}

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const idOrNull = (v) => (v ? String(v) : null);

// ── JWT ──
function signAccess(aud, { subjectId, role, storeId, sid }) {
  const cfg = audienceConfig(aud);
  return jwt.sign(
    { userId: String(subjectId), role, type: cfg.type, storeId: idOrNull(storeId), sid, typ: "access" },
    secretFor(aud, "access"),
    { audience: aud, subject: String(subjectId), expiresIn: Math.floor(cfg.accessMs() / 1000), algorithm: "HS256" },
  );
}

function signRefresh(aud, { subjectId, role, storeId, jti, familyId }) {
  const cfg = audienceConfig(aud);
  return jwt.sign(
    { userId: String(subjectId), role, type: cfg.type, storeId: idOrNull(storeId), fam: familyId, typ: "refresh" },
    secretFor(aud, "refresh"),
    { audience: aud, subject: String(subjectId), jwtid: jti, expiresIn: Math.floor((refreshDays() * DAY) / 1000), algorithm: "HS256" },
  );
}

function verifyTyped(aud, kind, token, opts = {}) {
  const decoded = jwt.verify(String(token || ""), secretFor(aud, kind), {
    audience: aud,
    algorithms: ["HS256"],
    ignoreExpiration: Boolean(opts.ignoreExpiration),
  });
  if (decoded?.typ !== kind) {
    const err = new jwt.JsonWebTokenError(`Expected a ${kind} token`);
    throw err;
  }
  return decoded;
}

const verifyAccess = (aud, token, opts) => verifyTyped(aud, "access", token, opts);
const verifyRefresh = (aud, token, opts) => verifyTyped(aud, "refresh", token, opts);

// ── Cookies ──
function cookieOptions(maxAge, path = "/") {
  const requested = String(process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  const sameSite = ["strict", "lax", "none"].includes(requested) ? requested : "lax";
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path,
  };
  if (maxAge !== undefined) options.maxAge = maxAge;
  return options;
}

const refreshCookiePath = (aud) => `${apiPrefix()}${audienceConfig(aud).refreshRoute}`;

function setAuthCookies(res, aud, { accessToken, refreshToken }) {
  const cfg = audienceConfig(aud);
  const refreshMs = refreshDays() * DAY;
  res.cookie(cfg.cookies.access, accessToken, cookieOptions(cfg.accessMs()));
  res.cookie(cfg.cookies.refresh, refreshToken, cookieOptions(refreshMs, refreshCookiePath(aud)));
  // Marker JS-readable (httpOnly nahi): sirf "1", koi token nahi. Frontend isi se
  // jaanta hai session hai ya nahi — guest par profile/wishlist/refresh calls nahi.
  res.cookie(cfg.cookies.session, "1", { ...cookieOptions(refreshMs), httpOnly: false });
}

function clearAuthCookies(res, aud) {
  const cfg = audienceConfig(aud);
  res.clearCookie(cfg.cookies.access, cookieOptions());
  res.clearCookie(cfg.cookies.refresh, cookieOptions(undefined, refreshCookiePath(aud)));
  res.clearCookie(cfg.cookies.session, cookieOptions());
  for (const name of LEGACY_COOKIES) res.clearCookie(name, cookieOptions());
}

// ── Sessions (lazy require: tests me model ke baghair bhi JWT helpers chal sakein) ──
const Session = () => require("../models/RefreshSession");

/**
 * Naya session (login) ya isi family me naya token (refresh) — cookies bhi set.
 * @param subject { _id, role, storeId }
 */
async function issueSession(req, res, aud, subject, { familyId } = {}) {
  const jti = crypto.randomUUID();
  const family = familyId || crypto.randomUUID();
  const storeId = aud === "superadmin" ? null : idOrNull(subject.storeId);
  const base = { subjectId: subject._id, role: subject.role, storeId };

  const refreshToken = signRefresh(aud, { ...base, jti, familyId: family });
  await Session().create({
    jti,
    familyId: family,
    aud,
    subjectId: subject._id,
    storeId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshDays() * DAY),
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    ip: String(req?.ip || ""),
  });
  const accessToken = signAccess(aud, { ...base, sid: family });
  setAuthCookies(res, aud, { accessToken, refreshToken });
  return { jti, familyId: family, accessToken, refreshToken };
}

const revokeFamily = (familyId, reason) =>
  Session().updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

/**
 * Refresh cookie → naya access + refresh (rotation).
 * @param loadSubject async (subjectId) => { _id, role, storeId } | null  (null = account ab valid nahi)
 * @returns { ok: true, subject? , grace? } | { ok: false, status, message }
 */
async function rotateSession(req, res, aud, loadSubject) {
  const cfg = audienceConfig(aud);
  const fail = (message, { clear = true, status = 401 } = {}) => {
    if (clear) clearAuthCookies(res, aud);
    return { ok: false, status, message };
  };

  const token = req.cookies?.[cfg.cookies.refresh];
  if (!token) return fail("Refresh token required", { clear: false });

  let decoded;
  try {
    decoded = verifyRefresh(aud, token);
  } catch {
    return fail("Invalid refresh token");
  }

  const session = await Session().findOne({ jti: decoded.jti });
  if (!session || session.aud !== aud || session.tokenHash !== hashToken(token)) {
    return fail("Invalid refresh token");
  }

  if (session.revokedAt) {
    const age = Date.now() - new Date(session.revokedAt).getTime();
    // Dusre tab ne abhi abhi rotate kiya — naye cookies browser me aa chuke hain
    if (session.revokedReason === "rotated" && age < ROTATE_GRACE_MS) return { ok: true, grace: true };
    // Purana (rotate ho chuka) token dobara aaya → chori ka shak → poori family band
    if (session.revokedReason === "rotated") await revokeFamily(session.familyId, "reuse");
    return fail("Session expired. Please log in again.");
  }

  // Store binding: store A ka session store B par refresh nahi hoga
  const reqStoreId = req.store?._id ? String(req.store._id) : null;
  if (aud !== "superadmin" && reqStoreId && String(session.storeId || "") !== reqStoreId) {
    return fail("Invalid refresh token", { clear: false });
  }

  const subject = await loadSubject(decoded.userId);
  if (!subject) {
    await revokeFamily(session.familyId, "invalid_subject");
    return fail("User not found");
  }

  // Atomic claim — do requests ek hi token ko do baar rotate na kar sakein
  const claimed = await Session().findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: "rotated" } },
    { returnDocument: "after" },
  );
  if (!claimed) return { ok: true, grace: true };

  const next = await issueSession(req, res, aud, { ...subject, storeId: subject.storeId ?? session.storeId }, { familyId: session.familyId });
  await Session().updateOne({ _id: session._id }, { $set: { replacedBy: next.jti } });
  return { ok: true, subject };
}

/** Logout: access token (expired bhi chalega) ka sid → poori family revoke */
async function revokeCurrentSession(req, aud) {
  const cfg = audienceConfig(aud);
  const families = new Set();
  const access = req.cookies?.[cfg.cookies.access];
  if (access) {
    try { families.add(verifyAccess(aud, access, { ignoreExpiration: true }).sid); } catch { /* ignore */ }
  }
  const refresh = req.cookies?.[cfg.cookies.refresh];
  if (refresh) {
    try { families.add(verifyRefresh(aud, refresh, { ignoreExpiration: true }).fam); } catch { /* ignore */ }
  }
  for (const familyId of families) if (familyId) await revokeFamily(familyId, "logout");
}

/** Password change / reset: is account ke saare sessions band (current chhod kar, optional) */
function revokeAllForSubject(aud, subjectId, { exceptFamilyId, reason = "password_change" } = {}) {
  const filter = { aud, subjectId, revokedAt: null };
  if (exceptFamilyId) filter.familyId = { $ne: exceptFamilyId };
  return Session().updateMany(filter, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

/** Request me is audience ka current session id (sid) — password change par current session bachane ke liye */
function currentFamilyId(req, aud) {
  const access = req.cookies?.[audienceConfig(aud).cookies.access];
  if (!access) return null;
  try { return verifyAccess(aud, access, { ignoreExpiration: true }).sid || null; } catch { return null; }
}

module.exports = {
  AUDIENCES,
  audienceConfig,
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
  cookieOptions,
  setAuthCookies,
  clearAuthCookies,
  issueSession,
  rotateSession,
  revokeCurrentSession,
  revokeAllForSubject,
  currentFamilyId,
  hashToken,
  ROTATE_GRACE_MS,
};
