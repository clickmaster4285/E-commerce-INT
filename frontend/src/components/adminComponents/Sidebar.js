"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { isAdminRole, isStaffRole } from "@/lib/roles";
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
import { attachSocketAuthSync } from "@/lib/socketAuthSync";
import { getBackendOrigin } from "@/lib/tenantHost";
import { setStoreInfo } from "@/redux/slices/storeInfoSlice";
import { useQueryClient } from "@tanstack/react-query";
import { slugKey } from "@/utils/slugKey";
import { useTranslation } from "../../i18n/LanguageProvider";
import adminHttp from "@/apis/axiosInstance";

import {
  X,
  Menu,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  LayoutGrid,
  Package,
  Megaphone,
  Gift,
  Settings2,
  ShoppingCart,
  Users,
  Wallet,
  Store,
  UsersRound,
} from "lucide-react";
import { getNavModules, getSidebarSections } from "@/lib/adminModules";

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
  sizeClass = "h-8 w-8",
  roundedClass = "rounded-lg",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showLogo = Boolean(logoUrl && !imageFailed);

  return (
    <span
      aria-label={name}
      className={`${sizeClass} ${roundedClass} flex shrink-0 items-center justify-center overflow-hidden shadow-sm ${
        showLogo ? "bg-[var(--sidebar-text-hover)] ring-1 ring-[var(--sidebar-border)]" : "text-[var(--sidebar-text-hover)] ring-1 ring-[var(--sidebar-border)]"
      }`}
      style={showLogo ? undefined : { background: "linear-gradient(135deg, var(--sidebar-accent), var(--sidebar-bg))" }}
    >
      {showLogo ? (
        <FallbackImage
          key={logoUrl}
          src={logoUrl}
          alt={name}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain p-[3px]"
        />
      ) : (
        <span aria-hidden="true" className="text-sm font-extrabold tracking-wide">
          {letter || "S"}
        </span>
      )}
    </span>
  );
}

// Modules catalog — shared with Super Admin Plans (`@/lib/adminModules`)
const sidebarSections = getSidebarSections();
const allMenuItems = getNavModules();
const sectionIcons = {
  overview: LayoutGrid,
  catalog: Package,
  sales: Megaphone,
  rewards: Gift,
  operations: Settings2,
  purchasing: ShoppingCart,
  pos: Users,
  finance: Wallet,
  store: Store,
  team: UsersRound,
};

// ============================================================
// SIDEBAR SOCKET
// ============================================================

let sidebarSocket = null;

function getSidebarSocket() {
  const SOCKET_URL = getBackendOrigin(); // page host ke saath aligned (tenantHost.js)

  if (sidebarSocket) return sidebarSocket;

  sidebarSocket = io(SOCKET_URL, {
    withCredentials: true,
    auth: { aud: "admin" }, // backend isi session ka cookie dekhta hai (a_at / u_at)
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
  attachSocketAuthSync(sidebarSocket, "admin");

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
  const [unreadChats, setUnreadChats] = useState(0);

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

  const routeSectionId = sidebarSections.find((section) =>
    allMenuItems.some((item) => section.items.includes(item.name) &&
      (pathname === item.path || pathname.startsWith(`${item.path}/`)))
  )?.id || null;
  const [openSection, setOpenSection] = useState(routeSectionId);
  const [lastRouteSectionId, setLastRouteSectionId] = useState(routeSectionId);
  if (routeSectionId && routeSectionId !== lastRouteSectionId) {
    setLastRouteSectionId(routeSectionId);
    setOpenSection(routeSectionId);
  }

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
      if (!isAdminRole(role)) {
        const currentItem = allMenuItems.find(
          (item) => item.path === pathname && item.permissionKey
        );
        // ✅ dashboard legacy payloads me missing ho sakta hai — sirf explicit false par redirect
        // ✅ featuredProducts/reviews legacy me missing hon to products se fallback (backend bhi undefined = allow)
        const effectiveValue = (item) => {
          if (!item) return undefined;
          const v = freshPermissions[item.permissionKey];
          if (v !== undefined) return v;
          if (item.fallbackKey) return freshPermissions[item.fallbackKey];
          return undefined;
        };
        const revoked =
          currentItem &&
          (currentItem.permissionKey === "dashboard"
            ? freshPermissions.dashboard === false
            : effectiveValue(currentItem) === false);
        if (revoked) {
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

  useEffect(() => {
    const role = String(socketRole || "").toLowerCase();
    if (!isStaffRole(role) || (!isAdminRole(role) && socketPermissions?.order === false)) return undefined;
    const socket = getSidebarSocket();
    const refresh = () => {
      adminHttp.get("/chats/admin/unread-count").then((response) => setUnreadChats(Number(response.data?.data?.count) || 0)).catch(() => {});
      socket.emit("chat:inbox:join", (response) => { if (response?.success) setUnreadChats(Number(response.data?.count) || 0); });
    };
    const onCount = (payload) => setUnreadChats(Number(payload?.count) || 0);
    socket.on("connect", refresh);
    socket.on("chat:unread-count", onCount);
    if (socket.connected) refresh();
    return () => { socket.off("connect", refresh); socket.off("chat:unread-count", onCount); };
  }, [socketRole, socketPermissions]);

  // ============================================================
  // I18N (admin only)
  // ============================================================
  // `name` / `title` stay the stable lookup key — paths, permissionKey and icons
  // are untouched. If a key is ever missing we fall back to the English label.
  const { t, dir, locale } = useTranslation();
  const navLabel = useCallback(
    (kind, label) => {
      const key = `admin.nav.${kind}.${slugKey(label)}`;
      const translated = t(key);
      // The translator returns the key itself when missing — fall back to the
      // raw English label so the sidebar never shows a dotted key.
      return translated === key ? label : translated;
    },
    [t],
  );

  // ============================================================
  // VISIBLE MENU ITEMS
  // ============================================================

  const visibleMenuItems = useMemo(() => {
    const permissions = socketProfileLoaded ? socketPermissions : {};
    const role = socketProfileLoaded ? socketRole : "";
    const normalizedRole = String(role).toLowerCase();

    if (isAdminRole(normalizedRole)) return allMenuItems;

    return allMenuItems.filter((item) => {
      if (!item.permissionKey) return true;
      // ✅ dashboard purane staff records me missing ho sakta hai (undefined) —
      // sirf explicit false par hide karo, taake legacy accounts lock na hon.
      if (item.permissionKey === "dashboard") return permissions.dashboard !== false;
      const v = permissions[item.permissionKey];
      // ✅ featuredProducts/reviews legacy me missing hon to products se fallback
      if (v !== undefined) return v === true;
      if (item.fallbackKey) {
        const fb = permissions[item.fallbackKey];
        if (fb !== undefined) return fb === true;
        return true; // backend undefined = allow
      }
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
          aria-label={t("admin.sidebar.open")}
          className={`
            fixed top-4 ${dir === "rtl" ? "right-4 left-auto" : "left-4 right-auto"} z-[60]
            flex h-10 w-10 items-center justify-center
            rounded-lg
            bg-[var(--sidebar-bg)]
            text-[var(--sidebar-text)]
            shadow-md
            transition-all duration-300
            focus:outline-none
            hover:bg-[var(--sidebar-hover-bg)]
          lg:hidden
          `}
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
            backdrop-blur-sm
            lg:hidden
          "
          style={{ background: "var(--sidebar-overlay)" }}
          onClick={handleCloseMobile}
        />
      )}

      {/* ======================================================
          SIDEBAR
      ====================================================== */}
      <aside
        dir={dir}
        lang={locale}
        className={`
          fixed inset-y-0 ${dir === "rtl" ? "right-0 left-auto border-l border-r-0" : "left-0 right-auto border-r border-l-0"} z-50
          flex h-screen w-[280px] flex-col
          border-r border-[var(--sidebar-border)]
          text-[var(--sidebar-text)]
          transition-[width,transform] duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${iconOnly ? "lg:w-[72px]" : "lg:w-[248px]"}
          ${isMobileOpen ? "translate-x-0" : dir === "rtl" ? "translate-x-full" : "-translate-x-full"}
        `}
        style={{ background: "var(--sidebar-bg-gradient)" }}
      >
        {/* ==================================================
            HEADER
        ================================================== */}
        <div
          className={`
            flex h-[72px] shrink-0 items-center
            gap-2 border-b border-[var(--sidebar-border)]
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
              key={logoUrl || displayName}
              logoUrl={logoUrl}
              name={displayName}
              letter={firstLetter}
              sizeClass="h-9 w-9"
              roundedClass="rounded-lg"
            />
            {!iconOnly && (
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--sidebar-text)]">
                  {displayName}
                </span>
                <span className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-muted)]">
                  {t("admin.sidebar.adminPanel")}
                </span>
              </span>
            )}
          </Link>

          {/* MOBILE CLOSE BUTTON */}
          <button
            type="button"
            onClick={handleCloseMobile}
            aria-label={t("admin.sidebar.close")}
            className="
              shrink-0 rounded-md p-1
              text-[var(--sidebar-text]]
              transition-colors
              focus:outline-none
              hover:bg-[var(--sidebar-hover-bg)]
              hover:text-[var(--sidebar-text-hover)]
              lg:hidden
            "
          >
            <X size={18} />
          </button>

          {/* DESKTOP COLLAPSE TOGGLE */}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={iconOnly ? t("admin.sidebar.expand") : t("admin.sidebar.collapse")}
            title={iconOnly ? t("admin.sidebar.expand") : t("admin.sidebar.collapse")}
            className="
              hidden h-7 w-7 shrink-0 items-center justify-center
              rounded-lg
              text-[var(--sidebar-muted)]
              transition-colors duration-150
              focus:outline-none
              hover:bg-[var(--sidebar-hover-bg)]
              hover:text-[var(--sidebar-text-hover)]
              lg:inline-flex
            "
          >
            {iconOnly ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>

        {/* ==================================================
            NAVIGATION
        ================================================== */}
        <nav
          aria-label={t("admin.sidebar.navigation")}
          className={`sidebar-wrapper flex-1 overflow-y-auto py-3 transition-colors ${iconOnly ? "px-1.5" : "px-3"}`}
        >
          {sidebarSections.map((section) => {
            const sectionTitle = section.title;
            const sectionItems = visibleMenuItems.filter((item) => section.items.includes(item.name));
            if (sectionItems.length === 0) return null;
            const sectionActive = sectionItems.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
            return (
              <div key={section.id || sectionTitle} className="mb-0.5">
                {(() => {
                  const SectionIcon = sectionIcons[section.id] || Package;
                  return (
                    <button
                      type="button"
                      aria-expanded={!iconOnly && openSection === section.id}
                      aria-label={sectionTitle}
                      title={sectionTitle}
                      onClick={() => {
                        if (iconOnly) { toggleCollapse(); setOpenSection(section.id); return; }
                        setOpenSection((current) => current === section.id ? null : section.id);
                      }}
                      className={`group relative flex h-10 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium tracking-normal transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--sidebar-focus)] focus-visible:outline-offset-[-2px] ${iconOnly ? "justify-center px-0" : "justify-between"} ${sectionActive ? "border-transparent bg-[var(--sidebar-active-soft)] text-[var(--sidebar-text-hover)]" : "border-transparent text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text-hover)]"}`}
                    >
                      <span className={`flex min-w-0 items-center gap-3 ${iconOnly ? "justify-center" : ""}`}>
                        <SectionIcon size={18} strokeWidth={1.75} className={`shrink-0 transition-colors ${sectionActive ? "text-[var(--sidebar-accent)]" : "text-[var(--sidebar-text)] group-hover:text-[var(--sidebar-text-hover)]"}`} />
                        {!iconOnly && <span className="flex-1 min-w-0 truncate text-sm font-medium tracking-normal">{sectionTitle}</span>}
                      </span>
                      {!iconOnly && <ChevronRight size={16} className={`shrink-0 text-[var(--sidebar-muted)] transition-all duration-200 ease-out group-hover:text-[var(--sidebar-text-hover)] ${sectionActive ? "!text-[var(--sidebar-text-hover)]" : ""} ${openSection === section.id ? "rotate-90" : ""}`} />}
                    </button>
                  );
                })()}
                {!iconOnly && <div className={`grid transition-[grid-template-rows,opacity] duration-[180ms] ease-out ${openSection === section.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden pt-1">
                <div className="ml-[21px] space-y-1 border-l border-[var(--sidebar-divider)] pl-3">
                  {sectionItems.map((item) => {
                    const active =
                      pathname === item.path ||
                      pathname.startsWith(`${item.path}/`);

                    return (
                      <Link
                        key={item.name}
                        href={item.path}
                        onClick={handleCloseMobile}
                        aria-current={active ? "page" : undefined}
                        title={iconOnly ? navLabel("item", item.name) : undefined}
                        aria-label={iconOnly ? navLabel("item", item.name) : undefined}
                        className={`
                          group relative flex h-9
                          items-center gap-2.5
                          rounded-lg
                          text-[13px] font-normal tracking-normal
                          transition-all duration-150
                          focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--sidebar-focus)] focus-visible:outline-offset-[-2px]
                          h-9 px-2
                          ${
                            active
                              ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-hover)]"
                              : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text-hover)]"
                          }
                        `}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute -left-[13px] bottom-2 top-2 w-[3px] rounded-full bg-[var(--sidebar-accent)]"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">{navLabel("item", item.name)}</span>
                        {item.name === "Chats" && isStaffRole(socketRole) && (isAdminRole(socketRole) || socketPermissions?.order !== false) && unreadChats > 0 && (
                          <span className={`flex min-w-5 items-center justify-center rounded-full bg-[var(--sidebar-badge)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--sidebar-text-hover)] ${iconOnly ? "absolute -right-0.5 -top-0.5" : "ml-auto"}`}>
                            {unreadChats > 99 ? "99+" : unreadChats}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                </div></div>}
              </div>
            );
          })}
        </nav>

        {/* ==================================================
            FOOTER
        ================================================== */}
        <div className="shrink-0 border-t border-[var(--sidebar-border)] px-3.5 py-3.5">
          {iconOnly ? (
            <p className="text-center text-[9px] font-semibold text-[var(--sidebar-muted)]">
              v1.0
            </p>
          ) : (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--sidebar-muted)]">
              {t("admin.sidebar.poweredBy")} <span className="font-semibold text-[var(--sidebar-text)]">Click Master</span>
              <span className="rounded-full bg-[var(--sidebar-pill-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--sidebar-muted)]">V1.0</span>
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
