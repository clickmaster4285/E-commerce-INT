// services/pricing/checkout.js — server decides every price (optimizeplan.md §2.2)
const test = require("node:test");
const assert = require("node:assert/strict");
const { priceCheckout } = require("../services/pricing/checkout");

const product = (id, extra = {}) => ({ _id: id, category_id: "c1", brand_id: "b1", tax: 0, ...extra });
const variant = (price, qty = 100) => ({ _id: `v-${price}`, selling_price: price, quantity: qty });
const now = new Date("2026-06-01T00:00:00Z");
const window = { isActive: true, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") };

test("regular line: best active discount, client price matches → no mismatch", () => {
  const discounts = [{ isActive: true, type: "percentage", value: 10, applyTo: "all", name: "Ten" }];
  const { priced, mismatches } = priceCheckout({
    lines: [{ index: 0, qty: 2, product: product("p1"), variant: variant(1000), clientUnit: 900, clientFree: 0 }],
    discounts,
    now,
  });
  assert.equal(priced.get(0).unit, 900);
  assert.equal(priced.get(0).perItemSavings, 100);
  assert.equal(mismatches.length, 0);
});

test("tampered price (client says 1) is caught as a mismatch with the server price", () => {
  const { priced, mismatches } = priceCheckout({
    lines: [{ index: 0, qty: 1, product: product("p1"), variant: variant(1000), clientUnit: 1, clientFree: 0 }],
    discounts: [],
    now,
  });
  assert.equal(priced.get(0).unit, 1000);
  assert.deepEqual(mismatches[0], { index: 0, clientUnit: 1, serverUnit: 1000, clientFree: 0, serverFree: 0 });
});

test("buy 2 get 1: server decides free items; inflated free items is a mismatch", () => {
  const deal = { ...window, type: "buy_x_get_y", applyTo: "all", buyQuantity: 2, getQuantity: 1 };
  const ok = priceCheckout({ lines: [{ index: 0, qty: 4, product: product("p1"), variant: variant(500), dealDoc: deal, clientUnit: 500, clientFree: 2 }], discounts: [], now });
  assert.equal(ok.priced.get(0).free, 2);
  assert.equal(ok.priced.get(0).dealSavings, 1000);
  assert.equal(ok.mismatches.length, 0);
  const bad = priceCheckout({ lines: [{ index: 0, qty: 4, product: product("p1"), variant: variant(500), dealDoc: deal, clientUnit: 500, clientFree: 40 }], discounts: [], now });
  assert.equal(bad.mismatches[0].serverFree, 2);
});

test("percentage deal skips regular discounts and uses the deal unit price", () => {
  const deal = { ...window, type: "percentage", applyTo: "product", productIds: ["p1"], discountValue: 25 };
  const discounts = [{ isActive: true, type: "percentage", value: 90, applyTo: "all" }];
  const { priced } = priceCheckout({ lines: [{ index: 0, qty: 1, product: product("p1"), variant: variant(999), dealDoc: deal, clientUnit: 749 }], discounts, now });
  assert.equal(priced.get(0).unit, 749); // Math.round(999 * 0.75)
});

test("deal outside its window or not covering the product → DEAL_NOT_APPLICABLE", () => {
  const expired = { ...window, endDate: new Date("2026-02-01"), type: "percentage", applyTo: "all", discountValue: 10 };
  const otherProduct = { ...window, type: "percentage", applyTo: "product", productIds: ["p9"], discountValue: 10 };
  const r1 = priceCheckout({ lines: [{ index: 0, qty: 1, product: product("p1"), variant: variant(100), dealDoc: expired, clientUnit: 90 }], discounts: [], now });
  const r2 = priceCheckout({ lines: [{ index: 0, qty: 1, product: product("p1"), variant: variant(100), dealDoc: otherProduct, clientUnit: 90 }], discounts: [], now });
  assert.equal(r1.errors[0].code, "DEAL_NOT_APPLICABLE");
  assert.equal(r2.errors[0].code, "DEAL_NOT_APPLICABLE");
});

test("bundle (all products, 20% off): group total split over lines by regular price", () => {
  const bundleDealDoc = { _id: "bd1", bundleRule: { mode: "all", rewardType: "percentage", value: 20 }, bundleProducts: [{ product: "p1", quantity: 1 }, { product: "p2", quantity: 1 }] };
  const lines = [
    { index: 0, qty: 1, product: product("p1"), variant: variant(600), bundleId: "bd1", bundleDealDoc, clientUnit: 480 },
    { index: 1, qty: 1, product: product("p2"), variant: variant(400), bundleId: "bd1", bundleDealDoc, clientUnit: 320 },
  ];
  const { priced, mismatches, errors } = priceCheckout({ lines, discounts: [], now });
  assert.equal(errors.length, 0);
  assert.equal(priced.get(0).unit + priced.get(1).unit, 800);
  assert.equal(priced.get(0).unit, 480);
  assert.equal(mismatches.length, 0);
});

test("bundle free gift: valid gift line priced 0; wrong product or extra quantity rejected", () => {
  const bundleDealDoc = { _id: "bd2", bundleRule: { mode: "all", rewardType: "free_product", freeProduct: "g1", freeQuantity: 1 }, bundleProducts: [] };
  const base = [
    { index: 0, qty: 1, product: product("p1"), variant: variant(300), bundleId: "bd2", bundleDealDoc, clientUnit: 300 },
    { index: 1, qty: 1, product: product("p2"), variant: variant(200), bundleId: "bd2", bundleDealDoc, clientUnit: 200 },
  ];
  const good = priceCheckout({ lines: [...base, { index: 2, qty: 1, isGift: true, product: product("g1"), variant: variant(150), bundleId: "bd2", bundleDealDoc, clientUnit: 0 }], discounts: [], now });
  assert.equal(good.errors.length, 0);
  assert.equal(good.priced.get(2).unit, 0);
  const greedy = priceCheckout({ lines: [...base, { index: 2, qty: 5, isGift: true, product: product("g1"), variant: variant(150), bundleId: "bd2", bundleDealDoc, clientUnit: 0 }], discounts: [], now });
  assert.equal(greedy.errors[0].code, "BUNDLE_GIFT_INVALID");
  const swapped = priceCheckout({ lines: [...base, { index: 2, qty: 1, isGift: true, product: product("expensive"), variant: variant(9999), bundleId: "bd2", bundleDealDoc, clientUnit: 0 }], discounts: [], now });
  assert.equal(swapped.errors[0].code, "BUNDLE_GIFT_INVALID");
});

test("legacy Bundle (fixed bundle price, no rule)", () => {
  const bundleDoc = { _id: "lb1", bundlePrice: 700, products: [{ product: "p1", quantity: 1 }, { product: "p2", quantity: 1 }] };
  const lines = [
    { index: 0, qty: 1, product: product("p1"), variant: variant(500), bundleId: "lb1", bundleDoc, clientUnit: 437.5 },
    { index: 1, qty: 1, product: product("p2"), variant: variant(300), bundleId: "lb1", bundleDoc, clientUnit: 262.5 },
  ];
  const { priced, mismatches } = priceCheckout({ lines, discounts: [], now });
  assert.equal(priced.get(0).unit + priced.get(1).unit, 700);
  assert.equal(mismatches.length, 0);
});
