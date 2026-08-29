"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

let globalSocket = null;

// ✅ DYNAMIC URL — jis host par frontend khula hai, wahi backend (5000) use karo
const getSocketURL = () => {
  // SSR ke liye env fallback
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") 
    );
  }
  // Browser mein — current hostname + backend port 5000
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    `http://${window.location.hostname}:5000`
  );
};

function getSocket() {
  if (globalSocket && globalSocket.connected) return globalSocket;

  const SOCKET_URL = getSocketURL();

  globalSocket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
  });

  globalSocket.on("connect", () => {
  });

  globalSocket.on("disconnect", (reason) => {
  });

  globalSocket.on("connect_error", (err) => {
    console.error("⚠️ Socket Connection Error:", err.message);
  });

  return globalSocket;
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