// Socket handshake identity — audience cookies, store-bound, DB-backed (utils/socketAuth.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { resolveSocketIdentity, parseCookies } = require("../utils/socketAuth");
const { getStoreId } = require("../utils/tenantContext");

const STORE_A = String(new mongoose.Types.ObjectId());
const STORE_B = String(new mongoose.Types.ObjectId());
const ADMIN_A = String(new mongoose.Types.ObjectId());
const CUSTOMER_A = String(new mongoose.Types.ObjectId());

// token = "<aud>|<json payload>" — verify stub audience bhi check karta hai (asli verifyAccess jaisa)
const tok = (aud, payload) => `${aud}|${JSON.stringify({ storeId: STORE_A, sid: "fam-1", ...payload })}`;
const verify = (aud, token) => {
  const [tokenAud, json] = String(token).split(/\|(.*)/s);
  if (tokenAud !== aud) throw new Error("jwt audience invalid");
  return JSON.parse(json);
};

// "DB": loadEntity ko context ka storeId milta hai — scoped lookup jaisa
const DB = {
  employee: { [ADMIN_A]: { _id: ADMIN_A, name: "Ali", role: "admin", status: "active", storeId: STORE_A, permissions: {} } },
  user: { [CUSTOMER_A]: { _id: CUSTOMER_A, name: "Sara", role: "user", status: "active", storeId: STORE_A } },
};
const loadEntity = async (type, id) => {
  const doc = DB[type]?.[id];
  return doc && String(doc.storeId) === getStoreId() ? doc : null; // tenantScope jaisa
};

const identify = (cookieHeader, tenantStoreId, aud) =>
  resolveSocketIdentity({ cookieHeader, tenantStoreId, aud, verify, loadEntity });

const cookie = (pairs) => Object.entries(pairs).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
const adminCookie = (extra = {}) => cookie({ a_at: tok("admin", { userId: ADMIN_A, role: "admin", ...extra }) });
const customerCookie = (extra = {}) => cookie({ u_at: tok("user", { userId: CUSTOMER_A, role: "user", ...extra }) });

test("store A admin on store A socket → admin with DB role + session id", async () => {
  const id = await identify(adminCookie(), STORE_A, "admin");
  assert.equal(id.userRole, "admin");
  assert.equal(id.userType, "employee");
  assert.equal(id.storeId, STORE_A);
  assert.equal(id.userName, "Ali");
  assert.equal(id.sessionId, "fam-1");
});

test("store A admin token on store B socket → guest (cross-store blocked)", async () => {
  assert.equal((await identify(adminCookie(), STORE_B, "admin")).userRole, "guest");
  // Token khud store B ka daawa kare, record store A ka → bhi guest
  assert.equal((await identify(adminCookie({ storeId: STORE_B }), STORE_B, "admin")).userRole, "guest");
});

test("JWT role claim is ignored — role comes from DB", async () => {
  const id = await identify(customerCookie({ role: "admin" }), STORE_A, "user");
  assert.equal(id.userRole, "user");
});

test("customer + admin both logged in: aud picks the right session", async () => {
  const both = `${adminCookie()}; ${customerCookie()}`;
  assert.equal((await identify(both, STORE_A, "user")).userType, "user");
  assert.equal((await identify(both, STORE_A, "admin")).userType, "employee");
  assert.equal((await identify(both, STORE_A, undefined)).userType, "employee"); // default admin
});

test("aud=user never accepts the admin cookie", async () => {
  assert.equal((await identify(adminCookie(), STORE_A, "user")).userRole, "guest");
});

test("platform host (no store) → always guest", async () => {
  assert.equal((await identify(adminCookie(), null, "admin")).userRole, "guest");
});

test("old shared accessToken / refresh cookies are not accepted", async () => {
  const legacy = cookie({ accessToken: tok("admin", { userId: ADMIN_A }), a_rt: tok("admin", { userId: ADMIN_A }) });
  assert.equal((await identify(legacy, STORE_A, "admin")).userRole, "guest");
});

test("blocked / inactive / deleted accounts → guest", async () => {
  for (const patch of [{ status: "inactive" }, { is_deleted: true }]) {
    const original = DB.employee[ADMIN_A];
    DB.employee[ADMIN_A] = { ...original, ...patch };
    assert.equal((await identify(adminCookie(), STORE_A, "admin")).userRole, "guest", JSON.stringify(patch));
    DB.employee[ADMIN_A] = original;
  }
  const original = DB.user[CUSTOMER_A];
  DB.user[CUSTOMER_A] = { ...original, status: "blocked" };
  assert.equal((await identify(customerCookie(), STORE_A, "user")).userRole, "guest");
  DB.user[CUSTOMER_A] = original;
});

test("no cookie → guest", async () => {
  assert.equal((await identify(undefined, STORE_A, "admin")).userRole, "guest");
});

test("pending seller is flagged", async () => {
  const original = DB.employee[ADMIN_A];
  DB.employee[ADMIN_A] = { ...original, role: "staff", seller_pending: true };
  assert.equal((await identify(adminCookie(), STORE_A, "admin")).sellerPending, true);
  DB.employee[ADMIN_A] = original;
});

test("parseCookies handles spacing and encoded values", () => {
  assert.deepEqual(parseCookies("a=1;b = x%3Dy ;  c=3=4"), { a: "1", b: "x=y", c: "3=4" });
});
