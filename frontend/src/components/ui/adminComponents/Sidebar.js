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
import { useQueryClient } from "@tanstack/react-query";

import { setStoreInfo } from "@/redux/slices/storeInfoSlice";

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
];

// ============================================================
// DEFAULT PERMISSIONS
// ============================================================

const DEFAULT_PERMISSIONS = {
  employees: false,
  products: false,
  brands: false,
  categories: false,
  profile: false,
  store: false,
  discounts: false,
  deals: false,
};

// ============================================================
// NORMALIZE PERMISSIONS
// ============================================================

function normalizePermissions(value) {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_PERMISSIONS,
    };
  }

  const normalized = {
    ...DEFAULT_PERMISSIONS,
  };

  Object.keys(DEFAULT_PERMISSIONS).forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    ) {
      normalized[key] =
        value[key] === true;
    }
  });

  return normalized;
}

// ============================================================
// GLOBAL SOCKET
// ============================================================

let sidebarSocket = null;

function getSidebarSocket() {
  const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    "http://localhost:5000";

  if (
    sidebarSocket &&
    sidebarSocket.connected
  ) {
    return sidebarSocket;
  }

  if (sidebarSocket) {
    return sidebarSocket;
  }

  sidebarSocket = io(SOCKET_URL, {
    withCredentials: true,

    transports: [
      "websocket",
      "polling",
    ],

    reconnection: true,

    reconnectionAttempts: Infinity,

    reconnectionDelay: 500,

    autoConnect: true,
  });

  return sidebarSocket;
}

// ============================================================
// DISCONNECT SOCKET
// ============================================================

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

  const queryClient =
    useQueryClient();

  const storeName = useSelector(
    (state) =>
      state.storeInfo.storeName
  );

  const primaryColor =
    useSelector(
      (state) =>
        state.storeInfo.primaryColor
    );

  const isLoaded =
    useSelector(
      (state) =>
        state.storeInfo.isLoaded
    );

  const isSelfDispatching =
    useRef(false);

  // ============================================================
  // SOCKET PERMISSIONS
  // ============================================================

  const [
    socketPermissions,
    setSocketPermissions,
  ] = useState(null);

  const [
    socketRole,
    setSocketRole,
  ] = useState(null);

  // ============================================================
  // APPLY PROFILE
  // ============================================================

  const applyProfileData =
    useCallback(
      (response) => {
        if (!response) {
          return;
        }

        const data =
          response?.data ||
          response?.user ||
          response;

        if (!data) {
          return;
        }

        const permissions =
          normalizePermissions(
            data.permissions
          );

        const role =
          String(
            data.role || ""
          ).toLowerCase();

        console.log(
          "======================================"
        );

        console.log(
          "📥 SIDEBAR PROFILE RECEIVED"
        );

        console.log(
          "👤 Role:",
          role
        );

        console.log(
          "🔐 Permissions:",
          permissions
        );

        console.log(
          "🎁 Deals permission:",
          permissions.deals
        );

        console.log(
          "======================================"
        );

        // --------------------------------------------------------
        // IMPORTANT
        // --------------------------------------------------------

        setSocketPermissions(
          permissions
        );

        setSocketRole(role);

        // --------------------------------------------------------
        // React Query cache
        // --------------------------------------------------------

        queryClient.setQueryData(
          ["profile"],
          (old) => {
            if (!old) {
              return {
                ...data,
                permissions,
                role,
              };
            }

            return {
              ...old,
              ...data,
              permissions,
              role,
            };
          }
        );
      },
      [queryClient]
    );

  // ============================================================
  // REQUEST FRESH PROFILE
  // ============================================================

  const requestFreshProfile =
    useCallback(() => {
      const socket =
        getSidebarSocket();

      if (!socket) {
        return;
      }

      if (socket.connected) {
        console.log(
          "🔄 Sidebar requesting fresh profile..."
        );

        socket.emit(
          "getProfile"
        );
      }
    }, []);

  // ============================================================
  // SOCKET CONNECT
  // ============================================================

  const handleConnect =
    useCallback(() => {
      const socket =
        sidebarSocket;

      console.log(
        "🟢 Sidebar socket connected:",
        socket?.id
      );

      if (socket) {
        socket.emit(
          "getProfile"
        );

        socket.emit(
          "getStoreInfo"
        );
      }
    }, []);

  // ============================================================
  // PROFILE DATA
  // ============================================================

  const handleProfileData =
    useCallback(
      (response) => {
        console.log(
          "📥 Sidebar profileData:",
          response
        );

        if (
          response?.success === false
        ) {
          console.warn(
            "⚠️ Sidebar profile request failed:",
            response?.message
          );

          return;
        }

        applyProfileData(
          response
        );
      },
      [applyProfileData]
    );

  // ============================================================
  // PROFILE UPDATED
  // ============================================================

  const handleProfileUpdated =
    useCallback(
      (response) => {
        console.log(
          "🔄 Sidebar profileUpdated:",
          response
        );

        if (
          response?.success === false
        ) {
          return;
        }

        applyProfileData(
          response
        );

        // ------------------------------------------------------
        // Extra fresh DB request
        // ------------------------------------------------------

        setTimeout(() => {
          requestFreshProfile();
        }, 100);
      },
      [
        applyProfileData,
        requestFreshProfile,
      ]
    );

  // ============================================================
  // PERMISSIONS UPDATED
  // ============================================================

  const handlePermissionsUpdated =
    useCallback(
      (response) => {
        console.log(
          "🔔 ======================================"
        );

        console.log(
          "🔔 SIDEBAR permissionsUpdated:"
        );

        console.log(
          response
        );

        console.log(
          "🔔 ======================================"
        );

        // ------------------------------------------------------
        // Sometimes backend sends:
        //
        // {
        //   permissions: {...}
        // }
        //
        // Sometimes:
        //
        // {
        //   data: {
        //      permissions: {...}
        //   }
        // }
        // ------------------------------------------------------

        const incomingPermissions =
          response?.permissions ||
          response?.data?.permissions ||
          response?.user?.permissions;

        if (
          !incomingPermissions
        ) {
          console.warn(
            "⚠️ permissionsUpdated has no permissions"
          );

          requestFreshProfile();

          return;
        }

        const permissions =
          normalizePermissions(
            incomingPermissions
          );

        console.log(
          "✅ Sidebar NEW permissions:",
          permissions
        );

        console.log(
          "🎁 Sidebar Deals:",
          permissions.deals
        );

        // ------------------------------------------------------
        // IMMEDIATE UI UPDATE
        // ------------------------------------------------------

        setSocketPermissions(
          permissions
        );

        if (
          response?.role !==
          undefined
        ) {
          setSocketRole(
            String(
              response.role
            ).toLowerCase()
          );
        }

        // ------------------------------------------------------
        // Update React Query
        // ------------------------------------------------------

        queryClient.setQueryData(
          ["profile"],
          (old) => {
            if (!old) {
              return {
                permissions,
                role:
                  response?.role ||
                  "",
              };
            }

            return {
              ...old,

              permissions,

              role:
                response?.role ??
                old.role,
            };
          }
        );

        // ------------------------------------------------------
        // Ask DB again
        // ------------------------------------------------------

        setTimeout(() => {
          requestFreshProfile();
        }, 150);
      },
      [
        queryClient,
        requestFreshProfile,
      ]
    );

  // ============================================================
  // SOCKET LISTENERS
  // ============================================================

  useEffect(() => {
    const socket =
      getSidebarSocket();

    // ----------------------------------------------------------
    // FIRST REGISTER LISTENERS
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // ALREADY CONNECTED
    // ----------------------------------------------------------

    if (socket.connected) {
      console.log(
        "🟢 Sidebar socket already connected:",
        socket.id
      );

      socket.emit(
        "getProfile"
      );

      socket.emit(
        "getStoreInfo"
      );
    }

    // ----------------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------------

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
  // FALLBACK FROM REACT QUERY
  // ============================================================

  const cachedProfile =
    queryClient.getQueryData(
      ["profile"]
    );

  // ============================================================
  // VISIBLE MENU ITEMS
  // ============================================================

  const visibleMenuItems =
    useMemo(() => {
      // --------------------------------------------------------
      // SOCKET DATA FIRST
      // --------------------------------------------------------

      let permissions =
        socketPermissions;

      let role =
        socketRole;

      // --------------------------------------------------------
      // React Query fallback
      // --------------------------------------------------------

      if (
        permissions === null
      ) {
        permissions =
          cachedProfile?.permissions ||
          userData?.permissions ||
          {};
      }

      if (
        role === null
      ) {
        role =
          cachedProfile?.role ||
          userData?.role ||
          "";
      }

      permissions =
        normalizePermissions(
          permissions
        );

      const normalizedRole =
        String(
          role || ""
        ).toLowerCase();

      console.log(
        "🔍 ======================================"
      );

      console.log(
        "🔍 SIDEBAR MENU CHECK"
      );

      console.log(
        "👤 Role:",
        normalizedRole
      );

      console.log(
        "🔐 Permissions:",
        permissions
      );

      console.log(
        "🎁 DEALS:",
        permissions.deals
      );

      console.log(
        "🔍 ======================================"
      );

      // ========================================================
      // ADMIN
      // ========================================================

      if (
        normalizedRole ===
          "admin" ||
        normalizedRole ===
          "administrator"
      ) {
        return allMenuItems;
      }

      // ========================================================
      // STAFF / EMPLOYEE
      // ========================================================

      return allMenuItems.filter(
        (item) => {
          // Dashboard always visible
          if (
            item.permissionKey ===
            null
          ) {
            return true;
          }

          const allowed =
            permissions[
              item.permissionKey
            ] === true;

          if (!allowed) {
            console.log(
              `🚫 Sidebar hiding ${item.name}`,
              {
                permissionKey:
                  item.permissionKey,

                value:
                  permissions[
                    item.permissionKey
                  ],
              }
            );
          } else {
            console.log(
              `✅ Sidebar showing ${item.name}`
            );
          }

          return allowed;
        }
      );
    }, [
      socketPermissions,
      socketRole,
      cachedProfile,
      userData,
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

    // ----------------------------------------------------------
    // STORE DATA
    // ----------------------------------------------------------

    const handleStoreData =
      (data) => {
        if (
          !data ||
          !data.store_name
        ) {
          return;
        }

        console.log(
          "📥 Sidebar store data:",
          data.store_name
        );

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

    // ----------------------------------------------------------
    // STORE INFO
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // STORE UPDATED
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // CONNECT
    // ----------------------------------------------------------

    const handleConnectStore =
      () => {
        console.log(
          "🟢 Sidebar store socket:",
          socket.id
        );

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
          console.log(
            "📥 Sidebar custom store event:",
            event.detail.store_name
          );

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
          console.log(
            "⚠️ Sidebar store failsafe..."
          );

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
      clearTimeout(timer);
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
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

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
            <span className="text-sm font-bold text-white">
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

      {/* ================================================== */}
      {/* NAVIGATION */}
      {/* ================================================== */}

      <nav
        aria-label="Main navigation"
        className="
          flex-1
          overflow-y-auto
          px-2 py-2
        "
      >
        <div className="space-y-0.5">
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
                  key={item.name}
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

                  <span className="truncate">
                    {
                      item.name
                    }
                  </span>
                </Link>
              );
            }
          )}
        </div>
      </nav>

      {/* ================================================== */}
      {/* FOOTER */}
      {/* ================================================== */}

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