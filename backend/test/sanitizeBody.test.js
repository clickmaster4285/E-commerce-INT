// Mass assignment guard (optimizeplan.md §2.2)
const test = require("node:test");
const assert = require("node:assert/strict");
const { withoutProtected } = require("../utils/sanitizeBody");

test("strips server-managed fields, Mongo operators and dotted paths", () => {
  const body = {
    name: "Summer Sale",
    usedCount: 999,
    storeId: "other-store",
    createdBy: "attacker",
    is_deleted: false,
    activity: [],
    translations: { name: { ur: "x" } },
    $set: { usedCount: 0 },
    "activity.0": "x",
    discountValue: 10,
  };
  assert.deepEqual(withoutProtected(body, ["usedCount"]), { name: "Summer Sale", discountValue: 10 });
});

test("model-specific extras (vendor balances) are removed", () => {
  const out = withoutProtected({ name: "V", balance_payable: 0, total_paid: 1e9, total_purchased: 5 }, ["total_purchased", "total_paid", "balance_payable"]);
  assert.deepEqual(out, { name: "V" });
});

test("non-object input → empty object (never throws)", () => {
  assert.deepEqual(withoutProtected(null), {});
  assert.deepEqual(withoutProtected(["a"]), {});
});
