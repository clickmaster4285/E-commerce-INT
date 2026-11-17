"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import Sidebar from "@/components/superadmin/Sidebar";
import Topbar from "@/components/superadmin/Topbar";

const BREADCRUMBS = {
  "/super-admin/dashboard": "Dashboard",
  "/super-admin/applications": "Signup Requests",
  "/super-admin/stores": "Store Management",
  "/super-admin/users": "User Management",
  "/super-admin/activity": "Activity Logs",
  "/super-admin/settings": "Settings",
};

const readThemeCookie = () => {
  try {
    const match = document.cookie.match(/(?:^|;)\s*theme\s*=\s*([^;]+)/);
    return decodeURIComponent(match?.[1] || "light") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export default function SuperAdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ status: "loading", admin: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState("light");

  // Same `theme` cookie the admin panel uses — the root layout applies it to
  // <html class="dark"> before first paint for /admin and /super-admin.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTheme(readThemeCookie()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.classList.toggle("dark", next === "dark");
      } catch {
        // Cookie failures should not break the panel
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    superAdminApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setState({ status: "authed", admin: res?.data || null });
      })
      .catch(() => {
        if (cancelled) return;
        router.replace("/super-admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await superAdminApi.logout();
    } catch {
      // still clear locally and leave
    }
    router.replace("/super-admin/login");
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <span className="spinner" aria-label="Checking session" />
      </div>
    );
  }

  const base = pathname?.replace(/\/$/, "");
  const breadcrumb = BREADCRUMBS[base] || "Super Admin";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Mobile scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingCount={state.admin?.pendingApplications || 0}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setSidebarOpen((v) => !v)}
          onLogout={handleLogout}
          breadcrumb={breadcrumb}
          adminName={state.admin?.name || "Super Admin"}
          adminEmail={state.admin?.email || ""}
          theme={theme}
          onToggleTheme={toggleTheme}
          loggingOut={loggingOut}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--bg-secondary)] px-3 py-4 sm:px-5 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
