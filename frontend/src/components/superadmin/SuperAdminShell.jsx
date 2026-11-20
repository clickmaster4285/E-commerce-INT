"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import Sidebar from "@/components/superadmin/Sidebar";
import Topbar from "@/components/superadmin/Topbar";

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
  const [state, setState] = useState({ status: "loading", admin: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState("light");

  // Same `theme` cookie the admin panel uses — root layout applies it to <html class="dark"> before first paint
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
      } catch { /* cookie failures should not break the panel */ }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    superAdminApi.me()
      .then((res) => { if (!cancelled) setState({ status: "authed", admin: res?.data || null }); })
      .catch(() => { if (!cancelled) router.replace("/super-admin/login"); });
    return () => { cancelled = true; };
  }, [router]);

  // Sidebar/topbar badge — dashboard totals se live pending count (requests mutate hone par invalidate hota hai)
  const { data: dashboard } = useQuery({
    queryKey: ["superadmin-dashboard"],
    queryFn: superAdminApi.getDashboard,
    enabled: state.status === "authed",
    staleTime: 15000,
    retry: 1,
  });
  const pendingCount = dashboard?.data?.totals?.pendingApplications ?? state.admin?.pendingApplications ?? 0;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await superAdminApi.logout(); } catch { /* still leave */ }
    router.replace("/super-admin/login");
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <span className="spinner" aria-label="Checking session" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} pendingCount={pendingCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setSidebarOpen((v) => !v)}
          onLogout={handleLogout}
          adminName={state.admin?.name || "Super Admin"}
          adminEmail={state.admin?.email || ""}
          theme={theme}
          onToggleTheme={toggleTheme}
          loggingOut={loggingOut}
          pendingCount={pendingCount}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
