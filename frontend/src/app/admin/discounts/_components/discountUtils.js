/* Shared numeric-input helpers — moved out of discounts/page.js
   (App Router pages cannot have named exports). */

// ✅ Discount form ke numeric fields 0 se kam kabhi nahi ho sakte.
// "-" ya "+" type hi nahi ho sakta, paste hone par sign hata diya jata hai,
// aur value kabhi bhi negative accept nahi hoti (integer=true par decimals bhi nahi).
export const toNonNegative = (raw, integer = false) => {
  const digitsOnly = String(raw ?? "").replace(integer ? /[^\d]/g : /[^\d.]/g, "");
  let cleaned = digitsOnly;
  if (!integer) {
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  if (cleaned === "" || cleaned === ".") return "";
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return "0";
  // leading zeros trim (0.5 jaise value safe rehti hai)
  return cleaned.replace(/^0+(?=\d)/, "");
};

// ✅ Numeric fields ka common validation — negative ya invalid value block hoti hai
export const validateNonNegative = (entries) => {
  for (const [label, raw] of entries) {
    if (raw === "" || raw === null || raw === undefined) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) return `${label} must be a valid number`;
    if (num < 0) return `${label} cannot be less than 0`;
  }
  return "";
};
