// ==========================================================
// ENV CONFIG (optimizeplan.md §5.3 / §5.5) — zod se process.env validate
// ----------------------------------------------------------
// `loadEnv()` sirf server.js startup par chalta hai (app.js / tests require
// karte waqt nahi) taake supertest / node --test par koi side effect na ho.
// - Hamesha: PORT / MONGO_URI required aur format-checked. API_PREFIX code me hardcoded (/api).
// - Production: JWT secrets (6 alag), INTERNAL_PROXY_SECRET, ROOT_DOMAIN wagairah bhi required.
// - Dev/test: baaki sab optional (existing code apne checks khud karta hai).
// ==========================================================
const { z } = require("zod");

const nonEmpty = (name) => z.string({ error: `${name} is required` }).trim().min(1, `${name} is required`);
const optionalStr = z.string().trim().optional();

// "" (blank .env line) ko undefined samjho taake optional vars fail na hon
const blankToUndef = (schema) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  PORT: nonEmpty("PORT").pipe(z.coerce.number().int("PORT must be an integer").min(1, "PORT must be 1-65535").max(65535, "PORT must be 1-65535")),
  HOST: optionalStr,
  MONGO_URI: nonEmpty("MONGO_URI").refine((v) => /^mongodb(\+srv)?:\/\//.test(v), "MONGO_URI must start with mongodb:// or mongodb+srv://"),
  REDIS_URL: blankToUndef(z.string().regex(/^rediss?:\/\//, "REDIS_URL must start with redis:// or rediss://").optional()),
  BCRYPT_SALT_ROUNDS: blankToUndef(z.coerce.number().int().min(4).max(15).optional()),
  JWT_SECRET: optionalStr,
  JWT_USER_ACCESS_SECRET: optionalStr,
  JWT_USER_REFRESH_SECRET: optionalStr,
  JWT_ADMIN_ACCESS_SECRET: optionalStr,
  JWT_ADMIN_REFRESH_SECRET: optionalStr,
  JWT_SA_ACCESS_SECRET: optionalStr,
  JWT_SA_REFRESH_SECRET: optionalStr,
  INTERNAL_PROXY_SECRET: optionalStr,
  ROOT_DOMAIN: optionalStr,
  CLIENT_URL: optionalStr,
}).passthrough();

const JWT_KEYS = [
  "JWT_USER_ACCESS_SECRET", "JWT_USER_REFRESH_SECRET",
  "JWT_ADMIN_ACCESS_SECRET", "JWT_ADMIN_REFRESH_SECRET",
  "JWT_SA_ACCESS_SECRET", "JWT_SA_REFRESH_SECRET",
];
const PROD_REQUIRED = [...JWT_KEYS, "JWT_SECRET", "INTERNAL_PROXY_SECRET", "ROOT_DOMAIN", "CLIENT_URL"];

/**
 * @param {object} [env=process.env]
 * @returns {{ ok: boolean, errors: string[], data: object|null }}
 */
function validateEnv(env = process.env) {
  const errors = [];
  const parsed = baseSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  const isProd = String(env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd) {
    for (const key of PROD_REQUIRED) {
      if (!String(env[key] || "").trim()) errors.push(`${key}: required in production`);
    }
    // 6 JWT secrets alag-alag hon (dev wali / copy-paste nahi)
    const vals = JWT_KEYS.map((k) => String(env[k] || "").trim()).filter(Boolean);
    if (new Set(vals).size !== vals.length) errors.push("JWT_*_SECRET values must all be different in production");
  }
  return { ok: errors.length === 0, errors, data: parsed.success ? parsed.data : null };
}

/** Invalid ho to saaf message ke saath Error throw (server.js process exit karega). */
function loadEnv(env = process.env) {
  const { ok, errors, data } = validateEnv(env);
  if (!ok) {
    const err = new Error(`Invalid environment configuration:\n - ${errors.join("\n - ")}`);
    err.code = "ENV_INVALID";
    err.issues = errors;
    throw err;
  }
  return data;
}

module.exports = { loadEnv, validateEnv, baseSchema };
