// ==========================================================
// AUTH SESSION MARKER — "kya is browser me login hai?"
// ----------------------------------------------------------
// Tokens (u_at / a_at / *_rt) httpOnly hain, JS unhe nahi dekh sakta. Backend
// (utils/tokens.js) saath me ek JS-readable marker set karta hai: u_sess=1 /
// a_sess=1 (koi token nahi). Cookies port nahi dekhti → backend (:5000) ka
// cookie isi hostname ke page (:3000) par document.cookie me milta hai.
// Logout / session khatam → backend marker hata deta hai.
// ==========================================================

const MARKERS = { user: "u_sess", admin: "a_sess", superadmin: "sa_sess" };

export function hasAuthSession(aud) {
  // Server render par document nahi — wahan block nahi karte
  if (typeof document === "undefined") return true;
  const name = MARKERS[aud];
  if (!name) return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${name}=`));
}
