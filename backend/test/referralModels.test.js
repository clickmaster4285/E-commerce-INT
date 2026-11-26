const test = require("node:test");
const assert = require("node:assert/strict");
const ReferralProgram = require("../models/ReferralProgram");
const Referral = require("../models/Referral");
const LoyaltyTransaction = require("../models/LoyaltyTransaction");
const { createCode } = require("../utils/referralService");

test("loyalty credit is exported for referral rewards", () => {
  const { credit } = require("../utils/loyaltyService");
  assert.equal(typeof credit, "function");
});

test("referral codes are unique-looking uppercase alphanumeric tokens", () => {
  const first = createCode();
  const second = createCode();
  assert.match(first, /^[A-F0-9]{10}$/);
  assert.match(second, /^[A-F0-9]{10}$/);
  assert.notEqual(first, second);
});

test("referral program defaults to off with editable point rewards", () => {
  const program = new ReferralProgram();
  assert.equal(program.enabled, false);
  assert.equal(program.referrerPoints, 100);
  assert.equal(program.friendPoints, 100);
  assert.equal(program.saleReferrerPoints, 0);
});

test("referral ledger records a customer only once per store and accepts referral rewards", async () => {
  const referral = new Referral({ referrerId: "507f1f77bcf86cd799439011", referredUserId: "507f191e810c19729de860ea", referralCode: "ABC123" });
  await referral.validate();
  assert.equal(Referral.schema.indexes().some(([keys, options]) => keys.storeId === 1 && keys.referredUserId === 1 && options.unique), true);
  assert.equal(LoyaltyTransaction.schema.path("type").enumValues.includes("referral"), true);
});
