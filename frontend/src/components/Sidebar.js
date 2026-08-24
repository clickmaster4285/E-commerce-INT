"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { setStoreInfo } from "@/redux/slices/storeInfoSlice";
import { useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Tag, Package, LayoutDashboard, X, Store, User, Users, Gift, Image as ImageIcon, Menu } from "lucide-react";

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
  // ✅ Socket DIRECT IP se connect karega (Rewrites sirf HTTP ke liye hain)
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://192.168.88.64:5000";
  if (sidebarSocket) return sidebarSocket;
  
  sidebarSocket = io(SOCKET_URL, { 
    withCredentials: true, 
    transports: ["websocket", "polling"], 
    reconnection: true 
  });
  return sidebarSocket;
}

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  
  const storeName = useSelector((state) => state.storeInfo.storeName);
  const primaryColor = useSelector((state) => state.storeInfo.primaryColor);
  const isLoaded = useSelector((state) => state.storeInfo.isLoaded);
  const isSelfDispatching = useRef(false);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [socketPermissions, setSocketPermissions] = useState({});
  const [socketRole, setSocketRole] = useState("");
  const [socketProfileLoaded, setSocketProfileLoaded] = useState(false);

  const applyProfile = useCallback((response) => {
    if (!response || response.success === false) return;
    const data = response?.data || response?.user || response;
    if (!data) return;
    
    const freshPermissions = { ...(data.permissions || {}) };
    const freshRole = data.role || "";
    
    setSocketPermissions(freshPermissions);
    setSocketRole(freshRole);
    setSocketProfileLoaded(true);

    queryClient.setQueryData(["profile"], (old) => ({
      ...(old || {}), ...data, permissions: freshPermissions, role: freshRole
    }));
  }, [queryClient]);

  const handleConnect = useCallback(() => {
    if (sidebarSocket?.connected) sidebarSocket.emit("getProfile");
  }, []);

  // ✅ REAL-TIME PERMISSION SYNC + REDIRECT GUARD
  const handlePermissionsUpdated = useCallback((data) => {
    if (!data?.permissions) return;
    
    setSocketPermissions(data.permissions);
    if (data.role !== undefined) setSocketRole(data.role || "");
    setSocketProfileLoaded(true);

    queryClient.setQueryData(["profile"], (old) => ({
      ...(old || {}), permissions: data.permissions, role: data.role ?? old?.role
    }));

    // ✅ FORCED REDIRECT: Agar current page restricted hai to dashboard bhejo
    const currentPath = window.location.pathname;
    const restrictedItem = allMenuItems.find(item => item.path === currentPath && item.permissionKey);
    
    if (restrictedItem && 
        data.permissions[restrictedItem.permissionKey] !== true && 
        String(data.role).toLowerCase() !== 'admin') {
        console.log("🚫 Access revoked! Redirecting to dashboard...");
        router.replace("/admin/dashboard");
    }
  }, [queryClient, router]);

  // ✅ STABLE SOCKET SETUP
  useEffect(() => {
    const socket = getSidebarSocket();
    socket.on("connect", handleConnect);
    socket.on("profileData", applyProfile);
    socket.on("profileUpdated", applyProfile);
    socket.on("permissionsUpdated", handlePermissionsUpdated);

    if (socket.connected) socket.emit("getProfile");
    return () => {
      socket.off("connect", handleConnect);
      socket.off("profileData", applyProfile);
      socket.off("profileUpdated", applyProfile);
      socket.off("permissionsUpdated", handlePermissionsUpdated);
    };
  }, []); 

  // ✅ PERMISSION FILTER LOGIC
  const visibleMenuItems = useMemo(() => {
    if (!socketProfileLoaded) return []; 
    const role = String(socketRole).toLowerCase();
    if (role === "admin") return allMenuItems;
    return allMenuItems.filter((item) => !item.permissionKey || socketPermissions[item.permissionKey] === true);
  }, [socketPermissions, socketRole, socketProfileLoaded]);

  useEffect(() => { setIsMobileOpen(false); if(onNavigate) onNavigate(); }, [pathname, onNavigate]);

  // ... [Keep existing Store Socket effects exactly as they were] ...
  useEffect(() => {
    const socket = getSidebarSocket();
    const handleStoreData = (data) => {
        if (!data?.store_name) return;
        isSelfDispatching.current = true;
        dispatch(setStoreInfo(data));
        setTimeout(() => { isSelfDispatching.current = false; }, 100);
    };
    const handleStoreInfo = (res) => { if (res?.success && res?.data) handleStoreData(res.data); };
    const handleStoreUpdated = (data) => { if (data?.store_name) handleStoreData(data); };
    
    socket.on("storeInfo", handleStoreInfo);
    socket.on("storeUpdated", handleStoreUpdated);
    socket.on("connect", () => socket.emit("getStoreInfo"));
    if (socket.connected) socket.emit("getStoreInfo");
    return () => {
        socket.off("storeInfo", handleStoreInfo);
        socket.off("storeUpdated", handleStoreUpdated);
    };
  }, [dispatch]);

  const displayName = storeName || "My Store";
  const displayColor = primaryColor || "#10b981";
  const firstLetter = displayName?.charAt(0)?.toUpperCase() || "S";

  const handleCloseMobile = useCallback(() => {
    setIsMobileOpen(false);
    if (onNavigate) onNavigate();
  }, [onNavigate]);

  return (
    <>
      {!isMobileOpen && (
        <button type="button" onClick={() => setIsMobileOpen(true)} aria-label="Open sidebar" className="fixed top-4 left-4 z-[60] flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-sidebar)] text-[var(--text-primary)] shadow-md transition-all duration-300 hover:bg-[var(--bg-sidebar-hover)] md:hidden">
          <Menu size={20} />
        </button>
      )}
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={handleCloseMobile} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[200px] flex-col overflow-hidden border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] text-[var(--text-sidebar)] shadow-xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-sidebar)] px-3">
          <Link href="/admin/dashboard" onClick={handleCloseMobile} className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300" style={{ backgroundColor: displayColor }}>
              <span className="text-sm font-bold text-white">{firstLetter}</span>
            </div>
            <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{displayName}</span>
          </Link>
          <button type="button" onClick={handleCloseMobile} aria-label="Close sidebar" className="shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)] md:hidden">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-2">
          <div className="space-y-0.5">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link key={item.name} href={item.path} onClick={handleCloseMobile} aria-current={active ? "page" : undefined} className={`flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors ${active ? "bg-[var(--bg-sidebar-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"}`}>
                  <Icon size={16} className={`shrink-0 ${active ? "text-emerald-500" : "text-[var(--text-muted)]"}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-[var(--border-sidebar)] px-3 py-2">
          <p className="text-center text-[10px] text-[var(--text-muted)]">Powered by <span className="font-medium text-[var(--text-secondary)]">{displayName}</span> · v1.0</p>
        </div>
      </aside>
    </>
  );
}