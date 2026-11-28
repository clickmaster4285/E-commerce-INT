// ==========================================================
// THEME CONTROLLER — store editor (draft / publish / versions)
// ----------------------------------------------------------
// Sab queries tenantScope plugin ke zariye current store tak mehdood hain
// (StoreTheme.findOne() = isi store ka theme). Draft public ko kabhi nahi jata.
// ==========================================================

const StoreTheme = require("../models/StoreTheme");
const StoreThemeVersion = require("../models/StoreThemeVersion");
const { buildDefaultTheme, publicSchema } = require("../config/themeSchema");
const { validateThemeData } = require("../utils/themeValidator");
const { invalidate } = require("../utils/publicCache");
const { storeIdFor } = require("../utils/uploadPaths");
const { publicTranslations, queueThemeTranslationSync } = require("../utils/themeTranslation");
const crypto = require("crypto");

// Preview links: random token (sirf hash DB me) — max itne active per store
const MAX_PREVIEW_LINKS = 5;
const PREVIEW_HOURS = [24, 168];
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

const actorId = (req) => (req.userType === "employee" && req.user?._id ? req.user._id : null);

/** Isi store ka theme document — pehli baar default se banta hai (race-safe) */
async function getOrCreateTheme() {
  const existing = await StoreTheme.findOne();
  if (existing) return existing;
  const defaults = buildDefaultTheme();
  try {
    return await StoreTheme.create({ draft: defaults, published: defaults });
  } catch (error) {
    // Do requests ek saath → unique { storeId } index; doosra wala existing utha le
    if (error?.code === 11000) return StoreTheme.findOne();
    throw error;
  }
}

const adminView = (doc) => ({
  draft: doc.draft || buildDefaultTheme(),
  published: doc.published || buildDefaultTheme(),
  draftRevision: doc.draftRevision,
  publishedVersion: doc.publishedVersion,
  draftUpdatedAt: doc.draftUpdatedAt,
  publishedAt: doc.publishedAt,
  hasUnpublishedChanges: JSON.stringify(doc.draft) !== JSON.stringify(doc.published),
  scheduled: doc.scheduled?.at ? { at: doc.scheduled.at, note: doc.scheduled.note || "", createdAt: doc.scheduled.createdAt } : null,
  lastScheduleError: doc.lastScheduleError || null,
  previewLinks: (doc.previewLinks || [])
    .filter((l) => new Date(l.expiresAt).getTime() > Date.now())
    .map((l) => ({ id: String(l._id), expiresAt: l.expiresAt, createdAt: l.createdAt })),
});

const emitTheme = (req, event, payload) => {
  try {
    req.io?.emit(event, payload); // tenant-aware proxy → room store:<id>
  } catch (_) {
    // socket fail → request phir bhi kamyab
  }
};

// ── PUBLIC: GET /theme/public — sirf published ──
exports.getPublicTheme = async (req, res) => {
  try {
    if (!req.store?._id) return fail(res, 404, "Store not found");
    const doc = await StoreTheme.findOne().select("published publishedVersion translations translationsUpdatedAt").lean();
    const version = doc?.publishedVersion || 0;
    // Translations publish ke baad async aate hain → ETag me unka stamp bhi
    const tStamp = doc?.translationsUpdatedAt ? new Date(doc.translationsUpdatedAt).getTime() : 0;
    const etag = `"${String(req.store._id)}-v${version}-t${tStamp}"`;

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.set("Vary", "Origin, Host");
    res.set("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    const localeRaw = String(req.query.locale || req.headers["x-lang"] || req.cookies?.lang || "").trim().toLowerCase();
    const locale = /^[a-z]{2}/.test(localeRaw) ? localeRaw.slice(0, 2) : "";
    return res.status(200).json({
      success: true,
      // Slice to one locale when known (optimizeplan.md §9.2) — else all locales for backward compat
      data: {
        theme: doc?.published || buildDefaultTheme(),
        version,
        translations: publicTranslations(doc?.translations, locale || undefined),
      },
    });
  } catch (error) {
    return fail(res, 500, "Failed to load theme");
  }
};

// ── ADMIN: GET /theme/schema ──
exports.getSchema = (req, res) => res.status(200).json({ success: true, data: publicSchema() });

// ── ADMIN: GET /theme ──
exports.getTheme = async (req, res) => {
  try {
    const doc = await getOrCreateTheme();
    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to load theme");
  }
};

// ── ADMIN: PUT /theme/draft  { data, baseRevision } ──
exports.saveDraft = async (req, res) => {
  try {
    const { data, baseRevision } = req.body || {};
    if (!Number.isInteger(baseRevision)) return fail(res, 400, "baseRevision (integer) is required");

    const result = validateThemeData(data, { storeId: storeIdFor(req) });
    if (!result.ok) return fail(res, 400, "Invalid theme data", { errors: result.errors });

    await getOrCreateTheme();
    // Atomic compare-and-set: doosre admin ne beech me save kiya → null → 409
    const doc = await StoreTheme.findOneAndUpdate(
      { draftRevision: baseRevision },
      {
        $set: { draft: result.data, draftUpdatedAt: new Date(), draftUpdatedBy: actorId(req) },
        $inc: { draftRevision: 1 },
      },
      { returnDocument: "after" },
    );
    if (!doc) {
      const current = await StoreTheme.findOne().select("draftRevision").lean();
      return fail(res, 409, "This theme was changed by someone else. Reload to get the latest version.", {
        code: "THEME_REVISION_CONFLICT",
        currentRevision: current?.draftRevision ?? null,
      });
    }
    return res.status(200).json({ success: true, data: { draftRevision: doc.draftRevision, draft: doc.draft } });
  } catch (error) {
    return fail(res, 500, "Failed to save draft");
  }
};

/**
 * Publish core — Publish button aur scheduled publish (utils/themeScheduler) dono.
 * Store context (runWithStore / request) ke andar chalna chahiye.
 * Returns { ok, doc } | { ok: false, status, message, errors?, code? }
 */
async function publishThemeData({ data, storeId, actor = null, note = "", io = null }) {
  const current = await getOrCreateTheme();
  // Schema badal chuka ho to purana draft / snapshot bhi dobara validate
  const result = validateThemeData(data || buildDefaultTheme(), { storeId });
  if (!result.ok) return { ok: false, status: 400, message: "Draft is invalid — fix it before publishing", errors: result.errors };

  const nextVersion = (current.publishedVersion || 0) + 1;
  const doc = await StoreTheme.findOneAndUpdate(
    { publishedVersion: current.publishedVersion || 0 },
    {
      $set: { published: result.data, publishedAt: new Date(), publishedBy: actor },
      $inc: { publishedVersion: 1 },
    },
    { returnDocument: "after" },
  );
  if (!doc) return { ok: false, status: 409, message: "Another publish just happened. Reload and try again.", code: "THEME_PUBLISH_CONFLICT" };

  await StoreThemeVersion.create({
    version: nextVersion,
    data: result.data,
    note: String(note || "").slice(0, 200),
    publishedBy: actor,
  });

  // Purane versions prune (sirf aakhri MAX_VERSIONS)
  const stale = await StoreThemeVersion.find()
    .sort({ version: -1 })
    .skip(StoreThemeVersion.MAX_VERSIONS)
    .select("_id")
    .lean();
  if (stale.length) await StoreThemeVersion.deleteMany({ _id: { $in: stale.map((v) => v._id) } });

  invalidate(["theme"]);
  try {
    io?.emit("themePublished", { version: doc.publishedVersion, publishedAt: doc.publishedAt });
  } catch (_) {}
  // Seller text → ur/ar (background, response block nahi hota)
  queueThemeTranslationSync(storeId);
  return { ok: true, doc };
}

const sendPublishResult = (res, r) =>
  r.ok
    ? res.status(200).json({ success: true, data: adminView(r.doc) })
    : fail(res, r.status, r.message, { ...(r.errors ? { errors: r.errors } : {}), ...(r.code ? { code: r.code } : {}) });

// ── ADMIN: POST /theme/publish  { note? } ──
exports.publish = async (req, res) => {
  try {
    const current = await getOrCreateTheme();
    const r = await publishThemeData({
      data: current.draft,
      storeId: storeIdFor(req),
      actor: actorId(req),
      note: req.body?.note,
      io: req.io,
    });
    return sendPublishResult(res, r);
  } catch (error) {
    return fail(res, 500, "Failed to publish theme");
  }
};

// ── ADMIN: POST /theme/schedule { at, note? } — draft ka SNAPSHOT us waqt publish hoga ──
// Snapshot is liye: schedule ke baad editor me kiye changes galti se live na hon.
exports.schedulePublish = async (req, res) => {
  try {
    const at = new Date(req.body?.at);
    const now = Date.now();
    if (Number.isNaN(at.getTime())) return fail(res, 400, "Pick a valid date and time");
    if (at.getTime() < now + 60 * 1000) return fail(res, 400, "Schedule at least 1 minute in the future");
    if (at.getTime() > now + 365 * 24 * 3600 * 1000) return fail(res, 400, "Schedule within the next 12 months");

    const current = await getOrCreateTheme();
    const result = validateThemeData(current.draft || buildDefaultTheme(), { storeId: storeIdFor(req) });
    if (!result.ok) return fail(res, 400, "Draft is invalid — fix it before scheduling", { errors: result.errors });

    const doc = await StoreTheme.findOneAndUpdate(
      { _id: current._id },
      {
        $set: {
          scheduled: {
            at,
            data: result.data,
            note: String(req.body?.note || "").slice(0, 200),
            by: actorId(req),
            createdAt: new Date(),
          },
          lastScheduleError: null,
        },
      },
      { returnDocument: "after" },
    );
    emitTheme(req, "themeScheduled", { at });
    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to schedule publish");
  }
};

// ── ADMIN: DELETE /theme/schedule ──
exports.cancelSchedule = async (req, res) => {
  try {
    const current = await getOrCreateTheme();
    const doc = await StoreTheme.findOneAndUpdate({ _id: current._id }, { $set: { scheduled: null } }, { returnDocument: "after" });
    emitTheme(req, "themeScheduled", { at: null });
    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to cancel schedule");
  }
};

// ── ADMIN: POST /theme/preview-links { hours: 24 | 168 } → { url-token (sirf ek baar), expiresAt } ──
exports.createPreviewLink = async (req, res) => {
  try {
    const hours = PREVIEW_HOURS.includes(Number(req.body?.hours)) ? Number(req.body.hours) : 24;
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    const current = await getOrCreateTheme();
    // Expired hatao, sirf aakhri MAX rakho
    const active = (current.previewLinks || []).filter((l) => new Date(l.expiresAt).getTime() > Date.now());
    const links = [...active, { hash: hashToken(token), expiresAt, createdAt: new Date(), createdBy: actorId(req) }].slice(-MAX_PREVIEW_LINKS);
    const doc = await StoreTheme.findOneAndUpdate({ _id: current._id }, { $set: { previewLinks: links } }, { returnDocument: "after" });
    return res.status(201).json({ success: true, data: { token, expiresAt, theme: adminView(doc) } });
  } catch (error) {
    return fail(res, 500, "Failed to create preview link");
  }
};

// ── ADMIN: DELETE /theme/preview-links — sab links revoke ──
exports.revokePreviewLinks = async (req, res) => {
  try {
    const current = await getOrCreateTheme();
    const doc = await StoreTheme.findOneAndUpdate({ _id: current._id }, { $set: { previewLinks: [] } }, { returnDocument: "after" });
    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to revoke preview links");
  }
};

// ── PUBLIC: GET /theme/preview?token= — valid link par CURRENT draft (login nahi) ──
exports.getPreviewTheme = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex");
    const token = String(req.query.token || "");
    if (!req.store?._id || token.length < 20 || token.length > 64) return fail(res, 404, "Preview link not found");
    const doc = await StoreTheme.findOne().select("draft previewLinks").lean();
    const hash = hashToken(token);
    const link = (doc?.previewLinks || []).find((l) => {
      const a = Buffer.from(String(l.hash || ""), "hex");
      const b = Buffer.from(hash, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
    if (!link || new Date(link.expiresAt).getTime() <= Date.now()) {
      return fail(res, 410, "This preview link has expired or was revoked", { code: "PREVIEW_EXPIRED" });
    }
    return res.status(200).json({ success: true, data: { theme: doc.draft || buildDefaultTheme(), expiresAt: link.expiresAt } });
  } catch (error) {
    return fail(res, 500, "Failed to load preview");
  }
};

// ── ADMIN: POST /theme/discard — draft = published ──
exports.discardDraft = async (req, res) => {
  try {
    const current = await getOrCreateTheme();
    const doc = await StoreTheme.findOneAndUpdate(
      { _id: current._id },
      {
        $set: { draft: current.published || buildDefaultTheme(), draftUpdatedAt: new Date(), draftUpdatedBy: actorId(req) },
        $inc: { draftRevision: 1 },
      },
      { returnDocument: "after" },
    );
    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to discard draft");
  }
};

// ── ADMIN: GET /theme/versions ──
exports.listVersions = async (req, res) => {
  try {
    const versions = await StoreThemeVersion.find()
      .sort({ version: -1 })
      .limit(StoreThemeVersion.MAX_VERSIONS)
      .select("version note publishedBy createdAt")
      .populate("publishedBy", "name email")
      .lean();
    return res.status(200).json({ success: true, data: versions });
  } catch (error) {
    return fail(res, 500, "Failed to load versions");
  }
};

// ── ADMIN: POST /theme/versions/:version/restore — snapshot → DRAFT (publish alag step) ──
exports.restoreVersion = async (req, res) => {
  try {
    const version = Number(req.params.version);
    if (!Number.isInteger(version) || version < 1) return fail(res, 400, "Invalid version");

    const snapshot = await StoreThemeVersion.findOne({ version }).lean();
    if (!snapshot) return fail(res, 404, "Version not found");

    const result = validateThemeData(snapshot.data, { storeId: storeIdFor(req) });
    if (!result.ok) return fail(res, 400, "This version no longer matches the theme schema", { errors: result.errors });

    const current = await getOrCreateTheme();
    const doc = await StoreTheme.findOneAndUpdate(
      { _id: current._id },
      {
        $set: { draft: result.data, draftUpdatedAt: new Date(), draftUpdatedBy: actorId(req) },
        $inc: { draftRevision: 1 },
      },
      { returnDocument: "after" },
    );
    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to restore version");
  }
};

// ── ADMIN: POST /theme/upload-image (themeImageMiddleware ke baad) ──
exports.uploadImage = (req, res) => {
  if (!req.themeImage) return fail(res, 400, "Image upload failed");
  return res.status(201).json({ success: true, data: req.themeImage });
};

exports._internal = { getOrCreateTheme, adminView, hashToken };
exports.publishThemeData = publishThemeData;
