const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requirePermission, checkPermission, hasPermission } = require("../middleware/checkPermission");
const { verifyAccessOnce } = require("../utils/authPayload");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

// Fake res/next — status+json capture
const run = (mw, req) => {
  const out = { nextCalled: false, status: null, body: null };
  const res = {
    status(code) { out.status = code; return this; },
    json(body) { out.body = body; return this; },
  };
  mw(req, res, () => { out.nextCalled = true; });
  return out;
};
const staff = (permissions, role = "staff") => ({ user: { role, permissions }, userType: "employee" });

test("requirePermission: admin hamesha pass (even permission false)", () => {
  const mw = requirePermission("orders");
  assert.equal(run(mw, staff({ orders: false }, "admin")).nextCalled, true);
  assert.equal(run(mw, staff({ orders: false }, "storehandler")).nextCalled, true);
});

test("requirePermission denyFalse: staff false block, true/missing pass", () => {
  const mw = requirePermission("products");
  const blocked = run(mw, staff({ products: false }));
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.status, 403);
  assert.equal(run(mw, staff({ products: true })).nextCalled, true);
  assert.equal(run(mw, staff({})).nextCalled, true);
  assert.equal(run(mw, staff(undefined)).nextCalled, true);
});

test("checkPermission == requirePermission default; order/orders alias chalta hai", () => {
  const mw = checkPermission("orders");
  assert.equal(run(mw, staff({ order: false })).status, 403);
  assert.equal(run(mw, staff({ orders: true, order: true })).nextCalled, true);
});

test("requirePermission requireTrue (finance): missing/false block, true pass, admin pass", () => {
  const mw = requirePermission("finance", { mode: "requireTrue", message: "Finance off" });
  const missing = run(mw, staff({}));
  assert.equal(missing.status, 403);
  assert.equal(missing.body.message, "Finance off");
  assert.equal(run(mw, staff({ finance: false })).status, 403);
  assert.equal(run(mw, staff({ finance: true })).nextCalled, true);
  assert.equal(run(mw, staff({}, "admin")).nextCalled, true);
});

test("requirePermission: customer sirf profile key; no user = 401", () => {
  assert.equal(run(requirePermission("orders"), { user: { role: "user" }, userType: "user" }).status, 403);
  assert.equal(run(requirePermission("profile"), { user: { role: "user" }, userType: "user" }).nextCalled, true);
  assert.equal(run(requirePermission("orders"), {}).status, 401);
});

test("hasPermission helper semantics", () => {
  assert.equal(hasPermission({ role: "staff", permissions: {} }, "store", "requireTrue"), false);
  assert.equal(hasPermission({ role: "staff", permissions: { store: true } }, "store", "requireTrue"), true);
  assert.equal(hasPermission({ role: "admin" }, "store", "requireTrue"), true);
  assert.equal(hasPermission({ role: "staff", permissions: {} }, "store"), true);
  assert.equal(hasPermission(null, "store"), false);
});

test("finance + storeController shared helper use karte hain", () => {
  assert.match(read("routes/financeRoutes.js"), /requirePermission\("finance",\s*\{\s*mode: "requireTrue"/);
  assert.match(read("controllers/storeController.js"), /hasPermission\(req\.user, "store", "requireTrue"\)/);
});

test("verifyAccessOnce: cache hit par dobara verify nahi (same aud + raw)", () => {
  const decoded = { userId: "u1", role: "staff" };
  const req = { _authPayload: { aud: "admin", raw: "tok", decoded } };
  assert.equal(verifyAccessOnce(req, "admin", "tok"), decoded);
});

test("verifyAccessOnce: aud ya raw alag ho to cache reuse nahi (security)", () => {
  const decoded = { userId: "u1" };
  const req = { _authPayload: { aud: "admin", raw: "tok", decoded } };
  assert.throws(() => verifyAccessOnce(req, "user", "tok"));
  assert.throws(() => verifyAccessOnce(req, "admin", "other-garbage"));
  assert.equal(req._authPayload.decoded, decoded); // fail par cache overwrite nahi
});

test("rateLimit aur authMiddleware dono verifyAccessOnce (shared payload) use karte hain", () => {
  assert.match(read("middleware/rateLimit.js"), /verifyAccessOnce\(req, aud, token\)/);
  assert.match(read("middleware/authMiddleware.js"), /verifyAccessOnce\(req, aud, raw\)/);
  assert.doesNotMatch(read("middleware/authMiddleware.js"), /[^e]verifyAccess\(/);
});

test("auth principal select slim: password/activities/avatar nahi", () => {
  const src = read("middleware/authMiddleware.js");
  const m = src.match(/PRINCIPAL_SELECT = "([^"]+)"/);
  assert.ok(m);
  for (const f of ["activities", "password", "avatar"]) assert.ok(!m[1].split(" ").includes(f));
  for (const f of ["_id", "storeId", "role", "permissions", "status", "is_deleted", "seller_pending"]) {
    assert.ok(m[1].split(" ").includes(f), f);
  }
  assert.match(src, /\.select\(PRINCIPAL_SELECT\)/);
});

test("superAdminAuth select activities exclude karta hai", () => {
  assert.match(read("middleware/superAdminAuth.js"), /\.select\("-passwordHash -activities"\)/);
});

test("services/auth toPublicUser: password leak nahi, avatar override", () => {
  const { toPublicUser } = require("../services/auth");
  const doc = { _id: "1", name: "A", username: "a", phone: "1", email: "a@x.com", role: "user", password: "h", activities: [1], avatar: "" };
  const pub = toPublicUser(doc);
  assert.equal(pub.id, "1");
  assert.equal(pub.avatar, null);
  assert.equal("password" in pub, false);
  assert.equal("activities" in pub, false);
  assert.equal(toPublicUser(doc, { avatar: "g.png" }).avatar, "g.png");
});

test("chat routes audience-specific middleware", () => {
  const src = read("routes/chatRoutes.js");
  assert.match(src, /staff = \[authMiddleware\.requireAdmin/);
  assert.match(src, /customer = \[authMiddleware\.requireUser/);
});
