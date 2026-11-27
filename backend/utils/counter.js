// ==========================================================
// COUNTER — atomic per-store numbers (optimizeplan.md §3.2)
// ----------------------------------------------------------
//   const seq = await nextSeq("order", { seed: async () => currentMax });
//   formatNumber("ORD-", seq, 5) → "ORD-00042"
//
// • $inc atomic hai → do concurrent requests ko kabhi same number nahi milta.
// • Lazy seed: kisi store me key pehli baar use ho to `seed()` us store ka
//   abhi tak ka sabse bada number deta hai (purane data se takraav nahi) —
//   alag migration script ki zaroorat nahi. Seed race (do requests ek saath
//   pehli baar) unique index pakadta hai; dono phir $inc karte hain.
// • Tenant plugin storeId khud lagata hai (store context zaroori).
// ==========================================================
const Counter = require("../models/Counter");
const { getStoreId } = require("./tenantContext");

// ⚠️ `session` sirf tab pass karo jab ho: `{ session: undefined }` Mongoose ke
// transaction AsyncLocalStorage session ko override kar deta hai (query
// transaction se bahar chali jati hai).
const withSession = (options, session) => (session ? { ...options, session } : options);

async function increment(key, session) {
  return Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    withSession({ returnDocument: "after", projection: { seq: 1 } }, session),
  ).lean();
}

/**
 * Counter na ho to seed se bana do — TRANSACTION SE BAHAR chalao.
 * (Transaction ke andar duplicate-key race poori transaction abort kar deti
 * hai; bahar ye sirf "kisi aur ne bana diya" hai.)
 */
async function ensureSeeded(key, { seed } = {}) {
  if (!getStoreId()) throw new Error(`Counter "${key}" needs a store context`);
  if (await Counter.exists({ key })) return;
  const start = Math.max(0, Number(seed ? await seed() : 0) || 0);
  try {
    await Counter.create({ key, seq: start });
  } catch (error) {
    if (error?.code !== 11000) throw error; // kisi aur request ne abhi seed kar diya — theek
  }
}

async function nextSeq(key, { seed, session } = {}) {
  if (!getStoreId()) throw new Error(`Counter "${key}" needs a store context`);
  let doc = await increment(key, session);
  if (doc) return doc.seq;

  const start = Math.max(0, Number(seed ? await seed() : 0) || 0);
  try {
    await Counter.create([{ key, seq: start }], withSession({}, session));
  } catch (error) {
    if (error?.code !== 11000) throw error; // kisi aur request ne abhi seed kar diya — theek
  }
  doc = await increment(key, session);
  if (!doc) throw new Error(`Counter "${key}" could not be initialised`);
  return doc.seq;
}

/**
 * Agla number DIKHANE ke liye (form ka "next code" preview) — kuch consume
 * nahi karta. Asal number save par nextSeq se milta hai (beech me kisi aur ne
 * le liya ho to preview se alag ho sakta hai — ye theek hai).
 */
async function peekSeq(key, { seed } = {}) {
  if (!getStoreId()) throw new Error(`Counter "${key}" needs a store context`);
  const doc = await Counter.findOne({ key }).select("seq").lean();
  const current = doc ? doc.seq : Math.max(0, Number(seed ? await seed() : 0) || 0);
  return current + 1;
}

const formatNumber = (prefix, seq, pad = 5) => `${prefix}${String(seq).padStart(pad, "0")}`;

/**
 * Existing documents me se sabse bada numeric suffix — sirf SEED ke liye
 * (har store me ek baar). Lexical sort par bharosa nahi ("ORD-100000" <
 * "ORD-99999" string sort me), is liye numeric max nikalte hain.
 */
async function maxNumericSuffix(Model, field, prefixRegex) {
  const [row] = await Model.aggregate([
    { $match: { [field]: { $regex: prefixRegex } } },
    { $project: { n: { $toInt: { $ifNull: [{ $getField: { field: "match", input: { $regexFind: { input: `$${field}`, regex: /(\d+)$/ } } } }, "0"] } } } },
    { $group: { _id: null, max: { $max: "$n" } } },
  ]);
  return row?.max || 0;
}

module.exports = { nextSeq, ensureSeeded, peekSeq, formatNumber, maxNumericSuffix };
