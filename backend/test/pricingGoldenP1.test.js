// Golden numbers — pricing/money ke "frozen" results (optimizeplan §4.2).
// Formula badle to ye test fail hoga: jaan-boojh kar badla ho to expected values update karo.
// Storefront parity alag test me hai: test/pricingParity.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const pricing = require("../services/pricing");
const { toMinor, fromMinor, allocate, roundMoney } = pricing.money;
const { getDealUnitPrice, calculateFreeItems } = pricing.dealRules;
const { bestRegularDiscount } = pricing.discountRules;
const { priceCheckout } = pricing;

test("golden: toMinor half-up + invalid input = 0", () => {
  assert.equal(toMinor(10.5), 1050);
  assert.equal(toMinor(1.005), 101);
  assert.equal(toMinor(19.999), 2000);
  assert.equal(toMinor("abc"), 0);
  assert.equal(fromMinor(2000), 20);
});

test("golden: allocate largest-remainder — total hamesha preserve", () => {
  assert.deepEqual(allocate(1000, [1, 1, 1]), [334, 333, 333]);
  assert.deepEqual(allocate(5, [0, 0]), [0, 0]);
  const shares = allocate(9999, [1234, 5678, 91011]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 9999);
});

test("golden: roundMoney ek hi jagah (utils/roundMoney) se re-export hota hai", () => {
  assert.equal(pricing.money.roundMoney, require("../utils/roundMoney").roundMoney);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(2.675), 2.68);
});

test("golden: deal unit price (percentage / fixed) + free items", () => {
  assert.equal(getDealUnitPrice(999, "percentage", 10), 899); // Math.round(899.1)
  assert.equal(getDealUnitPrice(1000, "fixed_amount", 250), 750);
  assert.equal(getDealUnitPrice(1000, "fixed_amount", 1000), 1000); // value >= price → regular
  assert.equal(calculateFreeItems(6, 2, 1), 3); // buy 2 get 1 on qty 6
  assert.equal(calculateFreeItems(1, 2, 1), 0);
});

test("golden: regular discount — sab se achhi discount jeetti hai", () => {
  const discounts = [
    { isActive: true, type: "percentage", value: 10, applyTo: "all", name: "Ten" },
    { isActive: true, type: "percentage", value: 20, applyTo: "all", name: "Twenty" },
  ];
  const best = bestRegularDiscount(1000, discounts, {});
  assert.equal(best.discountedPrice, 800);
  assert.equal(best.savings, 200);
  assert.equal(best.discountName, "Twenty");
});

test("golden: priceCheckout — regular discount line (server price + savings)", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const product = (id) => ({ _id: id, category_id: "c1", brand_id: "b1", tax: 0 });
  const variant = (price) => ({ _id: `v-${price}`, selling_price: price, quantity: 100 });
  const { priced, mismatches, errors } = priceCheckout({
    lines: [
      { index: 0, qty: 2, product: product("p1"), variant: variant(1000), clientUnit: 900, clientFree: 0 },
    ],
    discounts: [{ isActive: true, type: "percentage", value: 10, applyTo: "all", name: "Ten" }],
    now,
  });
  assert.equal(errors.length, 0);
  assert.equal(mismatches.length, 0);
  assert.equal(priced.get(0).unit, 900);
  assert.equal(priced.get(0).perItemSavings, 100);
});

test("services/pricing/index exports saari rules ek jagah", () => {
  for (const key of ["money", "dealRules", "bundleRules", "discountRules", "priceCheckout", "pricePosLine"]) {
    assert.ok(pricing[key], `missing ${key}`);
  }
});

test("golden: pricePosLine % + flat + tax", () => {
  const line = pricing.pricePosLine({
    unitPrice: 100,
    quantity: 2,
    discountRate: 10,
    flatDiscountPerUnit: 5,
    taxRate: 10,
  });
  // gross 200; %disc 20; flat 10; line 170; tax 17
  assert.equal(line.grossLineTotal, 200);
  assert.equal(line.itemDiscount, 30);
  assert.equal(line.lineTotal, 170);
  assert.equal(line.itemTax, 17);
  assert.equal(line.flat_discount, 5);
});
