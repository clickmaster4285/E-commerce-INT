// ==========================================
// 📝 LOGGER — pino (optimizeplan.md §7.1)
// ------------------------------------------
// Pehle ye no-op tha: 164 `log.*` calls (har catch ka log.error bhi) kuch print
// nahi karte the → production errors bilkul invisible.
//
// Interface wahi hai (`log.error("msg:", err.message)` jaisi purani calls bina
// badle chalti hain). Level:
//   LOG_LEVEL env (trace|debug|info|warn|error|fatal|silent) agar set ho,
//   warna production → "info", development → "warn" (terminal khamosh rahe,
//   sirf warnings/errors), test → "silent".
// Development me pino-pretty (devDependency) ho to readable output, warna JSON.
// Production me hamesha JSON (log collector ke liye).
// ==========================================

const pino = require("pino");

const env = String(process.env.NODE_ENV || "development").toLowerCase();
const isTest = env === "test" || process.argv.includes("--test") || Boolean(process.env.NODE_TEST_CONTEXT);
const defaultLevel = isTest ? "silent" : env === "production" ? "info" : "warn";
const level = String(process.env.LOG_LEVEL || defaultLevel).toLowerCase();

let transport;
if (env !== "production" && !isTest) {
  try {
    require.resolve("pino-pretty");
    transport = { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } };
  } catch {
    transport = undefined; // pino-pretty install nahi → plain JSON
  }
}

const base = pino({
  level,
  base: { service: "api" },
  // Kabhi bhi secrets log na hon (headers / body me aa jayein to bhi)
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-internal-proxy-secret']",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
  ...(transport ? { transport } : {}),
});

// Purani calls: log.error("❌ X failed:", err.message) / log.warn("text", obj)
// → pino ko (mergeObject, message) me badlo. Error objects `err` key me jate hain
// (stack ke sath), plain objects merge hote hain, baaki text message ban jata hai.
const toPino = (args) => {
  let merge;
  const text = [];
  for (const arg of args) {
    if (arg instanceof Error) {
      merge = { ...(merge || {}), err: arg };
    } else if (arg && typeof arg === "object") {
      merge = { ...(merge || {}), ...arg };
    } else if (arg !== undefined) {
      text.push(String(arg));
    }
  }
  return [merge, text.join(" ")];
};

const wrap = (method) => (...args) => {
  if (!base.isLevelEnabled(method)) return;
  const [merge, msg] = toPino(args);
  if (merge) base[method](merge, msg);
  else base[method](msg);
};

const log = {
  error: wrap("error"),
  warn: wrap("warn"),
  info: wrap("info"),
  debug: wrap("debug"),
  // pino-http / child loggers ke liye asal pino instance
  pino: base,
  child: (bindings) => base.child(bindings),
};

module.exports = log;
