// Category ancestors helpers (§4.4): har category par `ancestors: [root ... parent]`.
// Subtree filter = { ancestors: id } (ek indexed query) — pehle poora category tree load hota tha.
// Category model tenantScope hai, is liye queries storeId se khud scope hoti hain.
const mongoose = require("mongoose");

const MAX_DEPTH = 50; // cycle/corrupt data se bachne ke liye

// Parent ki chain walk karke [root ... parent] banata hai (parent_category_id par chalta hai,
// is liye un legacy docs par bhi sahi jin par ancestors abhi backfill nahi hue).
async function computeAncestors(Category, parentId) {
  if (!parentId) return [];
  const chain = [];
  const seen = new Set();
  let currentId = parentId;
  while (currentId && chain.length < MAX_DEPTH) {
    const key = String(currentId);
    if (seen.has(key)) break;
    seen.add(key);
    const cur = await Category.findOne({ _id: currentId }).select("parent_category_id").lean();
    if (!cur) break;
    chain.unshift(cur._id);
    currentId = cur.parent_category_id || null;
  }
  return chain;
}

// Category ka parent badalne par uske saare descendants ki ancestors dobara set karo.
// BFS parent_category_id par — backfill se pehle bhi sahi chalta hai.
async function rebuildDescendantAncestors(Category, categoryId, ancestorsOfCategory) {
  let frontier = [{ id: categoryId, ancestors: [...ancestorsOfCategory] }];
  const ops = [];
  let depth = 0;
  while (frontier.length && depth++ < MAX_DEPTH) {
    const next = [];
    for (const node of frontier) {
      const kids = await Category.find({ parent_category_id: node.id }).select("_id").lean();
      for (const kid of kids) {
        const ancestors = [...node.ancestors, node.id];
        ops.push({ updateOne: { filter: { _id: kid._id }, update: { $set: { ancestors } } } });
        next.push({ id: kid._id, ancestors });
      }
    }
    frontier = next;
  }
  if (ops.length) await Category.bulkWrite(ops, { ordered: false });
  return ops.length;
}

// Category ke saare descendants ki ids (khud category shamil nahi).
// storeId do to explicit filter lagta hai (tenant context ke bahar scripts ke liye).
async function getDescendantIds(storeId, categoryId, { activeOnly = false } = {}) {
  const Category = require("../models/Category"); // lazy — circular require se bachne ke liye
  if (!categoryId || !mongoose.isValidObjectId(String(categoryId))) return [];
  const filter = { ancestors: new mongoose.Types.ObjectId(String(categoryId)), is_deleted: false };
  if (storeId) filter.storeId = storeId;
  if (activeOnly) filter.is_active = true;
  let q = Category.find(filter).select("_id");
  if (storeId) q = q.setOptions({ skipTenantScope: true }); // storeId upar explicit filter mein hai
  const rows = await q.lean();
  return rows.map((r) => r._id);
}

// Pure helper (backfill script): [{_id, parent_category_id}] -> Map(idString -> [ancestor ObjectIds])
function buildAncestorMap(cats) {
  const byId = new Map(cats.map((c) => [String(c._id), c]));
  const out = new Map();
  for (const c of cats) {
    const chain = [];
    const seen = new Set([String(c._id)]);
    let pid = c.parent_category_id;
    while (pid && chain.length < MAX_DEPTH) {
      const key = String(pid);
      const p = byId.get(key);
      if (!p || seen.has(key)) break;
      seen.add(key);
      chain.unshift(p._id);
      pid = p.parent_category_id;
    }
    out.set(String(c._id), chain);
  }
  return out;
}

module.exports = { buildAncestorMap, computeAncestors, rebuildDescendantAncestors, getDescendantIds };
