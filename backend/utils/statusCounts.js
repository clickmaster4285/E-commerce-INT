// Status tabs ke counts: N× countDocuments ki jagah ek hi $group (§4.3).
// Model tenantScope plugin se storeId khud filter karta hai (aggregate pipeline mein bhi).

async function statusCounts(Model, { match = {}, field = "status" } = {}) {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  const out = {};
  for (const r of rows) {
    // null/undefined status ko "" key pe rakhte hain taake total sahi rahe
    out[r._id == null ? "" : String(r._id)] = r.n;
  }
  return out;
}

// Counts object ka total (sab statuses ka jod)
function sumCounts(counts) {
  return Object.values(counts || {}).reduce((a, b) => a + b, 0);
}

// Computed/overlapping tabs (jaise invoice overdue, deal upcoming) ke liye: ek $facet,
// har naam ke liye alag $match. Return { name: n }. Filters aggregate-safe hone chahiye
// (ObjectId/Date pehle se cast — aggregate string ids cast nahi karta).
async function facetCounts(Model, filters = {}, { match = {} } = {}) {
  const names = Object.keys(filters);
  if (!names.length) return {};
  const facet = {};
  for (const name of names) facet[name] = [{ $match: filters[name] }, { $count: "n" }];
  const [row] = await Model.aggregate([{ $match: match }, { $facet: facet }]);
  const out = {};
  for (const name of names) out[name] = row?.[name]?.[0]?.n || 0;
  return out;
}

module.exports = { statusCounts, sumCounts, facetCounts };
