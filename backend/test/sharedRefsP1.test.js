const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeMethod,
  PAYMENT_METHOD_CODES,
} = require("../config/paymentMethods");
const {
  ORDER_ALLOWED_TRANSITIONS,
  isAllowedTransition,
} = require("../config/statuses");
const Role = require("../models/Role");
const TaxClass = require("../models/TaxClass");
const Media = require("../models/Media");
const TranslationMemory = require("../models/TranslationMemory");
const imageSchema = require("../models/shared/imageSchema");

test("paymentMethods: legacy Order/Pos/Invoice values normalize to codes", () => {
  assert.equal(normalizeMethod("cod"), "cod");
  assert.equal(normalizeMethod("bank"), "bank_transfer");
  assert.equal(normalizeMethod("Cash"), "cash");
  assert.equal(normalizeMethod("Bank"), "bank_transfer");
  assert.equal(normalizeMethod("mobile_wallet"), "mobile_wallet");
  assert.equal(normalizeMethod("Cash Refund"), "cash");
  assert.equal(normalizeMethod("Balance Adjustment"), "store_credit");
  assert.equal(normalizeMethod("nonsense"), "other");
  assert.ok(PAYMENT_METHOD_CODES.includes("store_credit"));
});

test("statuses: order transitions follow allowed map", () => {
  assert.ok(isAllowedTransition("order", "pending", "confirmed"));
  assert.ok(isAllowedTransition("order", "pending", "cancelled"));
  assert.ok(isAllowedTransition("order", "shipped", "delivered"));
  assert.equal(isAllowedTransition("order", "pending", "delivered"), false);
  assert.equal(isAllowedTransition("order", "delivered", "cancelled"), false);
  assert.deepEqual(ORDER_ALLOWED_TRANSITIONS.processing, ["shipped", "cancelled"]);
});

test("Role schema has store + name indexes", () => {
  const indexes = Role.schema.indexes();
  assert.ok(
    indexes.some(([keys]) => keys.storeId === 1 && keys.name === 1),
    "compound storeId+name index",
  );
});

test("TaxClass schema has unique {storeId, name}", () => {
  const indexes = TaxClass.schema.indexes();
  assert.ok(
    indexes.some(([keys, options]) => keys.storeId === 1 && keys.name === 1 && options.unique),
  );
});

test("Media schema has unique {storeId, sha256}", () => {
  const indexes = Media.schema.indexes();
  assert.ok(
    indexes.some(([keys, options]) => keys.storeId === 1 && keys.sha256 === 1 && options.unique),
  );
});

test("TranslationMemory has unique {source_hash, target_lang}", () => {
  const indexes = TranslationMemory.schema.indexes();
  assert.ok(
    indexes.some(
      ([keys, options]) => keys.source_hash === 1 && keys.target_lang === 1 && options.unique,
    ),
  );
});

test("shared imageSchema exports required Variant-compatible fields", () => {
  assert.ok(imageSchema.paths.img_url);
  assert.ok(imageSchema.paths.img_size);
  assert.ok(imageSchema.paths.mimeType);
  assert.ok(imageSchema.paths.width);
  assert.ok(imageSchema.paths.height);
});