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
    withCredentials: true,       // ✅ Cookies bhejne ke liye zaroori
    transports: ["websocket", "polling"], // ✅ WebSocket pehle try karo
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
    timeout: 20000,
  });

  globalSocket.on("connect", () => {
    console.log("✅ Socket connected:", globalSocket.id);
  });

  globalSocket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  globalSocket.on("connect_error", (err) => {
    console.error("⚠️ Socket Connection Error:", err.message);
    console.error("Backend URL:", SOCKET_URL);
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