const Referral = require("../models/Referral");
const ReferralProgram = require("../models/ReferralProgram");
const LoyaltyTransaction = require("../models/LoyaltyTransaction");
const { getReferralSummary } = require("../utils/referralService");

const fail = (res, error, message) => {
  if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
  console.error("[referrals]", error);
  return res.status(500).json({ success: false, message });
};

exports.getMine = async (req, res) => {
  try { return res.json({ success: true, data: await getReferralSummary(req.user) }); }
  catch (error) { return fail(res, error, "Could not load your referral details."); }
};

exports.getAdmin = async (_req, res) => {
  try {
    const [program, total, rewarded, pending, latest, saleRewards, recentSales] = await Promise.all([
      ReferralProgram.findOne().lean(),
      Referral.countDocuments(),
      Referral.countDocuments({ status: "rewarded" }),
      Referral.countDocuments({ status: "pending" }),
      Referral.find().sort({ created_at: -1 }).limit(20).populate("referrerId", "name email").populate("referredUserId", "name email").lean(),
      LoyaltyTransaction.aggregate([
        { $match: { type: "referral", source_key: /^referral-sale:/, status: "available", points: { $gt: 0 } } },
        { $group: { _id: null, count: { $sum: 1 }, points: { $sum: "$points" } } },
      ]),
      LoyaltyTransaction.find({ type: "referral", source_key: /^referral-sale:/ }).sort({ created_at: -1 }).limit(20)
        .populate("user_id", "name email")
        .populate({ path: "order_id", select: "order_number total status user_id", populate: { path: "user_id", select: "name email" } })
        .lean(),
    ]);
    return res.json({ success: true, data: {
      settings: { enabled: Boolean(program?.enabled), referrerPoints: program?.referrerPoints ?? 100, friendPoints: program?.friendPoints ?? 100, saleReferrerPoints: program?.saleReferrerPoints ?? 0, headline: program?.headline || "Invite a friend, earn rewards" },
      stats: { total, rewarded, pending, saleRewards: saleRewards[0]?.count || 0, saleRewardPoints: saleRewards[0]?.points || 0 },
      recent: latest.map((row) => ({ id: row._id, status: row.status, referrerPoints: row.referrerPoints, friendPoints: row.friendPoints, createdAt: row.created_at, referrer: row.referrerId ? { name: row.referrerId.name, email: row.referrerId.email } : null, friend: row.referredUserId ? { name: row.referredUserId.name, email: row.referredUserId.email } : null })),
      recentSales: recentSales.map((row) => ({ id: row._id, points: row.points, reversedPoints: row.reversed_points || 0, status: row.status, createdAt: row.created_at, referrer: row.user_id ? { name: row.user_id.name, email: row.user_id.email } : null, order: row.order_id ? { number: row.order_id.order_number, total: row.order_id.total, status: row.order_id.status, customer: row.order_id.user_id ? { name: row.order_id.user_id.name, email: row.order_id.user_id.email } : null } : null })),
    } });
  } catch (error) { return fail(res, error, "Could not load referral settings."); }
};

exports.saveAdmin = async (req, res) => {
  try {
    const body = req.body || {};
    const referrerPoints = Number(body.referrerPoints);
    const friendPoints = Number(body.friendPoints);
    const saleReferrerPoints = Number(body.saleReferrerPoints ?? 0);
    const headline = String(body.headline || "").trim();
    const errors = {};
    if (!Number.isInteger(referrerPoints) || referrerPoints < 0 || referrerPoints > 1000000) errors.referrerPoints = "Enter a whole number from 0 to 1,000,000.";
    if (!Number.isInteger(friendPoints) || friendPoints < 0 || friendPoints > 1000000) errors.friendPoints = "Enter a whole number from 0 to 1,000,000.";
    if (!Number.isInteger(saleReferrerPoints) || saleReferrerPoints < 0 || saleReferrerPoints > 1000000) errors.saleReferrerPoints = "Enter a whole number from 0 to 1,000,000.";
    if (headline.length < 5 || headline.length > 100) errors.headline = "Use 5–100 characters.";
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: "Please review the highlighted fields.", errors });

    const doc = await ReferralProgram.findOneAndUpdate({}, { $set: { enabled: Boolean(body.enabled), referrerPoints, friendPoints, saleReferrerPoints, headline } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }).lean();
    return res.json({ success: true, message: "Referral program saved.", data: { enabled: doc.enabled, referrerPoints: doc.referrerPoints, friendPoints: doc.friendPoints, saleReferrerPoints: doc.saleReferrerPoints, headline: doc.headline } });
  } catch (error) { return fail(res, error, "Could not save referral settings."); }
};
