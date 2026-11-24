"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import FallbackImage from "@/components/common/FallbackImage";
import { LayoutDashboard, ClipboardList, Store, UserCog, BadgeDollarSign, ShieldCheck, X, PanelLeftClose, PanelLeftOpen, ExternalLink } from "lucide-react";
import { cx } from "@/components/superadmin/ui";

// Ek hi NAV list — Topbar breadcrumbs bhi isi se banta hai. superOnly = staff ko nahi dikhta.
export const NAV = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/applications", label: "Signup Requests", icon: ClipboardList, badgeKey: "pending" },
  { href: "/super-admin/stores", label: "Stores", icon: Store },
  { href: "/super-admin/plans", label: "Plans", icon: BadgeDollarSign },
  { href: "/super-admin/store-admins", label: "Store Admins", icon: ShieldCheck },
  { href: "/super-admin/team", label: "Employees", icon: UserCog },
];

const STORAGE_KEY = "super-admin-sidebar-collapsed";
const readCollapsed = () => { try { return window.localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; } };
const writeCollapsed = (v) => { try { window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch { /* private mode */ } };

export default function Sidebar({ open, onClose, pendingCount = 0, role = "superadmin" }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const items = NAV.filter((n) => !n.superOnly || role === "superadmin");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setCollapsed(readCollapsed()));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Route change par mobile drawer band
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapse = () => setCollapsed((prev) => { writeCollapsed(!prev); return !prev; });
  const expanded = !collapsed;

  return (
    <aside
      aria-label="Super Admin navigation"
      data-collapsed={collapsed || undefined}
      className={cx(
        "fixed inset-y-0 start-0 z-50 flex h-full shrink-0 flex-col bg-sidebar text-sidebar-fg transition-[width,transform] duration-200 ease-out lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      {/* Brand */}
      <div className={cx("flex h-16 shrink-0 items-center border-b border-sidebar-line", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link href="/super-admin/dashboard" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818cf8]" aria-label="Super Admin home" title={collapsed ? "Click Master" : undefined}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
            <FallbackImage src="/images/click-master-logo.webp" alt="Click Master" className="h-full w-full object-contain" />
          </span>
          {expanded && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14.5px] font-semibold tracking-tight text-white">Click Master</span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-fg-muted">Super Admin</span>
            </span>
          )}
        </Link>
        <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-white lg:hidden">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {expanded && <p className="mb-2 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-fg-muted/80">Platform</p>}
        <ul className="space-y-0.5">
          {items.map(({ href, label, icon: Icon, badgeKey }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            const badge = badgeKey === "pending" ? pendingCount : 0;
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} className={cx("sa-nav-link", collapsed && "justify-center px-0")}>
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
                  {expanded && <span className="min-w-0 flex-1 truncate">{label}</span>}
                  {badge > 0 && (expanded ? (
                    <span className="rounded-full bg-warning-solid px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums leading-none text-[#1c1105]">{badge > 99 ? "99+" : badge}</span>
                  ) : (
                    <span className="absolute end-2.5 top-2 h-2 w-2 rounded-full bg-warning-solid ring-2 ring-sidebar" aria-hidden="true" />
                  ))}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 space-y-1 border-t border-sidebar-line px-3 py-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className={cx("sa-nav-link", collapsed && "justify-center px-0")} title={collapsed ? "Open landing page" : undefined}>
          <ExternalLink size={17} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
          {expanded && <span className="truncate">Landing page</span>}
        </a>
        <button type="button" onClick={toggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed} className={cx("sa-nav-link hidden w-full lg:flex", collapsed && "justify-center px-0")}>
          {collapsed ? <PanelLeftOpen size={17} strokeWidth={1.9} aria-hidden="true" className="rtl:rotate-180" /> : <PanelLeftClose size={17} strokeWidth={1.9} aria-hidden="true" className="rtl:rotate-180" />}
          {expanded && <span className="truncate">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
