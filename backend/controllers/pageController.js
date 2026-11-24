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

const MAX_PAGES = 50;
const MAX_CONTENT = 100000;

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
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

// ── PUBLIC: GET /pages/public — published pages list (menus / footer) ──
exports.listPublicPages = async (req, res) => {
  try {
    const pages = await StorePage.find({ status: "published" })
      .sort({ title: 1 })
      .select("title slug translations.title")
      .limit(MAX_PAGES)
      .lean();
    res.set("Cache-Control", "public, max-age=60");
    return res.status(200).json({ success: true, data: pages });
  } catch (error) {
    return fail(res, 500, "Failed to load pages");
  }
};

// ── PUBLIC: GET /pages/public/:slug ──
exports.getPublicPage = async (req, res) => {
  try {
    const slug = slugify(req.params.slug);
    if (!slug) return fail(res, 404, "Page not found");
    const page = await StorePage.findOne({ slug, status: "published" })
      .select("title slug content seo translations updatedAt")
      .lean();
    if (!page) return fail(res, 404, "Page not found");
    res.set("Cache-Control", "public, max-age=60");
    return res.status(200).json({ success: true, data: page });
  } catch (error) {
    return fail(res, 500, "Failed to load page");
  }
};

// ── ADMIN: GET /pages/admin ──
exports.listPages = async (req, res) => {
  try {
    const pages = await StorePage.find()
      .sort({ updatedAt: -1 })
      .select("title slug status seo updatedAt createdAt")
      .lean();
    return res.status(200).json({ success: true, data: pages });
  } catch (error) {
    return fail(res, 500, "Failed to load pages");
  }
};

// ── ADMIN: GET /pages/admin/:id ──
exports.getPage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Page not found");
    const page = await StorePage.findById(req.params.id).lean();
    if (!page) return fail(res, 404, "Page not found");
    return res.status(200).json({ success: true, data: page });
  } catch (error) {
    return fail(res, 500, "Failed to load page");
  }
};

// ── ADMIN: POST /pages/admin ──
exports.createPage = async (req, res) => {
  try {
    const { errors, data } = parsePageBody(req.body);
    if (Object.keys(errors).length) return fail(res, 400, "Invalid page", { errors });

    const count = await StorePage.countDocuments({});
    if (count >= MAX_PAGES) return fail(res, 403, `A store can have up to ${MAX_PAGES} pages.`);

    const page = await StorePage.create({ ...data, createdBy: actorId(req), updatedBy: actorId(req) });
    afterWrite(req, page, "pageCreated");
    return res.status(201).json({ success: true, data: page });
  } catch (error) {
    if (duplicateSlug(error)) return fail(res, 409, "A page with this URL already exists", { errors: { slug: "Already in use" } });
    return fail(res, 500, "Failed to create page");
  }
};

// ── ADMIN: PUT /pages/admin/:id ──
exports.updatePage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Page not found");
    const { errors, data } = parsePageBody(req.body, { partial: true });
    if (Object.keys(errors).length) return fail(res, 400, "Invalid page", { errors });

    const page = await StorePage.findByIdAndUpdate(
      req.params.id,
      { $set: { ...data, updatedBy: actorId(req) } },
      { returnDocument: "after", runValidators: true },
    );
    if (!page) return fail(res, 404, "Page not found");
    afterWrite(req, page, "pageUpdated");
    return res.status(200).json({ success: true, data: page });
  } catch (error) {
    if (duplicateSlug(error)) return fail(res, 409, "A page with this URL already exists", { errors: { slug: "Already in use" } });
    return fail(res, 500, "Failed to update page");
  }
};

// ── ADMIN: DELETE /pages/admin/:id ──
exports.deletePage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Page not found");
    const page = await StorePage.findByIdAndDelete(req.params.id);
    if (!page) return fail(res, 404, "Page not found");
    afterWrite(req, page, "pageDeleted");
    return res.status(200).json({ success: true, data: { _id: page._id } });
  } catch (error) {
    return fail(res, 500, "Failed to delete page");
  }
};

exports._internal = { parsePageBody, slugify };
