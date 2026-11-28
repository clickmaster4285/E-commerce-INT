// ==========================================================
// LOYALTY CONTROLLER — admin (settings, members, history) +
// customer (/me) + public program info (storefront banners)
// ==========================================================

const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");
const LoyaltySettings = require("../models/LoyaltySettings");
const LoyaltyAccount = require("../models/LoyaltyAccount");
const LoyaltyTransaction = require("../models/LoyaltyTransaction");
const loyalty = require("../utils/loyaltyService");
const { normalizeSettings } = require("../utils/loyaltyMath");
const log = require("../utils/logger");

const fail = (res, err, fallback) => {
  if (err?.status) return res.status(err.status).json({ success: false, message: err.message });
  log.error(`[loyalty] ${fallback}:`, err);
  return res.status(500).json({ success: false, message: fallback });
};

const pageParams = (q, max = 100) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const pagination = (total, page, limit) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  return { total, page, limit, pages, hasNext: page < pages, hasPrev: page > 1 };
};
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Customer ko sirf wahi settings jo UI me dikhti hain. */
const publicProgram = (s) => ({
  enabled: s.enabled,
  programName: s.programName,
  earn: { enabled: s.earn.enabled, pointsPerUnit: s.earn.pointsPerUnit, spendUnit: s.earn.spendUnit, minOrderSubtotal: s.earn.minOrderSubtotal },
  signupBonus: { enabled: s.signupBonus.enabled, points: s.signupBonus.points },
  redeem: s.redeem,
});

const mapTxn = (t) => ({
  _id: t._id,
  type: t.type,
  points: t.points,
  status: t.status,
  order_id: t.order_id || null,
  order_number: t.order_number || "",
  note: t.note || "",
  actor_name: t.actor_name || "",
  created_at: t.created_at,
  ...(t.user_id && typeof t.user_id === "object" && t.user_id._id
    ? { user: { _id: t.user_id._id, name: t.user_id.name, email: t.user_id.email } }
    : { user_id: t.user_id }),
});

const mapAccount = (a) => ({
  balance: a?.balance || 0,
  pending: a?.pending || 0,
  lifetimeEarned: a?.lifetimeEarned || 0,
  lifetimeRedeemed: a?.lifetimeRedeemed || 0,
});

// ── Public ─────────────────────────────────────────────────
// GET /loyalty/program
const getProgram = async (req, res) => {
  try {
    const s = await loyalty.getSettings();
    res.json({ success: true, data: publicProgram(s) });
  } catch (err) {
    fail(res, err, "Could not load the rewards program");
  }
};

// ── Customer ───────────────────────────────────────────────
// GET /loyalty/me?page=&limit=
const getMyRewards = async (req, res) => {
  try {
    const { page, limit, skip } = pageParams(req.query, 50);
    const [s, account, total, txns] = await Promise.all([
      loyalty.getSettings(),
      loyalty.getAccount(req.user._id),
      LoyaltyTransaction.countDocuments({ user_id: req.user._id }),
      LoyaltyTransaction.find({ user_id: req.user._id }).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json({
      success: true,
      data: {
        program: publicProgram(s),
        account: mapAccount(account),
        transactions: txns.map(mapTxn),
        pagination: pagination(total, page, limit),
      },
    });
  } catch (err) {
    fail(res, err, "Could not load your rewards");
  }
};


// GET /loyalty/me/notices — admin ki taraf se points tabdeeliyan jo customer ne nahi dekhin
const getMyNotices = async (req, res) => {
  try {
    const [notices, account, s] = await Promise.all([
      loyalty.unseenNotices(req.user._id),
      loyalty.getAccount(req.user._id),
      loyalty.getSettings(),
    ]);
    res.json({
      success: true,
      data: {
        program: publicProgram(s),
        account: mapAccount(account),
        notices: notices.map((x) => ({
          _id: x._id, kind: x.kind, points: x.points, refunded: x.refunded, reversed: x.reversed,
          order_id: x.order_id, order_number: x.order_number, note: x.note, balance_after: x.balance_after, created_at: x.created_at,
        })),
      },
    });
  } catch (err) {
    fail(res, err, "Could not load notices");
  }
};

// POST /loyalty/me/notices/seen  { ids?: [] } — ids na hon to saare
const markMyNoticesSeen = async (req, res) => {
  try {
    const count = await loyalty.markNoticesSeen(req.user._id, req.body?.ids);
    res.json({ success: true, data: { count } });
  } catch (err) {
    fail(res, err, "Could not update notices");
  }
};
// POST /loyalty/me/welcome/claim — bonus signup par already credited hota hai,
// yahan sirf us transaction ko claimed mark karte hain (balance unchanged).
const claimWelcomeBonus = async (req, res) => {
  try {
    const result = await loyalty.claimWelcomeBonus(req.user._id);
    if (!result.ok) return res.status(404).json({ success: false, message: "No welcome reward is available." });
    res.json({
      success: true,
      data: {
        claimed: result.claimed,
        alreadyClaimed: Boolean(result.alreadyClaimed),
        points: result.points,
        account: mapAccount({ balance: result.balance }),
      },
    });
  } catch (err) {
    fail(res, err, "Could not claim your reward");
  }
};

// ── Admin: settings ────────────────────────────────────────
// GET /loyalty/admin/settings
const getSettings = async (req, res) => {
  try {
    const doc = await LoyaltySettings.findOne().lean();
    res.json({ success: true, data: { ...normalizeSettings(doc || {}), updated_at: doc?.updated_at || null } });
  } catch (err) {
    fail(res, err, "Could not load loyalty settings");
  }
};

// PUT /loyalty/admin/settings
const updateSettings = async (req, res) => {
  try {
    const b = req.body || {};
    const errors = {};
    const name = String(b.programName ?? "Rewards").trim();
    if (name.length < 2 || name.length > 40) errors.programName = "Use 2–40 characters.";
    const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
    if (!positive(b.earn?.spendUnit)) errors["earn.spendUnit"] = "Must be greater than 0.";
    if (!(Number(b.earn?.pointsPerUnit) >= 0)) errors["earn.pointsPerUnit"] = "Must be 0 or more.";
    if (!positive(b.redeem?.redeemPoints)) errors["redeem.redeemPoints"] = "Must be greater than 0.";
    if (!positive(b.redeem?.redeemValue)) errors["redeem.redeemValue"] = "Must be greater than 0.";
    const pct = Number(b.redeem?.maxPercent);
    if (!(pct >= 1 && pct <= 100)) errors["redeem.maxPercent"] = "Between 1 and 100.";
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });
    }

    const s = normalizeSettings({ ...b, programName: name });
    const doc = await LoyaltySettings.findOneAndUpdate(
      {},
      {
        $set: {
          enabled: s.enabled,
          programName: s.programName,
          earn: s.earn,
          signupBonus: s.signupBonus,
          redeem: s.redeem,
          updatedby: req.user?._id || null,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean();
    res.json({ success: true, message: "Loyalty settings saved", data: { ...normalizeSettings(doc), updated_at: doc.updated_at } });
  } catch (err) {
    fail(res, err, "Could not save loyalty settings");
  }
};

// ── Admin: overview ────────────────────────────────────────
// GET /loyalty/admin/overview
const getOverview = async (req, res) => {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);

    const [s, totalsAgg, customers, members, discountAgg, series, recent, top] = await Promise.all([
      loyalty.getSettings(),
      LoyaltyAccount.aggregate([
        { $group: { _id: null, balance: { $sum: "$balance" }, pending: { $sum: "$pending" }, earned: { $sum: "$lifetimeEarned" }, redeemed: { $sum: "$lifetimeRedeemed" } } },
      ]),
      User.countDocuments({ role: "user", is_deleted: { $ne: true } }),
      LoyaltyAccount.countDocuments({ $or: [{ lifetimeEarned: { $gt: 0 } }, { pending: { $gt: 0 } }] }),
      Order.aggregate([
        { $match: { loyalty_discount: { $gt: 0 }, status: { $ne: "cancelled" } } },
        { $group: { _id: null, value: { $sum: "$loyalty_discount" }, orders: { $sum: 1 } } },
      ]),
      LoyaltyTransaction.aggregate([
        { $match: { created_at: { $gte: since }, status: { $ne: "reversed" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            earned: { $sum: { $cond: [{ $and: [{ $gt: ["$points", 0] }, { $ne: ["$type", "refund"] }] }, "$points", 0] } },
            redeemed: { $sum: { $cond: [{ $eq: ["$type", "redeem"] }, { $multiply: ["$points", -1] }, 0] } },
          },
        },
      ]),
      LoyaltyTransaction.find().sort({ created_at: -1 }).limit(8).populate("user_id", "name email").lean(),
      LoyaltyAccount.find({ balance: { $gt: 0 } }).sort({ balance: -1 }).limit(5).populate("user_id", "name email").lean(),
    ]);

    const byDay = new Map(series.map((d) => [d._id, d]));
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, earned: byDay.get(key)?.earned || 0, redeemed: byDay.get(key)?.redeemed || 0 });
    }

    const t = totalsAgg[0] || {};
    res.json({
      success: true,
      data: {
        program: { enabled: s.enabled, programName: s.programName, redeem: s.redeem },
        stats: {
          customers,
          members,
          outstanding: t.balance || 0,
          pending: t.pending || 0,
          earned: t.earned || 0,
          redeemed: t.redeemed || 0,
          discountValue: discountAgg[0]?.value || 0,
          ordersWithPoints: discountAgg[0]?.orders || 0,
        },
        series: days,
        recent: recent.map(mapTxn),
        top: top.filter((a) => a.user_id).map((a) => ({ user: { _id: a.user_id._id, name: a.user_id.name, email: a.user_id.email }, ...mapAccount(a) })),
      },
    });
  } catch (err) {
    fail(res, err, "Could not load the loyalty overview");
  }
};

// ── Admin: members ─────────────────────────────────────────
const MEMBER_SORTS = {
  balance: { "account.balance": -1, created_at: -1 },
  earned: { "account.lifetimeEarned": -1, created_at: -1 },
  redeemed: { "account.lifetimeRedeemed": -1, created_at: -1 },
  newest: { created_at: -1 },
  name: { name: 1 },
};

// GET /loyalty/admin/members?search=&page=&limit=&sort=&filter=
const listMembers = async (req, res) => {
  try {
    const { page, limit, skip } = pageParams(req.query);
    const match = { role: "user", is_deleted: { $ne: true } };
    const search = String(req.query.search || "").trim();
    if (search) {
      const re = new RegExp(escapeRe(search), "i");
      match.$or = [{ name: re }, { email: re }, { phone: re }, { username: re }];
    }
    const sort = MEMBER_SORTS[req.query.sort] || MEMBER_SORTS.balance;

    const post = [];
    if (req.query.filter === "with_points") post.push({ $match: { "account.balance": { $gt: 0 } } });
    if (req.query.filter === "pending") post.push({ $match: { "account.pending": { $gt: 0 } } });
    if (req.query.filter === "redeemed") post.push({ $match: { "account.lifetimeRedeemed": { $gt: 0 } } });

    const [result] = await User.aggregate([
      { $match: match },
      { $lookup: { from: LoyaltyAccount.collection.collectionName, localField: "_id", foreignField: "user_id", as: "account" } },
      { $set: { account: { $ifNull: [{ $first: "$account" }, {}] } } },
      ...post,
      {
        $facet: {
          rows: [
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },
            { $project: { name: 1, email: 1, phone: 1, avatar: 1, created_at: 1, account: 1 } },
          ],
          total: [{ $count: "n" }],
        },
      },
    ]);

    const total = result?.total?.[0]?.n || 0;
    res.json({
      success: true,
      data: (result?.rows || []).map((u) => ({
        _id: u._id, name: u.name, email: u.email, phone: u.phone || "", avatar: u.avatar || null,
        joined_at: u.created_at, ...mapAccount(u.account),
      })),
      pagination: pagination(total, page, limit),
    });
  } catch (err) {
    fail(res, err, "Could not load members");
  }
};

// GET /loyalty/admin/members/:userId?page=&limit=
const getMember = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(404).json({ success: false, message: "Customer not found" });
    const user = await User.findOne({ _id: userId, role: "user" }).select("name email phone avatar created_at").lean();
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const { page, limit, skip } = pageParams(req.query, 50);
    const [account, total, txns, orderAgg] = await Promise.all([
      loyalty.getAccount(user._id),
      LoyaltyTransaction.countDocuments({ user_id: user._id }),
      LoyaltyTransaction.find({ user_id: user._id }).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      Order.aggregate([
        { $match: { user_id: user._id, status: { $ne: "cancelled" } } },
        { $group: { _id: null, orders: { $sum: 1 }, spent: { $sum: "$total" }, saved: { $sum: "$loyalty_discount" } } },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, email: user.email, phone: user.phone || "", avatar: user.avatar || null, joined_at: user.created_at },
        account: mapAccount(account),
        orders: { count: orderAgg[0]?.orders || 0, spent: orderAgg[0]?.spent || 0, saved: orderAgg[0]?.saved || 0 },
        transactions: txns.map(mapTxn),
        pagination: pagination(total, page, limit),
      },
    });
  } catch (err) {
    fail(res, err, "Could not load this member");
  }
};

// POST /loyalty/admin/members/:userId/adjust  { points, note }
const adjustMember = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(404).json({ success: false, message: "Customer not found" });
    const user = await User.exists({ _id: userId, role: "user" });
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const note = String(req.body?.note || "").trim();
    if (note.length < 3) {
      return res.status(400).json({ success: false, message: "Add a short reason.", errors: { note: "Add a short reason (at least 3 characters)." } });
    }
    await loyalty.adjust(userId, req.body?.points, note.slice(0, 300), { _id: req.user?._id, name: req.user?.name || "Administrator" });
    const account = await loyalty.getAccount(userId);
    res.json({ success: true, message: "Points updated", data: mapAccount(account) });
  } catch (err) {
    fail(res, err, "Could not adjust points");
  }
};

// ── Admin: transactions ────────────────────────────────────
// GET /loyalty/admin/transactions?type=&search=&page=&limit=
const listTransactions = async (req, res) => {
  try {
    const { page, limit, skip } = pageParams(req.query);
    const filter = {};
    if (LoyaltyTransaction.TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (["pending", "available", "reversed"].includes(req.query.status)) filter.status = req.query.status;
    const search = String(req.query.search || "").trim();
    if (search) {
      const re = new RegExp(escapeRe(search), "i");
      const users = await User.find({ role: "user", $or: [{ name: re }, { email: re }, { phone: re }] }).select("_id").limit(200).lean();
      filter.$or = [{ user_id: { $in: users.map((u) => u._id) } }, { order_number: re }, { note: re }];
    }
    const [total, rows] = await Promise.all([
      LoyaltyTransaction.countDocuments(filter),
      LoyaltyTransaction.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate("user_id", "name email").lean(),
    ]);
    res.json({ success: true, data: rows.map(mapTxn), pagination: pagination(total, page, limit) });
  } catch (err) {
    fail(res, err, "Could not load transactions");
  }
};

module.exports = {
  getProgram,
  getMyRewards,
  getMyNotices,
  markMyNoticesSeen,
  claimWelcomeBonus,
  getSettings,
  updateSettings,
  getOverview,
  listMembers,
  getMember,
  adjustMember,
  listTransactions,
};
