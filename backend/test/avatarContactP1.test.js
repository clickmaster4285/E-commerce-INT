// §3.6 avatar files + §3.7 created_at dual-read
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { persistAvatar, isDataUrl } = require("../utils/avatarFiles");
const { UPLOAD_ROOT, localPathForUrl } = require("../utils/uploadPaths");
const ContactMessage = require("../models/ContactMessage");

// 1x1 PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const storeId = new mongoose.Types.ObjectId();
const req = { store: { _id: storeId } };

test.after(() => {
  fs.rmSync(path.join(UPLOAD_ROOT, "stores", String(storeId)), { recursive: true, force: true });
});

test("persistAvatar turns a data URL into a store-scoped webp file URL", async () => {
  assert.ok(isDataUrl(PNG));
  const url = await persistAvatar(req, PNG);
  assert.match(url, new RegExp(`^/uploads/stores/${storeId}/avatars/avatar-\\d+-[a-f0-9]+\\.webp$`));
  const abs = localPathForUrl(req, url);
  assert.ok(abs && fs.existsSync(abs));
  const second = await persistAvatar(req, PNG);
  assert.notEqual(url, second, "filenames stay unique");
});

test("persistAvatar leaves URLs / empty values alone and rejects bad types", async () => {
  assert.equal(await persistAvatar(req, "/uploads/x.webp"), "/uploads/x.webp");
  assert.equal(await persistAvatar(req, ""), "");
  assert.equal(await persistAvatar(req, undefined), undefined);
  await assert.rejects(() => persistAvatar(req, "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), /unsupported/);
});

test("ContactMessage uses created_at and toDto dual-reads legacy createdAt", () => {
  assert.ok(ContactMessage.schema.path("created_at"));
  const legacy = new Date("2024-01-01");
  const fresh = new Date("2025-01-01");
  assert.equal(ContactMessage.toDto({ createdAt: legacy }).createdAt, legacy);
  const dto = ContactMessage.toDto({ created_at: fresh, updated_at: fresh });
  assert.equal(dto.createdAt, fresh);
  assert.equal(dto.updatedAt, fresh);
});
