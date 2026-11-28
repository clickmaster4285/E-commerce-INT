// ==========================================================
// STOCK — stock_levels + movements (§3.9)
// ----------------------------------------------------------
// Sirf yahi service stock_levels / stock_movements likhe.
// Migration period: Variant.quantity bhi dual-write (read cache).
// ==========================================================
const mongoose = require("mongoose");
const Variant = require("../models/Variant");
const StockLevel = require("../models/StockLevel");
const StockMovement = require("../models/StockMovement");
const StockReservation = require("../models/StockReservation");
const { refresh, refreshAsync } = require("./productSummary");
const ledger = require("./ledger");

const withSession = (opts, session) => (session ? { ...opts, session } : opts);
const q = (query, session) => (session ? query.session(session) : query);

async function ensureLevel({ variant_id, location_id, session }) {
  let level = await q(StockLevel.findOne({ variant_id, location_id }), session).lean();
  if (level) return level;

  const variant = await q(Variant.findById(variant_id).select("quantity product_id sku title"), session).lean();
  if (!variant) throw new Error("Variant not found");

  const on_hand = Math.max(0, Number(variant.quantity) || 0);
  try {
    const created = await StockLevel.create(
      [{ variant_id, location_id, on_hand, reserved: 0 }],
      withSession({}, session),
    );
    return created[0].toObject();
  } catch (err) {
    if (err?.code === 11000) {
      level = await q(StockLevel.findOne({ variant_id, location_id }), session).lean();
      if (level) return level;
    }
    throw err;
  }
}

async function bumpVariantQuantity(variant_id, delta, session) {
  if (!delta) return;
  if (delta < 0) {
    const abs = Math.abs(delta);
    const updated = await Variant.findOneAndUpdate(
      { _id: variant_id, is_deleted: { $ne: true }, quantity: { $gte: abs } },
      { $inc: { quantity: delta } },
      withSession({ returnDocument: "after" }, session),
    ).lean();
    if (!updated) throw new Error("Variant quantity insufficient (cache)");
    return updated;
  }
  return Variant.findOneAndUpdate(
    { _id: variant_id, is_deleted: { $ne: true } },
    { $inc: { quantity: delta } },
    withSession({ returnDocument: "after" }, session),
  ).lean();
}

/**
 * @param {object} input
 * @param {import("mongoose").ClientSession} [session]
 */
async function adjust(input, session) {
  const {
    variant_id,
    location_id = "main",
    qty_delta,
    setTo,
    kind,
    reason = "",
    explanation = "",
    actor = {},
    idempotency_key = null,
    ref_type = "",
    ref_id = null,
    line_id = null,
    unit_cost_minor = 0,
  } = input;

  if (idempotency_key) {
    const existing = await q(StockMovement.findOne({ idempotency_key }), session).lean();
    if (existing) return { ok: true, idempotent: true, movement: existing };
  }

  await ensureLevel({ variant_id, location_id, session });
  const variant = await q(Variant.findById(variant_id).select("sku title product_id quantity"), session).lean();
  if (!variant) return { ok: false, status: 404, message: "Variant not found" };

  let delta;
  let movementKind = kind;
  if (setTo != null && !Number.isNaN(Number(setTo))) {
    const level = await q(StockLevel.findOne({ variant_id, location_id }), session).lean();
    const current = level?.on_hand ?? variant.quantity ?? 0;
    delta = Number(setTo) - current;
    movementKind = movementKind || "count_set";
  } else {
    delta = Number(qty_delta);
    if (Number.isNaN(delta)) throw new Error("adjust needs qty_delta or setTo");
    if (!movementKind) {
      movementKind = delta >= 0 ? "adjust_add" : "adjust_remove";
    }
  }

  if (delta === 0) {
    return { ok: true, changed: false, on_hand: variant.quantity };
  }

  let updatedLevel;
  if (delta < 0) {
    const need = Math.abs(delta);
    updatedLevel = await StockLevel.findOneAndUpdate(
      {
        variant_id,
        location_id,
        $expr: { $gte: [{ $subtract: ["$on_hand", "$reserved"] }, need] },
      },
      { $inc: { on_hand: delta } },
      withSession({ returnDocument: "after" }, session),
    ).lean();
    if (!updatedLevel) {
      return { ok: false, status: 400, message: "Insufficient available stock" };
    }
  } else {
    updatedLevel = await StockLevel.findOneAndUpdate(
      { variant_id, location_id },
      { $inc: { on_hand: delta } },
      withSession({ returnDocument: "after" }, session),
    ).lean();
  }

  await bumpVariantQuantity(variant_id, delta, session);

  const on_hand_after = updatedLevel.on_hand;
  const [movement] = await StockMovement.create(
    [
      {
        variant_id,
        location_id,
        qty_delta: delta,
        on_hand_after,
        kind: movementKind,
        ref_type,
        ref_id,
        line_id,
        unit_cost_minor,
        reason,
        explanation,
        actor_id: actor.id || null,
        actor_name: actor.name || "",
        sku: variant.sku || "",
        variant_title: variant.title || "",
        idempotency_key,
        at: new Date(),
      },
    ],
    withSession({}, session),
  );

  const productId = variant.product_id;
  if (session) {
    await refresh(productId, { session }).catch(() => refreshAsync(productId));
  } else {
    refreshAsync(productId);
  }

  return { ok: true, changed: true, movement, on_hand: on_hand_after };
}

/**
 * Checkout reserve — on_hand - reserved >= qty hona chahiye.
 * idempotency_key: tx retry par pehli active reservation wapas.
 */
async function reserve({
  variant_id,
  location_id = "main",
  qty,
  checkout_draft_id,
  expires_at,
  idempotency_key = null,
  session,
}) {
  const n = Number(qty);
  if (!(n > 0)) throw new Error("reserve qty must be positive");

  if (idempotency_key) {
    const existing = await q(
      StockReservation.findOne({ idempotency_key, status: { $in: ["active", "committed"] } }),
      session,
    );
    if (existing) {
      return { ok: true, reservation: existing, idempotent: true };
    }
  }

  await ensureLevel({ variant_id, location_id, session });

  const updated = await StockLevel.findOneAndUpdate(
    {
      variant_id,
      location_id,
      $expr: { $gte: [{ $subtract: ["$on_hand", "$reserved"] }, n] },
    },
    { $inc: { reserved: n } },
    withSession({ returnDocument: "after" }, session),
  ).lean();

  if (!updated) {
    return { ok: false, status: 400, message: "Cannot reserve — insufficient available stock" };
  }

  try {
    const [row] = await StockReservation.create(
      [
        {
          variant_id,
          location_id,
          qty: n,
          checkout_draft_id: checkout_draft_id || null,
          expires_at: expires_at || new Date(Date.now() + 15 * 60 * 1000),
          status: "active",
          idempotency_key: idempotency_key || undefined,
        },
      ],
      withSession({}, session),
    );
    return { ok: true, reservation: row, level: updated };
  } catch (err) {
    // Race on unique idempotency_key — reserved bump rollback + reuse
    if (err?.code === 11000 && idempotency_key) {
      await StockLevel.updateOne(
        { variant_id, location_id, reserved: { $gte: n } },
        { $inc: { reserved: -n } },
        withSession({}, session),
      );
      const existing = await q(
        StockReservation.findOne({ idempotency_key, status: { $in: ["active", "committed"] } }),
        session,
      );
      if (existing) return { ok: true, reservation: existing, idempotent: true };
    }
    throw err;
  }
}

/** Sale confirm: reserved → on_hand kam, reserved release */
async function commit({
  reservation_id,
  kind = "sale",
  ref_type = "",
  ref_id = null,
  idempotency_key = null,
  session,
}) {
  if (idempotency_key) {
    const existingMov = await q(StockMovement.findOne({ idempotency_key }), session).lean();
    if (existingMov) {
      const reservation = await q(StockReservation.findById(reservation_id), session);
      return { ok: true, movement: existingMov, reservation, idempotent: true };
    }
  }

  const reservation = await q(StockReservation.findOne({ _id: reservation_id }), session);
  if (!reservation) return { ok: false, status: 404, message: "Reservation not found" };
  if (reservation.status === "committed") {
    return { ok: true, reservation, idempotent: true };
  }
  if (reservation.status !== "active") {
    return { ok: false, status: 400, message: `Reservation is ${reservation.status}` };
  }

  const { variant_id, location_id, qty } = reservation;
  const n = Number(qty);

  const updated = await StockLevel.findOneAndUpdate(
    {
      variant_id,
      location_id,
      reserved: { $gte: n },
      on_hand: { $gte: n },
    },
    { $inc: { on_hand: -n, reserved: -n } },
    withSession({ returnDocument: "after" }, session),
  ).lean();

  if (!updated) {
    return { ok: false, status: 400, message: "Cannot commit reservation" };
  }

  await bumpVariantQuantity(variant_id, -n, session);
  reservation.status = "committed";
  await reservation.save(withSession({}, session));

  const variant = await q(Variant.findById(variant_id).select("sku title product_id"), session).lean();
  const [movement] = await StockMovement.create(
    [
      {
        variant_id,
        location_id,
        qty_delta: -n,
        on_hand_after: updated.on_hand,
        kind,
        ref_type,
        ref_id,
        sku: variant?.sku || "",
        variant_title: variant?.title || "",
        idempotency_key: idempotency_key || undefined,
        at: new Date(),
      },
    ],
    withSession({}, session),
  );

  // COGS journal when weighted avg cost known (§3.9)
  const avgCost = Number(updated.avg_cost_minor) || 0;
  if (avgCost > 0 && n > 0) {
    const cogsMinor = Math.round(avgCost * n);
    if (cogsMinor > 0) {
      await ledger.post(
        {
          ref_type: `stock:${ref_type || "sale"}`,
          ref_id: ref_id || reservation._id,
          memo: `COGS ${kind}`,
          lines: [
            { account: "cogs", debit_minor: cogsMinor, credit_minor: 0 },
            { account: "inventory", debit_minor: 0, credit_minor: cogsMinor },
          ],
        },
        session,
      );
    }
  }

  if (variant?.product_id) refreshAsync(variant.product_id);
  return { ok: true, movement, reservation };
}

/** Cancel reserve — reserved wapas */
async function release({ reservation_id, session }) {
  const reservation = await q(StockReservation.findOne({ _id: reservation_id, status: "active" }), session);
  if (!reservation) return { ok: false, status: 404, message: "Reservation not found" };

  const n = Number(reservation.qty);
  await StockLevel.updateOne(
    { variant_id: reservation.variant_id, location_id: reservation.location_id, reserved: { $gte: n } },
    { $inc: { reserved: -n } },
    withSession({}, session),
  );

  reservation.status = "released";
  await reservation.save(withSession({}, session));
  return { ok: true, reservation };
}

/** PO receive — movement + weighted avg_cost + inventory/AP ledger */
async function receive({
  variant_id,
  location_id = "main",
  qty,
  ref_type = "purchase_order",
  ref_id,
  unit_cost_minor = 0,
  party_id = null,
  session,
}) {
  const n = Number(qty);
  const unitCost = Math.max(0, Number(unit_cost_minor) || 0);
  const levelBefore = await ensureLevel({ variant_id, location_id, session });
  const onHandBefore = Math.max(0, Number(levelBefore.on_hand) || 0);
  const avgBefore = Math.max(0, Number(levelBefore.avg_cost_minor) || 0);

  const result = await adjust(
    {
      variant_id,
      location_id,
      qty_delta: n,
      kind: "purchase_receive",
      ref_type,
      ref_id,
      unit_cost_minor: unitCost,
      reason: "PO receive",
    },
    session,
  );
  if (!result.ok) return result;

  if (n > 0) {
    const newOnHand = onHandBefore + n;
    const newAvg = newOnHand > 0
      ? Math.round(((onHandBefore * avgBefore) + (n * unitCost)) / newOnHand)
      : unitCost;
    await StockLevel.updateOne(
      { variant_id, location_id },
      { $set: { avg_cost_minor: newAvg } },
      withSession({}, session),
    );

    const inventoryMinor = Math.round(unitCost * n);
    if (inventoryMinor > 0) {
      await ledger.post(
        {
          ref_type: `stock:${ref_type}`,
          ref_id: ref_id || null,
          memo: "PO receive inventory",
          lines: [
            { account: "inventory", debit_minor: inventoryMinor, credit_minor: 0 },
            {
              account: "accounts_payable",
              party_type: "vendor",
              party_id: party_id || null,
              debit_minor: 0,
              credit_minor: inventoryMinor,
            },
          ],
        },
        session,
      );
    }
  }

  return result;
}

module.exports = { adjust, reserve, commit, release, receive, ensureLevel };