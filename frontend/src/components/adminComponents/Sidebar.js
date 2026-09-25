"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
  useSyncExternalStore,
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
  Menu,
  ChevronsLeft,
  ChevronsRight,
  ShoppingCart,
  Truck,
  Percent,
  Boxes,
  SlidersHorizontal, // Added for Attributes
} from "lucide-react";

// ============================================================
// STORE LOGO / MARK
// ============================================================
// Store logo upload ho chuka ho to wahi image dikhti hai — safe white card par
// object-contain ke sath (is liye wide/tall logo crop nahi hota aur transparent
// PNG bhi dark sidebar par saaf nazar aati hai).
// Logo na ho (ya image load fail ho jaye) to store ke primary color ka
// professional gradient mark + store name ka pehla letter show hota hai.
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

function StoreMark({
  logoUrl,
  name,
  letter,
  color,
  sizeClass = "h-8 w-8",
  letterClass = "text-sm",
  roundedClass = "rounded-lg",
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoUrl && !logoFailed) {
    return (
      <span
        className={`${sizeClass} ${roundedClass} flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm ring-1 ring-black/10`}
      >
        <img
          src={logoUrl}
          alt={name}
          onError={() => setLogoFailed(true)}
          className="h-full w-full object-contain p-[3px]"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} ${roundedClass} flex shrink-0 items-center justify-center shadow-sm ring-1 ring-white/15`}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 82%, #ffffff), color-mix(in srgb, ${color} 72%, #000000))`,
      }}
    >
      <span
        className={`font-bold uppercase tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] ${letterClass}`}
      >
        {letter}
      </span>
    </span>
  );
}

// ============================================================
// SIDEBAR SECTIONS (logical grouping for UI)
// ============================================================

const sidebarSections = [
  {
    title: "OVERVIEW",
    items: ["Dashboard"],
  },
  {
    title: "CATALOG",
    items: ["Brands", "Categories", "Attributes", "Products"],
  },
  {
    title: "SALES & MARKETING",
    items: ["Discounts", "Deals", "Banners"],
  },
  {
    title: "OPERATIONS",
    items: ["Manage Stock", "Orders", "Shipping"],
  },
  {
    title: "STORE",
    items: ["Store Info"],
  },
  {
    title: "TEAM & ACCOUNT",
    items: ["Employees", "Profile"],
  },
];

// ============================================================
// MENU ITEMS
// ============================================================

const allMenuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard", permissionKey: null },
  { name: "Brands", icon: Tag, path: "/admin/brands", permissionKey: "brands" },
  { name: "Categories", icon: FolderOpen, path: "/admin/categories", permissionKey: "categories" },
  { 
    name: "Attributes", 
    icon: SlidersHorizontal, 
    path: "/admin/attributes", 
    permissionKey: "attribute" 
  },
  { name: "Products", icon: Package, path: "/admin/products", permissionKey: "products" },
  { name: "Employees", icon: Users, path: "/admin/employees", permissionKey: "employees" },
  { name: "Discounts", icon: Percent, path: "/admin/discounts", permissionKey: "discounts" },
  { name: "Deals", icon: Gift, path: "/admin/deals", permissionKey: "deals" },
  { name: "Banners", icon: ImageIcon, path: "/admin/banners", permissionKey: "banners" },
  { name: "Manage Stock", icon: Boxes, path: "/admin/manage-stock", permissionKey: "manageStock" },
  { name: "Orders", icon: ShoppingCart, path: "/admin/orders", permissionKey: "order" },
  { name: "Shipping", icon: Truck, path: "/admin/shipping", permissionKey: "shipping" },
  { name: "Store Info", icon: Store, path: "/admin/store-info", permissionKey: "store" },
  { name: "Profile", icon: User, path: "/admin/profile", permissionKey: "profile" },
];

// ============================================================
// SIDEBAR SOCKET
// ============================================================

let sidebarSocket = null;

function getSidebarSocket() {
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

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

  sidebarSocket.on("connect_error", (error) => {
    // ✅ Silent — error console par show na ho, reconnection waise hi chalega
  });

  sidebarSocket.on("disconnect", (reason) => {});

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
// SIDEBAR COLLAPSE STORE (localStorage-backed, cross-tab sync)
// useSyncExternalStore pattern — SSR-safe, no setState-in-effect
// ============================================================

const collapsedListeners = new Set();

function subscribeCollapsed(callback) {
  collapsedListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    collapsedListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getCollapsedSnapshot() {
  try {
    return window.localStorage.getItem("admin.sidebar.collapsed") === "1";
  } catch {
    /* storage unavailable — default expanded */
    return false;
  }
}

function getCollapsedServerSnapshot() {
  return false;
}

function setCollapsed(next) {
  try {
    window.localStorage.setItem("admin.sidebar.collapsed", next ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  collapsedListeners.forEach((cb) => cb());
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
  const storeLogo = useSelector((state) => state.storeInfo.logo);
  const isLoaded = useSelector((state) => state.storeInfo.isLoaded);

  const isSelfDispatching = useRef(false);

  // ============================================================
  // MOBILE STATE
  // ============================================================

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // ============================================================
  // DESKTOP COLLAPSE STATE (persisted in localStorage)
  // ============================================================

  // localStorage-backed collapse state — useSyncExternalStore se read hota hai
  // (SSR-safe: server snapshot false, hydration mismatch nahi hota; cross-tab sync bonus)
  const isCollapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  const toggleCollapse = useCallback(() => {
    setCollapsed(!getCollapsedSnapshot());
  }, []);

  // Icon-only mode applies to desktop only — the mobile drawer always stays expanded
  const iconOnly = isCollapsed && !isMobileOpen;

  // ============================================================
  // PERMISSION STATE
  // ============================================================

  const [socketPermissions, setSocketPermissions] = useState(userData?.permissions || {});
  const [socketRole, setSocketRole] = useState(userData?.role || "");
  const [socketProfileLoaded, setSocketProfileLoaded] = useState(Boolean(userData));

  // ============================================================
  // SYNC WITH PARENT USER DATA (render-phase adjustment)
  // ============================================================

  const [lastSyncedUserData, setLastSyncedUserData] = useState(userData);

  if (userData !== lastSyncedUserData) {
    setLastSyncedUserData(userData);

    if (userData) {
      setSocketPermissions({ ...(userData.permissions || {}) });
      setSocketRole(userData.role || "");
      setSocketProfileLoaded(true);
    }
  }

  // ============================================================
  // APPLY PROFILE
  // ============================================================

  const applyProfile = useCallback(
    (response) => {
      if (!response || response.success === false) return;

      const data = response?.data || response?.user || response;
      if (!data) return;

      const freshPermissions = { ...(data.permissions || {}) };
      const freshRole = data.role || "";

      setSocketPermissions(freshPermissions);
      setSocketRole(freshRole);
      setSocketProfileLoaded(true);

      queryClient.setQueryData(["profile"], (old) => {
        if (!old) {
          return { ...data, permissions: freshPermissions, role: freshRole };
        }
        return { ...old, ...data, permissions: freshPermissions, role: freshRole };
      });
    },
    [queryClient]
  );

  // ============================================================
  // SOCKET CONNECT
  // ============================================================

  const handleConnect = useCallback(() => {
    const socket = sidebarSocket;
    if (socket && socket.connected) {
      socket.emit("getProfile");
    }
  }, []);

  // ============================================================
  // PROFILE DATA
  // ============================================================

  const handleProfileData = useCallback((response) => applyProfile(response), [applyProfile]);

  // ============================================================
  // PROFILE UPDATED
  // ============================================================

  const handleProfileUpdated = useCallback(
    (response) => {
      const employee = response?.data || response?.employee || response;
      const profile =
        employee?.userId && typeof employee.userId === "object" ? employee.userId : employee;
      const targetUserId = profile?._id;

      if (targetUserId && userData?._id && String(targetUserId) !== String(userData._id)) return;

      if (profile?.permissions) {
        applyProfile({ ...profile, permissions: profile.permissions });
      }
    },
    [applyProfile, userData]
  );

  // ============================================================
  // PERMISSIONS UPDATED
  // ============================================================

  const handlePermissionsUpdated = useCallback(
    (data) => {
      const permissionData = data?.data || data?.user || data;

      if (!permissionData || !permissionData.permissions) {
        if (sidebarSocket?.connected) sidebarSocket.emit("getProfile");
        return;
      }

      const freshPermissions = { ...permissionData.permissions };
      setSocketPermissions(freshPermissions);

      if (permissionData.role !== undefined) {
        setSocketRole(permissionData.role || "");
      }

      setSocketProfileLoaded(true);

      queryClient.setQueryData(["profile"], (old) => {
        if (!old) return { permissions: freshPermissions, role: data.role || "" };
        return { ...old, permissions: freshPermissions, role: permissionData.role ?? old.role };
      });

      // Force redirect if current page permission is revoked
      const role = String(permissionData.role || socketRole).toLowerCase();
      if (role !== "admin") {
        const currentItem = allMenuItems.find(
          (item) => item.path === pathname && item.permissionKey
        );
        if (currentItem && freshPermissions[currentItem.permissionKey] !== true) {
          router.replace("/admin/access-denied");
          return;
        }
      }

      setTimeout(() => {
        if (sidebarSocket?.connected) sidebarSocket.emit("getProfile");
      }, 150);
    },
    [queryClient, pathname, router, socketRole]
  );

  // ============================================================
  // PERMISSION SOCKET EVENTS
  // ============================================================

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

  // ============================================================
  // VISIBLE MENU ITEMS
  // ============================================================

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

  // ============================================================
  // CLOSE MOBILE MENU ON ROUTE CHANGE
  // ============================================================

  useEffect(() => {
    // rAF deferral: setState-in-effect lint rule satisfied, behavior identical
    const raf = requestAnimationFrame(() => {
      setIsMobileOpen(false);
      if (onNavigate) onNavigate();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, onNavigate]);

  // ============================================================
  // STORE SOCKET
  // ============================================================

  useEffect(() => {
    const socket = getSidebarSocket();

    const handleStoreData = (data) => {
      if (!data || !data.store_name) return;
      isSelfDispatching.current = true;
      dispatch(setStoreInfo(data));
      setTimeout(() => { isSelfDispatching.current = false; }, 100);
    };

    const handleStoreInfo = (response) => {
      if (response?.success && response?.data) handleStoreData(response.data);
    };

    const handleStoreUpdated = (data) => {
      if (data?.store_name) handleStoreData(data);
    };

    const handleConnectStore = () => socket.emit("getStoreInfo");

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

  // ============================================================
  // STORE CUSTOM EVENT
  // ============================================================

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

  // ============================================================
  // STORE LOAD FALLBACK
  // ============================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded) {
        const socket = getSidebarSocket();
        if (socket.connected) socket.emit("getStoreInfo");
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // ============================================================
  // STORE DISPLAY
  // ============================================================

  const displayName = storeName || "My Store";
  const displayColor = "var(--accent)";
  const firstLetter = displayName?.charAt(0)?.toUpperCase() || "S";
  const logoUrl = storeLogo?.img_url
    ? storeLogo.img_url.startsWith("http")
      ? storeLogo.img_url
      : `${API_ORIGIN}/${storeLogo.img_url}`
    : null;

  // ============================================================
  // MOBILE CLOSE
  // ============================================================

  const handleCloseMobile = useCallback(() => {
    setIsMobileOpen(false);
    if (onNavigate) onNavigate();
  }, [onNavigate]);

  // ============================================================
  // RETURN
  // ============================================================

  return (
    <>
      {/* ======================================================
          MOBILE TOGGLE BUTTON
      ====================================================== */}
      {!isMobileOpen && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open sidebar"
          className="
            fixed top-4 left-4 z-[60]
            flex h-10 w-10 items-center justify-center
            rounded-lg
            bg-[var(--bg-sidebar)]
            text-[var(--text-sidebar)]
            shadow-md
            transition-all duration-300
            hover:bg-[var(--bg-sidebar-hover)]
            md:hidden
          "
        >
          <Menu size={20} />
        </button>
      )}

      {/* ======================================================
          MOBILE OVERLAY
      ====================================================== */}
      {isMobileOpen && (
        <div
          className="
            fixed inset-0 z-40
            bg-black/50
            backdrop-blur-sm
            md:hidden
          "
          onClick={handleCloseMobile}
        />
      )}

      {/* ======================================================
          SIDEBAR
      ====================================================== */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-[280px] flex-col
          border-r border-[var(--border-sidebar)]
          bg-[var(--bg-sidebar)]
          text-[var(--text-sidebar)]
          transition-[width,transform] duration-300 ease-in-out
          md:relative md:translate-x-0
          ${iconOnly ? "md:w-[64px]" : "md:w-[var(--sidebar-width)]"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ==================================================
            HEADER
        ================================================== */}
        <div
          className={`
            flex h-16 shrink-0 items-center
            gap-2 border-b border-[var(--border-sidebar)]
            px-3
            ${iconOnly ? "flex-col justify-center gap-0.5" : "justify-between"}
          `}
        >
          <Link
            href="/admin/dashboard"
            onClick={handleCloseMobile}
            className="flex min-w-0 items-center gap-2"
            title={iconOnly ? displayName : undefined}
            aria-label={iconOnly ? displayName : undefined}
          >
            <StoreMark
              logoUrl={logoUrl}
              name={displayName}
              letter={firstLetter}
              color={displayColor}
            />
            {!iconOnly && (
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--text-sidebar)]">
                  {displayName}
                </span>
                <span className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-sidebar-muted)]">
                  Admin Panel
                </span>
              </span>
            )}
          </Link>

          {/* MOBILE CLOSE BUTTON */}
          <button
            type="button"
            onClick={handleCloseMobile}
            aria-label="Close sidebar"
            className="
              shrink-0 rounded-md p-1
              text-[var(--text-sidebar-muted)]
              transition-colors
              hover:bg-[var(--bg-sidebar-hover)]
              hover:text-[var(--text-sidebar)]
              md:hidden
            "
          >
            <X size={18} />
          </button>

          {/* DESKTOP COLLAPSE TOGGLE */}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={iconOnly ? "Expand sidebar" : "Collapse sidebar"}
            title={iconOnly ? "Expand sidebar" : "Collapse sidebar"}
            className="
              hidden h-7 w-7 shrink-0 items-center justify-center
              rounded-lg
              text-[var(--text-sidebar-muted)]
              transition-colors duration-150
              hover:bg-[var(--bg-sidebar-hover)]
              hover:text-[var(--text-sidebar)]
              md:inline-flex
            "
          >
            {iconOnly ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>

        {/* ==================================================
            NAVIGATION
        ================================================== */}
        <nav
          aria-label="Main navigation"
          className={`sidebar-wrapper flex-1 overflow-y-auto py-3 transition-colors ${iconOnly ? "px-1.5" : "px-2"}`}
        >
          {sidebarSections.map((section) => {
            const sectionItems = visibleMenuItems.filter((item) => section.items.includes(item.name));
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.title} className="mb-1.5">
                {iconOnly ? (
                  <div
                    aria-hidden="true"
                    className="mx-auto my-2 h-px w-6 rounded-full"
                    style={{ backgroundColor: "var(--sidebar-divider)" }}
                  />
                ) : (
                  <div className="px-2.5 pt-1.5 pb-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-sidebar-muted)]">
                      {section.title}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.path ||
                      pathname.startsWith(`${item.path}/`);

                    return (
                      <Link
                        key={item.name}
                        href={item.path}
                        onClick={handleCloseMobile}
                        aria-current={active ? "page" : undefined}
                        title={iconOnly ? item.name : undefined}
                        aria-label={iconOnly ? item.name : undefined}
                        className={`
                          group relative flex h-9
                          items-center gap-2.5
                          rounded-lg
                          text-xs font-medium
                          transition-all duration-150
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40
                          ${iconOnly ? "justify-center px-0" : "px-2.5"}
                          ${
                            active
                              ? "bg-[var(--bg-sidebar-active)] text-white"
                              : "text-[var(--text-sidebar-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)]"
                          }
                        `}
                      >
                        {active && !iconOnly && (
                          <span
                            aria-hidden="true"
                            className="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-white/90"
                          />
                        )}
                        <Icon
                          size={16}
                          className={`shrink-0 transition-colors ${
                            active
                              ? "text-white"
                              : "text-[var(--text-sidebar-muted)] group-hover:text-[var(--text-sidebar)]"
                          }`}
                        />
                        {!iconOnly && <span className="truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ==================================================
            FOOTER
        ================================================== */}
        <div className="shrink-0 border-t border-[var(--border-sidebar)] px-3 py-2.5">
          {iconOnly ? (
            <p className="text-center text-[9px] font-semibold text-[var(--text-sidebar-muted)]">
              v1.0
            </p>
          ) : (
            <p className="text-center text-[10px] text-[var(--text-sidebar-muted)]">
              Powered by{" "}
              <span className="font-semibold text-[var(--text-sidebar)]">ClickMaster</span> v1.0
            </p>
          )}
        </div>
      </aside>
    </>
  );
}