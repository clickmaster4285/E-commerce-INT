/**
 * Split locale JSON into storefront + admin chunks (§9.4).
 * Storefront keeps non-admin keys PLUS any admin.* keys still referenced
 * outside admin/super-admin trees (legacy shared strings).
 * Admin chunk holds every admin.* key and is loaded only on /admin.
 *
 * Usage: node scripts/splitI18nAdmin.js
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const LOCALES = path.join(SRC, "i18n", "locales");
const ADMIN_DIR = path.join(LOCALES, "admin");

const STOREFRONT_ROOTS = [
  path.join(SRC, "components", "user"),
  path.join(SRC, "components", "chat"),
  path.join(SRC, "components", "common"),
  path.join(SRC, "hooks", "user"),
  path.join(SRC, "lib"),
  path.join(SRC, "app", "(user)"),
  path.join(SRC, "app", "landing"),
  path.join(SRC, "app", "login"),
  path.join(SRC, "app", "store-setup"),
  path.join(SRC, "app", "admin-handoff"),
  path.join(SRC, "app", "store-not-found"),
  path.join(SRC, "app", "layout.js"),
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    if (/\.(js|jsx|ts|tsx)$/.test(dir)) acc.push(dir);
    return acc;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "admin" || entry.name === "super-admin") continue;
    walk(path.join(dir, entry.name), acc);
  }
  return acc;
}

function collectAdminKeysUsedOnStorefront() {
  const files = STOREFRONT_ROOTS.flatMap((p) => walk(p));
  const re = /\bt\(\s*["'](admin\.[^"']+)["']/g;
  const used = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text))) used.add(m[1]);
  }
  return used;
}

function splitLocale(code, keepAdminKeys) {
  const file = path.join(LOCALES, `${code}.json`);
  if (!fs.existsSync(file)) return null;
  const all = JSON.parse(fs.readFileSync(file, "utf8"));
  const storefront = {};
  const admin = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith("admin.")) {
      admin[key] = value;
      if (keepAdminKeys.has(key)) storefront[key] = value;
    } else {
      storefront[key] = value;
    }
  }
  fs.mkdirSync(ADMIN_DIR, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(storefront, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(ADMIN_DIR, `${code}.json`), `${JSON.stringify(admin, null, 2)}\n`, "utf8");
  return {
    code,
    before: Object.keys(all).length,
    storefront: Object.keys(storefront).length,
    admin: Object.keys(admin).length,
    sharedAdmin: [...keepAdminKeys].filter((k) => k in admin).length,
  };
}

const keep = collectAdminKeysUsedOnStorefront();
const codes = fs
  .readdirSync(LOCALES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const results = codes.map((code) => splitLocale(code, keep)).filter(Boolean);
console.log(JSON.stringify({ sharedAdminKeys: keep.size, results }, null, 2));
