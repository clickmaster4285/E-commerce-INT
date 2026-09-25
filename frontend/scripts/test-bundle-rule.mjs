/**
 * ============================================================
 * BUNDLE OFFER CONDITION — PURE LOGIC TEST
 * ============================================================
 * `src/utils/bundleCalculator.js` is ESM but the frontend package is not
 * "type": "module", so the file is copied to a temp .mjs and imported.
 * The test therefore runs exactly the code the app ships.
 *
 * Run:  node scripts/test-bundle-rule.mjs
 * ============================================================
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const srcFile = path.resolve(process.cwd(), "src/utils/bundleCalculator.js");
const tmpFile = path.join(os.tmpdir(), `bundleCalculator-${process.pid}.mjs`);

fs.copyFileSync(srcFile, tmpFile);
const mod = await import(pathToFileURL(tmpFile).href);
fs.rmSync(tmpFile, { force: true });

const {
  normalizeBundleRule,
  bundleRuleRequiredQty,
  bundleRuleDiscountAmount,
  bundleGiftQuantity,
  bundleRuleLabel,
  bundleProgressLabel,
  computeBundlePricing,
  repriceBundleGroup,
  splitBundlePrice,
  round2,
} = mod;

let passed = 0;
const failures = [];

const ok = (name, condition, extra = "") => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${extra ? ` — ${extra}` : ""}`);
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const eq = (name, actual, expected) =>
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const close = (name, actual, expected, tol = 0.011) =>
  ok(name, Math.abs(Number(actual) - Number(expected)) <= tol, `expected ~${expected}, got ${actual}`);

/* ==================== FIXTURES ==================== */
// Combo: 3 products (Rs. 1000 / 500 / 500) → one full set = 3 items, Rs. 2000

const PRODUCT_COUNT = 3;
const SET_SUBTOTAL = 2000;

const line = (regularPrice, units) => ({
  key: `k${regularPrice}-${units}`,
  regularPrice,
  qty: units,
  bundleQuantity: 1,
  isBundleGift: false,
});

// One full combo set = 1 unit of each product → 3 items, Rs. 2000
const setLines = () => [line(1000, 1), line(500, 1), line(500, 1)];
const twoSetsLines = () => [line(1000, 2), line(500, 2), line(500, 2)]; // 6 items, Rs. 4000
const partialLines = () => [line(1000, 1), line(500, 1)]; // 2 items, Rs. 1500
const fourItemLines = () => [line(1000, 2), line(500, 1), line(500, 1)]; // 4 items, Rs. 3000
const fiveItemLines = () => [line(1000, 2), line(500, 2), line(500, 1)]; // 5 items, Rs. 3500

const groupUnits = (lines) => lines.reduce((s, l) => s + l.qty, 0);

function regularSubtotal(lines) {
  return round2(lines.reduce((s, l) => s + l.regularPrice * l.qty, 0));
}

const PRICE_10 = { mode: "all", rewardType: "percentage", value: 10 };
const PRICE_LIMIT_4 = { mode: "limit", buyQuantity: 4, rewardType: "percentage", value: 10 };
const FIXED_300 = { mode: "all", rewardType: "fixed_amount", value: 300 };
const GIFT_RULE = {
  mode: "all",
  rewardType: "free_product",
  freeProduct: { _id: "gift1", name: "Gift Box", images: [{ img_url: "/gift.png" }] },
  freeProductPrice: 200,
  freeQuantity: 1,
};

/* ==================== 1. NORMALIZE ==================== */

console.log("\n1) normalizeBundleRule");

const r10 = normalizeBundleRule(PRICE_10);
eq("mode defaults to all", r10.mode, "all");
eq("percentage value kept", r10.value, 10);

const rLimit = normalizeBundleRule(PRICE_LIMIT_4);
eq("limit mode kept", rLimit.mode, "limit");
eq("limit quantity kept", rLimit.buyQuantity, 4);

eq("limit without quantity rejected", normalizeBundleRule({ mode: "limit", value: 10 }), null);
eq("percentage > 100 capped", normalizeBundleRule({ mode: "all", value: 150 }).value, 100);
eq("zero value rejected", normalizeBundleRule({ mode: "all", value: 0 }), null);
eq(
  "gift without product rejected",
  normalizeBundleRule({ mode: "all", rewardType: "free_product" }),
  null
);

const gift = normalizeBundleRule(GIFT_RULE);
eq("gift product id parsed", gift.freeProductId, "gift1");
eq("gift product name parsed", gift.freeProductName, "Gift Box");
eq("gift image parsed", gift.freeProductImage, "/gift.png");
eq("gift reward value forced to 0", gift.value, 0);

eq("legacy array keeps first rule", normalizeBundleRule([PRICE_10, { mode: "all", value: 90 }]).value, 10);
eq("empty input → null", normalizeBundleRule(null), null);

/* ==================== 2. REQUIRED QUANTITY ==================== */

console.log("\n2) bundleRuleRequiredQty");

eq("mode all → all selected products", bundleRuleRequiredQty(r10, PRODUCT_COUNT), 3);
eq("mode limit → admin quantity", bundleRuleRequiredQty(rLimit, PRODUCT_COUNT), 4);

/* ==================== 3. CONDITION GATING (deal must not apply early) ==================== */

console.log("\n3) Condition gating");

// mode "all": needs all 3 products (3 items)
const partial = partialLines();
const full = setLines();

eq(
  "2 of 3 items → NO discount",
  bundleRuleDiscountAmount(r10, regularSubtotal(partial), groupUnits(partial), PRODUCT_COUNT),
  0
);
close(
  "3 of 3 items → 10% of 2000",
  bundleRuleDiscountAmount(r10, regularSubtotal(full), groupUnits(full), PRODUCT_COUNT),
  200
);
close(
  "3 of 3 items (pricing) → 1800",
  computeBundlePricing({
    rule: normalizeBundleRule(PRICE_10),
    groupUnits: groupUnits(full),
    groupSubtotal: regularSubtotal(full),
    productCount: PRODUCT_COUNT,
  }).effectiveTotal,
  1800
);

const pending = computeBundlePricing({
  rule: normalizeBundleRule(PRICE_10),
  groupUnits: groupUnits(partial),
  groupSubtotal: regularSubtotal(partial),
  productCount: PRODUCT_COUNT,
});
eq("pending → not eligible", pending.eligible, false);
eq("pending → pays full subtotal", pending.effectiveTotal, round2(regularSubtotal(partial)));
ok("pending → progress hint shown", /Add 1 more item to unlock 10% OFF/.test(pending.progress));
eq("pending → no gift", pending.giftQty, 0);

// mode "limit": needs 4 items
const limitPending = computeBundlePricing({
  rule: normalizeBundleRule(PRICE_LIMIT_4),
  groupUnits: groupUnits(full),
  groupSubtotal: regularSubtotal(full),
  productCount: PRODUCT_COUNT,
});
eq("limit 4 with 3 items → not eligible", limitPending.eligible, false);
eq("limit pending required qty", limitPending.requiredQty, 4);

const four = fourItemLines();
const five = fiveItemLines();
close(
  "limit 4 with 4 items → 10% of 3000",
  bundleRuleDiscountAmount(rLimit, regularSubtotal(four), groupUnits(four), PRODUCT_COUNT),
  300
);
close(
  "limit 4 with 5 items → 10% of 3500",
  bundleRuleDiscountAmount(rLimit, regularSubtotal(five), groupUnits(five), PRODUCT_COUNT),
  350
);

// fixed amount
close(
  "fixed Rs.300 on 2000",
  bundleRuleDiscountAmount(FIXED_300, regularSubtotal(full), groupUnits(full), PRODUCT_COUNT),
  300
);
const capped = computeBundlePricing({
  rule: normalizeBundleRule({ mode: "all", rewardType: "fixed_amount", value: 9999 }),
  groupUnits: 3,
  groupSubtotal: SET_SUBTOTAL,
  productCount: PRODUCT_COUNT,
});
close("flat discount capped at subtotal (never negative)", capped.effectiveTotal, 0);

/* ==================== 4. FREE GIFT ==================== */

console.log("\n4) Free gift");

const giftRule = normalizeBundleRule(GIFT_RULE);
eq("gift locked below condition", bundleGiftQuantity(giftRule, 2, PRODUCT_COUNT), 0);
eq("gift unlocked at condition", bundleGiftQuantity(giftRule, 3, PRODUCT_COUNT), 1);
eq("gift scales with multiples (6 items → 2)", bundleGiftQuantity(giftRule, 6, PRODUCT_COUNT), 2);

const giftPricing = computeBundlePricing({
  rule: giftRule,
  groupUnits: 3,
  groupSubtotal: SET_SUBTOTAL,
  productCount: PRODUCT_COUNT,
});
eq("gift pricing → no price discount", giftPricing.discountAmount, 0);
eq("gift pricing → 1 gift line", giftPricing.giftQty, 1);
close("gift pricing → gift savings 200", giftPricing.giftSavings, 200);
close("gift pricing → total savings 200", giftPricing.totalSavings, 200);
close("gift pricing → lines still pay full subtotal", giftPricing.effectiveTotal, 2000);

/* ==================== 5. LEGACY COMBO PRICE (no rule) ==================== */

console.log("\n5) Legacy combo price (rule removed)");

const legacy = computeBundlePricing({
  rule: null,
  groupUnits: 3,
  groupSubtotal: SET_SUBTOTAL,
  productCount: PRODUCT_COUNT,
  legacyBundlePrice: 1500,
  multiplier: 1,
});
close("legacy 1 set → bundle price", legacy.effectiveTotal, 1500);
close("legacy 1 set → savings 500", legacy.totalSavings, 500);

const legacy2 = computeBundlePricing({
  rule: null,
  groupUnits: groupUnits(twoSetsLines()),
  groupSubtotal: regularSubtotal(twoSetsLines()),
  productCount: PRODUCT_COUNT,
  legacyBundlePrice: 1500,
  multiplier: 2,
});
close("legacy 2 sets → 3000", legacy2.effectiveTotal, 3000);
close("legacy 2 sets → savings 1000", legacy2.totalSavings, 1000);

/* ==================== 6. LINE REPRICING (EXACT) ==================== */

console.log("\n6) repriceBundleGroup — exact totals");

const priced1 = repriceBundleGroup(setLines(), 1800);
close("10% off → lines sum exactly 1800", round2(priced1.reduce((s, l) => s + l.price * l.qty, 0)), 1800);

const priced3 = repriceBundleGroup(twoSetsLines(), 3600);
close("6 items → lines sum exactly 3600", round2(priced3.reduce((s, l) => s + l.price * l.qty, 0)), 3600);

const odd = repriceBundleGroup(twoSetsLines(), 3333.33);
close("odd total stays exact", round2(odd.reduce((s, l) => s + l.price * l.qty, 0)), 3333.33);

ok(
  "gift lines are skipped by repricing",
  repriceBundleGroup(
    [...setLines(), { key: "gift", isBundleGift: true, regularPrice: 200, qty: 1 }],
    1800
  ).every((l) => !l.isBundleGift)
);

const weighted = splitBundlePrice(
  [
    { regularPrice: 1000, quantity: 1 },
    { regularPrice: 500, quantity: 1 },
    { regularPrice: 500, quantity: 1 },
  ],
  1000
);
close("weight 50% line", weighted[0].unitPrice, 500);
close("weight 25% line", weighted[1].unitPrice, 250);
close("weight 25% line", weighted[2].unitPrice, 250);

/* ==================== 7. LABELS ==================== */

console.log("\n7) Labels");

eq("all-products % label", bundleRuleLabel(normalizeBundleRule(PRICE_10), PRODUCT_COUNT), "Buy all 3 products → 10% OFF");
eq("limit % label", bundleRuleLabel(normalizeBundleRule(PRICE_LIMIT_4), PRODUCT_COUNT), "Buy 4 items → 10% OFF");
eq(
  "fixed label",
  bundleRuleLabel(normalizeBundleRule({ mode: "all", rewardType: "fixed_amount", value: 250 }), PRODUCT_COUNT),
  "Buy all 3 products → Rs. 250 OFF"
);
eq("gift label", bundleRuleLabel(giftRule, PRODUCT_COUNT), "Buy all 3 products → Gift Box FREE");
eq(
  "progress label",
  bundleProgressLabel(normalizeBundleRule(PRICE_10), 1, PRODUCT_COUNT),
  "Add 2 more items to unlock 10% OFF"
);
eq("progress label hidden once met", bundleProgressLabel(normalizeBundleRule(PRICE_10), 3, PRODUCT_COUNT), "");

/* ==================== SUMMARY ==================== */

console.log(`\n${"=".repeat(46)}`);
if (failures.length === 0) {
  console.log(`✅ ALL PASSED — ${passed} assertions`);
  process.exit(0);
} else {
  console.log(`❌ ${failures.length} FAILED of ${passed + failures.length}`);
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
}

