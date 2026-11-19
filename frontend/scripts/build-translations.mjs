// ==========================================
// Split src/i18n/translations.source.mjs into per-locale JSON files.
// ==========================================
// Usage: npm run i18n   (also runs automatically via predev / prebuild)
//
// Output: src/i18n/locales/<code>.json  →  { "some.key": "text", ... }
// A locale file only contains keys that actually have a value for that
// locale; anything missing falls back to English at runtime — identical to
// the old `entry[locale] ?? entry.en ?? key` behaviour.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nDir = path.join(root, "src", "i18n");
const outDir = path.join(i18nDir, "locales");

// Locale codes are read from config.js text so this script never has to
// import app code (config.js uses extensionless ESM that plain Node rejects).
const configText = fs.readFileSync(path.join(i18nDir, "config.js"), "utf8");
const codes = [...configText.matchAll(/\{\s*code:\s*"([a-z-]+)"/g)].map((m) => m[1]);
if (!codes.includes("en")) throw new Error("build-translations: could not read LOCALES from config.js");

const { default: translations } = await import(
  pathToFileURL(path.join(i18nDir, "translations.source.mjs")).href
);

fs.mkdirSync(outDir, { recursive: true });

let written = 0;
for (const code of codes) {
  const dict = {};
  for (const [key, values] of Object.entries(translations)) {
    const value = values?.[code];
    if (value !== undefined && value !== null) dict[key] = value;
  }
  const file = path.join(outDir, `${code}.json`);
  const json = JSON.stringify(dict, null, 2) + "\n";
  // Only touch the file when content changed, so dev servers don't reload needlessly.
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== json) {
    fs.writeFileSync(file, json);
    written++;
  }
}

console.log(
  `i18n: ${Object.keys(translations).length} keys × ${codes.length} locales → src/i18n/locales (${written} file(s) updated)`
);
