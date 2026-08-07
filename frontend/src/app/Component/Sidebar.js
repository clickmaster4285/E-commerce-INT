"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  FolderOpen,
  Tag,
  Package,
  LayoutDashboard,
  X,
  Store,
} from "lucide-react";

// ✅ MENU ORDER: Store Info is at the BOTTOM (after Products)
const menu = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { name: "Brands", icon: Tag, path: "/admin/brands" },
  { name: "Categories", icon: FolderOpen, path: "/admin/categories" },
  { name: "Products", icon: Package, path: "/admin/products" },
  { name: "Store Info", icon: Store, path: "/admin/store-info" },
];

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();

  // ✅ Route change pe sidebar band karo (layout ke closeSidebar se)
  useEffect(() => {
    if (onNavigate) onNavigate();
  }, [pathname]);

  return (
    <>
      {/* ❌ Mobile Open Button — HATA DIYA (Navbar mein already hai) */}

      {/* ❌ Mobile Overlay — HATA DIYA (Layout mein already hai) */}

      {/* Sidebar */}
      <aside
        className="
          flex h-screen w-[200px] flex-col
          overflow-hidden
          border-r border-[var(--border-sidebar)]
          bg-[var(--bg-sidebar)]
          text-[var(--text-sidebar)]
          shadow-sm
        "
      >
        {/* Header / Logo */}
        <div
          className="
            flex h-16 shrink-0
            items-center justify-between
            gap-2
            border-b border-[var(--border-sidebar)]
            px-3
          "
        >
          <Link
            href="/admin/dashboard"
            onClick={onNavigate}
            className="flex min-w-0 items-center gap-2"
          >
            <div
              className="
                flex h-8 w-8 shrink-0
                items-center justify-center
                rounded-lg
                bg-emerald-500
              "
            >
              <span className="text-sm font-bold text-emerald-950">C</span>
            </div>

            <span
              className="
                truncate text-sm font-semibold
                tracking-tight
                text-[var(--text-primary)]
              "
            >
              ClickMaster
            </span>
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close sidebar"
            className="
              shrink-0 rounded-md p-1
              text-[var(--text-muted)]
              transition-colors
              hover:bg-[var(--bg-sidebar-hover)]
              hover:text-[var(--text-primary)]
              md:hidden
            "
          >
            <X size={14} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          className="flex-1 overflow-y-auto px-2 py-2"
        >
          <div className="space-y-0.5">
            {menu.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.path ||
                pathname.startsWith(`${item.path}/`);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`
                    flex h-8 items-center
                    gap-2 rounded-md px-2.5
                    text-xs font-medium
                    transition-colors
                    ${
                      active
                        ? "bg-[var(--bg-sidebar-hover)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
                    }
                  `}
                >
                  <Icon
                    size={16}
                    className={`
                      shrink-0
                      ${
                        active
                          ? "text-emerald-500"
                          : "text-[var(--text-muted)]"
                      }
                    `}
                  />

                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="
            shrink-0
            border-t border-[var(--border-sidebar)]
            px-3 py-2
          "
        >
          <p
            className="
              text-center text-[10px]
              text-[var(--text-muted)]
            "
          >
            Powered by{" "}
            <span className="font-medium text-[var(--text-secondary)]">
              ClickMasters
            </span>{" "}
            · v1.0
          </p>
        </div>
      </aside>
    </>
  );
}