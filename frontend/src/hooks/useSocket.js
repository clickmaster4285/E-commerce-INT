"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

let globalSocket = null;

function getSocket() {
  if (globalSocket && globalSocket.connected) return globalSocket;

  // ✅ FIXED: 5000 (backend) not 3000 (frontend)
  const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ;

  console.log("🔌 Creating socket connection to:", SOCKET_URL);

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
    console.log("✅ Socket Connected:", globalSocket.id);
  });

  globalSocket.on("disconnect", (reason) => {
    console.log("❌ Socket Disconnected:", reason);
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