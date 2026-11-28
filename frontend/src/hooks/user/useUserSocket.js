"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { attachSocketAuthSync } from "@/lib/socketAuthSync";
import { getBackendOrigin } from "@/lib/tenantHost";

/* ==========================================================
   USER SOCKET — storefront ke liye.
   ------------------------------------------------------------
   Admin ke liye `hooks/admin/useAdminSocket.js` hai.

   URL + options yahan env se aati hain — koi host/IP/port hard-coded
   nahi. Ye wahi config hai jo `hooks/admin/useAdminSocket.js` me hai;
   dono files alag rakhne ka faisla aapne kiya tha (extra config file
   nahi chahiye thi), is liye ye chhoti config block dono me copy hai.
   ========================================================== */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Client par socket URL — backend origin, PAGE ke hostname par aligned.
 *
 * Auth cookie `httpOnly` + `sameSite=lax` hai — socket ka host page ke host
 * se alag ho to cookie nahi jaati aur socket "guest" reh jata hai. Isi liye
 * alistore.192.168.88.35.nip.io:3000 → alistore.192.168.88.35.nip.io:5000.
 * Logic: src/lib/tenantHost.js → getBackendOrigin
 */
const getSocketUrl = () => getBackendOrigin();

const SOCKET_OPTIONS = {
  withCredentials: true,
  auth: { aud: "user" }, // backend isi session ka cookie dekhta hai (a_at / u_at)
  transports: (process.env.NEXT_PUBLIC_SOCKET_TRANSPORTS || "websocket,polling")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
  reconnection: true,
  reconnectionAttempts: num(process.env.NEXT_PUBLIC_SOCKET_RECONNECT_ATTEMPTS, 5),
  reconnectionDelay: num(process.env.NEXT_PUBLIC_SOCKET_RECONNECT_DELAY, 1500),
  reconnectionDelayMax: num(process.env.NEXT_PUBLIC_SOCKET_RECONNECT_DELAY_MAX, 4000),
  timeout: num(process.env.NEXT_PUBLIC_SOCKET_TIMEOUT, 15000),
};

/* ==========================================================
   CONNECTION (singleton)
   ========================================================== */
let userSocket = null;

/**
 * Socket ko poora phenk do (sirf tab jab wakai stale/dead ho).
 * ⚠️ Explicit `removeAllListeners()` hai, aur ye sirf replace karte waqt chalta hai.
 */
function disposeSocket() {
  if (!userSocket) return;
  try {
    userSocket.removeAllListeners();
  } catch {
    // ignore
  }
  try {
    userSocket.disconnect();
  } catch {
    // ignore
  }
  userSocket = null;
}

/**
 * Get or create the user socket connection.
 * ✅ IMMEDIATE CONNECT — Storefront ke liye realtime zaroori hai,
 * is liye idle-connect NAHI — transport seedha khulta hai.
 * Socket object foran banta hai (listeners attach hote hain, koi event miss nahi hota).
 */
export function getUserSocket() {
  // `.active` = connected YA connecting.
  if (userSocket && userSocket.active) return userSocket;

  // Sach me stale/dead socket → replace
  if (userSocket) disposeSocket();

  const socketUrl = getSocketUrl();
  if (!socketUrl) return null;

  try {
    userSocket = io(socketUrl, SOCKET_OPTIONS);
  } catch {
    // Socket init fail par bhi console spam na ho
    return null;
  }

  userSocket.on("connect", () => {});
  userSocket.on("disconnect", () => {});
  userSocket.on("connect_error", () => {
    // Silent — reconnection waise hi chalegi
  });
  attachSocketAuthSync(userSocket, "user");

  return userSocket;
}

export function reconnectUserSocket() {
  disposeSocket();
  return getUserSocket();
}

export function useUserSocket({ enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled) {
      socketRef.current = null;
      setConnected(false);
      return () => {
        isMounted.current = false;
      };
    }

    const s = getUserSocket();

    if (!s) {
      setConnected(false);
      return () => {};
    }

    socketRef.current = s;
    setConnected(s.connected);

    const onConnect = () => {
      if (isMounted.current) setConnected(true);
    };
    const onDisconnect = () => {
      if (isMounted.current) setConnected(false);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    if (s.connected) setConnected(true);

    return () => {
      isMounted.current = false;
      try {
        s.off("connect", onConnect);
        s.off("disconnect", onDisconnect);
      } catch {
        // ignore
      }
    };
  }, [enabled]);

  return { socket: enabled ? socketRef.current : null, isConnected: connected };
}
