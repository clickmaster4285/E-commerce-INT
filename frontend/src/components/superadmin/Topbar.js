"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sun, Moon, LogOut, ChevronDown, ChevronRight, ShieldCheck, Bell, Activity } from "lucide-react";
import { NAV } from "@/components/superadmin/Sidebar";
import { IconButton, Avatar, cx } from "@/components/superadmin/ui";

// /super-admin/applications/123 → [Signup Requests, Details]
const useBreadcrumbs = (pathname) => {
  const section = NAV.find((n) => pathname === n.href || pathname?.startsWith(`${n.href}/`));
  if (!section) return [];
  const crumbs = [{ label: section.label, href: section.href }];
  if (pathname !== section.href) crumbs.push({ label: pathname.endsWith("/new") ? `Add ${section.label.replace(/s$/, "").toLowerCase()}` : "Details" });
  return crumbs;
};

export default function Topbar({ onMenuClick, onLogout, adminName = "Super Admin", adminEmail = "", adminRole = "superadmin", theme = "light", onToggleTheme, loggingOut = false, pendingCount = 0 }) {
  const pathname = usePathname();
  const crumbs = useBreadcrumbs(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const isDark = theme === "dark";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-card px-3 sm:px-6">
      {/* LEFT — menu + breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2">
        <IconButton icon={Menu} label="Open menu" size="lg" onClick={onMenuClick} className="lg:hidden" />
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
          <Link href="/super-admin/dashboard" className="shrink-0 text-fg-muted transition-colors hover:text-fg">Super Admin</Link>
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={c.label} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight size={14} className="shrink-0 text-fg-muted/70 rtl:rotate-180" aria-hidden="true" />
                {last ? (
                  <span aria-current="page" className="truncate font-semibold text-fg">{c.label}</span>
                ) : (
                  <Link href={c.href} className="truncate text-fg-muted transition-colors hover:text-fg">{c.label}</Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* RIGHT — pending, theme, user */}
      <div className="flex shrink-0 items-center gap-1">
        <Link href="/super-admin/applications" aria-label={pendingCount ? `${pendingCount} pending signup requests` : "Signup requests"} title="Pending signup requests" className="sa-iconbtn sa-iconbtn--ghost sa-iconbtn--lg relative">
          <Bell size={18} aria-hidden="true" />
          {pendingCount > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-solid px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </Link>
        {onToggleTheme ? <IconButton icon={isDark ? Sun : Moon} label={isDark ? "Switch to light mode" : "Switch to dark mode"} size="lg" onClick={onToggleTheme} /> : null}

        <div className="relative ms-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={cx("flex h-10 items-center gap-2 rounded-lg border border-transparent py-1 pe-2 ps-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", menuOpen ? "bg-subtle" : "hover:bg-subtle")}
          >
            <Avatar name={adminName} size="sm" />
            <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-fg md:block">{adminName}</span>
            <ChevronDown size={14} aria-hidden="true" className={cx("hidden text-fg-muted transition-transform md:block", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div role="menu" className="sa-menu !absolute end-0 top-full mt-2 w-64 !p-0">
              <div className="border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={adminName} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-fg">{adminName}</span>
                    {adminEmail ? <span className="mt-0.5 block truncate text-[12px] text-fg-muted">{adminEmail}</span> : null}
                  </span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-accent">
                  <ShieldCheck size={12} aria-hidden="true" /> {adminRole === "staff" ? "Staff" : "Super Admin"}
                </span>
              </div>
              <div className="p-1.5">
                <Link href="/super-admin/activity" role="menuitem" onClick={() => setMenuOpen(false)} className="sa-menu__item">
                  <Activity size={15} aria-hidden="true" />
                  My activity
                </Link>
                <div className="sa-menu__sep" role="separator" />
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onLogout(); }} disabled={loggingOut} className="sa-menu__item sa-menu__item--danger">
                  <LogOut size={15} aria-hidden="true" />
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
