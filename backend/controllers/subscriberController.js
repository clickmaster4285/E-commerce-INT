// ==========================================================
// SUBSCRIBER CONTROLLER — newsletter signup (storefront) + admin list / CSV
// ==========================================================

const mongoose = require("mongoose");
const Subscriber = require("../models/Subscriber");

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

const { escapeRegex } = require("../utils/escapeRegex");
const normalizeEmail = (v) => String(v || "").trim().toLowerCase().slice(0, 254);

// ── PUBLIC: POST /newsletter/subscribe { email, locale? } ──
// Pehle se subscribed ho to bhi 200 (email enumerate na ho sake)
exports.subscribe = async (req, res) => {
  try {
    if (!req.store?._id) return fail(res, 404, "Store not found");
    const email = normalizeEmail(req.body?.email);
    if (!Subscriber.EMAIL_PATTERN.test(email)) return fail(res, 400, "Please enter a valid email address");
    const locale = String(req.body?.locale || "en").slice(0, 10);
    // Kahan se aaya (allowlist) — newsletter section ya store editor popup
    const source = ["newsletter_section", "popup", "footer"].includes(req.body?.source) ? req.body.source : "newsletter_section";

    await Subscriber.updateOne(
      { email },
      { $set: { status: "subscribed", locale }, $setOnInsert: { email, source } },
      { upsert: true },
    );
    return res.status(200).json({ success: true, message: "Subscribed" });
  } catch (error) {
    if (error?.code === 11000) return res.status(200).json({ success: true, message: "Subscribed" });
    return fail(res, 500, "Could not subscribe right now");
  }
};

function buildFilter(query) {
  const filter = {};
  if (["subscribed", "unsubscribed"].includes(query.status)) filter.status = query.status;
  const search = String(query.search || "").trim().slice(0, 100);
  if (search) filter.email = { $regex: escapeRegex(search.toLowerCase()) };
  return filter;
}

// ── ADMIN: GET /newsletter/admin?page&limit&search&status ──
exports.listSubscribers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = buildFilter(req.query);
    const [items, total, subscribed] = await Promise.all([
      Subscriber.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Subscriber.countDocuments(filter),
      Subscriber.countDocuments({ status: "subscribed" }),
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      success: true,
      data: items,
      counts: { subscribed },
      pagination: { total, page, limit, pages, hasNext: page < pages, hasPrev: page > 1 },
    });
  } catch (error) {
    return fail(res, 500, "Failed to load subscribers");
  }
};

// CSV injection se bachao (=, +, -, @ se shuru hone wale cells)
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ── ADMIN: GET /newsletter/admin/export (CSV) ──
exports.exportSubscribers = async (req, res) => {
  try {
    const rows = await Subscriber.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(50000).lean();
    const lines = [["email", "status", "locale", "subscribed_at"].join(",")];
    for (const r of rows) {
      lines.push([r.email, r.status, r.locale, new Date(r.createdAt).toISOString()].map(csvCell).join(","));
    }
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(`﻿${lines.join("\n")}`);
  } catch (error) {
    return fail(res, 500, "Failed to export subscribers");
  }
};

// ── ADMIN: PATCH /newsletter/admin/:id { status } ──
exports.updateSubscriber = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Subscriber not found");
    const status = req.body?.status;
    if (!["subscribed", "unsubscribed"].includes(status)) return fail(res, 400, "Invalid status");
    const doc = await Subscriber.findByIdAndUpdate(req.params.id, { $set: { status } }, { returnDocument: "after" }).lean();
    if (!doc) return fail(res, 404, "Subscriber not found");
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return fail(res, 500, "Failed to update subscriber");
  }
};

// ── ADMIN: DELETE /newsletter/admin/:id ──
exports.deleteSubscriber = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Subscriber not found");
    const doc = await Subscriber.findByIdAndDelete(req.params.id);
    if (!doc) return fail(res, 404, "Subscriber not found");
    return res.status(200).json({ success: true, data: { _id: doc._id } });
  } catch (error) {
    return fail(res, 500, "Failed to delete subscriber");
  }
};

exports._internal = { csvCell, buildFilter };
