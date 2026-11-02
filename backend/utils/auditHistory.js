const valueText = (value) => {
  if (value == null || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (typeof value === "object") {
    if (value.name) return value.name;
    if (value._id) return value._id.toString();
    const stable = (entry) => Array.isArray(entry) ? entry.map(stable) : entry && typeof entry === "object" && !(entry instanceof Date)
      ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, stable(entry[key])])) : entry;
    const normalized = stable(value);
    return Object.entries(normalized).map(([key, entry]) => `${key.replaceAll("_", " ")}: ${entry && typeof entry === "object" ? JSON.stringify(entry) : String(entry ?? "")}`).join(" · ") || "{}";
  }
  return String(value);
};

const diffFields = (before, after, fields) => fields.flatMap(([key, label = key]) => {
  const oldValue = valueText(before?.[key]);
  const newValue = valueText(after?.[key]);
  return oldValue === newValue ? [] : [{ field: label, before: oldValue || "—", after: newValue || "—" }];
});

const idText = (value) => String(value?._id || value || "");
const diffItems = (beforeItems = [], afterItems = [], labels = {}) => {
  const unmatched = new Set(beforeItems.map((_, index) => index));
  const changes = [];
  const matchItem = (item) => {
    const candidates = [...unmatched].map((index) => ({ item: beforeItems[index], index }));
    const variant = idText(item.variant_id);
    const product = idText(item.product_id);
    const sku = String(item.sku || "").trim().toLowerCase();
    const name = String(item.name || "").trim().toLowerCase();
    const unique = (rows) => rows.length === 1 ? rows[0] : null;
    return unique(candidates.filter(({ item: old }) => variant && idText(old.variant_id) === variant))
      || unique(candidates.filter(({ item: old }) => product && idText(old.product_id) === product && String(old.name || "").trim().toLowerCase() === name))
      || unique(candidates.filter(({ item: old }) => sku && String(old.sku || "").trim().toLowerCase() === sku))
      || unique(candidates.filter(({ item: old }) => product && idText(old.product_id) === product));
  };
  for (const item of afterItems) {
    const match = matchItem(item);
    const title = item.name || "Item";
    const variant = item.variant_name || item.variantTitle || item.variant_title || item.sku || "";
    const meta = { product_name: title, variant_title: variant, sku: item.sku || "" };
    if (!match) {
      changes.push({ action: "added", field: "Item", ...meta, before: "—", after: `${Number(item.quantity ?? item.qty_ordered) || 0}` });
      continue;
    }
    unmatched.delete(match.index);
    const old = match.item;
    const oldQty = Number(old.quantity ?? old.qty_ordered) || 0;
    const newQty = Number(item.quantity ?? item.qty_ordered) || 0;
    if (oldQty !== newQty) changes.push({ action: "quantity", field: labels.quantity || "Quantity", ...meta, before: String(oldQty), after: String(newQty), from_quantity: oldQty, to_quantity: newQty });
    for (const [key, label] of Object.entries({ ...(labels.itemFields || {}) })) {
      const oldValue = valueText(old[key]);
      const newValue = valueText(item[key]);
      if (oldValue !== newValue) changes.push({ action: "item_field", field: label, ...meta, before: oldValue || "—", after: newValue || "—" });
    }
  }
  for (const index of unmatched) {
    const item = beforeItems[index];
    changes.push({ action: "removed", field: "Item", product_name: item.name || "Item", variant_title: item.variant_name || item.variantTitle || item.variant_title || item.sku || "", sku: item.sku || "", before: String(Number(item.quantity ?? item.qty_ordered) || 0), after: "—" });
  }
  return changes;
};

const auditEvent = (req, type, changes = []) => ({
  type,
  at: new Date(),
  actor_id: req.user?._id || req.user?.id || null,
  actor_name: String(req.user?.name || req.user?.username || req.user?.email || "Administrator"),
  changes,
});

module.exports = { auditEvent, diffFields, diffItems, valueText };
