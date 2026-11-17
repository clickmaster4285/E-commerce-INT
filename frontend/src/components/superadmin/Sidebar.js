"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Users,
  ScrollText,
  Settings,
  X,
} from "lucide-react";

const NAV = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/applications", label: "Signup Requests", icon: ClipboardList, badgeKey: "pending" },
  { href: "/super-admin/stores", label: "Store Management", icon: Store },
  { href: "/super-admin/users", label: "User Management", icon: Users },
  { href: "/super-admin/activity", label: "Activity Logs", icon: ScrollText },
  { href: "/super-admin/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ open, onClose, pendingCount = 0 }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-[270px] flex-col border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] text-[var(--text-sidebar)] transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-label="Super Admin navigation"
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-sidebar)] px-5">
        <Link href="/super-admin/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="Super Admin home">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-white/20">
            <img src="/images/click-master-logo.webp" alt="Click Master" className="h-full w-full object-contain" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-[var(--text-sidebar)]">Click Master</span>
            <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-sidebar-muted)]">
              Super Admin
            </span>
          </span>
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
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-sidebar-muted)]">
          Platform
        </p>
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
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--bg-sidebar-active)] text-white"
                      : "text-[var(--text-sidebar-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)]"
                  }`}
                >
                  <Icon
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={`shrink-0 ${active ? "text-white" : "text-[var(--text-sidebar-muted)] group-hover:text-[var(--text-sidebar)]"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge > 0 && (
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

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--border-sidebar)] px-5 py-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-sidebar-muted)]">
          Multi-tenant Platform
        </p>
        <p className="mt-1 text-[11px] leading-4 text-[var(--text-sidebar-muted)]">
          Manage sellers, stores, users and approvals in one place.
        </p>
      </div>
    </aside>
  );
}
