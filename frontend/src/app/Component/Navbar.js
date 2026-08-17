'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Menu, Sun, Moon, LogOut, User, ChevronDown
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import axiosInstance from "@/apis/axiosInstance";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { disconnectSidebarSocket } from "./Sidebar";

// ✅ GLOBAL singleton socket for navbar
let navbarSocket = null;

function getNavbarSocket() {
  if (navbarSocket && navbarSocket.connected) return navbarSocket;

  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

  navbarSocket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });

  return navbarSocket;
}

const profileOptions = [
  { name: "Profile Settings", icon: User, path: "/admin/profile?tab=general" },
];

export default function Navbar({ theme, toggleTheme, onMenuClick, userData }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // ✅ Socket-based live user data (name, email)
  const [liveUser, setLiveUser] = useState(null);

  // ✅ FIX: Jab pathname change ho (login/logout) to liveUser reset karo
  useEffect(() => {
    setLiveUser(null);
  }, [pathname]);

  // ✅ Fetch live user data via socket — pathname dependency se login pe re-run hoga
  useEffect(() => {
    const socket = getNavbarSocket();

    const handleProfileData = (res) => {
      if (!res) return;
      const data = res.data || res.user || res;
      if (data && (data.name || data._id)) {
        console.log("📥 Navbar socket → profile data:", data.name, data.email);
        setLiveUser(data);
      }
    };

    const handleProfileUpdated = (res) => {
      const data = res?.data || res?.user || res;
      if (data && (data.name || data._id)) {
        console.log("🔄 Navbar socket → profile updated:", data.name, data.email);
        setLiveUser(data);
      }
    };

    const handleEmployeeUpdated = (res) => {
      const data = res?.data || res;
      if (!data || !data._id) return;
      
      const currentUserId = liveUser?._id || userData?._id;
      if (currentUserId && data._id.toString() === currentUserId.toString()) {
        console.log("🔄 Navbar socket → MY employee data updated:", data.name, data.email);
        setLiveUser((prev) => ({
          ...(prev || {}),
          ...data,
          permissions: data.permissions || prev?.permissions || {},
        }));
      }
    };

    const handlePermissionsUpdated = (data) => {
      console.log("🔔 Navbar socket → permissionsUpdated, re-fetching profile...");
      socket.emit("getProfile");
    };

    const handleConnect = () => {
      console.log("🟢 Navbar socket connected:", socket.id);
      socket.emit("getProfile");
    };

    if (socket.connected) {
      socket.emit("getProfile");
    } else {
      socket.on("connect", handleConnect);
    }

    socket.on("profileData", handleProfileData);
    socket.on("profileUpdated", handleProfileUpdated);
    socket.on("permissionsUpdated", handlePermissionsUpdated);
    socket.on("employeeUpdated", handleEmployeeUpdated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("profileData", handleProfileData);
      socket.off("profileUpdated", handleProfileUpdated);
      socket.off("permissionsUpdated", handlePermissionsUpdated);
      socket.off("employeeUpdated", handleEmployeeUpdated);
    };
  }, [pathname]);

  // ✅ Merge: liveUser (socket) priority, fallback to userData (prop)
  const currentUser = liveUser || userData || {};
  const displayName = currentUser.name || "User";
  const displayEmail = currentUser.email || "";
  const userRole = currentUser.role || userData?.role || "";
  const firstLetter = displayName?.charAt(0)?.toUpperCase() || "U";
  const isAdmin = userRole?.toLowerCase() === "admin";
  
  const avatarGradient = isAdmin 
    ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' 
    : 'linear-gradient(135deg, #10b981, #14b8a6)';

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setIsOpen(false); }, [pathname]);

  const handleLogout = async () => {
    setIsOpen(false);
    
    toast.warning("Are you sure you want to logout?", {
      description: "You will need to login again to access your account.",
      duration: 5000,
      action: {
        label: "Yes, Logout",
        onClick: async () => {
          try {
            await axiosInstance.post("/users/logout");
            toast.success("Logged out successfully!");
          } catch (e) {
            console.error("Logout error:", e);
            toast.error("Logout failed. Please try again.");
          } finally {
            // ✅ Dono sockets disconnect karo taake next login pe fresh connection ho
            if (navbarSocket) {
              navbarSocket.disconnect();
              navbarSocket = null;
            }
            disconnectSidebarSocket();
            setLiveUser(null);
            router.push('/login');
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const isProfileActive = pathname.startsWith("/admin/profile");

  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between px-3 sm:px-5 backdrop-blur-xl transition-colors duration-300"
      style={{
        backgroundColor: isDark ? 'rgba(10, 12, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {/* ===== LEFT ===== */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 active:scale-95 md:hidden"
          style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* ===== RIGHT ===== */}
      <div className="flex items-center gap-1 sm:gap-1.5">

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark ? 'Light mode' : 'Dark mode'}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 active:scale-95"
          style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
            e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Divider */}
        <div
          className="mx-1 hidden h-5 w-px sm:block"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        />

        {/* ===== PROFILE DROPDOWN ===== */}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 sm:pr-2.5 transition-all duration-150"
            style={{
              backgroundColor: isOpen || isProfileActive
                ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isOpen && !isProfileActive)
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
            }}
            onMouseLeave={(e) => {
              if (!isOpen && !isProfileActive)
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Avatar */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white transition-shadow duration-200"
              style={{
                background: avatarGradient,
                boxShadow: isOpen || isProfileActive
                  ? `0 0 0 2px ${isAdmin ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}, 0 2px 8px ${isAdmin ? 'rgba(139, 92, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
                  : '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              {firstLetter}
            </div>

            {/* ✅ Display Name — Sirf asli naam */}
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span
                className="text-[13px] font-semibold truncate max-w-[120px]"
                style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}
              >
                {displayName}
              </span>
            </div>

            {/* Chevron */}
            <ChevronDown
              size={13}
              className="hidden sm:block transition-transform duration-200"
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
              }}
            />
          </button>

          {/* ===== DROPDOWN PANEL ===== */}
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setIsOpen(false)} />

              <div
                className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl"
                style={{
                  backgroundColor: isDark ? '#13151f' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  boxShadow: isDark
                    ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
                    : '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
                  animation: 'navDropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* --- User Header --- */}
                <div
                  className="px-4 py-3.5"
                  style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        background: avatarGradient,
                        boxShadow: `0 2px 8px ${isAdmin ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      }}
                    >
                      {firstLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13px] font-semibold truncate"
                        style={{ color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)' }}
                      >
                        {displayName}
                      </p>
                      {displayEmail && (
                        <p
                          className="text-[11px] truncate mt-0.5"
                          style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }}
                        >
                          {displayEmail}
                        </p>
                      )}
                    </div>
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: '#10b981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)' }}
                    />
                  </div>
                </div>

                {/* --- Menu Items --- */}
                <div className="py-1.5 px-1.5">
                  {profileOptions.map((option) => {
                    const Icon = option.icon;
                    const tabParam = option.path.split("?tab=")[1];
                    const isActive =
                      pathname.startsWith("/admin/profile") &&
                      new URLSearchParams(pathname.split("?")[1] || "").get("tab") === tabParam;

                    return (
                      <Link
                        key={option.name}
                        href={option.path}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-100"
                        style={{
                          backgroundColor: isActive
                            ? isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.06)'
                            : 'transparent',
                          color: isActive ? '#10b981' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                            e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
                          }
                        }}
                      >
                        <Icon
                          size={15}
                          className="shrink-0"
                          style={{ color: isActive ? '#10b981' : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
                        />
                        {option.name}
                      </Link>
                    );
                  })}
                </div>

                {/* --- Sign Out --- */}
                <div
                  className="px-1.5 pb-1.5 pt-0.5"
                  style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
                >
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-100"
                    style={{ color: isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(220, 38, 38, 0.8)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)';
                      e.currentTarget.style.color = isDark ? '#f87171' : '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(220, 38, 38, 0.8)';
                    }}
                  >
                    <LogOut size={15} className="shrink-0" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes navDropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
}