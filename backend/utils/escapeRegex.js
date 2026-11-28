// Shared RegExp escape for user-supplied search strings (optimizeplan.md §2.3 / §8).
// Controllers used to paste the same replace() (or skip it) — unescaped input is
// ReDoS / injection into $regex queries.
function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
