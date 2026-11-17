"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  Settings,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export default function Topbar({
  onMenuClick,
  onLogout,
  breadcrumb,
  adminName = "Super Admin",
  adminEmail = "",
  theme = "light",
  onToggleTheme,
  loggingOut = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isDark = theme === "dark";
  const initials =
    String(adminName || "Super Admin")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SA";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-navbar)] bg-[color-mix(in_srgb,var(--bg-navbar)_94%,transparent)] px-3 backdrop-blur-xl sm:px-5">
      {/* LEFT — menu + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] lg:hidden"
        >
          <Menu size={19} aria-hidden="true" />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12px]">
          <span className="font-medium text-[var(--text-muted)]">Super Admin</span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">/</span>
          <span className="truncate font-semibold text-[var(--text-primary)]">{breadcrumb}</span>
        </nav>
      </div>

      {/* RIGHT */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] md:inline-flex">
          <ShieldCheck size={12} aria-hidden="true" />
          Super Admin
        </span>

        {/* Theme toggle */}
        {onToggleTheme ? (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
        ) : null}

        {/* Divider */}
        <div className="mx-1 hidden h-5 w-px bg-[var(--border-navbar)] sm:block" aria-hidden="true" />

        {/* Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={`flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1.5 transition-colors sm:pr-2 ${
              menuOpen ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_58%,var(--bg-sidebar)))] text-[11px] font-bold text-white">
              {initials}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-none text-[var(--text-primary)]">
                {adminName}
              </span>
              <span className="mt-1 block text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--text-muted)]">
                Full access
              </span>
            </span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`hidden text-[var(--text-muted)] transition-transform sm:block ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute end-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
            >
              {/* User header */}
              <div className="border-b border-[var(--border-color)] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_58%,var(--bg-sidebar)))] text-[12px] font-bold text-white">
                    {initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
                      {adminName}
                    </span>
                    {adminEmail ? (
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
                        {adminEmail}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                        Full access
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1.5">
                <Link
                  role="menuitem"
                  href="/super-admin/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={16} aria-hidden="true" />
                  Account settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-60"
                >
                  <LogOut size={16} aria-hidden="true" />
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
