"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { setStoreInfo } from "@/redux/slices/storeInfoSlice";

import {
  FolderOpen,
  Tag,
  Package,
  LayoutDashboard,
  X,
  Store,
  User,
} from "lucide-react";

const menu = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { name: "Brands", icon: Tag, path: "/admin/brands" },
  { name: "Categories", icon: FolderOpen, path: "/admin/categories" },
  { name: "Products", icon: Package, path: "/admin/products" },
  { name: "Store Info", icon: Store, path: "/admin/store-info" },
  { name: "Profile", icon: User, path: "/admin/profile" },
];

// ✅ GLOBAL singleton socket
let sidebarSocket = null;

function getSidebarSocket() {
  if (sidebarSocket && sidebarSocket.connected) return sidebarSocket;

  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://192.168.88.64:3000";

  sidebarSocket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });

  return sidebarSocket;
}

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();
  const dispatch = useDispatch();

  const storeName = useSelector((state) => state.storeInfo.storeName);
  const primaryColor = useSelector((state) => state.storeInfo.primaryColor);
  const isLoaded = useSelector((state) => state.storeInfo.isLoaded);

  // ✅ Ref to prevent infinite loop - track if WE dispatched
  const isSelfDispatching = useRef(false);

  // ✅ Mobile sidebar band karo route change pe
  useEffect(() => {
    if (onNavigate) onNavigate();
  }, [pathname]);

  // ✅ SOCKET: Store info fetch karo aur Redux update karo
  useEffect(() => {
    const socket = getSidebarSocket();

    const handleStoreData = (data) => {
      if (!data || !data.store_name) return;

      console.log("📥 Sidebar socket → store data:", data.store_name);

      // ✅ Mark ke yeh hum khud dispatch kar rahe hain
      isSelfDispatching.current = true;
      dispatch(setStoreInfo(data));

      // ✅ Reset flag after a tick
      setTimeout(() => {
        isSelfDispatching.current = false;
      }, 100);
    };

    const handleStoreInfo = (response) => {
      if (response?.success && response?.data) {
        handleStoreData(response.data);
      }
    };

    const handleStoreUpdated = (data) => {
      if (data?.store_name) {
        handleStoreData(data);
      }
    };

    const handleConnect = () => {
      console.log("🟢 Sidebar socket connected:", socket.id);
      socket.emit("getStoreInfo");
    };

    if (socket.connected) {
      console.log("🟢 Sidebar socket already connected, fetching...");
      socket.emit("getStoreInfo");
    } else {
      socket.on("connect", handleConnect);
    }

    socket.on("storeInfo", handleStoreInfo);
    socket.on("storeUpdated", handleStoreUpdated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("storeInfo", handleStoreInfo);
      socket.off("storeUpdated", handleStoreUpdated);
    };
  }, [dispatch]);

  // ✅ CUSTOM EVENT: Doosre components se update aaye (but NOT from self)
  useEffect(() => {
    const handleCustomEvent = (e) => {
      // ✅ Agar khud ne dispatch kiya hai toh ignore karo (INFINITE LOOP FIX)
      if (isSelfDispatching.current) return;

      if (e.detail?.store_name) {
        console.log("📥 Sidebar custom event → store data:", e.detail.store_name);
        isSelfDispatching.current = true;
        dispatch(setStoreInfo(e.detail));
        setTimeout(() => {
          isSelfDispatching.current = false;
        }, 100);
      }
    };

    window.addEventListener("storeUpdated", handleCustomEvent);
    return () => window.removeEventListener("storeUpdated", handleCustomEvent);
  }, [dispatch]);

  // ✅ FAILSAFE: 3 second baad agar loaded nahi hai toh dobara fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded) {
        console.log("⚠️ Sidebar failsafe: Re-fetching store info...");
        const socket = getSidebarSocket();
        if (socket.connected) {
          socket.emit("getStoreInfo");
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isLoaded]);

  // ✅ DISPLAY VALUES
  const displayName = storeName || "My Store";
  const displayColor = primaryColor || "#10b981";
  const firstLetter = displayName?.charAt(0)?.toUpperCase() || "S";

  return (
    <aside
      className="
        flex h-screen w-[200px] flex-col
        overflow-hidden
        border-r border-[var(--border-sidebar)]
        bg-[var(--bg-sidebar)]
        text-[var(--text-sidebar)]
        shadow-sm
      "
    >
      {/* ===== HEADER / LOGO ===== */}
      <div
        className="
          flex h-16 shrink-0
          items-center justify-between
          gap-2
          border-b border-[var(--border-sidebar)]
          px-3
        "
      >
        <Link
          href="/admin/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
            style={{ backgroundColor: displayColor }}
          >
            <span className="text-sm font-bold text-white">
              {firstLetter}
            </span>
          </div>

          <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {displayName}
          </span>
        </Link>

        <button
          type="button"
          onClick={onNavigate}
          aria-label="Close sidebar"
          className="
            shrink-0 rounded-md p-1
            text-[var(--text-muted)]
            transition-colors
            hover:bg-[var(--bg-sidebar-hover)]
            hover:text-[var(--text-primary)]
            md:hidden
          "
        >
          <X size={14} />
        </button>
      </div>

      {/* ===== NAVIGATION ===== */}
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-2 py-2"
      >
        <div className="space-y-0.5">
          {menu.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.path ||
              pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`
                  flex h-8 items-center
                  gap-2 rounded-md px-2.5
                  text-xs font-medium
                  transition-colors
                  ${
                    active
                      ? "bg-[var(--bg-sidebar-hover)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
                  }
                `}
              >
                <Icon
                  size={16}
                  className={`shrink-0 ${
                    active
                      ? "text-emerald-500"
                      : "text-[var(--text-muted)]"
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ===== FOOTER ===== */}
      <div className="shrink-0 border-t border-[var(--border-sidebar)] px-3 py-2">
        <p className="text-center text-[10px] text-[var(--text-muted)]">
          Powered by{" "}
          <span className="font-medium text-[var(--text-secondary)]">
            {displayName}
          </span>{" "}
          · v1.0
        </p>
      </div>
    </aside>
  );
}