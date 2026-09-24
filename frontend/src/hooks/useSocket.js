"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

let globalSocket = null;
let hasLoggedError = false; // ✅ Spam rokne ke liye

const getSocketURL = () => {
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ||
      null
    );
  }
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    `http://${window.location.hostname}:${process.env.NEXT_PUBLIC_SERVER_PORT || 5000}`
  );
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
}

function getSocket() {
  // ✅ Agar socket pehle se connected hai toh wahi return karo
  if (globalSocket && globalSocket.connected) return globalSocket;

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
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 3,        // ✅ Zyada attempts se spam kam
      reconnectionDelay: 1500,
      reconnectionDelayMax: 4000,
      autoConnect: true,
      timeout: 15000,
    });
  } catch (err) {
    // ✅ Silent — socket init fail par bhi console error show na ho
    return null;
  }

  globalSocket.on("connect", () => {
    console.log("✅ Socket connected:", globalSocket?.id || "unknown");
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
