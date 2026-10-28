const test = require("node:test");
const assert = require("node:assert/strict");
const { getInvoiceStockAdjustments } = require("../utils/invoiceStockAdjustments");

test("invoice stock changes are based on quantity difference", () => {
  const line = (quantity) => [{ variant_id: "variant-a", quantity }];
  assert.deepEqual(getInvoiceStockAdjustments([], line(2)), [{ variant_id: "variant-a", quantity: 2 }]);
  assert.deepEqual(getInvoiceStockAdjustments(line(2), line(4)), [{ variant_id: "variant-a", quantity: 2 }]);
  assert.deepEqual(getInvoiceStockAdjustments(line(4), line(2)), [{ variant_id: "variant-a", quantity: -2 }]);
  assert.deepEqual(getInvoiceStockAdjustments(line(2), line(2)), []);
});

test("invoice stock adjustments aggregate duplicate lines and variant swaps", () => {
  assert.deepEqual(
    getInvoiceStockAdjustments(
      [{ variant_id: "variant-a", quantity: 2 }, { variant_id: "variant-a", quantity: 1 }],
      [{ variant_id: "variant-a", quantity: 1 }, { variant_id: "variant-b", quantity: 2 }],
    ),
    [{ variant_id: "variant-a", quantity: -2 }, { variant_id: "variant-b", quantity: 2 }],
  );
});
