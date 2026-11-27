// Server pricing == storefront pricing (optimizeplan.md §4.2)
// Frontend calculators (pure ESM files) ko vm me load kar ke backend copies ke
// sath same inputs par compare karte hain. Koi ek file badle aur doosri nahi →
// ye test fail hota hai (checkout PRICE_CHANGED se bachne ke liye).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dealRules = require("../services/pricing/dealRules");
const bundleRules = require("../services/pricing/bundleRules");
const { bestRegularDiscount } = require("../services/pricing/discountRules");

const FRONTEND = path.join(__dirname, "..", "..", "frontend", "src", "utils");
const loadEsm = (file) => {
  const full = path.join(FRONTEND, file);
  if (!fs.existsSync(full)) return null;
  const code = fs.readFileSync(full, "utf8").replace(/^export\s+(?=(function|const|let|class)\b)/gm, "");
  const names = [...code.matchAll(/^(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
  const ctx = {};
  vm.runInNewContext(`${code}\n;__out = { ${names.join(", ")} };`, ctx);
  return ctx.__out;
};
const fe = { deal: loadEsm("dealCalculator.js"), bundle: loadEsm("bundleCalculator.js") };

// Deterministic pseudo-random (seeded) taake failures reproducible hon
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const PRICES = [0, 1, 9.99, 99, 100, 149.5, 999, 1234.56, 25000];

test("deal unit price / free items / thresholds match the storefront", (t) => {
  if (!fe.deal) return t.skip("frontend source not available");
  for (let i = 0; i < 2000; i += 1) {
    const price = pick(PRICES);
    const type = pick(["percentage", "fixed_amount", "buy_x_get_y", "free_shipping", "bundle"]);
    const value = pick([0, 1, 5, 10, 33, 50, 99, 100, 150, 2000]);
    const buy = pick([0, 1, 2, 3, 5]);
    const get = pick([0, 1, 2]);
    const qty = pick([0, 1, 2, 3, 4, 6, 7, 10]);
    const min = pick([undefined, 0, 1, 2, 5]);
    assert.equal(dealRules.getDealUnitPrice(price, type, value), fe.deal.getDealUnitPrice(price, type, value), `unit ${price} ${type} ${value}`);
    assert.equal(dealRules.calculateFreeItems(qty, buy, get), fe.deal.calculateFreeItems(qty, buy, get), `free ${qty} ${buy} ${get}`);
    const deal = { type, minQuantity: min, buyQuantity: buy };
    assert.equal(dealRules.getEffectiveMinQuantity(deal), fe.deal.getEffectiveMinQuantity(deal));
    const item = { dealId: "d", dealType: type, qty, dealMinQuantity: min, dealBuyQuantity: buy };
    assert.equal(dealRules.isDealActiveForQty(deal, qty), fe.deal.isDealActive(item), `active ${JSON.stringify(item)}`);
  }
});

test("bundle rule normalisation, pricing and re-split match the storefront", (t) => {
  if (!fe.bundle) return t.skip("frontend source not available");
  for (let i = 0; i < 1500; i += 1) {
    const raw = {
      mode: pick(["all", "limit"]),
      buyQuantity: pick([0, 1, 2, 3, 4]),
      rewardType: pick(["percentage", "fixed_amount", "free_product", "bogus"]),
      value: pick([0, 5, 10, 50, 100, 120, 500]),
      freeProduct: pick(["", "p9"]),
      freeQuantity: pick([0, 1, 2]),
    };
    const ruleBe = bundleRules.normalizeBundleRule(raw);
    const ruleFe = fe.bundle.normalizeBundleRule(raw);
    assert.equal(Boolean(ruleBe), Boolean(ruleFe), `normalize ${JSON.stringify(raw)}`);
    for (const key of ["mode", "buyQuantity", "rewardType", "value", "freeProductId", "freeQuantity"]) {
      if (ruleBe) assert.equal(ruleBe[key], ruleFe[key], `${key} ${JSON.stringify(raw)}`);
    }
    const lines = Array.from({ length: pick([1, 2, 3, 4]) }, (_, n) => ({
      key: `l${n}`, regularPrice: pick(PRICES), qty: pick([1, 1, 2, 3]), bundleQuantity: pick([1, 1, 2]),
    }));
    const units = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = fe.bundle.round2(lines.reduce((s, l) => s + l.regularPrice * l.qty, 0));
    const args = { rule: ruleFe, groupUnits: units, groupSubtotal: subtotal, productCount: lines.length, legacyBundlePrice: pick([0, 100, 999]), multiplier: fe.bundle.bundleMultiplierFromLines(lines) };
    assert.equal(bundleRules.bundleMultiplierFromLines(lines), args.multiplier);
    const be = bundleRules.computeBundlePricing({ ...args, rule: ruleBe });
    const feP = fe.bundle.computeBundlePricing(args);
    for (const key of ["eligible", "discountAmount", "giftQty", "effectiveTotal"]) {
      assert.equal(be[key], feP[key], `${key} ${JSON.stringify({ raw, lines })}`);
    }
    const reBe = bundleRules.repriceBundleGroup(lines, be.effectiveTotal).map((l) => l.price);
    const reFe = fe.bundle.repriceBundleGroup(lines, feP.effectiveTotal).map((l) => l.price);
    assert.deepEqual(reBe, Array.from(reFe)); // vm realm array → main realm
  }
});

test("regular discount picks the same best price as the storefront rules", () => {
  // Storefront DiscountContext (includeDeals=false) ka hisaab — inline fixtures
  const discounts = [
    { isActive: true, type: "percentage", value: 10, applyTo: "all", name: "Ten" },
    { isActive: true, type: "fixed", value: 150, applyTo: "specific_products", selectedProducts: [{ _id: "p1" }], name: "Flat" },
    { isActive: true, type: "percentage", value: 50, applyTo: "specific_brands", selectedBrands: ["b2"], name: "Brand" },
    { isActive: false, type: "percentage", value: 90, applyTo: "all" },
    { isActive: true, type: "fixed_price", value: 1, applyTo: "all" },
    { isActive: true, type: "percentage", value: 70, applyTo: "specific_tags" },
  ];
  assert.deepEqual(bestRegularDiscount(1000, discounts, { productId: "p1", categoryId: "c1", brandId: "b1" }), { hasDiscount: true, originalPrice: 1000, discountedPrice: 850, savings: 150, discountName: "Flat" });
  assert.equal(bestRegularDiscount(1000, discounts, { productId: "p2", brandId: "b2" }).discountedPrice, 500);
  assert.equal(bestRegularDiscount(999, discounts, { productId: "p2" }).discountedPrice, 899); // 899.1 → round
  assert.equal(bestRegularDiscount(100, [], {}).hasDiscount, false);
});
