"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { setStoreInfo } from "@/redux/slices/storeInfoSlice";
import { useQueryClient } from "@tanstack/react-query";

import {
  FolderOpen,
  Tag,
  Package,
  LayoutDashboard,
  X,
  Store,
  User,
  Users,
  Gift,
  Image as ImageIcon,
  Menu, // Hamburger Icon
} from "lucide-react";

// ... [Keep allMenuItems, getSidebarSocket, disconnectSidebarSocket exactly as before] ...
const allMenuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard", permissionKey: null },
    { name: "Brands", icon: Tag, path: "/admin/brands", permissionKey: "brands" },
    { name: "Categories", icon: FolderOpen, path: "/admin/categories", permissionKey: "categories" },
    { name: "Products", icon: Package, path: "/admin/products", permissionKey: "products" },
    { name: "Store Info", icon: Store, path: "/admin/store-info", permissionKey: "store" },
    { name: "Profile", icon: User, path: "/admin/profile", permissionKey: "profile" },
    { name: "Employees", icon: Users, path: "/admin/employees", permissionKey: "employees" },
    { name: "Discounts", icon: Tag, path: "/admin/discounts", permissionKey: "discounts" },
    { name: "Deals", icon: Gift, path: "/admin/deals", permissionKey: "deals" },
    { name: "Banners", icon: ImageIcon, path: "/admin/banners", permissionKey: "banners" },
];

let sidebarSocket = null;

function getSidebarSocket() {
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
  if (sidebarSocket) return sidebarSocket;

  sidebarSocket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    autoConnect: true,
    forceNew: false,
  });

  sidebarSocket.on("connect_error", (error) => console.error("❌ Sidebar socket error:", error?.message));
  sidebarSocket.on("disconnect", (reason) => console.log("🔴 Sidebar socket disconnected:", reason));
  return sidebarSocket;
}

export function disconnectSidebarSocket() {
  if (sidebarSocket) {
    sidebarSocket.removeAllListeners();
    sidebarSocket.disconnect();
    sidebarSocket = null;
  }
}

// ============================================================
// SIDEBAR COMPONENT
// ============================================================

export default function Sidebar({ onNavigate, userData }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const storeName = useSelector((state) => state.storeInfo.storeName);
  const primaryColor = useSelector((state) => state.storeInfo.primaryColor);
  const isLoaded = useSelector((state) => state.storeInfo.isLoaded);
  const isSelfDispatching = useRef(false);

  // Internal state for mobile toggle
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [socketPermissions, setSocketPermissions] = useState(userData?.permissions || {});
  const [socketRole, setSocketRole] = useState(userData?.role || "");
  const [socketProfileLoaded, setSocketProfileLoaded] = useState(Boolean(userData));

  // ... [Keep applyProfile, handleConnect, handleProfileData, handleProfileUpdated, handlePermissionsUpdated exactly as before] ...
  
  const applyProfile = useCallback((response) => {
      if (!response || response.success === false) return;
      const data = response?.data || response?.user || response;
      if (!data) return;
      
      const freshPermissions = { ...(data.permissions || {}) };
      const freshRole = data.role || "";
      
      setSocketPermissions(freshPermissions);
      setSocketRole(freshRole);
      setSocketProfileLoaded(true);

      queryClient.setQueryData(["profile"], (old) => {
          if (!old) return { ...data, permissions: freshPermissions, role: freshRole };
          return { ...old, ...data, permissions: freshPermissions, role: freshRole };
      });
  }, [queryClient]);

  const handleConnect = useCallback(() => {
      const socket = sidebarSocket;
      if (socket && socket.connected) socket.emit("getProfile");
  }, []);

  const handleProfileData = useCallback((response) => applyProfile(response), [applyProfile]);
  const handleProfileUpdated = useCallback((response) => {
      const employee = response?.data || response?.employee || response;
      const profile = employee?.userId && typeof employee.userId === "object"
        ? employee.userId
        : employee;
      const targetUserId = profile?._id;
      if (targetUserId && userData?._id && String(targetUserId) !== String(userData._id)) return;
      if (profile?.permissions) applyProfile({ ...profile, permissions: profile.permissions });
  }, [applyProfile, userData?._id]);

  const handlePermissionsUpdated = useCallback((data) => {
      const permissionData = data?.data || data?.user || data;
      if (!permissionData || !permissionData.permissions) {
          if (sidebarSocket?.connected) sidebarSocket.emit("getProfile");
          return;
      }
      const freshPermissions = { ...permissionData.permissions };
      setSocketPermissions(freshPermissions);
      if (permissionData.role !== undefined) setSocketRole(permissionData.role || "");
      setSocketProfileLoaded(true);

      queryClient.setQueryData(["profile"], (old) => {
          if (!old) return { permissions: freshPermissions, role: data.role || "" };
          return { ...old, permissions: freshPermissions, role: permissionData.role ?? old.role };
      });

      // Force redirect if current page permission is revoked
      const role = String(permissionData.role || socketRole).toLowerCase();
      if (role !== "admin") {
          const currentItem = allMenuItems.find((item) => item.path === pathname && item.permissionKey);
          if (currentItem && freshPermissions[currentItem.permissionKey] !== true) {
              router.replace("/admin/access-denied");
              return;
          }
      }

      setTimeout(() => {
          if (sidebarSocket?.connected) sidebarSocket.emit("getProfile");
      }, 150);
  }, [queryClient, pathname, router, socketRole]);

  useEffect(() => {
      const socket = getSidebarSocket();
      socket.on("connect", handleConnect);
      socket.on("profileData", handleProfileData);
      socket.on("profileUpdated", handleProfileUpdated);
      socket.on("permissionsUpdated", handlePermissionsUpdated);
      socket.on("authPermissionsUpdated", handlePermissionsUpdated);

      if (socket.connected) socket.emit("getProfile");

      return () => {
          socket.off("connect", handleConnect);
          socket.off("profileData", handleProfileData);
          socket.off("profileUpdated", handleProfileUpdated);
          socket.off("permissionsUpdated", handlePermissionsUpdated);
          socket.off("authPermissionsUpdated", handlePermissionsUpdated);
      };
  }, [handleConnect, handleProfileData, handleProfileUpdated, handlePermissionsUpdated]);

  const visibleMenuItems = useMemo(() => {
      const permissions = socketProfileLoaded ? socketPermissions : {};
      const role = socketProfileLoaded ? socketRole : "";
      const normalizedRole = String(role).toLowerCase();

      if (normalizedRole === "admin") return allMenuItems;

      return allMenuItems.filter((item) => {
          if (!item.permissionKey) return true;
          return permissions[item.permissionKey] === true;
      });
  }, [socketPermissions, socketRole, socketProfileLoaded]);

  // Close mobile menu when route changes
  useEffect(() => {
      setIsMobileOpen(false);
      if (onNavigate) onNavigate();
  }, [pathname, onNavigate]);

  // ... [Keep Store Socket effects exactly as before] ...
  useEffect(() => {
      const socket = getSidebarSocket();
      const handleStoreData = (data) => {
          if (!data || !data.store_name) return;
          isSelfDispatching.current = true;
          dispatch(setStoreInfo(data));
          setTimeout(() => { isSelfDispatching.current = false; }, 100);
      };
      const handleStoreInfo = (response) => { if (response?.success && response?.data) handleStoreData(response.data); };
      const handleStoreUpdated = (data) => { if (data?.store_name) handleStoreData(data); };
      const handleConnectStore = () => { socket.emit("getStoreInfo"); };

      socket.on("storeInfo", handleStoreInfo);
      socket.on("storeUpdated", handleStoreUpdated);
      socket.on("connect", handleConnectStore);
      if (socket.connected) socket.emit("getStoreInfo");

      return () => {
          socket.off("storeInfo", handleStoreInfo);
          socket.off("storeUpdated", handleStoreUpdated);
          socket.off("connect", handleConnectStore);
      };
  }, [dispatch]);

  useEffect(() => {
      const handleCustomEvent = (event) => {
          if (isSelfDispatching.current) return;
          if (event.detail?.store_name) {
              isSelfDispatching.current = true;
              dispatch(setStoreInfo(event.detail));
              setTimeout(() => { isSelfDispatching.current = false; }, 100);
          }
      };
      window.addEventListener("storeUpdated", handleCustomEvent);
      return () => window.removeEventListener("storeUpdated", handleCustomEvent);
  }, [dispatch]);

  useEffect(() => {
      const timer = setTimeout(() => {
          if (!isLoaded) {
              const socket = getSidebarSocket();
              if (socket.connected) socket.emit("getStoreInfo");
          }
      }, 3000);
      return () => clearTimeout(timer);
  }, [isLoaded]);

  const displayName = storeName || "My Store";
  const displayColor = primaryColor || "var(--accent)";
  const firstLetter = displayName?.charAt(0)?.toUpperCase() || "S";

  // Helper to close mobile sidebar
  const handleCloseMobile = useCallback(() => {
      setIsMobileOpen(false);
      if (onNavigate) onNavigate();
  }, [onNavigate]);

  return (
    <>
      {/* 
         MOBILE TOGGLE BUTTON 
         Conditionally rendered: Only shows when sidebar is CLOSED (!isMobileOpen)
      */}
      {!isMobileOpen && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open sidebar"
          className="
            fixed top-4 left-4 z-[60]
            flex h-10 w-10 items-center justify-center
            rounded-lg bg-[var(--bg-sidebar)] 
            text-[var(--text-primary)] shadow-md
            transition-all duration-300 hover:bg-[var(--bg-sidebar-hover)]
            md:hidden
          "
        >
          <Menu size={20} />
        </button>
      )}

      {/* MOBILE OVERLAY BACKDROP */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={handleCloseMobile}
        />
      )}

      {/* 
         SIDEBAR CONTAINER 
         - Mobile: Fixed, slides in/out with translate-x
         - Desktop: Relative, always visible
      */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-[200px] flex-col
          overflow-hidden border-r border-[var(--border-sidebar)]
          bg-[var(--bg-sidebar)] text-[var(--text-sidebar)]
          shadow-xl transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* HEADER */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-sidebar)] px-3">
          <Link
            href="/admin/dashboard"
            onClick={handleCloseMobile}
            className="flex min-w-0 items-center gap-2"
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
              style={{ backgroundColor: displayColor }}
            >
              <span className="text-sm font-bold text-white">{firstLetter}</span>
            </div>
            <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              {displayName}
            </span>
          </Link>

          {/* CLOSE BUTTON (Mobile Only) */}
          <button
            type="button"
            onClick={handleCloseMobile}
            aria-label="Close sidebar"
            className="shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)] md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVIGATION */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-2">
          <div className="space-y-0.5">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.path ||
                pathname.startsWith(`${item.path}/`) ||
                (item.path === "/admin/employees" && pathname === "/admin/employee");

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={handleCloseMobile}
                  aria-current={active ? "page" : undefined}
                  className={`
                    flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors
                    ${
                      active
                        ? "bg-[var(--bg-sidebar-active)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
                    }
                  `}
                >
                  <Icon
                    size={16}
                    className={`shrink-0 ${active ? "text-white" : "text-[var(--text-muted)]"}`}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-[var(--border-sidebar)] px-3 py-2">
          <p className="text-center text-[10px] text-[var(--text-muted)]">
            Powered by <span className="font-medium text-[var(--text-secondary)]">{displayName}</span> · v1.0
          </p>
        </div>
      </aside>
    </>
  );
}