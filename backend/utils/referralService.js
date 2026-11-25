const crypto = require("crypto");
const User = require("../models/User");
const Referral = require("../models/Referral");
const ReferralProgram = require("../models/ReferralProgram");
const LoyaltyTransaction = require("../models/LoyaltyTransaction");
const { credit } = require("./loyaltyService");
const { getStoreId } = require("./tenantContext");

const createCode = () => crypto.randomBytes(5).toString("hex").toUpperCase();

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = createCode();
    try {
      const result = await User.updateOne({ _id: user._id, referralCode: null }, { $set: { referralCode: code } });
      if (result.modifiedCount) return code;
      const fresh = await User.findById(user._id).select("referralCode").lean();
      if (fresh?.referralCode) return fresh.referralCode;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new Error("Could not generate a unique referral code.");
}

async function processSignupReferral(user, rawCode) {
  const referralCode = String(rawCode || "").trim().toUpperCase();
  if (!referralCode || !getStoreId()) return null;
  const referrer = await User.findOne({ referralCode, role: "user", is_deleted: { $ne: true } }).select("_id").lean();
  if (!referrer || String(referrer._id) === String(user._id)) return null;
  const program = await ReferralProgram.findOne().lean();
  const enabled = Boolean(program?.enabled);
  const referrerPoints = enabled ? Math.max(0, Math.floor(program.referrerPoints || 0)) : 0;
  const friendPoints = enabled ? Math.max(0, Math.floor(program.friendPoints || 0)) : 0;
  let referral;
  try {
    referral = await Referral.create({
      referrerId: referrer._id,
      referredUserId: user._id,
      referralCode,
      referrerPoints,
      friendPoints,
      status: enabled ? "pending" : "ineligible",
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    referral = await Referral.findOne({ referredUserId: user._id });
    if (!referral || referral.status !== "pending") return referral;
  }
  if (referral.status === "pending") {
    await Promise.all([
      credit(referral.referrerId, { type: "referral", points: referral.referrerPoints, sourceKey: `referral:${referral._id}:referrer`, note: "Friend joined using your referral link" }),
      credit(referral.referredUserId, { type: "referral", points: referral.friendPoints, sourceKey: `referral:${referral._id}:friend`, note: "Welcome reward from a referral" }),
    ]);
    await Referral.updateOne({ _id: referral._id, status: "pending" }, { $set: { status: "rewarded" } });
  }
  return referral;
}

async function getReferralSummary(user) {
  if (user.referredByCode) await processSignupReferral(user, user.referredByCode);
  await rewardPendingReferrals(user._id);
  const code = await ensureReferralCode(user);
  const [program, total, recent, rewardTotals] = await Promise.all([
    ReferralProgram.findOne().lean(),
    Referral.countDocuments({ referrerId: user._id, status: "rewarded" }),
    Referral.find({ referrerId: user._id }).sort({ created_at: -1 }).limit(10).select("status friendPoints created_at").lean(),
    Referral.aggregate([
      { $match: { referrerId: user._id, status: "rewarded" } },
      { $group: { _id: null, points: { $sum: "$referrerPoints" } } },
    ]),
  ]);
  const { ROOT_DOMAIN } = require("./tenantHost");
  const store = await require("../models/Store").findById(getStoreId()).select("subdomain").lean();
  const protocol = process.env.PUBLIC_STORE_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : "http");
  const port = String(process.env.PUBLIC_STORE_PORT || "").trim();
  const host = store?.subdomain && ROOT_DOMAIN ? `${store.subdomain}.${ROOT_DOMAIN}` : "";
  const shareUrl = `${host ? `${protocol}://${host}${port ? `:${port}` : ""}` : ""}/login?mode=register&ref=${encodeURIComponent(code)}`;
  return { enabled: Boolean(program?.enabled), headline: program?.headline || "Invite a friend, earn rewards", referrerPoints: program?.referrerPoints || 0, friendPoints: program?.friendPoints || 0, code, shareUrl, successfulReferrals: total, pointsEarned: rewardTotals[0]?.points || 0, recent };
}

async function rewardPendingReferrals(userId) {
  const pending = await Referral.find({ referredUserId: userId, status: "pending" }).lean();
  for (const referral of pending) {
    await Promise.all([
      credit(referral.referrerId, { type: "referral", points: referral.referrerPoints, sourceKey: `referral:${referral._id}:referrer`, note: "Friend joined using your referral link" }),
      credit(referral.referredUserId, { type: "referral", points: referral.friendPoints, sourceKey: `referral:${referral._id}:friend`, note: "Welcome reward from a referral" }),
    ]);
    await Referral.updateOne({ _id: referral._id, status: "pending" }, { $set: { status: "rewarded" } });
  }
}

async function rewardReferralSale(order) {
  if (!order?._id || !order?.user_id || order.status !== "delivered" || !getStoreId()) return false;
  const [referral, program] = await Promise.all([
    Referral.findOne({ referredUserId: order.user_id, status: "rewarded" }).select("referrerId").lean(),
    ReferralProgram.findOne().select("enabled saleReferrerPoints").lean(),
  ]);
  const points = Math.max(0, Math.floor(Number(program?.saleReferrerPoints) || 0));
  if (!referral || !program?.enabled || !points) return false;
  return credit(referral.referrerId, {
    type: "referral",
    points,
    sourceKey: `referral-sale:${order._id}:referrer`,
    note: `Referral reward for delivered order ${order.order_number}`,
    order,
  });
}

async function reverseReferralSale(order) {
  if (!order?._id) return 0;
  const { reverseAvailableCredit } = require("./loyaltyService");
  return reverseAvailableCredit(
    `referral-sale:${order._id}:referrer`,
    `Referral sale reward reversed · order ${order.order_number} cancelled`,
  );
}

async function restoreReferralSale(order) {
  if (!order?._id) return false;
  const { restoreReversedCredit } = require("./loyaltyService");
  return restoreReversedCredit(
    `referral-sale:${order._id}:referrer`,
    `Referral sale reward restored · order ${order.order_number}`,
  );
}

module.exports = { ensureReferralCode, processSignupReferral, getReferralSummary, rewardPendingReferrals, rewardReferralSale, reverseReferralSale, restoreReferralSale, createCode };
