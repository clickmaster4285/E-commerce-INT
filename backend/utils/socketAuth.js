// ==========================================================
// SOCKET AUTH — handshake cookie se identity (store-bound)
// ----------------------------------------------------------
// Pehle socket sirf JWT verify karta tha aur role JWT se le leta tha →
// store A ke admin ka token store B ke socket par bhi "admin" tha aur
// updateStoreInfo / createEmployee waghera store B me chal jate the.
//
// Ab:
//   • platform host (tenantStoreId null) par koi socket login nahi → guest
//   • user/employee DB se isi store ke context me load hota hai
//     (tenantScope plugin dusre store ka record laata hi nahi)
//   • storeId dobara compare (defence in depth)
//   • deleted / inactive / blocked → guest
//   • role, name, permissions DB se — JWT claims par bharosa nahi
//   • superadmin token socket par kuch nahi (guest)
//   • audience-wise cookies (utils/tokens.js): client `auth: { aud }` bhejta
//     hai — "admin" → a_at, "user" → u_at; na bheje to admin → user.
//     Refresh token socket par kabhi nahi (us cookie ka path sirf refresh route hai).
// ==========================================================

const { runWithStore } = require("./tenantContext");
const { AUDIENCES, verifyAccess } = require("./tokens");

const TYPE_FOR = { admin: "employee", user: "user" };

const GUEST = Object.freeze({
  userId: null,
  userType: "guest",
  userRole: "guest",
  userName: "Guest",
  userPermissions: {},
  storeId: null,
  sellerPending: false,
  sessionId: null,
  // Session hai (a_sess/u_sess) lekin access token expire → client REST refresh
  // kare aur reconnect (socket refresh cookie kabhi nahi dekhta)
  needsRefresh: null,
});

const guest = () => ({ ...GUEST, userPermissions: {} });

function parseCookies(raw) {
  const out = {};
  if (!raw) return out;
  for (const part of String(raw).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    let value = part.slice(idx + 1).trim();
    try { value = decodeURIComponent(value); } catch { /* raw rehne do */ }
    out[key] = value;
  }
  return out;
}

const defaultLoadEntity = (type, id) => {
  const Model = type === "employee" ? require("../models/Employee") : require("../models/User");
  return Model.findById(id)
    .select("name role permissions status is_deleted storeId seller_pending")
    .lean();
};

/**
 * @param {object} opts
 * @param {string} opts.cookieHeader   handshake ka raw Cookie header
 * @param {string|null} opts.tenantStoreId  handshake Host se resolve hua store
 * @param {string} [opts.aud]          client ka `handshake.auth.aud` ("admin" | "user")
 * @param {Function} [opts.verify]     (aud, token) => decoded  (tests ke liye)
 * @param {Function} [opts.loadEntity] (type, id) => entity (tests ke liye)
 */
async function resolveSocketIdentity({
  cookieHeader,
  tenantStoreId,
  aud,
  verify = verifyAccess,
  loadEntity = defaultLoadEntity,
}) {
  // Platform host par koi store context nahi → admin events unscoped chal jate. Guest only.
  if (!tenantStoreId) return guest();

  const cookies = parseCookies(cookieHeader);
  const hint = String(aud || "").trim().toLowerCase();
  const audiences = TYPE_FOR[hint] ? [hint] : ["admin", "user"];

  let decoded = null;
  let type = null;
  for (const candidate of audiences) {
    const token = cookies[AUDIENCES[candidate].cookies.access];
    if (!token) continue;
    try {
      const d = verify(candidate, token);
      if (d && d.userId) { decoded = d; type = TYPE_FOR[candidate]; break; }
    } catch { /* expired / invalid → next audience */ }
  }
  if (!decoded) {
    const stale = audiences.find((a) => cookies[AUDIENCES[a].cookies.session]);
    return stale ? { ...guest(), needsRefresh: stale } : guest();
  }

  // Token kisi aur store ka → guest (DB lookup se pehle hi)
  if (String(decoded.storeId || "") !== String(tenantStoreId)) return guest();

  let entity = null;
  try {
    entity = await runWithStore(tenantStoreId, () => loadEntity(type, decoded.userId));
  } catch {
    return guest();
  }

  if (!entity || entity.is_deleted) return guest();
  if (entity.status === "inactive" || entity.status === "blocked") return guest();
  // Plugin pehle hi scope karta hai — phir bhi seedha compare (dusre store ka token = guest)
  if (!entity.storeId || String(entity.storeId) !== String(tenantStoreId)) return guest();

  return {
    userId: String(entity._id || decoded.userId),
    userType: type,
    userRole: String(entity.role || (type === "employee" ? "staff" : "user")).toLowerCase(),
    userName: entity.name || "User",
    userPermissions: entity.permissions || {},
    storeId: String(tenantStoreId),
    sellerPending: type === "employee" && Boolean(entity.seller_pending),
    sessionId: decoded.sid || null,
  };
}

module.exports = { resolveSocketIdentity, parseCookies };
