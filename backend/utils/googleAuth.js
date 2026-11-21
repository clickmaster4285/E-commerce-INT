// ==========================================================
// GOOGLE ID TOKEN VERIFY — admin + customer "Sign in with Google"
// ----------------------------------------------------------
// Token ka payload khud decode karna kaafi NAHI (signature check nahi hota —
// koi bhi { email: "owner@store.com" } likh kar bhej sakta hai). Google ka
// tokeninfo endpoint signature + expiry verify karta hai; phir yahan:
//   aud === GOOGLE_CLIENT_ID · iss Google · exp future · email_verified
// ==========================================================

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

class GoogleTokenError extends Error {
  constructor(message = "Invalid Google token") {
    super(message);
    this.name = "GoogleTokenError";
  }
}

/**
 * @param {string} credential Google ID token (GIS button / One Tap)
 * @param {object} [deps] tests: { fetchImpl, clientId, now }
 * @returns {Promise<{ sub: string, email: string, name: string, picture: string }>}
 */
async function verifyGoogleIdToken(credential, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const clientId = deps.clientId !== undefined ? deps.clientId : process.env.GOOGLE_CLIENT_ID;
  const nowSeconds = Math.floor((deps.now ? deps.now() : Date.now()) / 1000);

  if (!credential || typeof credential !== "string") throw new GoogleTokenError("Google credential missing");
  if (!clientId) throw new GoogleTokenError("Google sign-in is not configured");

  let payload;
  try {
    const res = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) throw new GoogleTokenError();
    payload = await res.json();
  } catch (error) {
    throw error instanceof GoogleTokenError ? error : new GoogleTokenError();
  }

  if (!payload || payload.aud !== clientId) throw new GoogleTokenError();
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new GoogleTokenError();
  if (!(Number(payload.exp) > nowSeconds)) throw new GoogleTokenError("Google token has expired");
  if (!(payload.email_verified === true || payload.email_verified === "true")) {
    throw new GoogleTokenError("Google account email is not verified");
  }
  if (!payload.email) throw new GoogleTokenError("Google account did not return an email");

  return {
    sub: String(payload.sub || ""),
    email: String(payload.email).toLowerCase().trim(),
    name: payload.name || "",
    picture: payload.picture || "",
  };
}

module.exports = { verifyGoogleIdToken, GoogleTokenError };
