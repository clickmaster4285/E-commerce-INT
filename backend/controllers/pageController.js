// ==========================================================
// PAGE CONTROLLER — seller ke custom pages (/pages/<slug>)
// Content hamesha sanitize hota hai (utils/themeValidator.sanitizeRichText).
// Public sirf `published` pages dekhta hai.
// ==========================================================

const mongoose = require("mongoose");
const StorePage = require("../models/StorePage");
const { sanitizeRichText } = require("../utils/themeValidator");
const { invalidate } = require("../utils/publicCache");
const { queueTranslationSync } = require("../utils/translationService");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const MAX_PAGES = 50;
const MAX_CONTENT = 100000;

const actorId = (req) => (req.userType === "employee" && req.user?._id ? req.user._id : null);

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Body → safe fields. Partial update par sirf bheje gaye fields. */
function parsePageBody(body, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body || {}, k);

  if (!partial || has("title")) {
    const title = String(body?.title || "").trim().slice(0, 120);
    if (!title) errors.title = "Title is required";
    out.title = title;
  }
  // Slug sirf create par (title se auto) ya jab explicitly bheja jaye — partial
  // update me sirf title badalne se URL nahi badalta (purane links na tootein).
  if (!partial || has("slug")) {
    const slug = slugify(has("slug") && body.slug ? body.slug : out.title);
    if (!slug || !StorePage.SLUG_PATTERN.test(slug)) errors.slug = "Slug must use letters, numbers and dashes";
    out.slug = slug;
  }
  if (!partial || has("content")) {
    out.content = sanitizeRichText(String(body?.content || ""), MAX_CONTENT);
  }
  if (!partial || has("status")) {
    const status = body?.status || "draft";
    if (!["draft", "published"].includes(status)) errors.status = "Invalid status";
    out.status = status;
  }
  if (!partial || has("seo")) {
    out.seo = {
      title: String(body?.seo?.title || "").trim().slice(0, 120),
      description: String(body?.seo?.description || "").trim().slice(0, 300),
    };
  }
  return { errors, data: out };
}

const afterWrite = (req, doc, event) => {
  invalidate(["pages"]);
  try {
    req.io?.emit(event, { _id: doc._id, slug: doc.slug, status: doc.status });
  } catch (_) {}
  if (event !== "pageDeleted") queueTranslationSync(StorePage, doc._id);
};

const duplicateSlug = (error) => error?.code === 11000;

const notFound = () => new AppError("Page not found", { status: 404, code: "NOT_FOUND" });
const slugTaken = () => new AppError("A page with this URL already exists", {
  status: 409, code: "SLUG_TAKEN", details: { errors: { slug: "Already in use" } },
});

// ── PUBLIC: GET /pages/public — published pages list (menus / footer) ──
exports.listPublicPages = asyncHandler(async (req, res) => {
  const pages = await StorePage.find({ status: "published" })
    .sort({ title: 1 })
    .select("title slug translations.title")
    .limit(MAX_PAGES)
    .lean();
  res.set("Cache-Control", "public, max-age=60");
  return res.status(200).json({ success: true, data: pages });
});

// ── PUBLIC: GET /pages/public/:slug ──
exports.getPublicPage = asyncHandler(async (req, res) => {
  const slug = slugify(req.params.slug);
  if (!slug) throw notFound();
  const page = await StorePage.findOne({ slug, status: "published" })
    .select("title slug content seo translations updatedAt")
    .lean();
  if (!page) throw notFound();
  res.set("Cache-Control", "public, max-age=60");
  return res.status(200).json({ success: true, data: page });
});

// ── ADMIN: GET /pages/admin ──
exports.listPages = asyncHandler(async (req, res) => {
  const pages = await StorePage.find()
    .sort({ updatedAt: -1 })
    .select("title slug status seo updatedAt createdAt")
    .lean();
  return res.status(200).json({ success: true, data: pages });
});

// ── ADMIN: GET /pages/admin/:id ──
exports.getPage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const page = await StorePage.findById(req.params.id).lean();
  if (!page) throw notFound();
  return res.status(200).json({ success: true, data: page });
});

// ── ADMIN: POST /pages/admin ──
exports.createPage = asyncHandler(async (req, res) => {
  const { errors, data } = parsePageBody(req.body);
  if (Object.keys(errors).length) throw new AppError("Invalid page", { status: 400, code: "VALIDATION_ERROR", details: { errors } });

  const count = await StorePage.countDocuments({});
  if (count >= MAX_PAGES) throw new AppError(`A store can have up to ${MAX_PAGES} pages.`, { status: 403, code: "PAGE_LIMIT" });

  let page;
  try {
    page = await StorePage.create({ ...data, createdBy: actorId(req), updatedBy: actorId(req) });
  } catch (error) {
    if (duplicateSlug(error)) throw slugTaken();
    throw error;
  }
  afterWrite(req, page, "pageCreated");
  return res.status(201).json({ success: true, data: page });
});

// ── ADMIN: PUT /pages/admin/:id ──
exports.updatePage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const { errors, data } = parsePageBody(req.body, { partial: true });
  if (Object.keys(errors).length) throw new AppError("Invalid page", { status: 400, code: "VALIDATION_ERROR", details: { errors } });

  let page;
  try {
    page = await StorePage.findByIdAndUpdate(
      req.params.id,
      { $set: { ...data, updatedBy: actorId(req) } },
      { returnDocument: "after", runValidators: true },
    );
  } catch (error) {
    if (duplicateSlug(error)) throw slugTaken();
    throw error;
  }
  if (!page) throw notFound();
  afterWrite(req, page, "pageUpdated");
  return res.status(200).json({ success: true, data: page });
});

// ── ADMIN: DELETE /pages/admin/:id ──
exports.deletePage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const page = await StorePage.findByIdAndDelete(req.params.id);
  if (!page) throw notFound();
  afterWrite(req, page, "pageDeleted");
  return res.status(200).json({ success: true, data: { _id: page._id } });
});
exports._internal = { parsePageBody, slugify };
