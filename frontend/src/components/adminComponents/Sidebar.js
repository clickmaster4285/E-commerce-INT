import { getAdminSocket, disposeAdminSocket } from "@/hooks/admin/useAdminSocket";
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
  color = "var(--accent)",
  sizeClass = "h-8 w-8",
  roundedClass = "rounded-lg",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [logoUrl]);
  const showLogo = Boolean(logoUrl && !imageFailed);

  return (
    <span
      aria-label={name}
      className={`${sizeClass} ${roundedClass} flex shrink-0 items-center justify-center overflow-hidden shadow-sm ${
        showLogo ? "bg-white ring-1 ring-black/10" : "text-white ring-1 ring-white/20"
      }`}
      style={showLogo ? undefined : { background: `linear-gradient(135deg, ${color}, #4338ca)` }}
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

// ============================================================
// SIDEBAR SOCKET
// ============================================================

function getSidebarSocket() {
  return getAdminSocket();
}

export function disconnectSidebarSocket() {
  disposeAdminSocket();
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
    const socket = getSidebarSocket();
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
        if (getSidebarSocket()?.connected) getSidebarSocket().emit("getProfile");
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
        if (getSidebarSocket()?.connected) getSidebarSocket().emit("getProfile");
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
          aria-label={t("admin.sidebar.open")}
          className={`
            fixed top-4 ${dir === "rtl" ? "right-4 left-auto" : "left-4 right-auto"} z-[60]
            flex h-10 w-10 items-center justify-center
            rounded-lg
            bg-sidebar
            text-sidebar-fg
            shadow-md
            transition-all duration-300
            hover:bg-sidebar-hover
            md:hidden
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
        dir={dir}
        lang={locale}
        className={`
          fixed inset-y-0 ${dir === "rtl" ? "right-0 left-auto border-l border-r-0" : "left-0 right-auto border-r border-l-0"} z-50
          flex h-screen w-[280px] flex-col
          border-sidebar-line
          bg-sidebar
          text-sidebar-fg
          transition-[width,transform] duration-300 ease-in-out
          md:relative md:translate-x-0
          ${iconOnly ? "md:w-[64px]" : "md:w-[var(--sidebar-width)]"}
          ${isMobileOpen ? "translate-x-0" : dir === "rtl" ? "translate-x-full" : "-translate-x-full"}
        `}
      >
        {/* ==================================================
            HEADER
        ================================================== */}
        <div
          className={`
            flex h-16 shrink-0 items-center
            gap-2 border-b border-sidebar-line
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
                <span className="truncate text-[13.5px] font-semibold tracking-tight text-sidebar-fg">
                  {displayName}
                </span>
                <span className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-fg-muted">
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
              text-sidebar-fg-muted
              transition-colors
              hover:bg-sidebar-hover
              hover:text-sidebar-fg
              md:hidden
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
              text-sidebar-fg-muted
              transition-colors duration-150
              hover:bg-sidebar-hover
              hover:text-sidebar-fg
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
          aria-label={t("admin.sidebar.navigation")}
          className={`sidebar-wrapper flex-1 overflow-y-auto py-3 transition-colors ${iconOnly ? "px-1.5" : "px-2"}`}
        >
          {sidebarSections.map((section) => {
            const sectionTitle = section.sidebarTitle || section.title;
            const sectionItems = visibleMenuItems.filter((item) => section.items.includes(item.name));
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.id || sectionTitle} className="mb-1.5">
                {iconOnly ? (
                  <div
                    aria-hidden="true"
                    className="mx-auto my-2 h-px w-6 rounded-full"
                    style={{ backgroundColor: "var(--sidebar-divider)" }}
                  />
                ) : !section.hideSidebarHeading ? (
                  <div className="px-2.5 pt-1.5 pb-1">
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-fg-muted">
                      {navLabel("section", sectionTitle)}
                    </span>
                  </div>
                ) : null}
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
                        title={iconOnly ? navLabel("item", item.name) : undefined}
                        aria-label={iconOnly ? navLabel("item", item.name) : undefined}
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
                              ? "bg-sidebar-active text-white"
                              : "text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
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
                              : "text-sidebar-fg-muted group-hover:text-sidebar-fg"
                          }`}
                        />
                        {!iconOnly && <span className="min-w-0 flex-1 truncate">{navLabel("item", item.name)}</span>}
                        {item.name === "Chats" && isStaffRole(socketRole) && (isAdminRole(socketRole) || socketPermissions?.order !== false) && unreadChats > 0 && (
                          <span className={`flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${iconOnly ? "absolute -right-0.5 -top-0.5" : "ml-auto"}`}>
                            {unreadChats > 99 ? "99+" : unreadChats}
                          </span>
                        )}
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
        <div className="shrink-0 border-t border-sidebar-line px-3 py-2.5">
          {iconOnly ? (
            <p className="text-center text-[9px] font-semibold text-sidebar-fg-muted">
              v1.0
            </p>
          ) : (
            <p className="text-center text-[10px] text-sidebar-fg-muted">
              {t("admin.sidebar.poweredBy")}{" "}
              <span className="font-semibold text-sidebar-fg">ClickMaster</span> {t("admin.sidebar.version")}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
