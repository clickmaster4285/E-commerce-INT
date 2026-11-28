// Keyset (cursor) pagination — {created_at, _id} desc sort ke liye (§4.4).
// Use: ?cursor=<opaque> bheja jaye to skip ki jagah keysetFilter() filter mein merge hota hai;
// response mein `nextCursor` aata hai. ?page= wala purana path waise hi chalta hai.
// Sort lazmi tor par { [field]: -1, _id: -1 } hona chahiye.
const mongoose = require("mongoose");

function encodeCursor(doc, field = "created_at") {
  if (!doc || doc[field] == null || doc._id == null) return null;
  const t = new Date(doc[field]).getTime();
  if (!Number.isFinite(t)) return null;
  const payload = JSON.stringify({ t, id: String(doc._id) });
  return Buffer.from(payload, "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") return null;
  try {
    const { t, id } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const d = new Date(t);
    if (Number.isNaN(d.getTime()) || !mongoose.isValidObjectId(id)) return null;
    return { at: d, id: new mongoose.Types.ObjectId(id) };
  } catch {
    return null;
  }
}

// Invalid/khali cursor => null (caller page/skip path pe chala jaye)
function keysetFilter(cursor, field = "created_at") {
  const c = decodeCursor(cursor);
  if (!c) return null;
  return {
    $or: [
      { [field]: { $lt: c.at } },
      { [field]: c.at, _id: { $lt: c.id } },
    ],
  };
}

module.exports = { keysetFilter, encodeCursor, decodeCursor };
