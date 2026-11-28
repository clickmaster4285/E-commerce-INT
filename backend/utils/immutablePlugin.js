// ==========================================================
// IMMUTABLE — append-only collections (§3.9)
// ----------------------------------------------------------
// Galti reversal entry se fix hoti hai, row edit nahi.
// Migrations ke liye query option: { allowCorrection: true }.
// ==========================================================

const MSG =
  "Append-only row — reversal entry use karo; migrations ke liye allowCorrection: true";

function rejectMutation() {
  const opts = this.getOptions?.() || {};
  if (opts.allowCorrection === true) return;
  const err = new Error(MSG);
  err.code = "IMMUTABLE";
  throw err;
}

/**
 * @param {import("mongoose").Schema} schema
 */
function immutablePlugin(schema) {
  const ops = ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"];
  for (const op of ops) {
    schema.pre(op, rejectMutation);
  }
}

module.exports = immutablePlugin;