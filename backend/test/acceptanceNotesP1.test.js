// §10 checklist — items that are already true, pinned by source assertions.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

test("config/db.js requires a replica set (hello.setName) and exits otherwise", () => {
  const db = read("config", "db.js");
  assert.match(db, /hello\?\.setName/);
  assert.match(db, /must be a replica set/i);
  assert.match(db, /process\.exit\(1\)/);
});

test("public product path redacts cost_price (redactPublic + slim variant select)", () => {
  const redact = read("middleware", "redactPublic.js");
  assert.match(redact, /cost_price/);
  const routes = read("routes", "productRoutes.js");
  assert.match(routes, /redactPublic/);
  const ctrl = read("controllers", "productController.js");
  assert.match(ctrl, /select\("-cost_price/);
});

test("withTx has no STANDALONE fallback — fails closed without a replica set", () => {
  const tx = read("utils", "tx.js");
  // comments hata kar sirf code dekho (header comment "Standalone fallback ... gone" likhta hai)
  const code = tx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /standalone/i);
  assert.doesNotMatch(code, /manual compensation|compensat/i);
  assert.match(tx, /MongoDB must be a replica set for withTx/);
});

test("auth principal select excludes avatar and password (§3.6)", () => {
  const mw = read("middleware", "authMiddleware.js");
  const line = mw.match(/PRINCIPAL_SELECT = "([^"]+)"/)[1];
  assert.doesNotMatch(line, /avatar|password/);
});
