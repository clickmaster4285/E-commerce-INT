// Guest support-chat token with TTL (§9.1).
// Stored as JSON `{ token, exp }` so old bare-string values still work once rewritten.

export const GUEST_TOKEN_KEY = "support-chat-guest-token";
export const GUEST_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let memoryToken = "";

function emitChanged() {
  try {
    window.dispatchEvent(new Event("support-chat:guest-token"));
  } catch {
    /* ignore */
  }
}

function parseStored(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") return parsed;
  } catch {
    // Legacy: bare token string
    if (typeof raw === "string" && raw.trim()) {
      return { token: raw.trim(), exp: Date.now() + GUEST_TOKEN_TTL_MS };
    }
  }
  return null;
}

export function subscribeGuestToken(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("support-chat:guest-token", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("support-chat:guest-token", callback);
  };
}

export function getGuestToken() {
  if (typeof window === "undefined") return "";
  try {
    const parsed = parseStored(window.localStorage.getItem(GUEST_TOKEN_KEY));
    if (!parsed?.token) return memoryToken || "";
    if (parsed.exp && Date.now() > Number(parsed.exp)) {
      clearGuestToken();
      return "";
    }
    // Rewrite legacy bare strings into TTL envelope
    if (!parsed.exp) {
      setGuestToken(parsed.token);
    }
    return parsed.token;
  } catch {
    return memoryToken || "";
  }
}

export function getGuestTokenServerSnapshot() {
  return "";
}

export function setGuestToken(token, ttlMs = GUEST_TOKEN_TTL_MS) {
  const value = String(token || "").trim();
  if (!value) {
    clearGuestToken();
    return;
  }
  memoryToken = value;
  const payload = JSON.stringify({ token: value, exp: Date.now() + Math.max(60_000, Number(ttlMs) || GUEST_TOKEN_TTL_MS) });
  try {
    window.localStorage.setItem(GUEST_TOKEN_KEY, payload);
  } catch {
    /* private mode — keep memory */
  }
  emitChanged();
}

export function clearGuestToken() {
  memoryToken = "";
  try {
    window.localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  emitChanged();
}
