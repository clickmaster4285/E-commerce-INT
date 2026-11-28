// Hard-cap "legacy" unbounded list responses (optimizeplan.md §4.5).
// Callers that omit page/limit used to get the whole collection.
const DEFAULT_LEGACY_CAP = 50;

function legacyCap(requested, max = DEFAULT_LEGACY_CAP) {
  const n = Number(requested);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), max);
  return max;
}

module.exports = { legacyCap, DEFAULT_LEGACY_CAP };
