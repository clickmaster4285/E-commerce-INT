
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  FolderOpen,
  Tag,
  Package,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";

const menu = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
  },
  {
    name: "Brands",
    icon: Tag,
    path: "/admin/brands",
  },
  {
    name: "Categories",
    icon: FolderOpen,
    path: "/admin/categories",
  },
  {
    name: "Products",
    icon: Package,
    path: "/admin/products",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Open Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open sidebar"
        className="
          fixed left-4 top-4 z-[60]
          rounded-lg
          border border-[var(--border-color)]
          bg-[var(--bg-sidebar)]
          p-2.5
          text-[var(--text-sidebar)]
          shadow-md
          transition-colors
          hover:bg-[var(--bg-sidebar-hover)]
          lg:hidden
        "
      >
        <Menu size={21} />
      </button>

      {/* Mobile Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="
            fixed inset-0 z-40
            bg-black/40
            lg:hidden
          "
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50
          flex h-screen w-[260px] flex-col
          overflow-hidden
          border-r border-[var(--border-sidebar)]
          bg-[var(--bg-sidebar)]
          text-[var(--text-sidebar)]
          shadow-xl
          transition-transform duration-300
          lg:sticky lg:translate-x-0 lg:shadow-none
          ${open? "translate-x-0": "-translate-x-full"}
        `}
      >
        {/* Brand Header */}
        <div
          className="
            relative flex h-[78px] shrink-0
            items-center gap-3
            border-b border-[var(--border-sidebar)]
            bg-[var(--bg-sidebar)]
            px-5
          "
        >
          {/* CM Monogram */}
          <div
            className="
              relative flex h-10 w-10 shrink-0
              items-center justify-center
              rounded-xl
              border border-emerald-500/40
              bg-[#0f2a2a]
              shadow-sm
            "
          >
            <div className="absolute inset-1 rounded-lg border border-emerald-400/20" />

            <span
              className="
                relative z-10
                text-[15px]
                font-extrabold
                tracking-[-0.08em]
                text-emerald-400
              "
            >
              CM
            </span>
          </div>

          {/* Brand Name */}
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
              Click Master
            </h1>

            <p className="mt-1 truncate text-[10px] font-medium leading-tight text-[var(--text-muted)]">
              Admin Control Panel
            </p>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
            className="
              ml-auto shrink-0
              rounded-md p-1
              text-[var(--text-muted)]
              transition-colors
              hover:bg-[var(--bg-sidebar-hover)]
              hover:text-[var(--text-primary)]
              lg:hidden
            "
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <div className="flex flex-col gap-1.5">
            {menu.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.path ||
                pathname.startsWith(`${item.path}/`);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setOpen(false)}
                  className={`
                    group flex h-11 w-full
                    items-center gap-3
                    rounded-lg
                    border-l-2
                    px-4
                    text-sm font-medium
                    transition-all duration-200

                    ${
                      active
? `
                          border-l-[var(--accent)]
                          bg-[var(--bg-sidebar-active)]
                          text-[var(--text-primary)]
                        `
: `
                          border-l-transparent
                          text-[var(--text-secondary)]
                          hover:bg-[var(--bg-sidebar-hover)]
                          hover:text-[var(--text-primary)]
                        `
                    }
                  `}
                >
                  <Icon
                    size={19}
                    strokeWidth={active? 2.4: 2}
                    className={`
                      shrink-0
                      transition-transform duration-200
                      ${
                        active
? "text-[var(--accent)]"
: "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                      }
                    `}
                  />

                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div
          className="
            shrink-0
            border-t border-[var(--border-sidebar)]
            px-5 py-4
          "
        >
          <p className="text-[10px] font-medium text-[var(--text-muted)]">
            Powered by{" "}
            <span className="text-[var(--text-secondary)]">
              ClickMasters
            </span>{" "}
            <span className="mx-1 text-[var(--border-color)]">·</span>
            <span className="text-[var(--text-muted)]">v1.0</span>
          </p>
        </div>
      </aside>
    </>
  );
}