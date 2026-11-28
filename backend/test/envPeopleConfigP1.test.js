// §3.6 people cleanup + §5.3/§5.5 env + validate middleware tests
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const { validateEnv, loadEnv } = require("../config/env");
const { validate } = require("../middleware/validate");
const { z } = require("zod");

const goodEnv = { PORT: "5000", MONGO_URI: "mongodb://localhost/x", API_PREFIX: "/api" };

test("env validation accepts minimal good env", () => {
  assert.equal(validateEnv(goodEnv).ok, true);
  assert.equal(loadEnv(goodEnv).PORT, 5000);
});

test("env validation rejects bad PORT", () => {
  const r = validateEnv({ ...goodEnv, PORT: "abc" });
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /PORT/);
  assert.throws(() => loadEnv({ ...goodEnv, PORT: "99999" }), /PORT/);
});

test("env validation requires JWT secrets in production", () => {
  const r = validateEnv({ ...goodEnv, NODE_ENV: "production" });
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /JWT_USER_ACCESS_SECRET/);
});

function run(mw, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ res: this, body: b, next: false }); },
    };
    mw(req, res, () => resolve({ res, req, next: true }));
  });
}

test("validate middleware rejects bad body and passes good body", async () => {
  const mw = validate({ body: z.object({ email: z.string().email() }) });
  const bad = await run(mw, { body: { email: "nope" }, query: {}, params: {} });
  assert.equal(bad.next, false);
  assert.equal(bad.res.statusCode, 400);
  assert.equal(bad.body.errors[0].path, "body.email");
  const good = await run(mw, { body: { email: "a@b.co" }, query: {}, params: {} });
  assert.equal(good.next, true);
});

test("translation field lists exclude people/log models", () => {
  const { TRANSLATABLE_FIELDS } = require("../utils/translationService");
  for (const m of ["Customer", "Employee", "Lead", "Invoice", "Quote", "StockHistory"]) {
    assert.equal(TRANSLATABLE_FIELDS[m], undefined, m);
  }
  assert.ok(TRANSLATABLE_FIELDS.Product.includes("name"));
});

test("PendingRegistration has storeId+email unique index", () => {
  const PendingRegistration = require("../models/PendingRegistration");
  const idx = PendingRegistration.schema.indexes();
  assert.ok(idx.some(([f, o]) => f.storeId === 1 && f.email === 1 && o.unique));
  assert.ok(!idx.some(([f, o]) => Object.keys(f).length === 1 && f.email === 1 && o.unique));
});
