"use client";

import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ;
console.log("SOCKET_URL =", SOCKET_URL);
export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // ✅ Token lene ka function (har baar fresh)
  const getToken = useCallback(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }, []);

  useEffect(() => {
    const token = getToken();
console.log("Socket Token:", token);
    // ⚠️ Agar token nahi hai toh connect mat karo
    if (!token) {
      console.warn("⚠️ No token found. Socket not connected.");
      return;
    }

    const newSocket = io(SOCKET_URL, {
transports: ["websocket", "polling"],
      auth: {
        token: token, // ✅ Token yahan pass ho raha hai
      },
      autoConnect: false, // ✅ Pehle manual connect karein
    });

    // Connect event handlers
    newSocket.on("connect", () => {
      console.log("🟢 Socket Connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("🔴 Socket Disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
  console.log("❌ Full Socket Error:", err);
  console.log("❌ Error Message:", err.message);
  setIsConnected(false);
});

    // ✅ Ab manually connect karein (token already set hai)
    newSocket.connect();
    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, [getToken]); // ✅ getToken change hone par re-run

  // ✅ Save/Login ke baad dobara connect karne ka function
  const reconnect = useCallback(() => {
    if (socket) {
      socket.auth.token = getToken(); // 🔄 Fresh token update
      socket.connect();
    }
  }, [socket, getToken]);

  return { socket, isConnected, reconnect };
};