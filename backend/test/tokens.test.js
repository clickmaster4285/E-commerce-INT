// Per-audience tokens + rotating refresh sessions (utils/tokens.js)
// DB nahi: models/RefreshSession ki jagah in-memory fake (require.cache).
process.env.API_PREFIX = "/api";
for (const n of [
  "JWT_USER_ACCESS_SECRET", "JWT_USER_REFRESH_SECRET",
  "JWT_ADMIN_ACCESS_SECRET", "JWT_ADMIN_REFRESH_SECRET",
  "JWT_SA_ACCESS_SECRET", "JWT_SA_REFRESH_SECRET",
]) process.env[n] = `test-${n}`;

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const mongoose = require("mongoose");

// ── Fake RefreshSession ──
const rows = [];
const matches = (row, filter) => Object.entries(filter).every(([k, v]) => {
  if (v && typeof v === "object" && "$ne" in v) return String(row[k]) !== String(v.$ne);
  if (v === null) return row[k] == null;
  return String(row[k]) === String(v);
});
const applySet = (row, update) => Object.assign(row, update.$set || {});
const FakeSession = {
  async create(doc) { const row = { _id: new mongoose.Types.ObjectId(), revokedAt: null, revokedReason: null, replacedBy: null, ...doc }; rows.push(row); return row; },
  async findOne(filter) { return rows.find((r) => matches(r, filter)) || null; },
  async findOneAndUpdate(filter, update) { const r = rows.find((x) => matches(x, filter)); if (r) applySet(r, update); return r || null; },
  async updateOne(filter, update) { const r = rows.find((x) => matches(x, filter)); if (r) applySet(r, update); },
  async updateMany(filter, update) { rows.filter((x) => matches(x, filter)).forEach((r) => applySet(r, update)); },
};
const modelPath = path.join(__dirname, "..", "models", "RefreshSession.js");
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: FakeSession };

const tokens = require("../utils/tokens");

// ── Fake req/res ──
function makeRes() {
  return {
    cookies: {}, cleared: [],
    cookie(name, value, opts) { this.cookies[name] = { value, opts }; },
    clearCookie(name, opts) { this.cleared.push({ name, opts }); },
  };
}
const reqWith = (cookies, store) => ({ cookies, headers: {}, ip: "1.2.3.4", store });
const cookieJar = (res) => Object.fromEntries(Object.entries(res.cookies).map(([k, v]) => [k, v.value]));

const STORE_A = { _id: new mongoose.Types.ObjectId() };
const STORE_B = { _id: new mongoose.Types.ObjectId() };
const admin = { _id: new mongoose.Types.ObjectId(), role: "admin", storeId: STORE_A._id };
const customer = { _id: new mongoose.Types.ObjectId(), role: "user", storeId: STORE_A._id };
const load = (subject) => async () => subject;

test("each audience has its own cookies; refresh cookie is path-restricted", async () => {
  const res = makeRes();
  await tokens.issueSession(reqWith({}), res, "admin", admin);
  assert.deepEqual(Object.keys(res.cookies).sort(), ["a_at", "a_rt", "a_sess"]);
  assert.equal(res.cookies.a_rt.opts.path, "/api/users/admin/refresh-token");
  assert.equal(res.cookies.a_at.opts.path, "/");
  assert.equal(res.cookies.a_at.opts.httpOnly, true);
  assert.equal(res.cookies.a_sess.value, "1");

  const u = makeRes();
  await tokens.issueSession(reqWith({}), u, "user", customer);
  assert.deepEqual(Object.keys(u.cookies).sort(), ["u_at", "u_rt", "u_sess"]);
  assert.equal(u.cookies.u_rt.opts.path, "/api/users/refresh-token");

  const sa = makeRes();
  await tokens.issueSession(reqWith({}), sa, "superadmin", { _id: new mongoose.Types.ObjectId(), role: "superadmin" });
  assert.equal(sa.cookies.sa_rt.opts.path, "/api/super-admin/auth/refresh-token");
});

test("access token carries storeId + sid and only verifies for its own audience", async () => {
  const res = makeRes();
  const { familyId } = await tokens.issueSession(reqWith({}), res, "user", customer);
  const at = res.cookies.u_at.value;
  const decoded = tokens.verifyAccess("user", at);
  assert.equal(decoded.storeId, String(STORE_A._id));
  assert.equal(decoded.sid, familyId);
  assert.equal(decoded.type, "user");
  assert.throws(() => tokens.verifyAccess("admin", at));
  assert.throws(() => tokens.verifyAccess("superadmin", at));
});

test("admin token is not a customer token and vice versa", async () => {
  const res = makeRes();
  await tokens.issueSession(reqWith({}), res, "admin", admin);
  assert.throws(() => tokens.verifyAccess("user", res.cookies.a_at.value));
});

test("refresh token can't be used as an access token", async () => {
  const res = makeRes();
  await tokens.issueSession(reqWith({}), res, "admin", admin);
  assert.throws(() => tokens.verifyAccess("admin", res.cookies.a_rt.value));
});

test("token signed with another secret is rejected", () => {
  const forged = require("jsonwebtoken").sign(
    { userId: String(admin._id), role: "admin", type: "employee", typ: "access", storeId: String(STORE_A._id) },
    "wrong-secret", { audience: "admin" },
  );
  assert.throws(() => tokens.verifyAccess("admin", forged));
});

test("rotation: R1 → R2; reusing R1 later revokes the whole family", async () => {
  const login = makeRes();
  await tokens.issueSession(reqWith({}), login, "admin", admin);
  const r1 = cookieJar(login);

  const first = makeRes();
  const ok = await tokens.rotateSession(reqWith(r1, STORE_A), first, "admin", load(admin));
  assert.equal(ok.ok, true);
  const r2 = cookieJar(first);
  assert.notEqual(r2.a_rt, r1.a_rt);

  // Grace window ke baad purana token dobara → reuse
  const old = rows.find((r) => r.tokenHash === tokens.hashToken(r1.a_rt));
  old.revokedAt = new Date(Date.now() - tokens.ROTATE_GRACE_MS - 1000);
  const reuse = await tokens.rotateSession(reqWith(r1, STORE_A), makeRes(), "admin", load(admin));
  assert.equal(reuse.ok, false);
  assert.equal(reuse.status, 401);

  // Family band → R2 bhi ab kaam nahi karta
  const after = await tokens.rotateSession(reqWith(r2, STORE_A), makeRes(), "admin", load(admin));
  assert.equal(after.ok, false);
});

test("two tabs refreshing at once: second one gets a grace pass, not a logout", async () => {
  const login = makeRes();
  await tokens.issueSession(reqWith({}), login, "user", customer);
  const r1 = cookieJar(login);
  assert.equal((await tokens.rotateSession(reqWith(r1, STORE_A), makeRes(), "user", load(customer))).ok, true);
  const second = await tokens.rotateSession(reqWith(r1, STORE_A), makeRes(), "user", load(customer));
  assert.equal(second.ok, true);
  assert.equal(second.grace, true);
});

test("store A session can't refresh on store B", async () => {
  const login = makeRes();
  await tokens.issueSession(reqWith({}), login, "admin", admin);
  const result = await tokens.rotateSession(reqWith(cookieJar(login), STORE_B), makeRes(), "admin", load(admin));
  assert.equal(result.ok, false);
});

test("admin refresh cookie is not accepted by the customer refresh", async () => {
  const login = makeRes();
  await tokens.issueSession(reqWith({}), login, "admin", admin);
  const jar = cookieJar(login);
  const result = await tokens.rotateSession(reqWith({ u_rt: jar.a_rt }, STORE_A), makeRes(), "user", load(customer));
  assert.equal(result.ok, false);
});

test("deactivated account: refresh fails and the family is revoked", async () => {
  const login = makeRes();
  const { familyId } = await tokens.issueSession(reqWith({}), login, "admin", admin);
  const result = await tokens.rotateSession(reqWith(cookieJar(login), STORE_A), makeRes(), "admin", async () => null);
  assert.equal(result.ok, false);
  assert.ok(rows.filter((r) => r.familyId === familyId).every((r) => r.revokedAt));
});

test("logout revokes the session → refresh then fails", async () => {
  const login = makeRes();
  await tokens.issueSession(reqWith({}), login, "user", customer);
  const jar = cookieJar(login);
  await tokens.revokeCurrentSession(reqWith(jar), "user");
  const result = await tokens.rotateSession(reqWith(jar, STORE_A), makeRes(), "user", load(customer));
  assert.equal(result.ok, false);
});

test("password change revokes other sessions but keeps the current one", async () => {
  const subject = { _id: new mongoose.Types.ObjectId(), role: "user", storeId: STORE_A._id };
  const deviceA = makeRes();
  const a = await tokens.issueSession(reqWith({}), deviceA, "user", subject);
  const deviceB = makeRes();
  await tokens.issueSession(reqWith({}), deviceB, "user", subject);
  await tokens.revokeAllForSubject("user", subject._id, { exceptFamilyId: a.familyId });
  assert.equal((await tokens.rotateSession(reqWith(cookieJar(deviceA), STORE_A), makeRes(), "user", load(subject))).ok, true);
  assert.equal((await tokens.rotateSession(reqWith(cookieJar(deviceB), STORE_A), makeRes(), "user", load(subject))).ok, false);
});

test("clearAuthCookies clears that audience (refresh at its path) + legacy cookies", () => {
  const res = makeRes();
  tokens.clearAuthCookies(res, "admin");
  const names = res.cleared.map((c) => c.name);
  assert.deepEqual(names.sort(), ["a_at", "a_rt", "a_sess", "accessToken", "refreshToken"]);
  assert.equal(res.cleared.find((c) => c.name === "a_rt").opts.path, "/api/users/admin/refresh-token");
});
