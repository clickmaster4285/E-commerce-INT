// Google ID token verification (utils/googleAuth.js) + admin Google login rules
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyGoogleIdToken } = require("../utils/googleAuth");

const CLIENT_ID = "client-123.apps.googleusercontent.com";
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const good = {
  aud: CLIENT_ID,
  iss: "https://accounts.google.com",
  exp: String(Math.floor(NOW / 1000) + 600),
  email: "Owner@Store.com",
  email_verified: "true",
  sub: "g-1",
  name: "Owner",
  picture: "https://example.com/p.png",
};
// tokeninfo stub: credential "ok" → payload, warna Google 400 (bad signature)
const fetchFor = (payload) => async (url) => {
  const token = decodeURIComponent(String(url).split("id_token=")[1] || "");
  if (token !== "signed-by-google") return { ok: false, json: async () => ({ error: "invalid_token" }) };
  return { ok: true, json: async () => payload };
};
const verify = (payload, credential = "signed-by-google", extra = {}) =>
  verifyGoogleIdToken(credential, { fetchImpl: fetchFor(payload), clientId: CLIENT_ID, now: () => NOW, ...extra });

test("valid Google token → normalized identity", async () => {
  const id = await verify(good);
  assert.deepEqual(id, { sub: "g-1", email: "owner@store.com", name: "Owner", picture: "https://example.com/p.png" });
});

test("hand-made unsigned token is rejected (Google tokeninfo fails it)", async () => {
  const forged = ["e30", Buffer.from(JSON.stringify({ email: "owner@store.com" })).toString("base64"), "x"].join(".");
  await assert.rejects(verify(good, forged), /Invalid Google token/);
});

test("wrong audience / issuer / expired / unverified email are rejected", async () => {
  await assert.rejects(verify({ ...good, aud: "someone-elses-app" }), /Invalid Google token/);
  await assert.rejects(verify({ ...good, iss: "evil.example.com" }), /Invalid Google token/);
  await assert.rejects(verify({ ...good, exp: String(Math.floor(NOW / 1000) - 1) }), /expired/);
  await assert.rejects(verify({ ...good, email_verified: "false" }), /not verified/);
  await assert.rejects(verify({ ...good, email: "" }), /email/);
});

test("missing credential, missing client id, network error → rejected", async () => {
  await assert.rejects(verify(good, ""), /missing/);
  await assert.rejects(verify(good, "signed-by-google", { clientId: "" }), /not configured/);
  await assert.rejects(
    verifyGoogleIdToken("signed-by-google", { fetchImpl: async () => { throw new Error("ECONNRESET"); }, clientId: CLIENT_ID, now: () => NOW }),
    /Invalid Google token/,
  );
});

// ── googleLogin handler: who may get an admin session ──
const path = require("path");
const mongoose = require("mongoose");
const tokensPath = path.join(__dirname, "..", "utils", "tokens.js");
const googlePath = path.join(__dirname, "..", "utils", "googleAuth.js");
const ownershipPath = path.join(__dirname, "..", "utils", "sellerOwnership.js");

function loadHandler({ email, employeesByStore, platformOwner }) {
  // Fresh copies with stubs
  for (const p of [tokensPath, googlePath, ownershipPath, require.resolve("../controllers/userController")]) delete require.cache[p];
  require.cache[googlePath] = { id: googlePath, filename: googlePath, loaded: true, exports: {
    verifyGoogleIdToken: async (c) => { if (c !== "ok") throw new Error("Invalid Google token"); return { email, sub: "g", name: "", picture: "" }; },
  } };
  const issued = [];
  require.cache[tokensPath] = { id: tokensPath, filename: tokensPath, loaded: true, exports: {
    issueSession: async (req, res, aud, subject) => issued.push({ aud, subject }),
    revokeAllForSubject: async () => {}, revokeCurrentSession: async () => {}, clearAuthCookies: () => {},
  } };
  require.cache[ownershipPath] = { id: ownershipPath, filename: ownershipPath, loaded: true, exports: {
    findPlatformEmployee: async () => platformOwner || { employee: null },
    sellerEmailTaken: async () => false, SELLER_EMAIL_TAKEN_MESSAGE: "",
  } };
  const Employee = require("../models/Employee");
  Employee.findOne = (filter) => ({
    select: () => Promise.resolve(employeesByStore.current?.find((e) => e.email === filter.email) || null),
  });
  const activity = require("../utils/activityHelper");
  activity.pushGlobalActivity = async () => {};
  const { googleLogin } = require("../controllers/userController");
  return { googleLogin, issued };
}
const call = (handler, body, store) =>
  new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); }, cookie() {} };
    handler({ body, store, headers: {}, ip: "1.1.1.1", io: { emit() {}, to() { return { emit() {} }; } } }, res);
  });

const STORE_A = { _id: new mongoose.Types.ObjectId() };
const staff = (extra = {}) => ({ _id: new mongoose.Types.ObjectId(), email: "owner@store.com", role: "staff", status: "active", name: "O", ...extra });

test("store host: this store's active staff gets an admin session", async () => {
  const { googleLogin, issued } = loadHandler({ email: "owner@store.com", employeesByStore: { current: [staff()] } });
  const r = await call(googleLogin, { credential: "ok" }, STORE_A);
  assert.equal(r.status, 200);
  assert.equal(issued[0].aud, "admin");
});

test("store host: Google email with no staff record here (customer / other store) → 403, no session", async () => {
  const { googleLogin, issued } = loadHandler({ email: "owner@store.com", employeesByStore: { current: [] } });
  const r = await call(googleLogin, { credential: "ok" }, STORE_A);
  assert.equal(r.status, 403);
  assert.equal(issued.length, 0);
});

test("inactive or deleted staff → 403", async () => {
  for (const extra of [{ status: "inactive" }, { is_deleted: true }]) {
    const { googleLogin, issued } = loadHandler({ email: "owner@store.com", employeesByStore: { current: [staff(extra)] } });
    const r = await call(googleLogin, { credential: "ok" }, STORE_A);
    assert.equal(r.status, 403, JSON.stringify(extra));
    assert.equal(issued.length, 0);
  }
});

test("invalid Google token → 401", async () => {
  const { googleLogin, issued } = loadHandler({ email: "owner@store.com", employeesByStore: { current: [staff()] } });
  const r = await call(googleLogin, { credential: "forged" }, STORE_A);
  assert.equal(r.status, 401);
  assert.equal(issued.length, 0);
});

test("platform host: only the seller owner; ambiguous → 409", async () => {
  let h = loadHandler({ email: "owner@store.com", employeesByStore: {}, platformOwner: { employee: staff() } });
  assert.equal((await call(h.googleLogin, { credential: "ok" }, null)).status, 200);
  h = loadHandler({ email: "owner@store.com", employeesByStore: {}, platformOwner: { employee: null, ambiguous: true } });
  assert.equal((await call(h.googleLogin, { credential: "ok" }, null)).status, 409);
  h = loadHandler({ email: "owner@store.com", employeesByStore: {}, platformOwner: { employee: null } });
  assert.equal((await call(h.googleLogin, { credential: "ok" }, null)).status, 403);
});
