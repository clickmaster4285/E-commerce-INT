// Professional usernames — naam se banao, email-prefix + random digits se nahi.
//   "Hamza Asif"  → hamza.asif, hamzaasif, hamza_asif, hamza.asif2 …
//   "Ayesha"      → ayesha, ayesha2 …
// Signup suggestions, auto-assign (username khali ho) aur Google signup sab yahi use karte hain.
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");

const MAX_LEN = 30;
const clean = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s._-]/g, "").trim();

/** Naam ke parts (max 2) — "Hamza Asif Khan" → ["hamza", "asif"] */
const nameParts = (name) => clean(name).split(/[\s._-]+/).filter(Boolean).slice(0, 2);

/** Ek naam ke liye candidate patterns (bina number ke), unique order me */
const basePatterns = (name, email) => {
  const parts = nameParts(name);
  const out = [];
  if (parts.length >= 2) {
    const [a, b] = parts;
    out.push(`${a}.${b}`, `${a}${b}`, `${a}_${b}`, `${a}.${b[0]}`, `${a[0]}${b}`);
  } else if (parts.length === 1) {
    out.push(parts[0]);
  }
  const emailBase = clean(String(email || "").split("@")[0]).replace(/[^a-z0-9._]/g, "");
  if (emailBase && emailBase.length >= 3) out.push(emailBase);
  return [...new Set(out.map((u) => u.replace(/^[._-]+|[._-]+$/g, "").slice(0, MAX_LEN)).filter((u) => u.length >= 3))];
};

/** Kaunse usernames pehle se liye hue hain (User + doosri email ki pending registrations) */
const takenSet = async (candidates, { excludeEmail } = {}) => {
  if (!candidates.length) return new Set();
  const [users, pendings] = await Promise.all([
    User.find({ username: { $in: candidates } }).select("username").lean(),
    PendingRegistration.find({ username: { $in: candidates }, ...(excludeEmail ? { email: { $ne: excludeEmail } } : {}) }).select("username").lean(),
  ]);
  return new Set([...users, ...pendings].map((d) => String(d.username).toLowerCase()));
};

/**
 * Available suggestions (default 4). Pehle plain patterns, phir number suffix (2, 3 …).
 * @returns {Promise<string[]>}
 */
const suggestUsernames = async (name, email, { count = 4, excludeEmail } = {}) => {
  const bases = basePatterns(name, email);
  if (!bases.length) return [];
  const numbered = [];
  for (let n = 2; n <= 9; n += 1) for (const b of bases.slice(0, 3)) numbered.push(`${b.slice(0, MAX_LEN - 1)}${n}`);
  const candidates = [...bases, ...numbered];
  const taken = await takenSet(candidates, { excludeEmail });
  return candidates.filter((c) => !taken.has(c)).slice(0, count);
};

/** Ek guaranteed-unique username (auto-assign ke liye). Fallback: base + random 4 digits. */
const uniqueUsername = async (name, email, opts = {}) => {
  const [first] = await suggestUsernames(name, email, { ...opts, count: 1 });
  if (first) return first;
  const base = basePatterns(name, email)[0] || "user";
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${base.slice(0, MAX_LEN - 4)}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await takenSet([candidate], opts)).size) return candidate;
  }
  return `${base.slice(0, MAX_LEN - 13)}${Date.now()}`;
};

module.exports = { suggestUsernames, uniqueUsername, basePatterns };
