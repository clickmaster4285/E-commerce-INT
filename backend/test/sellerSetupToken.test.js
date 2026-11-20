// /store-setup signed links (utils/sellerSetupToken.js) — email alone never opens an application
process.env.JWT_SECRET = "test-jwt-secret";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { signSetupToken, findApplicationForToken } = require("../utils/sellerSetupToken");

const APP_A = { _id: "64b000000000000000000001", email: "ali@x.co", status: "pending" };
const APP_B = { _id: "64b000000000000000000002", email: "sara@x.co", status: "pending" };
const db = new Map([[APP_A._id, APP_A], [APP_B._id, APP_B]]);

// findById(...).select().lean() chain
const FakeApplication = {
  findById(id) {
    const value = db.get(String(id)) || null;
    const q = { select: () => q, lean: () => q, then: (ok, fail) => Promise.resolve(value).then(ok, fail) };
    return q;
  },
};
const find = (token) => findApplicationForToken(token, { SellerApplication: FakeApplication });

test("valid link opens its own application", async () => {
  const app = await find(signSetupToken(APP_A));
  assert.equal(app._id, APP_A._id);
});

test("a link for application A never resolves to B", async () => {
  const app = await find(signSetupToken(APP_A));
  assert.notEqual(app._id, APP_B._id);
});

test("missing, garbage, wrong-secret, wrong-type and expired tokens are rejected", async () => {
  assert.equal(await find(""), null);
  assert.equal(await find("not-a-jwt"), null);
  assert.equal(await find(jwt.sign({ type: "seller_setup", appId: APP_A._id, email: APP_A.email }, "other-secret")), null);
  assert.equal(await find(jwt.sign({ type: "store_handoff", appId: APP_A._id, email: APP_A.email }, process.env.JWT_SECRET)), null);
  assert.equal(
    await find(jwt.sign({ type: "seller_setup", appId: APP_A._id, email: APP_A.email }, process.env.JWT_SECRET, { expiresIn: -10 })),
    null,
  );
});

test("token whose email no longer matches the application is rejected", async () => {
  const token = jwt.sign({ type: "seller_setup", appId: APP_A._id, email: "someone@else.co" }, process.env.JWT_SECRET);
  assert.equal(await find(token), null);
});

test("an email address is not a token", async () => {
  assert.equal(await find(APP_A.email), null);
});

test("unknown application id → null", async () => {
  const token = jwt.sign({ type: "seller_setup", appId: "64b0000000000000000000ff", email: APP_A.email }, process.env.JWT_SECRET);
  assert.equal(await find(token), null);
});
