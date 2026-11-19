"use client";

import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export default function Topbar({
  onMenuClick,
  onLogout,
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
    <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] px-3 sm:px-5">
      {/* LEFT — mobile menu only (breadcrumbs live in PageHeader) */}
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] lg:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      {/* RIGHT — theme toggle + user menu */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {onToggleTheme ? (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        ) : null}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={`flex h-11 items-center gap-2.5 rounded-lg py-1 pe-1.5 ps-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:pe-2 ${
              menuOpen ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_58%,var(--bg-sidebar)))] text-[11px] font-semibold text-white">
              {initials}
            </span>
            <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-[var(--text-primary)] sm:block">
              {adminName}
            </span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`hidden text-[var(--text-muted)] transition-transform duration-150 sm:block ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute end-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
            >
              {/* User header with role pill */}
              <div className="border-b border-[var(--border-color)] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_58%,var(--bg-sidebar)))] text-[12px] font-semibold text-white">
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
                    ) : null}
                  </span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  <ShieldCheck size={11} aria-hidden="true" />
                  Super Admin
                </span>
              </div>

              <div className="p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)] disabled:opacity-60"
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
