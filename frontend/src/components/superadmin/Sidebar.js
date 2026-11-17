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
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-[270px] flex-col border-r border-white/5 bg-[#0b1220] transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-label="Super Admin navigation"
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-5">
        <Link href="/super-admin/dashboard" className="flex items-center gap-2.5" aria-label="Super Admin home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-black text-white shadow-lg shadow-blue-500/30">
            SA
          </span>
          <span className="leading-none">
            <span className="block text-[15px] font-black tracking-tight text-white">Click Master</span>
            <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.25em] text-blue-400">
              Super Admin
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="rounded-lg p-2 text-white/60 hover:bg-white/5 lg:hidden"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
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
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold tabular-nums text-amber-950">
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
      <div className="shrink-0 border-t border-white/5 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Multi-tenant Platform
        </p>
        <p className="mt-1 text-[11px] leading-4 text-white/45">
          Manage sellers, stores, users and approvals in one place.
        </p>
      </div>
    </aside>
  );
}
