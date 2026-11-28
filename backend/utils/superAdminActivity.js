const SuperAdminActivity = require("../models/SuperAdminActivity");
const log = require("./logger");

// Audit every sensitive superadmin action. Never throws — audit failure must
// not break the business flow.
const logActivity = async ({ action, actor, entityType = "system", entityId = "", details = {} }) => {
  try {
    await SuperAdminActivity.create({
      action,
      actor: actor
        ? { id: actor._id || null, email: actor.email || "", name: actor.name || actor.email || "unknown" }
        : undefined,
      entityType,
      entityId: String(entityId || ""),
      details,
    });
  } catch (error) {
    log.error("[super-admin] activity log failed:", error.message);
  }
};

// ---------- Display helpers (activity feed, member/user history) ----------
const ENTITY_LABELS = {
  seller_application: "Signup request",
  store: "Store",
  user: "User",
  superadmin: "Team",
  auth: "Sign-in",
  settings: "Settings",
  system: "System",
  plan: "Plan",
};
const humanize = (key) => String(key).replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
const KNOWN = new Set(["changed", "previous", "next", "status", "storeName", "email", "role", "reason", "message", "device", "ip"]);

/** details object → "Changed: name, phone · Status active → blocked · Store: hamzaHS" */
const describeActivity = (a) => {
  const d = a?.details && typeof a.details === "object" ? a.details : {};
  const parts = [];
  if (Array.isArray(d.changed) && d.changed.length) parts.push(`Changed: ${d.changed.map(humanize).join(", ")}`);
  if (d.previous && d.next) parts.push(`Status ${d.previous} → ${d.next}`);
  else if (d.status) parts.push(`Status: ${d.status}`);
  if (d.storeName) parts.push(`Store: ${d.storeName}`);
  if (d.role) parts.push(`Role: ${d.role}`);
  if (d.email) parts.push(String(d.email));
  if (d.reason) parts.push(`Reason: ${String(d.reason).slice(0, 160)}`);
  if (d.message) parts.push(`Message: ${String(d.message).slice(0, 160)}`);
  if (d.device) parts.push(String(d.device));
  if (d.ip) parts.push(`IP ${d.ip}`);
  for (const [k, v] of Object.entries(d)) {
    if (KNOWN.has(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") parts.push(`${humanize(k)}: ${v}`);
  }
  return parts.join(" · ");
};

/** "Seller approved — hamza (hamzastoreee)" → { title: "Seller approved", subject: "hamza (hamzastoreee)" } */
const splitAction = (action) => {
  const text = String(action || "");
  const m = text.match(/^(.*?)\s*(?:—|:)\s+(.*)$/);
  return m ? { title: m[1].trim(), subject: m[2].trim() } : { title: text, subject: "" };
};

/** Ek activity document → feed row (frontend ke liye) */
// Purane log entries ("Super admin logged in/out") → naya wording
const LEGACY_ACTIONS = { "super admin logged in": "Signed in", "super admin logged out": "Signed out" };
const actionText = (x) => LEGACY_ACTIONS[String(x || "").toLowerCase()] || x;
const activityRow = (a) => ({
  id: a._id,
  action: actionText(a.action),
  ...splitAction(actionText(a.action)),
  description: describeActivity(a),
  entityType: a.entityType,
  entityLabel: ENTITY_LABELS[a.entityType] || "System",
  entityId: a.entityId || "",
  by: a.actor?.name || "",
  byId: a.actor?.id || null,
  at: a.created_at,
});

// ---------- Sign-in context: "Chrome on Windows" + IP ----------
const deviceFromUA = (ua = "") => {
  const s = String(ua);
  if (!s) return "";
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "Browser";
  const os = /Windows/.test(s) ? "Windows" : /Android/.test(s) ? "Android" : /iPhone|iPad|iOS/.test(s) ? "iOS" : /Mac OS X|Macintosh/.test(s) ? "macOS" : /Linux/.test(s) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
};
const clientInfo = (req) => {
  const fwd = String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = String(fwd || req?.ip || req?.socket?.remoteAddress || "").replace(/^::ffff:/, "");
  return { device: deviceFromUA(req?.headers?.["user-agent"]), ip: ip === "::1" ? "127.0.0.1" : ip };
};

module.exports = { clientInfo, deviceFromUA, logActivity, describeActivity, splitAction, activityRow, ENTITY_LABELS };
