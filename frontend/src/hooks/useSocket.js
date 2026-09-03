"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import Cookies from "js-cookie";

let globalSocket = null;
let errorLogged = false; // ✅ Spam rokne ke liye

const getSocketURL = () => {
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "")
    );
  }
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    `http://${window.location.hostname}:5000`
  );
};

function getSocket() {
  // ✅ Agar socket already connected hai, wahi use karo
  if (globalSocket && globalSocket.connected) return globalSocket;

  const SOCKET_URL = getSocketURL();

  globalSocket = io(SOCKET_URL, {
    withCredentials: true, // ✅ Cookies automatically bhejega
    transports: ["websocket", "polling"], // ✅ WebSocket pehle (faster)
    reconnection: true,
    reconnectionAttempts: 10, // ✅ Infinite ki jagah 10 try (spam kam)
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    autoConnect: true,
  });

  globalSocket.on("connect", () => {
    errorLogged = false; // ✅ Error flag reset
    console.log("✅ Socket connected successfully");
  });

  globalSocket.on("disconnect", (reason) => {
    if (reason !== "io client disconnect") {
      console.warn("⚠️ Socket disconnected:", reason);
    }
  });

  globalSocket.on("connect_error", (err) => {
    // ✅ Sirf ek baar log karo — spam mat karo
    if (!errorLogged) {
      console.warn(
        "⚠️ Socket connection failed. Backend may be offline.",
        { url: SOCKET_URL, message: err.message }
      );
      errorLogged = true;
    }
  });

  return globalSocket;
}

// ✅ Login ke baad socket refresh karne ke liye
export function reconnectSocket() {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
  return getSocket();
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    setConnected(s.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    if (s.connected) setConnected(true);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: socketRef.current, isConnected: connected };
}

export { getSocket };