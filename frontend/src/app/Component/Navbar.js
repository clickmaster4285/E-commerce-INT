'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Menu, Sun, Moon, LogOut, User, ShieldCheck,
  Store, Activity, Settings, ChevronDown
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import axiosInstance from "@/apis/axiosInstance";

const profileOptions = [
  { name: "Profile Settings", icon: User, path: "/admin/profile?tab=general" },
  { name: "Security", icon: ShieldCheck, path: "/admin/profile?tab=security" },
  { name: "Store Info", icon: Store, path: "/admin/profile?tab=store" },
  { name: "Permissions", icon: ShieldCheck, path: "/admin/profile?tab=permissions" },
  { name: "Activity", icon: Activity, path: "/admin/profile?tab=activity" },
  { name: "Preferences", icon: Settings, path: "/admin/profile?tab=preferences" },
];

export default function Navbar({ theme, toggleTheme, onMenuClick }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

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
    if (!window.confirm('Are you sure you want to logout?')) return;
    try { await axiosInstance.post("/users/logout"); }
    catch (e) { console.error("Logout error:", e); }
    finally { router.push('/login'); }
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
          style={{
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          }}
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
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                boxShadow: isOpen || isProfileActive
                  ? '0 0 0 2px rgba(139, 92, 246, 0.3), 0 2px 8px rgba(139, 92, 246, 0.25)'
                  : '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              A
            </div>

            {/* Name - Desktop only */}
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span
                className="text-[13px] font-semibold"
                style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}
              >
                Admin
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
              {/* Backdrop for mobile */}
              <div
                className="fixed inset-0 z-40 sm:hidden"
                onClick={() => setIsOpen(false)}
              />

              <div
                className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl sm:w-64"
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
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                      }}
                    >
                      A
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13px] font-semibold truncate"
                        style={{ color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)' }}
                      >
                        Admin
                      </p>
                      <p
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)' }}
                      >
                        Company Admin
                      </p>
                    </div>
                    {/* Online dot */}
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: '#10b981',
                        boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)',
                      }}
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
                          color: isActive
                            ? '#10b981'
                            : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)',
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
                          style={{
                            color: isActive
                              ? '#10b981'
                              : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                          }}
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

      {/* Animations */}
      <style>{`
        @keyframes navDropdownIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </header>
  );
}