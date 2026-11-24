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
    const doc = await StoreTheme.findOne().select("published publishedVersion").lean();
    const version = doc?.publishedVersion || 0;
    const etag = `"${String(req.store._id)}-v${version}"`;

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.set("Vary", "Origin, Host");
    res.set("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    return res.status(200).json({
      success: true,
      data: { theme: doc?.published || buildDefaultTheme(), version },
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

// ── ADMIN: POST /theme/publish  { note? } ──
exports.publish = async (req, res) => {
  try {
    const current = await getOrCreateTheme();
    // Schema badal chuka ho to purana draft bhi dobara validate
    const result = validateThemeData(current.draft || buildDefaultTheme(), { storeId: storeIdFor(req) });
    if (!result.ok) return fail(res, 400, "Draft is invalid — fix it before publishing", { errors: result.errors });

    const nextVersion = (current.publishedVersion || 0) + 1;
    const doc = await StoreTheme.findOneAndUpdate(
      { publishedVersion: current.publishedVersion || 0 },
      {
        $set: { published: result.data, publishedAt: new Date(), publishedBy: actorId(req) },
        $inc: { publishedVersion: 1 },
      },
      { returnDocument: "after" },
    );
    if (!doc) return fail(res, 409, "Another publish just happened. Reload and try again.", { code: "THEME_PUBLISH_CONFLICT" });

    await StoreThemeVersion.create({
      version: nextVersion,
      data: result.data,
      note: String(req.body?.note || "").slice(0, 200),
      publishedBy: actorId(req),
    });

    // Purane versions prune (sirf aakhri MAX_VERSIONS)
    const stale = await StoreThemeVersion.find()
      .sort({ version: -1 })
      .skip(StoreThemeVersion.MAX_VERSIONS)
      .select("_id")
      .lean();
    if (stale.length) await StoreThemeVersion.deleteMany({ _id: { $in: stale.map((v) => v._id) } });

    invalidate(["theme"]);
    emitTheme(req, "themePublished", { version: doc.publishedVersion, publishedAt: doc.publishedAt });

    return res.status(200).json({ success: true, data: adminView(doc) });
  } catch (error) {
    return fail(res, 500, "Failed to publish theme");
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

exports._internal = { getOrCreateTheme, adminView };
