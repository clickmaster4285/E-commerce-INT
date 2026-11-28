// ==========================================================
// CONTACT CONTROLLER — storefront contact form + admin inbox
// ==========================================================

const mongoose = require("mongoose");
const ContactMessage = require("../models/ContactMessage");
const { escapeRegex } = require("../utils/escapeRegex");
const AppError = require("../utils/AppError");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
const clip = (v, max) => String(v ?? "").trim().slice(0, max);

function parseContact(body = {}) {
  const errors = {};
  const data = {
    name: clip(body.name, 120),
    email: clip(body.email, 254).toLowerCase(),
    phone: clip(body.phone, 30).replace(/[^\d+\s()-]/g, ""),
    message: clip(body.message, 4000),
    locale: clip(body.locale || "en", 10),
    page: clip(body.page, 300),
  };
  if (!data.name) errors.name = "Name is required";
  if (!EMAIL.test(data.email)) errors.email = "Valid email is required";
  if (data.message.length < 5) errors.message = "Message is too short";
  // Honeypot: bots hidden field bhar dete hain
  if (clip(body.website, 200)) errors.spam = "Rejected";
  return { errors, data };
}

// ── PUBLIC: POST /contact ──
exports.submitMessage = async (req, res) => {
  try {
    if (!req.store?._id) {
      throw new AppError("Store not found", { status: 404, code: "STORE_NOT_FOUND" });
    }
    const { errors, data } = parseContact(req.body);
    if (errors.spam) return res.status(200).json({ success: true }); // bot ko pata na chale
    if (Object.keys(errors).length) {
      throw new AppError("Please check the form", { status: 400, code: "VALIDATION_ERROR", details: { errors } });
    }
    const doc = await ContactMessage.create(data);
    try {
      req.io?.emit("contactMessageCreated", { _id: doc._id }); // tenant room
    } catch (_) {}
    return res.status(201).json({ success: true });
  } catch (error) {
    // AppError (validation / store missing) — 500 me mat dabao
    if (error instanceof AppError || error?.isOperational) {
      const extra = { ...(error.code ? { code: error.code } : {}), ...(error.details || {}) };
      return fail(res, error.status || 400, error.message, extra);
    }
    return fail(res, 500, "Could not send your message right now");
  }
};

// ── ADMIN: GET /contact/admin?page&limit&status&search ──
exports.listMessages = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (["new", "read", "archived"].includes(req.query.status)) filter.status = req.query.status;
    const search = clip(req.query.search, 100);
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { message: rx }];
    }
    const [items, total, unread] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ContactMessage.countDocuments(filter),
      ContactMessage.countDocuments({ status: "new" }),
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      success: true,
      data: items,
      counts: { unread },
      pagination: { total, page, limit, pages, hasNext: page < pages, hasPrev: page > 1 },
    });
  } catch (error) {
    return fail(res, 500, "Failed to load messages");
  }
};

// ── ADMIN: PATCH /contact/admin/:id { status } ──
exports.updateMessage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Message not found");
    const status = req.body?.status;
    if (!["new", "read", "archived"].includes(status)) return fail(res, 400, "Invalid status");
    const doc = await ContactMessage.findByIdAndUpdate(req.params.id, { $set: { status } }, { returnDocument: "after" }).lean();
    if (!doc) return fail(res, 404, "Message not found");
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return fail(res, 500, "Failed to update message");
  }
};

// ── ADMIN: DELETE /contact/admin/:id ──
exports.deleteMessage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Message not found");
    const doc = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!doc) return fail(res, 404, "Message not found");
    return res.status(200).json({ success: true, data: { _id: doc._id } });
  } catch (error) {
    return fail(res, 500, "Failed to delete message");
  }
};

exports._internal = { parseContact };
