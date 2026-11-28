const test = require("node:test");
const assert = require("node:assert/strict");
const { toMinor, fromMinor, add, mul, pct, allocate } = require("../utils/money");

test("toMinor / fromMinor round-trip PKR", () => {
  assert.equal(toMinor(10.5, "PKR"), 1050);
  assert.equal(fromMinor(1050, "PKR"), 10.5);
  assert.equal(toMinor(1.005, "PKR"), 101); // half-up
});

test("add / mul / pct", () => {
  assert.equal(add(100, 50, -25), 125);
  assert.equal(mul(199, 3), 597);
  assert.equal(pct(10000, 17.5), 1750);
});

test("allocate largest-remainder preserves total", () => {
  const parts = allocate(100, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(parts.sort((a, b) => b - a), [34, 33, 33]);

  const uneven = allocate(10, [2, 3, 5]);
  assert.equal(uneven.reduce((a, b) => a + b, 0), 10);
});

test("asyncHandler exports a function", () => {
  assert.equal(typeof require("../utils/asyncHandler"), "function");
});
