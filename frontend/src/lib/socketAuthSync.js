// ==========================================================
// SOCKET AUTH SYNC — access token refresh ke baad socket dobara authenticate
// ----------------------------------------------------------
// Socket handshake sirf access cookie (a_at / u_at) dekhta hai; refresh cookie
// ka path sirf REST refresh route hai. Is liye:
//   1) REST interceptor refresh kare → "auth-refreshed" event → connected
//      socket reconnect (naya handshake, naya token).
//   2) Socket expired token ke saath connect ho (guest) → backend
//      "auth:refresh-needed" bhejta hai → yahan refresh + reconnect.
// Har socket par sirf ek baar attach hota hai.
// ==========================================================

import axiosInstance, { userHttp } from "@/apis/axiosInstance";

const REFRESH = {
  admin: { http: axiosInstance, url: "/users/admin/refresh-token" },
  user: { http: userHttp, url: "/users/refresh-token" },
};
const RETRY_GAP_MS = 30 * 1000; // refresh fail ho to loop na bane

export function attachSocketAuthSync(socket, aud) {
  if (!socket || typeof window === "undefined" || socket.__authSyncAttached || !REFRESH[aud]) return socket;
  socket.__authSyncAttached = true;
  let lastAttempt = 0;

  const reconnect = () => {
    // Idle socket (abhi connect nahi hua) apne waqt par naye cookie ke saath khud connect hoga
    if (!socket.connected) return;
    socket.disconnect();
    socket.connect();
  };

  window.addEventListener("auth-refreshed", (event) => {
    if (event?.detail?.mode === aud) reconnect();
  });

  socket.on("auth:refresh-needed", async (payload) => {
    if (payload?.aud && payload.aud !== aud) return;
    if (Date.now() - lastAttempt < RETRY_GAP_MS) return;
    lastAttempt = Date.now();
    try {
      const { http, url } = REFRESH[aud];
      await http.post(url, undefined, { timeout: 15000 });
      reconnect();
    } catch {
      // Session sach me khatam — REST interceptor login par bhej dega
    }
  });

  return socket;
}
