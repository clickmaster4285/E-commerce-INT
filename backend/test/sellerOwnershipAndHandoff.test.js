// Option A (ek seller email = ek store) + one-time handoff token (Redis / Mongo)
// DB nahi: SellerApplication / Employee / UsedToken ki jagah in-memory fakes.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const mongoose = require("mongoose");

const STORE_A = new mongoose.Types.ObjectId();
const STORE_B = new mongoose.Types.ObjectId();

// ── Fakes ──
const db = { applications: [], employees: [] };
const matches = (row, filter) =>
  Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof mongoose.Types.ObjectId)) {
      if ("$in" in v) return v.$in.includes(row[k]);
      if ("$ne" in v) return String(row[k]) !== String(v.$ne);
    }
    return String(row[k]) === String(v);
  });
const chain = (value) => {
  const q = {
    select: () => q, lean: () => q, setOptions: () => q,
    limit: (n) => { value = Array.isArray(value) ? value.slice(0, n) : value; return q; },
    then: (ok, fail) => Promise.resolve(value).then(ok, fail),
  };
  return q;
};
const FakeApplication = {
  exists: (f) => chain(db.applications.some((r) => matches(r, f)) ? { _id: 1 } : null),
  findOne: (f) => chain(db.applications.find((r) => matches(r, f)) || null),
};
const FakeEmployee = {
  exists: (f) => chain(db.employees.some((r) => matches(r, f)) ? { _id: 1 } : null),
  findOne: (f) => chain(db.employees.find((r) => matches(r, f)) || null),
  find: (f) => chain(db.employees.filter((r) => matches(r, f))),
};
const stub = (rel, exports) => {
  const p = path.join(__dirname, "..", rel);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
stub("models/SellerApplication.js", FakeApplication);
stub("models/Employee.js", FakeEmployee);

const { sellerEmailTaken, findPlatformEmployee } = require("../utils/sellerOwnership");
const { claimOnce } = require("../utils/oneTimeToken");

test.beforeEach(() => {
  db.applications.length = 0;
  db.employees.length = 0;
});

// ───────────── Option A ─────────────
test("email with a live (pending/approved) application owns a store", async () => {
  db.applications.push({ email: "ali@x.co", status: "approved", store_id: STORE_A });
  assert.equal(await sellerEmailTaken("Ali@X.co"), true);
});

test("rejected application frees the email; plain staff email is not an owner", async () => {
  db.applications.push({ email: "ali@x.co", status: "rejected", store_id: STORE_A });
  db.employees.push({ email: "ali@x.co", role: "staff", storeId: STORE_B, is_deleted: false });
  assert.equal(await sellerEmailTaken("ali@x.co"), false);
});

test("legacy store admin (no application) counts as owner", async () => {
  db.employees.push({ email: "old@x.co", role: "admin", storeId: STORE_A, is_deleted: false });
  assert.equal(await sellerEmailTaken("old@x.co"), true);
});

test("platform login picks the employee of the application's store, not same-email staff elsewhere", async () => {
  db.applications.push({ email: "ali@x.co", status: "approved", store_id: STORE_A });
  db.employees.push({ _id: "staffB", email: "ali@x.co", role: "staff", storeId: STORE_B });
  db.employees.push({ _id: "ownerA", email: "ali@x.co", role: "staff", storeId: STORE_A });
  const { employee, ambiguous } = await findPlatformEmployee("ali@x.co");
  assert.equal(ambiguous, undefined);
  assert.equal(employee._id, "ownerA");
});

test("platform login: two legacy admins with one email → ambiguous (409), none → null", async () => {
  db.employees.push({ _id: "a", email: "dup@x.co", role: "admin", storeId: STORE_A, is_deleted: false });
  db.employees.push({ _id: "b", email: "dup@x.co", role: "admin", storeId: STORE_B, is_deleted: false });
  assert.equal((await findPlatformEmployee("dup@x.co")).ambiguous, true);
  assert.equal((await findPlatformEmployee("nobody@x.co")).employee, null);
});

// ───────────── One-time handoff token ─────────────
function fakeRedis({ fail = false } = {}) {
  const keys = new Map();
  return {
    keys,
    async set(key, value, ex, ttl, nx) {
      if (fail) throw new Error("redis down");
      assert.equal(ex, "EX");
      assert.equal(nx, "NX");
      if (keys.has(key)) return null;
      keys.set(key, ttl);
      return "OK";
    },
  };
}
function fakeUsedToken() {
  const ids = new Set();
  return {
    ids,
    async create({ _id }) {
      if (ids.has(_id)) { const e = new Error("dup"); e.code = 11000; throw e; }
      ids.add(_id);
    },
  };
}

test("Redis: first use allowed, second use rejected (atomic SET NX EX)", async () => {
  const redis = fakeRedis();
  assert.equal(await claimOnce("handoff", "jti-1", 90, { redis }), true);
  assert.equal(await claimOnce("handoff", "jti-1", 90, { redis }), false);
  assert.equal(redis.keys.get("onetime:handoff:jti-1"), 90);
});

test("no Redis → MongoDB UsedToken gives the same single-use guarantee (survives restart)", async () => {
  const UsedToken = fakeUsedToken();
  assert.equal(await claimOnce("handoff", "jti-2", 60, { redis: null, UsedToken }), true);
  // "restart": naya process wahi DB dekhta hai
  assert.equal(await claimOnce("handoff", "jti-2", 60, { redis: null, UsedToken }), false);
});

test("Redis error → falls back to MongoDB instead of allowing reuse", async () => {
  const UsedToken = fakeUsedToken();
  const redis = fakeRedis({ fail: true });
  assert.equal(await claimOnce("handoff", "jti-3", 60, { redis, UsedToken }), true);
  assert.equal(await claimOnce("handoff", "jti-3", 60, { redis, UsedToken }), false);
});

test("missing jti is never accepted", async () => {
  assert.equal(await claimOnce("handoff", "", 60, { redis: fakeRedis() }), false);
});
