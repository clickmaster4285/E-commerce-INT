"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import FallbackImage from "@/components/common/FallbackImage";
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Users,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const NAV = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/applications", label: "Signup Requests", icon: ClipboardList, badgeKey: "pending" },
  { href: "/super-admin/stores", label: "Store Management", icon: Store },
  { href: "/super-admin/users", label: "User Management", icon: Users },
];

const STORAGE_KEY = "super-admin-sidebar-collapsed";

const readCollapsed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeCollapsed = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage may be unavailable (private mode); keep UI state only
  }
};

export default function Sidebar({ open, onClose, pendingCount = 0 }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restore persisted collapse state (client-only)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setCollapsed(readCollapsed()));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Close the mobile drawer on route change
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };

  const showExpanded = !collapsed;

  return (
    <aside
      className={`super-sidebar fixed inset-y-0 start-0 z-50 flex h-full shrink-0 flex-col border-e border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] text-[var(--text-sidebar)] transition-[width,transform] duration-200 ease-in-out lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "w-[68px]" : "w-[220px]"}`}
      aria-label="Super Admin navigation"
      data-collapsed={collapsed || undefined}
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-sidebar)] px-3">
        <Link
          href="/super-admin/dashboard"
          className="flex h-11 min-w-0 items-center gap-2.5 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Super Admin home"
          title={collapsed ? "Click Master" : undefined}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-white/15">
            <FallbackImage src="/images/click-master-logo.webp" alt="Click Master" className="h-full w-full object-contain" />
          </span>
          {showExpanded && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold tracking-tight text-[var(--text-sidebar)]">Click Master</span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-sidebar-muted)]">
                Super Admin
              </span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="rounded-lg p-2 text-[var(--text-sidebar-muted)] transition-colors hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)] lg:hidden"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            const badge = badgeKey === "pending" ? pendingCount : 0;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={`group relative flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13px] font-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    active
                      ? "super-nav-active"
                      : "text-[var(--text-sidebar-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)]"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={`shrink-0 ${active ? "" : "text-[var(--text-sidebar-muted)] group-hover:text-[var(--text-sidebar)]"}`}
                  />
                  {showExpanded && <span className="min-w-0 flex-1 truncate">{label}</span>}
                  {showExpanded && badge > 0 && (
                    <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#1c1105]">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle + footer */}
      <div className="shrink-0 border-t border-[var(--border-sidebar)] px-2 py-3">
        {showExpanded ? (
          <p className="px-2 text-[12px] leading-4 text-[var(--text-sidebar-muted)]">
            Platform control panel
          </p>
        ) : null}
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-1 hidden h-9 w-full items-center justify-center rounded-[10px] text-[var(--text-sidebar-muted)] transition-colors hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] lg:flex"
        >
          {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
        </button>
      </div>
    </aside>
  );
}
