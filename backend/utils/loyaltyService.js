// ==========================================================
// LOYALTY SERVICE — points ka saara DB kaam yahin hota hai
// ----------------------------------------------------------
// Qaida: account ka balance/pending sirf yahan $inc hota hai, aur har
// tabdeeli ke saath ek LoyaltyTransaction banta hai. source_key unique
// hai, is liye koi bhi event (signup, order earn, refund) do baar nahi lagta.
//
// Order ke points ka safar:
//   placeOrder      → earn txn "pending" (account.pending +) — kharch nahi ho sakte
//   delivered       → "available" (pending −, balance +)
//   delivered → wapas (shipped waghera) → dobara "pending" (balance minus nahi)
//   cancelled       → "reversed" — balance se wapas (minus kabhi nahi)
//                     + is order me kharch kiye points refund
//   delete (pending)→ wahi jo cancel me
// ==========================================================

const mongoose = require("mongoose");
const LoyaltySettings = require("../models/LoyaltySettings");
const LoyaltyAccount = require("../models/LoyaltyAccount");
const LoyaltyTransaction = require("../models/LoyaltyTransaction");
const LoyaltyNotice = require("../models/LoyaltyNotice");
const { normalizeSettings, pointsForAmount, quoteRedemption } = require("./loyaltyMath");
const log = require("./logger");
const { getStoreId } = require("./tenantContext");

const isDup = (err) => err && err.code === 11000;

/** Store ki settings (DB me na ho to defaults — program off). */
async function getSettings() {
  // Store context ke baghair (platform host / script) program hamesha off
  if (!getStoreId()) return normalizeSettings({});
  const doc = await LoyaltySettings.findOne().lean();
  return normalizeSettings(doc || {});
}

async function ensureAccount(userId) {
  return LoyaltyAccount.findOneAndUpdate(
    { user_id: userId },
    { $setOnInsert: { user_id: userId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
}

async function getAccount(userId) {
  const acc = await LoyaltyAccount.findOne({ user_id: userId }).lean();
  return acc || { user_id: userId, balance: 0, pending: 0, lifetimeEarned: 0, lifetimeRedeemed: 0 };
}

const inc = (userId, fields) =>
  LoyaltyAccount.updateOne({ user_id: userId }, { $inc: fields, $setOnInsert: { user_id: userId } }, { upsert: true });

/**
 * Seedha "available" credit (signup / adjust / refund).
 * Duplicate source_key → kuch nahi hota (false return).
 */
async function credit(userId, { type, points, sourceKey, note = "", order = null, actor = null }) {
  if (!points) return false;
  try {
    await LoyaltyTransaction.create({
      user_id: userId,
      type,
      points,
      status: "available",
      source_key: sourceKey,
      order_id: order?._id || null,
      order_number: order?.order_number || "",
      note,
      actor_id: actor?._id || null,
      actor_name: actor?.name || "",
    });
  } catch (err) {
    if (isDup(err)) return false;
    throw err;
  }
  const fields = { balance: points };
  if (points > 0 && type !== "refund") fields.lifetimeEarned = points;
  if (type === "refund") fields.lifetimeRedeemed = -points;
  await inc(userId, fields);
  return true;
}

// ── Signup ─────────────────────────────────────────────────
/** Naye verified customer ko welcome bonus. Errors kabhi signup nahi rokte. */
async function awardSignupBonus(userId) {
  try {
    const s = await getSettings();
    if (!s.enabled || !s.signupBonus.enabled || s.signupBonus.points <= 0) return 0;
    const done = await credit(userId, {
      type: "signup",
      points: s.signupBonus.points,
      sourceKey: `signup:${userId}`,
      note: "Welcome bonus",
    });
    return done ? s.signupBonus.points : 0;
  } catch (err) {
    log.error("[loyalty] signup bonus failed:", err.message);
    return 0;
  }
}

// ── Welcome claim ──────────────────────────────────────────
/**
 * Welcome bonus signup par hi "available" balance me credit ho chuka hota hai.
 * Claim sirf usi transaction ko mark karta hai — balance DObara nahi badhta.
 * Conditional update se concurrent clicks bhi idempotent rehte hain.
 */
async function claimWelcomeBonus(userId) {
  const [account, txn] = await Promise.all([
    getAccount(userId),
    LoyaltyTransaction.findOne({
      user_id: userId,
      type: "signup",
      source_key: `signup:${userId}`,
      status: "available",
    }).lean(),
  ]);
  const balance = account.balance || 0;
  if (!txn) return { ok: false, claimed: false, points: 0, balance };
  if (txn.claimed_at) return { ok: true, claimed: false, alreadyClaimed: true, points: txn.points || 0, balance };

  const updated = await LoyaltyTransaction.findOneAndUpdate(
    { _id: txn._id, claimed_at: null },
    { $set: { claimed_at: new Date() } },
    { lean: true },
  );
  return {
    ok: true,
    claimed: Boolean(updated),
    alreadyClaimed: !updated,
    points: txn.points || 0,
    balance,
  };
}

// ── Checkout ───────────────────────────────────────────────
/**
 * Order banne se PEHLE points kaat lo (atomic: balance >= points shart ke saath).
 * orderId pehle se bana hota hai taake order fail ho to refundRedemption chale.
 * Returns { points, discount } — 0/0 agar kuch redeem nahi hua.
 * Galat request par Error (status 400) throw hota hai.
 */
async function redeemForCheckout(userId, { requested, subtotal, orderId }) {
  const want = Math.floor(Number(requested) || 0);
  if (want <= 0) return { points: 0, discount: 0 };

  const s = await getSettings();
  const account = await getAccount(userId);
  const q = quoteRedemption(s, { balance: account.balance, subtotal, requested: want });
  if (!q.ok) {
    const err = new Error(
      q.reason === "min_points"
        ? `You need at least ${s.redeem.minPoints} points to redeem.`
        : q.reason === "order_small"
          ? `Add more items to use points — they can pay up to ${s.redeem.maxPercent}% of the items total.`
          : "Points can't be used on this order.",
    );
    err.status = 400;
    throw err;
  }

  const res = await LoyaltyAccount.updateOne(
    { user_id: userId, balance: { $gte: q.points } },
    { $inc: { balance: -q.points, lifetimeRedeemed: q.points } },
  );
  if (!res.modifiedCount) {
    const err = new Error("Your points balance changed. Please review and try again.");
    err.status = 409;
    throw err;
  }
  try {
    await LoyaltyTransaction.create({
      user_id: userId,
      type: "redeem",
      points: -q.points,
      status: "available",
      source_key: `redeem:${orderId}`,
      order_id: orderId,
      note: `Rs ${q.discount} off order`,
    });
  } catch (err) {
    await inc(userId, { balance: q.points, lifetimeRedeemed: -q.points });
    throw err;
  }
  return { points: q.points, discount: q.discount };
}

/** Order create fail ho gaya → kaate hue points wapas (transaction hata ke). */
async function rollbackRedemption(userId, orderId) {
  try {
    const txn = await LoyaltyTransaction.findOneAndDelete({ source_key: `redeem:${orderId}` }).lean();
    if (txn) await inc(userId, { balance: -txn.points, lifetimeRedeemed: txn.points });
  } catch (err) {
    log.error("[loyalty] rollback failed:", err.message);
  }
}

/**
 * Balance se zyada se zyada `points` wapas lo — kabhi minus nahi.
 * Returns kitne points asal me kate.
 */
async function takeBack(userId, points, extra = {}) {
  const p = Math.max(0, Math.floor(points));
  if (!p) return 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const acc = await LoyaltyAccount.findOne({ user_id: userId }).select("balance").lean();
    const take = Math.min(p, Math.max(0, acc?.balance || 0));
    const res = await LoyaltyAccount.updateOne(
      { user_id: userId, balance: acc?.balance || 0 },
      { $inc: { balance: -take, ...extra } },
    );
    if (res.modifiedCount || !acc) return take;
  }
  return 0;
}

/**
 * Order bante hi uske points "pending" — kharch nahi ho sakte.
 * Delivered par "available" hote hain; cancel / delete par hat jaate hain.
 */
async function addOrderEarn(order) {
  try {
    const s = await getSettings();
    const base = Number(order.subtotal || 0) - Number(order.loyalty_discount || 0);
    const points = pointsForAmount(s, base);
    if (points <= 0) return 0;
    await LoyaltyTransaction.create({
      user_id: order.user_id,
      type: "earn",
      points,
      status: "pending",
      source_key: `earn:${order._id}`,
      order_id: order._id,
      order_number: order.order_number,
      note: `Order ${order.order_number}`,
    });
    await inc(order.user_id, { pending: points });
    // tag order — UI "X points milenge" dikha sake
    await mongoose.model("Order").updateOne({ _id: order._id }, { $set: { loyalty_points_earned: points } });
    order.loyalty_points_earned = points;
    return points;
  } catch (err) {
    if (!isDup(err)) log.error("[loyalty] order earn failed:", err.message);
    return 0;
  }
}

/** Pending order edit hua (qty badli) → us order ke points dobara hisaab. */
async function syncOrderEarn(order) {
  try {
    const txn = await LoyaltyTransaction.findOne({ source_key: `earn:${order._id}`, status: { $ne: "reversed" } }).lean();
    if (!txn) return;
    const s = await getSettings();
    const next = pointsForAmount(s, Number(order.subtotal || 0) - Number(order.loyalty_discount || 0));
    const diff = next - txn.points;
    if (!diff) return;
    if (txn.status === "pending") {
      await inc(order.user_id, { pending: diff });
    } else if (diff > 0) {
      await inc(order.user_id, { balance: diff, lifetimeEarned: diff });
    } else {
      await takeBack(order.user_id, -diff, { lifetimeEarned: diff });
    }
    await LoyaltyTransaction.updateOne({ _id: txn._id }, { $set: { points: next } });
    order.loyalty_points_earned = next;
  } catch (err) {
    log.error("[loyalty] sync order earn failed:", err.message);
  }
}

/** Order ke points reverse (cancel / delete). Available the to balance se — minus nahi. */
async function reverseEarn(order) {
  const txn = await LoyaltyTransaction.findOneAndUpdate(
    { source_key: `earn:${order._id}`, status: { $in: ["pending", "available"] } },
    { $set: { status: "reversed" } },
    { returnDocument: "before" },
  ).lean();
  if (!txn) return 0;
  if (txn.status === "pending") {
    await inc(order.user_id, { pending: -txn.points });
    return 0;
  }
  const taken = await takeBack(order.user_id, txn.points, { lifetimeEarned: -txn.points });
  if (taken < txn.points) {
    // Customer pehle hi kharch kar chuka — jitne the utne kaate, record me likh do
    await LoyaltyTransaction.updateOne(
      { _id: txn._id },
      { $set: { note: `Order ${order.order_number} cancelled · ${taken} of ${txn.points} points taken back` } },
    );
  }
  return taken;
}

/**
 * Cancel se wapas active kiya → reverse hue points dobara chalu.
 * Delivered par seedha "available", warna "pending" (delivery ka intezar).
 */
async function restoreEarn(order, delivered) {
  const to = delivered ? "available" : "pending";
  const txn = await LoyaltyTransaction.findOneAndUpdate(
    { source_key: `earn:${order._id}`, status: "reversed" },
    { $set: { status: to, note: `Order ${order.order_number}` } },
    { returnDocument: "before" },
  ).lean();
  if (!txn) return 0;
  await inc(order.user_id, delivered ? { balance: txn.points, lifetimeEarned: txn.points } : { pending: txn.points });
  return txn.points;
}

/** Delivered → pending points ab kharch ho sakte hain. */
async function releaseEarn(order) {
  const txn = await LoyaltyTransaction.findOneAndUpdate(
    { source_key: `earn:${order._id}`, status: "pending" },
    { $set: { status: "available" } },
    { returnDocument: "before" },
  ).lean();
  if (!txn) return 0;
  await inc(order.user_id, { pending: -txn.points, balance: txn.points, lifetimeEarned: txn.points });
  return txn.points;
}

/** Delivered se ghalti se wapas (shipped waghera) → points dobara pending (balance minus nahi). */
async function holdEarn(order) {
  const txn = await LoyaltyTransaction.findOneAndUpdate(
    { source_key: `earn:${order._id}`, status: "available" },
    { $set: { status: "pending" } },
    { returnDocument: "before" },
  ).lean();
  if (!txn) return 0;
  const taken = await takeBack(order.user_id, txn.points, { lifetimeEarned: -txn.points });
  await inc(order.user_id, { pending: txn.points });
  if (taken < txn.points) {
    await LoyaltyTransaction.updateOne(
      { _id: txn._id },
      { $set: { note: `Order ${order.order_number} · ${txn.points - taken} points were already spent` } },
    );
  }
  return txn.points;
}

/** Cancel / delete par redeem kiye points wapas. Returns kitne wapas hue. */
async function refundRedemption(order, note = "") {
  const redeemed = Number(order.loyalty_points_redeemed || 0);
  if (redeemed <= 0) return 0;
  const done = await credit(order.user_id, {
    type: "refund",
    points: redeemed,
    sourceKey: `refund:${order._id}`,
    order,
    note: note || `Order ${order.order_number} cancelled`,
  });
  return done ? redeemed : 0;
}

/** Cancel se wapas active kiya → refund wapas le lo (balance se, minus nahi). */
async function undoRefund(order) {
  const txn = await LoyaltyTransaction.findOneAndDelete({ source_key: `refund:${order._id}` }).lean();
  if (!txn) return 0;
  return takeBack(order.user_id, txn.points, { lifetimeRedeemed: txn.points });
}

// ── Customer notices (admin ki taraf se tabdeeli) ──────────
/**
 * Notice save karo + agar customer online hai to live bhej do.
 * Kabhi throw nahi karta — notice na bane to bhi points ka kaam ho chuka hai.
 */
async function notifyCustomer(userId, data) {
  try {
    const acc = await getAccount(userId);
    const notice = await LoyaltyNotice.create({ user_id: userId, balance_after: acc.balance || 0, ...data });
    try {
      const io = require("./socket").getIO();
      io?.to(`chat:customer:${userId}`).emit("loyalty:notice", { _id: notice._id, kind: notice.kind });
    } catch { /* socket band — agli dafa site kholne par dikhega */ }
  } catch (err) {
    log.error("[loyalty] notice failed:", err.message);
  }
}

/** Admin status change ke baad call hota hai. Errors log hote hain, status change nahi rukta. */
async function onOrderStatusChange(order, prevStatus, nextStatus) {
  if (!order?.user_id || prevStatus === nextStatus) return;
  try {
    if (nextStatus === "cancelled") {
      // Pehle kharch kiye points wapas, phir kamaye hue points wapas lo
      const refunded = await refundRedemption(order);
      const reversed = await reverseEarn(order);
      if (refunded || reversed) {
        await notifyCustomer(order.user_id, { kind: "order_cancelled", refunded, reversed, order_id: order._id, order_number: order.order_number });
      }
      return;
    }
    const delivered = nextStatus === "delivered";
    if (prevStatus === "cancelled") {
      const restored = await restoreEarn(order, delivered);
      const recharged = await undoRefund(order);
      if (restored || recharged) {
        await notifyCustomer(order.user_id, { kind: "order_restored", refunded: recharged, reversed: restored, order_id: order._id, order_number: order.order_number });
      }
      return;
    }
    // Delivered par hi points kharch ke qabil
    if (delivered) await releaseEarn(order);
    else if (prevStatus === "delivered") await holdEarn(order);
  } catch (err) {
    log.error("[loyalty] status sync failed:", err.message);
  }
}

/** Customer ne pending order delete kiya. */
async function onOrderDeleted(order) {
  try {
    await refundRedemption(order, `Order ${order.order_number} removed`);
    await reverseEarn(order);
  } catch (err) {
    log.error("[loyalty] delete sync failed:", err.message);
  }
}

// ── Admin ──────────────────────────────────────────────────
/** Manual +/− points. Minus par balance negative nahi hone dete. */
async function adjust(userId, points, note, actor) {
  const p = Math.trunc(Number(points) || 0);
  if (!p) {
    const err = new Error("Enter a points amount other than zero.");
    err.status = 400;
    throw err;
  }
  const id = new mongoose.Types.ObjectId();
  if (p < 0) {
    await ensureAccount(userId);
    const res = await LoyaltyAccount.updateOne({ user_id: userId, balance: { $gte: -p } }, { $inc: { balance: p } });
    if (!res.modifiedCount) {
      const err = new Error("The customer doesn't have that many points.");
      err.status = 400;
      throw err;
    }
    await LoyaltyTransaction.create({
      user_id: userId, type: "adjust", points: p, status: "available",
      source_key: `adjust:${id}`, note, actor_id: actor?._id || null, actor_name: actor?.name || "",
    });
    await notifyCustomer(userId, { kind: "deduct", points: -p, note });
    return;
  }
  await credit(userId, { type: "adjust", points: p, sourceKey: `adjust:${id}`, note, actor });
  await notifyCustomer(userId, { kind: "gift", points: p, note });
}

/** Customer ke unseen notices (naye pehle). */
async function unseenNotices(userId, limit = 10) {
  return LoyaltyNotice.find({ user_id: userId, seen_at: null }).sort({ created_at: -1 }).limit(limit).lean();
}

async function markNoticesSeen(userId, ids) {
  const valid = (Array.isArray(ids) ? ids : []).filter((x) => mongoose.isValidObjectId(x)).slice(0, 50);
  const filter = { user_id: userId, seen_at: null };
  if (valid.length) filter._id = { $in: valid };
  const res = await LoyaltyNotice.updateMany(filter, { $set: { seen_at: new Date() } });
  return res.modifiedCount || 0;
}

module.exports = {
  getSettings,
  getAccount,
  ensureAccount,
  awardSignupBonus,
  claimWelcomeBonus,
  redeemForCheckout,
  rollbackRedemption,
  addOrderEarn,
  syncOrderEarn,
  onOrderStatusChange,
  onOrderDeleted,
  adjust,
  unseenNotices,
  markNoticesSeen,
};
