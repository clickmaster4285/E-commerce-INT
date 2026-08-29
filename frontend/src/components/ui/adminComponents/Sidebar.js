"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Image as ImageIcon, // Added Icon for Banners
} from "lucide-react";

// ============================================================
// ALL MENU ITEMS
// ============================================================

const allMenuItems = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
    permissionKey: null,
  },
  {
    name: "Brands",
    icon: Tag,
    path: "/admin/brands",
    permissionKey: "brands",
  },
  {
    name: "Categories",
    icon: FolderOpen,
    path: "/admin/categories",
    permissionKey: "categories",
  },
  {
    name: "Products",
    icon: Package,
    path: "/admin/products",
    permissionKey: "products",
  },
  {
    name: "Store Info",
    icon: Store,
    path: "/admin/store-info",
    permissionKey: "store",
  },
  {
    name: "Profile",
    icon: User,
    path: "/admin/profile",
    permissionKey: "profile",
  },
  {
    name: "Employees",
    icon: Users,
    path: "/admin/employees",
    permissionKey: "employees",
  },
  {
    name: "Discounts",
    icon: Tag,
    path: "/admin/discounts",
    permissionKey: "discounts",
  },
  {
    name: "Deals",
    icon: Gift,
    path: "/admin/deals",
    permissionKey: "deals",
  },
  {
    name: "Banners",
    icon: ImageIcon,
    path: "/admin/banners",
    permissionKey: "banners",
  },
];

// ============================================================
// GLOBAL SOCKET
// ============================================================

let sidebarSocket = null;

function getSidebarSocket() {
  const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL 

  if (sidebarSocket) {
    return sidebarSocket;
  }

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
    console.error(
      "❌ Sidebar socket connection error:",
      error?.message || error
    );
  });

  sidebarSocket.on("disconnect", (reason) => {
  });

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
// SIDEBAR
// ============================================================

export default function Sidebar({
  onNavigate,
  userData,
}) {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const storeName = useSelector(
    (state) => state.storeInfo.storeName
  );

  const primaryColor = useSelector(
    (state) => state.storeInfo.primaryColor
  );

  const isLoaded = useSelector(
    (state) => state.storeInfo.isLoaded
  );

  const isSelfDispatching = useRef(false);

  // ============================================================
  // IMPORTANT
  // Empty object means:
  // "Do NOT trust old userData permissions"
  // ============================================================

  const [socketPermissions, setSocketPermissions] =
    useState({});

  const [socketRole, setSocketRole] =
    useState("");

  const [socketProfileLoaded, setSocketProfileLoaded] =
    useState(false);

  // ============================================================
  // APPLY PROFILE
  // ============================================================

  const applyProfile = useCallback(
    (response) => {
      if (!response) {
        return;
      }

      if (response.success === false) {
        console.warn(
          "⚠️ Sidebar profile request failed:",
          response.message
        );

        return;
      }

      const data =
        response?.data ||
        response?.user ||
        response;

      if (!data) {
        return;
      }

      const freshPermissions = {
        ...(data.permissions || {}),
      };

      const freshRole =
        data.role || "";


      setSocketPermissions(
        freshPermissions
      );

      setSocketRole(
        freshRole
      );

      setSocketProfileLoaded(true);

      // ========================================================
      // UPDATE REACT QUERY CACHE
      // ========================================================

      queryClient.setQueryData(
        ["profile"],
        (old) => {
          if (!old) {
            return {
              ...data,
              permissions:
                freshPermissions,
              role: freshRole,
            };
          }

          return {
            ...old,
            ...data,
            permissions:
              freshPermissions,
            role: freshRole,
          };
        }
      );
    },
    [queryClient]
  );

  // ============================================================
  // SOCKET CONNECT
  // ============================================================

  const handleConnect = useCallback(() => {
    const socket =
      sidebarSocket;


    if (
      socket &&
      socket.connected
    ) {
      // ALWAYS get fresh DB permissions
      socket.emit(
        "getProfile"
      );
    }
  }, []);

  // ============================================================
  // PROFILE DATA
  // ============================================================

  const handleProfileData =
    useCallback(
      (response) => {

        applyProfile(
          response
        );
      },
      [applyProfile]
    );

  // ============================================================
  // PROFILE UPDATED
  // ============================================================

  const handleProfileUpdated =
    useCallback(
      (response) => {

        applyProfile(
          response
        );
      },
      [applyProfile]
    );

  // ============================================================
  // PERMISSIONS UPDATED
  // ============================================================

  const handlePermissionsUpdated =
    useCallback(
      (data) => {

        if (
          !data ||
          !data.permissions
        ) {
          console.warn(
            "⚠️ permissionsUpdated without permissions"
          );

          if (
            sidebarSocket?.connected
          ) {
            sidebarSocket.emit(
              "getProfile"
            );
          }

          return;
        }

        const freshPermissions = {
          ...data.permissions,
        };


        // ======================================================
        // IMMEDIATE SIDEBAR UPDATE
        // ======================================================

        setSocketPermissions(
          freshPermissions
        );

        if (
          data.role !== undefined
        ) {
          setSocketRole(
            data.role || ""
          );
        }

        setSocketProfileLoaded(
          true
        );

        // ======================================================
        // UPDATE QUERY CACHE
        // ======================================================

        queryClient.setQueryData(
          ["profile"],
          (old) => {
            if (!old) {
              return {
                permissions:
                  freshPermissions,
                role:
                  data.role || "",
              };
            }

            return {
              ...old,
              permissions:
                freshPermissions,
              role:
                data.role ??
                old.role,
            };
          }
        );

        // ======================================================
        // GET ABSOLUTE LATEST DB VALUE
        // ======================================================

        setTimeout(() => {
          if (
            sidebarSocket?.connected
          ) {

            sidebarSocket.emit(
              "getProfile"
            );
          }
        }, 150);
      },
      [queryClient]
    );

  // ============================================================
  // SOCKET LISTENERS
  // ============================================================

  useEffect(() => {
    const socket =
      getSidebarSocket();

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "profileData",
      handleProfileData
    );

    socket.on(
      "profileUpdated",
      handleProfileUpdated
    );

    socket.on(
      "permissionsUpdated",
      handlePermissionsUpdated
    );

    // Already connected
    if (socket.connected) {

      socket.emit(
        "getProfile"
      );
    }

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "profileData",
        handleProfileData
      );

      socket.off(
        "profileUpdated",
        handleProfileUpdated
      );

      socket.off(
        "permissionsUpdated",
        handlePermissionsUpdated
      );
    };
  }, [
    handleConnect,
    handleProfileData,
    handleProfileUpdated,
    handlePermissionsUpdated,
  ]);

  // ============================================================
  // PERMISSION BASED MENU
  // ============================================================

  const visibleMenuItems =
    useMemo(() => {
      // IMPORTANT:
      // Once socket profile is available,
      // ONLY socket permissions are used.

      const permissions =
        socketProfileLoaded
          ? socketPermissions
          : {};

      const role =
        socketProfileLoaded
          ? socketRole
          : "";

      const normalizedRole =
        String(
          role
        ).toLowerCase();


      // ========================================================
      // ADMIN
      // ========================================================

      if (
        normalizedRole ===
        "admin"
      ) {
        return allMenuItems;
      }

      // ========================================================
      // STAFF / MANAGER
      // ========================================================

      return allMenuItems.filter(
        (item) => {
          // Dashboard always visible
          if (
            !item.permissionKey
          ) {
            return true;
          }

          const value =
            permissions[
              item.permissionKey
            ];

          // ONLY explicit true
          // gets access
          return value === true;
        }
      );
    }, [
      socketPermissions,
      socketRole,
      socketProfileLoaded,
    ]);

  // ============================================================
  // MOBILE CLOSE ON ROUTE CHANGE
  // ============================================================

  useEffect(() => {
    if (onNavigate) {
      onNavigate();
    }
  }, [
    pathname,
    onNavigate,
  ]);

  // ============================================================
  // STORE SOCKET
  // ============================================================

  useEffect(() => {
    const socket =
      getSidebarSocket();

    const handleStoreData =
      (data) => {
        if (
          !data ||
          !data.store_name
        ) {
          return;
        }


        isSelfDispatching.current =
          true;

        dispatch(
          setStoreInfo(data)
        );

        setTimeout(() => {
          isSelfDispatching.current =
            false;
        }, 100);
      };

    const handleStoreInfo =
      (response) => {
        if (
          response?.success &&
          response?.data
        ) {
          handleStoreData(
            response.data
          );
        }
      };

    const handleStoreUpdated =
      (data) => {
        if (
          data?.store_name
        ) {
          handleStoreData(
            data
          );
        }
      };

    const handleConnectStore =
      () => {

        socket.emit(
          "getStoreInfo"
        );
      };

    socket.on(
      "storeInfo",
      handleStoreInfo
    );

    socket.on(
      "storeUpdated",
      handleStoreUpdated
    );

    socket.on(
      "connect",
      handleConnectStore
    );

    if (
      socket.connected
    ) {
      socket.emit(
        "getStoreInfo"
      );
    }

    return () => {
      socket.off(
        "storeInfo",
        handleStoreInfo
      );

      socket.off(
        "storeUpdated",
        handleStoreUpdated
      );

      socket.off(
        "connect",
        handleConnectStore
      );
    };
  }, [dispatch]);

  // ============================================================
  // CUSTOM STORE EVENT
  // ============================================================

  useEffect(() => {
    const handleCustomEvent =
      (event) => {
        if (
          isSelfDispatching.current
        ) {
          return;
        }

        if (
          event.detail?.store_name
        ) {
          isSelfDispatching.current =
            true;

          dispatch(
            setStoreInfo(
              event.detail
            )
          );

          setTimeout(() => {
            isSelfDispatching.current =
              false;
          }, 100);
        }
      };

    window.addEventListener(
      "storeUpdated",
      handleCustomEvent
    );

    return () => {
      window.removeEventListener(
        "storeUpdated",
        handleCustomEvent
      );
    };
  }, [dispatch]);

  // ============================================================
  // STORE FAILSAFE
  // ============================================================

  useEffect(() => {
    const timer =
      setTimeout(() => {
        if (!isLoaded) {
          const socket =
            getSidebarSocket();

          if (
            socket.connected
          ) {
            socket.emit(
              "getStoreInfo"
            );
          }
        }
      }, 3000);

    return () => {
      clearTimeout(
        timer
      );
    };
  }, [isLoaded]);

  // ============================================================
  // DISPLAY
  // ============================================================

  const displayName =
    storeName ||
    "My Store";

  const displayColor =
    primaryColor ||
    "#10b981";

  const firstLetter =
    displayName
      ?.charAt(0)
      ?.toUpperCase() ||
    "S";

  // ============================================================
  // RENDER
  // ============================================================

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
      {/* HEADER */}

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
          className="
            flex min-w-0
            items-center gap-2
          "
        >
          <div
            className="
              flex h-8 w-8 shrink-0
              items-center justify-center
              rounded-lg
              transition-colors
              duration-300
            "
            style={{
              backgroundColor:
                displayColor,
            }}
          >
            <span
              className="
                text-sm font-bold text-white
              "
            >
              {firstLetter}
            </span>
          </div>

          <span
            className="
              truncate
              text-sm font-semibold
              tracking-tight
              text-[var(--text-primary)]
            "
          >
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

      {/* NAVIGATION */}

      <nav
        aria-label="Main navigation"
        className="
          flex-1
          overflow-y-auto
          px-2 py-2
        "
      >
        <div
          className="space-y-0.5"
        >
          {visibleMenuItems.map(
            (item) => {
              const Icon =
                item.icon;

              const active =
                pathname ===
                  item.path ||
                pathname.startsWith(
                  `${item.path}/`
                ) ||
                (
                  item.path ===
                    "/admin/employees" &&
                  pathname ===
                    "/admin/employee"
                );

              return (
                <Link
                  key={
                    item.name
                  }
                  href={
                    item.path
                  }
                  onClick={
                    onNavigate
                  }
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
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
                    className={`
                      shrink-0
                      ${
                        active
                          ? "text-emerald-500"
                          : "text-[var(--text-muted)]"
                      }
                    `}
                  />

                  <span
                    className="truncate"
                  >
                    {item.name}
                  </span>
                </Link>
              );
            }
          )}
        </div>
      </nav>

      {/* FOOTER */}

      <div
        className="
          shrink-0
          border-t border-[var(--border-sidebar)]
          px-3 py-2
        "
      >
        <p
          className="
            text-center
            text-[10px]
            text-[var(--text-muted)]
          "
        >
          Powered by{" "}
          <span
            className="
              font-medium
              text-[var(--text-secondary)]
            "
          >
            {displayName}
          </span>{" "}
          · v1.0
        </p>
      </div>
    </aside>
  );
}