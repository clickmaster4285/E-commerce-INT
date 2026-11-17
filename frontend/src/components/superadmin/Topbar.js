"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, ChevronDown, ShieldCheck } from "lucide-react";

export default function Topbar({ onMenuClick, onLogout, breadcrumb, adminName = "Super Admin" }) {
  const router = useRouter();
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

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-navbar)] px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] lg:hidden"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-[12px] sm:flex">
          <span className="font-semibold text-[var(--text-muted)]">Super Admin</span>
          <span aria-hidden="true" className="text-[var(--text-subtle)]">/</span>
          <span className="truncate font-bold text-[var(--text-primary)]">{breadcrumb}</span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          className="hidden items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 sm:inline-flex"
          title="Dedicated Super Admin session"
        >
          <ShieldCheck size={12} aria-hidden="true" />
          Super Admin
        </span>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] pl-1.5 pr-2 text-left transition hover:border-[var(--text-subtle)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-black text-white">
              {String(adminName || "SA").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[120px] truncate text-[12px] font-bold text-[var(--text-primary)]">{adminName}</span>
              <span className="block text-[10px] font-semibold text-[var(--text-muted)]">Full access</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" className={`text-[var(--text-muted)] transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-[70] w-52 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-1.5 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); router.push("/super-admin/settings"); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]"
              >
                Account settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
