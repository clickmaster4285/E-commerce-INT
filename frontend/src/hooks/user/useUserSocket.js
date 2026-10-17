"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

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

/** Backend ka origin — sirf env se, koi guess/fallback host nahi. */
const getSocketOrigin = () => {
  const explicit = (process.env.NEXT_PUBLIC_SOCKET_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const serverUrl = (process.env.NEXT_PUBLIC_SERVERURL || "").trim();
  if (serverUrl) return serverUrl.replace(/\/+$/, "").replace(/\/api\/?$/, "");

  return "";
};

/**
 * Client par socket URL.
 *
 * Auth cookie `httpOnly` + `sameSite=lax` hai — agar socket ka host page
 * ke host se alag ho to cookie nahi jaati, socket "guest" reh jata hai aur
 * role-gated events `Unauthorized` dete hain. Is liye env URL tabhi use
 * hoti hai jab uska hostname page ke hostname se match kare.
 */
const getSocketUrl = () => {
  const origin = getSocketOrigin();

  // SSR — sirf env, koi hard-coded fallback nahi
  if (typeof window === "undefined") return origin || null;

  if (origin) {
    try {
      if (new URL(origin).hostname === window.location.hostname) return origin;
    } catch {
      // env URL malformed → neeche dynamic path
    }
  }

  const port = process.env.NEXT_PUBLIC_SERVER_PORT;
  if (!port) return null;

  // Protocol page wala — hardcoded `http://` HTTPS par mixed-content block karta hai
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

const SOCKET_OPTIONS = {
  withCredentials: true,
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

  return userSocket;
}

export function reconnectUserSocket() {
  disposeSocket();
  return getUserSocket();
}

export function useUserSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
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
  }, []);

  return { socket: socketRef.current, isConnected: connected };
}
