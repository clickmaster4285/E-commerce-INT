// §5.2 AppError, §1 hydrate, §3.10 geo, §3.9 money.allocate — unit-only
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const AppError = require("../utils/AppError");
const { classify } = require("../middleware/errorHandler");
const { hydrate } = require("../utils/hydrate");
const { normalizeCountryCode, countryDisplayName } = require("../utils/geo");
const { allocate, toMinor, fromMinor } = require("../utils/money");

test("AppError carries status, code, details, isOperational", () => {
  const err = new AppError("Nahi chala", { status: 422, code: "WEIRD", details: { field: "x" } });
  assert.equal(err.message, "Nahi chala");
  assert.equal(err.status, 422);
  assert.equal(err.code, "WEIRD");
  assert.deepEqual(err.details, { field: "x" });
  assert.equal(err.isOperational, true);
  assert.ok(err instanceof Error);
});

test("classify maps AppError without stack leakage for 500", () => {
  const err = new AppError("secret db thing", { status: 500, code: "BOOM" });
  err.stack = "STACK_SHOULD_NOT_GO_TO_CLIENT";
  const out = classify(err);
  assert.equal(out.status, 500);
  assert.equal(out.code, "BOOM");
  assert.equal(out.message, "secret db thing");
  assert.equal(out.stack, undefined);
});

test("classify maps AppError details onto response extras", () => {
  const err = new AppError("Form", { status: 400, code: "VALIDATION_ERROR", details: { errors: { name: "required" } } });
  const out = classify(err);
  assert.deepEqual(out.extra, { errors: { name: "required" } });
});

test("hydrate batches one $in query and replaces field", async () => {
  const id1 = new mongoose.Types.ObjectId();
  const id2 = new mongoose.Types.ObjectId();
  const calls = [];
  const mockModel = {
    find(filter) {
      calls.push(filter);
      return {
        select() {
          return {
            lean: async () => [
              { _id: id1, name: "Ali", email: "a@x.com" },
              { _id: id2, name: "Sara", email: "s@x.com" },
            ],
          };
        },
      };
    },
  };
  const docs = [
    { _id: "t1", createdby: id1 },
    { _id: "t2", createdby: id2 },
    { _id: "t3", createdby: null },
  ];
  const out = await hydrate(docs, { field: "createdby", model: mockModel, select: "name email" });
  assert.equal(calls.length, 1);
  assert.deepEqual([...calls[0]._id.$in].map(String).sort(), [String(id1), String(id2)].sort());
  assert.equal(out[0].createdby.name, "Ali");
  assert.equal(out[1].createdby.email, "s@x.com");
  assert.equal(out[2].createdby, null);
});

test("geo normalizeCountryCode", () => {
  assert.equal(normalizeCountryCode("Pakistan"), "PK");
  assert.equal(normalizeCountryCode("PK"), "PK");
  assert.equal(normalizeCountryCode("pakistan"), "PK");
  assert.equal(countryDisplayName("PK"), "Pakistan");
});

test("money.allocate largest-remainder", () => {
  const total = toMinor(10, "PKR");
  const parts = [333, 333, 334]; // weights
  const shares = allocate(total, parts);
  assert.equal(shares.reduce((a, b) => a + b, 0), total);
  assert.deepEqual(shares.map((m) => fromMinor(m, "PKR")), [3.33, 3.33, 3.34]);
});