// ==========================================
// LIBRETRANSLATE CLIENT (self-hosted)
// ==========================================
// English -> supported locales via a self-hosted LibreTranslate instance
// (Argos Translate models). Koi paid API nahi — sirf ek local/own-server
// service jo `LIBRETRANSLATE_URL` par chal rahi hai.
//
// Why a client instead of calling the provider inline:
//   • Argos/LibreTranslate CPU-bound hai — parallel requests se queue khud
//     lambi ho jaati hai. Is liye calls ek serial queue se jaati hain.
//   • Rate limit (429) / network hiccup par retry-with-backoff chahiye.
//   • Service down ho to THROW karke caller ko English fallback karne dena
//     hai — is liye hard failure nahi, balki `null` return hota hai.
//
// Env (backend/.env):
//   LIBRETRANSLATE_URL=http://localhost:5000
//   LIBRETRANSLATE_API_KEY=            (optional — sirf agar instance par
//                                       `--api-keys` enable kiya ho)
//   TRANSLATE_TARGET_LOCALES=ur,ar,es,fr,de,hi,zh,pt,tr (comma separated)
//   TRANSLATE_BATCH_SIZE=10            (ek request me kitne strings)
//   TRANSLATE_TIMEOUT_MS=30000
//   TRANSLATE_MAX_RETRIES=3

const log = require("./logger");

// ⚠️ Default port 5055 — ye jaan-boojh kar teenon busy/alag ports se door hai:
//   5000 = is project ka apna Express server
//   5005 = LibreTranslate ka default (aapki existing instance yahi par hai)
// Agar same port par do services aa jayein to connections galat server par
// jaakar "ur is not supported" jaisi errors milti hain.
const API_URL = (process.env.LIBRETRANSLATE_URL || "http://localhost:5055").replace(/\/+$/, "");
const API_KEY = process.env.LIBRETRANSLATE_API_KEY || "";
const TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS) || 30000;
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES) || 3;
const BATCH_SIZE = Number(process.env.TRANSLATE_BATCH_SIZE) || 10;

const SOURCE_LANG = "en";
const TARGET_LOCALES = String(process.env.TRANSLATE_TARGET_LOCALES || "ur,ar,es,fr,de,hi,zh,pt,tr")
  .split(",")
  .map((l) => l.trim().toLowerCase())
  .filter(Boolean);

// ✅ Serial queue — ek waqt me sirf ek request jaari ho.
let queue = Promise.resolve();

function enqueue(task) {
  const result = queue.then(task, task);
  // Chain ko resolve/reject dono par safal rakhte hain taake ek failed task
  // baad ke saare tasks ko block na kar de.
  queue = result.then(
    () => {},
    () => {}
  );
  return result;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Configured hai? Nahi to translation silently skip ho jaati hai. */
function isEnabled() {
  return Boolean(API_URL);
}

// ⚠️ Project ka `logger` mute hai (saare logs band), jiski wajah se translation
// fail hone par KISI ko pata hi nahi chalta tha — UI par English dikhta rehta
// aur pata hi nahi chalta ke service chalu nahi hai. Ye ek misconfiguration hai,
// routine log nahi — is liye console par ek baar zaroor dikhate hain (per
// process, taake har request par spam na ho).
let warnedUnreachable = false;

function warnUnreachableOnce(reason) {
  if (warnedUnreachable) return;
  warnedUnreachable = true;
  console.warn(
    `\n\x1b[33m⚠️  [translation] LibreTranslate reachable nahi hai (${reason})\x1b[0m\n` +
      `    URL: ${API_URL || "(set nahi hai)"}\n` +
      `    Urdu abhi English fallback dikha raha hoga. Fix:\n` +
      `      1. LibreTranslate chalao (self-hosted, Argos se) — e.g. docker run -p 5005:5000 libretranslate/libretranslate\n` +
      `      2. Urdu model install karo (translate-ur)\n` +
      `      3. backend/.env me LIBRETRANSLATE_URL sahi port ke saath set karo\n` +
      `      4. ` + "`npm run backfill:translations`" + ` chalao\n` +
      `    Check: ` + "`npm run translation:check`" + `\n`
  );
}

/**
 * Ek batch translate karo.
 * @param {string[]} texts
 * @param {string} target
 * @returns {Promise<string[]|null>} translated texts, ya `null` agar service
 *          available nahi thi / fail hui. `null` ka matlab hai "English hi
 *          rakho" — is liye caller ko isko fail se alag treat karna chahiye.
 */
async function translateBatch(texts, target = TARGET_LOCALES[0]) {
  const batch = texts.map((t) => String(t ?? "").trim()).filter(Boolean);
  if (!batch.length) return [];

  if (!isEnabled()) {
    log.warn("[libreTranslate] LIBRETRANSLATE_URL set nahi — translation skip");
    warnUnreachableOnce("LIBRETRANSLATE_URL is not set");
    return null;
  }

  try {
    // Poori list ek sath nahi bhejte — `BATCH_SIZE` ke chunks me, aur har
    // chunk retry-aware hai. Saare chunks ek hi serial queue se guzarte hain.
    return await enqueue(async () => {
      const out = [];
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const slice = batch.slice(i, i + BATCH_SIZE);
        out.push(...(await requestWithRetry(slice, target)));
      }
      return out;
    });
  } catch (error) {
    // Service down / unreachable — caller English par fall back karega.
    log.error("[libreTranslate] batch failed:", error?.message || error);
    warnUnreachableOnce(error?.message || "unknown error");
    return null;
  }
}

async function requestWithRetry(batch, target) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s ...
      await sleep(1000 * 2 ** (attempt - 1));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const payload = {
        q: batch,
        source: SOURCE_LANG,
        target,
        format: "text",
      };
      if (API_KEY) payload.api_key = API_KEY;

      const response = await fetch(`${API_URL}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        // Rate-limited ya server-side hiccup → retry worth hai.
        lastError = new Error(`LibreTranslate HTTP ${response.status}`);
        continue;
      }

      if (!response.ok) {
        // 4xx (bad key, unknown target) — retry se kuch nahi hoga.
        const body = await response.text().catch(() => "");
        throw new Error(`LibreTranslate HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json();
      const items = Array.isArray(data?.translations) ? data.translations : [];

      // LibreTranslate array input par array deta hai, string input par string.
      const out = items.map((entry) =>
        typeof entry === "string" ? entry : String(entry?.text ?? "")
      );

      if (out.length !== batch.length) {
        throw new Error(
          `LibreTranslate returned ${out.length} results for ${batch.length} inputs`
        );
      }

      return out;
    } catch (error) {
      lastError = error;
      // Non-retryable (abort par bhi retry karte hain — network hiccup ho
      // sakta hai), lekin MAX_RETRIES ke baad give up.
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("LibreTranslate request failed");
}

/**
 * Ek hi call me kai targets translate karo (locale wise).
 * @returns {Promise<Record<string,string[]|null>>} target -> texts
 */
async function translateBatchMultiTarget(texts, targets = TARGET_LOCALES) {
  const batch = texts.map((t) => String(t ?? "").trim()).filter(Boolean);
  const result = {};

  for (const target of targets) {
    result[target] = await translateBatch(batch, target);
  }

  return result;
}

/**
 * Instance par `ur` model installed hai ya nahi — backfill script ke preflight
 * ke liye. `{ ok, targets, error }`
 */
async function checkAvailability() {
  if (!isEnabled()) {
    return { ok: false, targets: [], error: "LIBRETRANSLATE_URL is not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = API_KEY
      ? `${API_URL}/languages?api_key=${encodeURIComponent(API_KEY)}`
      : `${API_URL}/languages`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return { ok: false, targets: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const languages = Array.isArray(data) ? data : [];
    const byCode = new Map(languages.map((l) => [String(l.code).toLowerCase(), l]));
    const english = byCode.get(SOURCE_LANG);
    const availableTargets = new Set(
      Array.isArray(english?.targets) ? english.targets : languages.map((l) => l.code)
    );

    // Har CONFIGURED target check karo — sirf `ur` nahi. Pehle yahan sirf Urdu
    // dekha jaata tha, to `ur,ar` me se Arabic missing hone par bhi check "OK"
    // aa jata tha aur backfill chup-chaap fail ho jata tha.
    const missing = TARGET_LOCALES.filter((locale) => !availableTargets.has(locale));

    if (missing.length) {
      return {
        ok: false,
        targets: [...availableTargets],
        error:
          `${SOURCE_LANG} → ${missing.join(", ")} model installed nahi hai ` +
          `(installed: ${[...availableTargets].join(", ") || "none"}). ` +
          "Bridge chalao: `py backend/scripts/argosTranslateServer.py` " +
          "(models `argospm install translate-ur` / `translate-ar` se install hote hain).",
      };
    }

    return {
      ok: true,
      targets: [...availableTargets],
      error: null,
    };
  } catch (error) {
    return { ok: false, targets: [], error: error?.message || "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  SOURCE_LANG,
  TARGET_LOCALES,
  BATCH_SIZE,
  isEnabled,
  translateBatch,
  translateBatchMultiTarget,
  checkAvailability,
};
