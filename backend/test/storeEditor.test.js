// Store editor — models tenant-scoped, plan gate, draft conflict, public never leaks draft.
// DB nahi: model statics stub kiye jate hain.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.ROOT_DOMAIN = process.env.ROOT_DOMAIN || "root.test";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const mongoose = require("mongoose");

// translationService load time par LibreTranslate ke .env vars maangta hai —
// test me no-op stub (pageController sirf queueTranslationSync call karta hai)
const translationPath = path.resolve(__dirname, "../utils/translationService.js");
require.cache[translationPath] = {
  id: translationPath, filename: translationPath, loaded: true,
  exports: { queueTranslationSync: () => {} },
};

mongoose.set("bufferTimeoutMS", 200);

const StoreTheme = require("../models/StoreTheme");
const StoreThemeVersion = require("../models/StoreThemeVersion");
const StorePage = require("../models/StorePage");
const Plan = require("../models/Plan");
const Employee = require("../models/Employee");
const ctrl = require("../controllers/themeController");
const pageCtrl = require("../controllers/pageController");
const { requirePlanFeature } = require("../middleware/planFeature");
const { buildDefaultTheme } = require("../config/themeSchema");

const STORE = new mongoose.Types.ObjectId();

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.end = () => res;
  return res;
}

// Static stub helper — test ke baad restore
function stub(t, obj, key, impl) {
  const orig = obj[key];
  obj[key] = impl;
  t.after(() => { obj[key] = orig; });
}

const chain = (value) => {
  const q = { select: () => q, lean: async () => value, sort: () => q, skip: () => q, limit: () => q, populate: () => q };
  q.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  return q;
};

// ───────────────────────── Models ─────────────────────────
test("store editor models are tenant-scoped with per-store unique indexes", () => {
  for (const M of [StoreTheme, StoreThemeVersion, StorePage]) {
    assert.equal(M.schema.$tenantScopeField, "storeId", M.modelName);
    assert.ok(!M.schema.indexes().some(([k, o]) => o.unique && !("storeId" in k)), `${M.modelName}: global unique index`);
  }
  assert.ok(StoreTheme.schema.indexes().some(([k, o]) => o.unique && k.storeId === 1 && Object.keys(k).length === 1));
  assert.ok(StorePage.schema.indexes().some(([k, o]) => o.unique && k.storeId === 1 && k.slug === 1));
});

test("Plan.features.storeEditor defaults to true; Employee permission exists", () => {
  assert.equal(new Plan({ name: "x", slug: "x" }).features.storeEditor, true);
  assert.equal(new Employee({}).permissions.storeEditor, true);
});

// ───────────────────────── Plan gate ─────────────────────────
test("requirePlanFeature blocks only when feature is explicitly false", async () => {
  const run = async (plan) => {
    const res = mockRes();
    let nexted = false;
    await requirePlanFeature("storeEditor", { resolvePlan: async () => plan })({ store: { _id: STORE } }, res, () => { nexted = true; });
    return { res, nexted };
  };
  assert.equal((await run(null)).nexted, true);
  assert.equal((await run({ features: {} })).nexted, true);
  assert.equal((await run({ features: { storeEditor: true } })).nexted, true);
  const blocked = await run({ name: "Basic", features: { storeEditor: false } });
  assert.equal(blocked.nexted, false);
  assert.equal(blocked.res.statusCode, 403);
  assert.equal(blocked.res.body.code, "PLAN_FEATURE_DISABLED");
});

// ───────────────────────── Public endpoint ─────────────────────────
test("public theme never returns the draft", async (t) => {
  const published = buildDefaultTheme();
  stub(t, StoreTheme, "findOne", () => chain({ published, publishedVersion: 3 }));
  const res = mockRes();
  await ctrl.getPublicTheme({ store: { _id: STORE }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body.data).sort(), ["theme", "translations", "version"]);
  assert.equal(res.body.data.version, 3);
  assert.equal(res.headers.ETag, `"${STORE}-v3-t0"`);
});

test("public theme falls back to defaults and supports 304", async (t) => {
  stub(t, StoreTheme, "findOne", () => chain(null));
  const res = mockRes();
  await ctrl.getPublicTheme({ store: { _id: STORE }, headers: {} }, res);
  assert.deepEqual(res.body.data.theme, buildDefaultTheme());

  const res304 = mockRes();
  await ctrl.getPublicTheme({ store: { _id: STORE }, headers: { "if-none-match": `"${STORE}-v0-t0"` } }, res304);
  assert.equal(res304.statusCode, 304);
});

// ───────────────────────── Draft save ─────────────────────────
const adminReq = (body) => ({
  body,
  store: { _id: STORE },
  user: { _id: new mongoose.Types.ObjectId() },
  userType: "employee",
});

test("saveDraft returns 409 when baseRevision is stale", async (t) => {
  stub(t, StoreTheme, "findOne", () => chain({ _id: 1, draftRevision: 7 }));
  stub(t, StoreTheme, "findOneAndUpdate", async (filter) => {
    assert.deepEqual(filter, { draftRevision: 5 });
    return null; // compare-and-set fail
  });
  const res = mockRes();
  await ctrl.saveDraft(adminReq({ data: buildDefaultTheme(), baseRevision: 5 }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "THEME_REVISION_CONFLICT");
  assert.equal(res.body.currentRevision, 7);
});

test("saveDraft validates before writing", async (t) => {
  let wrote = false;
  stub(t, StoreTheme, "findOneAndUpdate", async () => { wrote = true; return null; });
  const bad = buildDefaultTheme();
  bad.order.push("x");
  bad.sections.x = { type: "nope" };
  const res = mockRes();
  await ctrl.saveDraft(adminReq({ data: bad, baseRevision: 0 }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(wrote, false);

  const res2 = mockRes();
  await ctrl.saveDraft(adminReq({ data: buildDefaultTheme() }), res2);
  assert.equal(res2.statusCode, 400); // baseRevision missing
});

test("saveDraft increments revision on success", async (t) => {
  stub(t, StoreTheme, "findOne", () => chain({ _id: 1, draftRevision: 2 }));
  stub(t, StoreTheme, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(update.$inc, { draftRevision: 1 });
    return { draftRevision: filter.draftRevision + 1, draft: update.$set.draft };
  });
  const res = mockRes();
  await ctrl.saveDraft(adminReq({ data: buildDefaultTheme(), baseRevision: 2 }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.draftRevision, 3);
});

// ───────────────────────── Pages ─────────────────────────
test("page body: content sanitized, slug from title, partial title keeps slug", () => {
  const { parsePageBody } = pageCtrl._internal;
  const created = parsePageBody({ title: "About Us", content: "<p>Hi</p><script>x()</script>" });
  assert.deepEqual(created.errors, {});
  assert.equal(created.data.slug, "about-us");
  assert.doesNotMatch(created.data.content, /<script/);

  const partial = parsePageBody({ title: "ہمارے بارے میں" }, { partial: true });
  assert.deepEqual(partial.errors, {});
  assert.equal(partial.data.slug, undefined);

  const badSlug = parsePageBody({ title: "ہمارے بارے میں" });
  assert.ok(badSlug.errors.slug);
});

// ───────────────────────── Newsletter ─────────────────────────
test("Subscriber is tenant-scoped with per-store unique email", () => {
  const Subscriber = require("../models/Subscriber");
  assert.equal(Subscriber.schema.$tenantScopeField, "storeId");
  assert.ok(Subscriber.schema.indexes().some(([k, o]) => o.unique && k.storeId === 1 && k.email === 1));
});

test("subscribe validates email and upserts lowercase", async (t) => {
  const Subscriber = require("../models/Subscriber");
  const sub = require("../controllers/subscriberController");
  let call = null;
  stub(t, Subscriber, "updateOne", async (filter, update, opts) => { call = { filter, update, opts }; return {}; });

  const bad = mockRes();
  await sub.subscribe({ store: { _id: STORE }, body: { email: "nope" } }, bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(call, null);

  const ok = mockRes();
  await sub.subscribe({ store: { _id: STORE }, body: { email: "  Ali@Example.COM ", locale: "ur" } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(call.filter, { email: "ali@example.com" });
  assert.equal(call.opts.upsert, true);
  assert.equal(call.update.$set.locale, "ur");
});

test("CSV cells are escaped against formula injection", () => {
  const { csvCell } = require("../controllers/subscriberController")._internal;
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("ok@x.co"), "ok@x.co");
});

// ───────────────────────── Scheduled publish + preview links ─────────────────────────
test("schedulePublish rejects past / invalid dates, stores snapshot", async (t) => {
  const draft = buildDefaultTheme();
  stub(t, StoreTheme, "findOne", () => chain({ _id: 1, draft, publishedVersion: 0 }));
  let update = null;
  stub(t, StoreTheme, "findOneAndUpdate", async (_f, u) => { update = u; return { ...u.$set, draft, published: draft }; });

  const past = mockRes();
  await ctrl.schedulePublish(adminReq({ at: new Date(Date.now() - 1000).toISOString() }), past);
  assert.equal(past.statusCode, 400);
  const bad = mockRes();
  await ctrl.schedulePublish(adminReq({ at: "nope" }), bad);
  assert.equal(bad.statusCode, 400);

  const ok = mockRes();
  const at = new Date(Date.now() + 3600 * 1000).toISOString();
  await ctrl.schedulePublish(adminReq({ at, note: "Eid" }), ok);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(update.$set.scheduled.data, draft);
  assert.equal(new Date(update.$set.scheduled.at).toISOString(), at);
  assert.equal(ok.body.data.scheduled.note, "Eid");
});

test("preview link: token returned once, only hash stored; expired/unknown rejected", async (t) => {
  let saved = null;
  stub(t, StoreTheme, "findOne", () => chain({ _id: 1, draft: buildDefaultTheme(), previewLinks: saved?.previewLinks || [] }));
  stub(t, StoreTheme, "findOneAndUpdate", async (_f, u) => { saved = u.$set; return { ...u.$set, draft: buildDefaultTheme() }; });

  const created = mockRes();
  await ctrl.createPreviewLink(adminReq({ hours: 168 }), created);
  assert.equal(created.statusCode, 201);
  const { token } = created.body.data;
  assert.ok(token.length >= 30);
  assert.ok(!JSON.stringify(saved).includes(token)); // asli token DB me nahi
  assert.equal(saved.previewLinks[0].hash, ctrl._internal.hashToken(token));

  const view = mockRes();
  await ctrl.getPreviewTheme({ store: { _id: STORE }, query: { token } }, view);
  assert.equal(view.statusCode, 200);
  assert.ok(view.body.data.theme.order);

  const wrong = mockRes();
  await ctrl.getPreviewTheme({ store: { _id: STORE }, query: { token: "x".repeat(32) } }, wrong);
  assert.equal(wrong.statusCode, 410);

  saved.previewLinks[0].expiresAt = new Date(Date.now() - 1000);
  const expired = mockRes();
  await ctrl.getPreviewTheme({ store: { _id: STORE }, query: { token } }, expired);
  assert.equal(expired.statusCode, 410);
});

test("scheduler claims due themes atomically and publishes once", async (t) => {
  const { runOnce } = require("../utils/themeScheduler");
  const due = [{ _id: "t1", storeId: STORE }];
  const chainList = (v) => { const q = { select: () => q, setOptions: () => q, lean: async () => v }; return q; };
  stub(t, StoreTheme, "find", () => chainList(due));
  let claims = 0;
  stub(t, StoreTheme, "findOneAndUpdate", () => {
    claims += 1;
    // Pehla claim snapshot leta hai, doosra (dusra instance) kuch nahi
    return chainList(claims === 1 ? { scheduled: { at: new Date(), data: buildDefaultTheme(), note: "Eid" } } : { scheduled: null });
  });
  const calls = [];
  const publish = async (args) => { calls.push(args); return { ok: true }; };
  assert.equal(await runOnce({ publish }), 1);
  assert.equal(await runOnce({ publish }), 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].note, "Scheduled: Eid");
  assert.equal(calls[0].storeId, String(STORE));
});
