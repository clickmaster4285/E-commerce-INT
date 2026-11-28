// Scale P1 (§5.6 / §6 / §7.1): jobs queue, leader lock, mailer split, image middlewares, error tracker
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

test("queue dedupes pending jobId and whenIdle resolves", async () => {
  const queue = require("../jobs/queue");
  let runs = 0;
  queue.register("t-dedupe", async () => { runs += 1; });
  const a = await queue.add("t-dedupe", {}, { jobId: "same" });
  const b = await queue.add("t-dedupe", {}, { jobId: "same" });
  assert.equal(a.queued, true);
  assert.equal(b.deduped, true);
  await queue.whenIdle();
  assert.equal(runs, 1);
  // run ke baad wahi jobId dobara add ho sakta hai
  const c = await queue.add("t-dedupe", {}, { jobId: "same" });
  assert.equal(c.queued, true);
  await queue.whenIdle();
  assert.equal(runs, 2);
});

test("queue retries failed job and reruns when re-added while running", async () => {
  const queue = require("../jobs/queue");
  let tries = 0;
  queue.register("t-retry", async () => { tries += 1; if (tries < 2) throw new Error("boom"); });
  await queue.add("t-retry", {}, { jobId: "r", attempts: 3, backoffMs: 5 });
  await queue.whenIdle();
  assert.equal(tries, 2);

  let seen = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  queue.register("t-rerun", async (payload) => { seen.push(payload); if (payload === 1) await gate; });
  await queue.add("t-rerun", 1, { jobId: "x" });
  await new Promise((r) => setImmediate(r));
  const dup = await queue.add("t-rerun", 2, { jobId: "x" }); // running → rerun mark
  assert.equal(dup.deduped, true);
  release();
  await queue.whenIdle();
  assert.deepEqual(seen, [1, 2]);
});

test("translation jobId is stable per model:id:fields", () => {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true }); // libreTranslate required env
  const { translationJobId } = require("../utils/translationService");
  const Model = { modelName: "Product" };
  assert.equal(translationJobId(Model, "1", ["b", "a"]), translationJobId(Model, "1", ["a", "b"]));
  assert.notEqual(translationJobId(Model, "1", ["a"]), translationJobId(Model, "2", ["a"]));
});

test("leader lock is a no-op without redis and honours NX result", async () => {
  const { acquireLeaderLock, withLeaderLock } = require("../utils/leaderLock");
  assert.equal(await acquireLeaderLock("t", { redis: null }), true);
  let calls = 0;
  assert.equal(await withLeaderLock("t", async () => { calls += 1; return "ran"; }, { redis: null }), "ran");
  assert.equal(calls, 1);

  const taken = { set: async (...args) => { taken.args = args; return null; } };
  assert.equal(await withLeaderLock("t", async () => { calls += 1; }, { redis: taken }), null);
  assert.equal(calls, 1);
  assert.equal(taken.args[0], "lock:scheduler:t");
  assert.deepEqual(taken.args.slice(2), ["PX", 55000, "NX"]);

  const free = { set: async () => "OK" };
  assert.equal(await acquireLeaderLock("t", { redis: free }), true);
  const broken = { set: async () => { throw new Error("down"); } };
  assert.equal(await acquireLeaderLock("t", { redis: broken }), true); // fail-open
});

test("schedulers use the leader lock", () => {
  assert.match(read("utils/bannerScheduler.js"), /withLeaderLock\('banner'/);
  assert.match(read("utils/themeScheduler.js"), /withLeaderLock\("theme"/);
  assert.match(read("utils/themeImageCleanup.js"), /withLeaderLock\("themeImageCleanup"/);
});

test("mailer / sendEmail / otp template exports", () => {
  const mailer = require("../utils/mailer");
  for (const key of ["getSmtpConfig", "isSmtpConfigured", "getTransporter", "verifySmtpConnection", "toFriendlySmtpError"]) {
    assert.equal(typeof mailer[key], "function", key);
  }
  const facade = require("../utils/sendEmail");
  for (const key of ["sendEmail", "sendOtpEmail", "isSmtpConfigured", "verifySmtpConnection", "getSmtpConfig"]) {
    assert.equal(typeof facade[key], "function", key);
  }
  const { escapeHtml, buildOtpEmail } = require("../services/email/otpTemplate");
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  process.env.PLATFORM_NAME ||= "TestStore";
  const mail = buildOtpEmail({ otp: "123456", purpose: "password_reset", expiresInMinutes: 10 });
  assert.match(mail.subject, /Reset your password/);
  assert.match(mail.html, /123456/);
  assert.match(mail.text, /123456/);
});

test("enqueueEmail queues and delivers through sendEmail", async () => {
  const queue = require("../jobs/queue");
  const facade = require("../utils/sendEmail");
  const sent = [];
  const original = facade.sendEmail;
  facade.sendEmail = async (message) => { sent.push(message); return { delivered: true }; };
  try {
    // handler jobs/email.js import par register hota hai (queue._reset se pehle test me gira nahi)
    const { enqueueEmail } = require("../jobs/email");
    const res = await enqueueEmail({ to: "a@b.c", subject: "s", html: "<p>x</p>", text: "x" }, { jobId: "mail-1" });
    assert.equal(res.queued, true);
    await queue.whenIdle();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "a@b.c");
  } finally {
    facade.sendEmail = original;
  }
});

test("image middlewares are migrated to createImageUpload", () => {
  for (const file of [
    "middleware/themeImageMiddleware.js",
    "middleware/bundleImageMiddleware.js",
    "middleware/imageMiddleware.js",
    "middleware/productImageMiddleware.js",
    "middleware/reviewUploadMiddleware.js",
  ]) {
    const src = read(file);
    assert.match(src, /createImageUpload/, file);
    assert.doesNotMatch(src, /tenantMulter|config\/uploadConfig/, file);
  }
  const { themeImageUpload, processThemeImage } = require("../middleware/themeImageMiddleware");
  assert.equal(typeof themeImageUpload, "function");
  const req = { file: { img_url: "/uploads/x.webp", img_size: 1, width: 2, height: 3 } };
  processThemeImage(req, {}, () => {});
  assert.deepEqual(req.themeImage, { url: "/uploads/x.webp", size: 1, width: 2, height: 3, mimeType: "image/webp" });
});

test("startup no longer creates legacy upload folders; store logo REST route exists", () => {
  assert.doesNotMatch(read("server.js"), /BUNDLE_UPLOAD_SUBDIR|REVIEW_UPLOAD_SUBDIR/);
  assert.match(read("routes/storeRoutes.js"), /router\.post\("\/logo"/);
});

test("migrateLegacyUploads plans moves under uploads/stores/<id>", async () => {
  const { planMigration } = require("../scripts/migrateLegacyUploads");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-up-"));
  fs.mkdirSync(path.join(root, "bundles", "b1"), { recursive: true });
  fs.writeFileSync(path.join(root, "bundles", "b1", "cover.webp"), "x");
  fs.mkdirSync(path.join(root, "store"), { recursive: true });
  fs.writeFileSync(path.join(root, "store", "logo.webp"), "x");
  const { plan, unresolved } = await planMigration({ uploadRoot: root, resolveStoreId: async () => "S1" });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].to, path.join(root, "stores", "S1", "bundles", "b1", "cover.webp"));
  assert.ok(unresolved.some((u) => u.path.startsWith("store")));
});

test("storage driver stub stays local; error tracker hook is safe", () => {
  process.env.STORAGE_DRIVER = "s3";
  const { storageDriver } = require("../utils/uploadPaths");
  assert.equal(storageDriver().effective, "local");
  delete process.env.STORAGE_DRIVER;

  const { captureError } = require("../utils/errorTracker");
  const captured = [];
  global.__errorTracker = (err, ctx) => captured.push([err.message, ctx.path]);
  captureError(new Error("bad"), { path: "/x" });
  global.__errorTracker = () => { throw new Error("tracker broken"); };
  assert.doesNotThrow(() => captureError(new Error("bad2")));
  delete global.__errorTracker;
  assert.deepEqual(captured, [["bad", "/x"]]);
});
