// ==========================================================
// services/auth.js — login handlers ke shared helpers (stub, §5.4)
// ----------------------------------------------------------
// Abhi sirf toPublicUser extract hua (loginUser / loginAdmin / google logins
// me copy-paste tha). issueSession abhi controllers me `tokens.issueSession`
// se hi chalta hai — yahan sirf thin wrapper placeholder.
// TODO: baqi login handlers (OTP verify, refresh, handoff) ko is service par shift karna.
// ==========================================================

const tokens = require("../utils/tokens");

/** Login response ka `user` object — password/activities kabhi nahi. */
function toPublicUser(doc, { avatar } = {}) {
  return {
    id: doc._id,
    name: doc.name,
    username: doc.username,
    phone: doc.phone,
    email: doc.email,
    role: doc.role,
    avatar: avatar !== undefined ? avatar : doc.avatar || null,
  };
}

/** Placeholder: session cookies/token issue (tokens.issueSession ka wrapper). */
function issueSession(req, res, aud, entity) {
  return tokens.issueSession(req, res, aud, entity);
}

module.exports = { toPublicUser, issueSession };
