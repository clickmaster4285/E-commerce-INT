// ==========================================================
// REDACT PUBLIC — public response se admin-only fields hatao
// ----------------------------------------------------------
// Kuch routes (jaise GET /products) admin panel aur storefront dono use karte
// hain. Admin request `optionalAdmin` se `req.authAud = "admin"` ho jati hai aur
// pura payload pata hai. Baaki har request (shopper, SSR, bot) ke response se
// ye keys kisi bhi gehrai par hata di jati hain — taake cost price, staff ke
// name/email, stock thresholds wagaira kabhi public na hon.
//
// Ye "defence in depth" hai: asal hal per-page DTO hai (optimizeplan.md §9.2),
// lekin jab tak har endpoint ka DTO nahi banta, ye guard leak band rakhta hai.
// ==========================================================

const DEFAULT_PUBLIC_REDACT = [
  "cost_price",
  "min_qnt",
  "max_qnt",
  "topup",
  "createdby",
  "updatedby",
  "deletedby",
  "translation_source",
  "translation_status",
  "purchaseOrderHistory",
];

function redactInPlace(value, keys, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) redactInPlace(item, keys, seen);
    return value;
  }
  // ObjectId / Date / Buffer jaise objects ko chhed-chhaad nahi
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  for (const key of Object.keys(value)) {
    if (keys.has(key)) delete value[key];
    else redactInPlace(value[key], keys, seen);
  }
  return value;
}

function redactPublic(keys = DEFAULT_PUBLIC_REDACT) {
  const set = new Set(keys);
  return (req, res, next) => {
    if (req.authAud === "admin") return next();
    const origJson = res.json.bind(res);
    res.json = (body) => origJson(redactInPlace(body, set));
    return next();
  };
}

module.exports = { redactPublic, redactInPlace, DEFAULT_PUBLIC_REDACT };
