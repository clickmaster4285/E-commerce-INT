"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { getBackendOrigin } from "@/lib/tenantHost";

let globalSocket = null;
let hasLoggedError = false; // ✅ Spam rokne ke liye
let connectScheduled = false; // ✅ idle-connect ek hi baar schedule ho

const getSocketURL = () => {
  // SSR + client dono: backend origin, client par PAGE ke hostname par aligned
  // (cookies httpOnly + sameSite=lax — same hostname par hi jaati hain).
  // alistore.192.168.88.35.nip.io:3000 → alistore.192.168.88.35.nip.io:5000
  return getBackendOrigin();
};

function cleanupOldSocket() {
  if (globalSocket) {
    try {
      globalSocket.off("connect");
      globalSocket.off("disconnect");
      globalSocket.off("connect_error");
      if (globalSocket.connected) {
        globalSocket.disconnect();
      }
    } catch (e) {
      // ignore cleanup errors
    }
    globalSocket = null;
  }
  connectScheduled = false;
}

/* ✅ IDLE-CONNECT — TCP/TLS handshake critical path (LCP/TBT) se bahar.
   Socket object foran banta hai (listeners attach hote hain, koi event
   miss nahi hota — sirf transport idle/interaction/2s-timeout par khulta
   hai). URL, options, events, singleton — sab same. */
function scheduleConnect(socket) {
  if (!socket || socket.connected || connectScheduled) return;
  connectScheduled = true;
  const fire = () => {
    if (!connectScheduled) return;
    connectScheduled = false;
    try {
      if (globalSocket === socket && !socket.connected) socket.connect();
    } catch (e) {
      // ignore — reconnection waise hi chalegi
    }
  };
  const kick = () => {
    try {
      if (typeof window !== "undefined" && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
    } catch (e) {}
    window.removeEventListener("pointerdown", kick);
    window.removeEventListener("keydown", kick);
    window.removeEventListener("touchstart", kick);
    fire();
  };
  let idleId = null;
  try {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => fire(), { timeout: 2000 });
      window.addEventListener("pointerdown", kick, { once: true, passive: true });
      window.addEventListener("keydown", kick, { once: true });
      window.addEventListener("touchstart", kick, { once: true, passive: true });
      return;
    }
  } catch (e) {
    // fallback neeche
  }
  fire();
}

function getSocket() {
  // ✅ Agar socket pehle se hai (connected ya idle-pending) toh wahi return karo
  if (globalSocket && (globalSocket.connected || connectScheduled)) return globalSocket;

  // ✅ Agar pehle disconnected ya error state mein tha toh purge karo
  if (globalSocket) {
    cleanupOldSocket();
  }

  const SOCKET_URL = getSocketURL();
  if (!SOCKET_URL) {
    // ✅ Silent — console error/warning show na ho
    return null;
  }

  try {
    globalSocket = io(SOCKET_URL, {
      withCredentials: true,
      auth: { aud: "admin" }, // backend isi session ka cookie dekhta hai (a_at / u_at)
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 3,        // ✅ Zyada attempts se spam kam
      reconnectionDelay: 1500,
      reconnectionDelayMax: 4000,
      autoConnect: false, // ✅ idle-connect: transport idle/interaction par khulta hai
      timeout: 15000,
    });
    scheduleConnect(globalSocket);
  } catch (err) {
    // ✅ Silent — socket init fail par bhi console error show na ho
    return null;
  }

  globalSocket.on("connect", () => {
    hasLoggedError = false;
  });

  globalSocket.on("disconnect", (reason) => {
    // ✅ Silent — disconnect info console par show na ho
  });

  globalSocket.on("connect_error", (err) => {
    // ✅ Silent — error console par show na ho, reconnection waise hi chalega
    hasLoggedError = true;
  });

  return globalSocket;
}

export function reconnectSocket() {
  cleanupOldSocket();
  hasLoggedError = false;
  return getSocket();
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const s = getSocket();

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
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return { socket: socketRef.current, isConnected: connected };
}

export { getSocket };
