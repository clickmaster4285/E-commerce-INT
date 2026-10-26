const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateReturnLine,
  capReturnLines,
  calculateReturnSettlement,
  getOriginalInvoiceTotal,
} = require("../utils/invoiceReturnMath");

const closeTo = (actual, expected) => assert.equal(actual, expected);

test("returning an item equal to the invoice total settles at exactly zero", () => {
  const line = calculateReturnLine({ _id: "item-1", quantity: 1, unit_price: 2400, total: 2400 }, 1);
  const capped = capReturnLines([{ qty: 1, ...line }], 2400);
  const settlement = calculateReturnSettlement(2400, 2400, capped.total);
  closeTo(capped.total, 2400);
  closeTo(settlement.adjusted_total, 0);
  closeTo(settlement.cash_refund, 2400);
  closeTo(settlement.remaining_balance, 0);
});

test("return value above invoice total is capped and never creates a negative total", () => {
  const capped = capReturnLines([
    { qty: 1, return_value: 1000, unit_price: 1000 },
    { qty: 1, return_value: 1000, unit_price: 1000 },
    { qty: 1, return_value: 1000, unit_price: 1000 },
  ], 2400);
  const settlement = calculateReturnSettlement(2400, 2400, capped.total);
  closeTo(capped.raw_total, 3000);
  closeTo(capped.total, 2400);
  assert.equal(capped.capped, true);
  closeTo(capped.lines.reduce((sum, line) => sum + line.return_value, 0), 2400);
  closeTo(settlement.adjusted_total, 0);
  assert.ok(settlement.cash_refund <= 2400);
});

test("discounts and taxes use stored net line total with exact cents over partial returns", () => {
  // Gross 2,000 less 300 allocated discount plus 150 tax = 1,850 actually paid.
  const item = { _id: "item-2", quantity: 2, unit_price: 1000, discount: 300, tax: 150, total: 1850 };
  const first = calculateReturnLine(item, 1);
  closeTo(first.return_value, 925);
  const returns = [{ items_returned: [{ item_id: "item-2", qty: 1, unit_price: first.unit_price, return_value: first.return_value }] }];
  const second = calculateReturnLine(item, 1, returns);
  closeTo(second.return_value, 925);
  const both = calculateReturnLine(item, 1, returns);
  closeTo(both.available_quantity, 1);
  closeTo(both.return_value, 925);
});

test("partial payment offsets the balance before paying cash", () => {
  const settlement = calculateReturnSettlement(2114.33, 2000, 909.43);
  closeTo(settlement.adjusted_total, 1204.90);
  closeTo(settlement.cash_refund, 795.10);
  closeTo(settlement.amount_paid, 1204.90);
  closeTo(settlement.remaining_balance, 0);
});

test("original invoice total stays unchanged after returns, including legacy records", () => {
  closeTo(getOriginalInvoiceTotal({
    original_total: 1000,
    total: 600,
    returns: [{ total_adjustment: 400 }],
  }), 1000);
  closeTo(getOriginalInvoiceTotal({
    total: 600,
    returns: [{ refund_amount: 250 }, { total_adjustment: 150 }],
  }), 1000);
});
