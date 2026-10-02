// ==========================================
// 📝 LOGGER — console noise control (logic-zero)
// LOG_LEVEL=error|warn|info|debug (production default: warn)
// - error: hamesha print (asli errors)
// - warn/info/debug: level-gated
// - TokenExpiredError expected event hai → caller log.debug use kare (default quiet)
// ⚠️ KABHI secrets mat bhejo: OTP, password, token, SMTP_PASS.
//    Logger args ko filter NAHI karta — caller zimmedar hai.
// ==========================================

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = () => {
  const raw = String(process.env.LOG_LEVEL || "").toLowerCase().trim();
  if (LEVELS[raw] !== undefined) return LEVELS[raw];
  return process.env.NODE_ENV === "production" ? LEVELS.warn : LEVELS.info;
};

const log = {
  error: (...args) => console.error(...args),
  warn: (...args) => {
    if (currentLevel() >= LEVELS.warn) console.warn(...args);
  },
  info: (...args) => {
    if (currentLevel() >= LEVELS.info) console.log(...args);
  },
  debug: (...args) => {
    if (currentLevel() >= LEVELS.debug) console.log(...args);
  },
};

module.exports = log;
