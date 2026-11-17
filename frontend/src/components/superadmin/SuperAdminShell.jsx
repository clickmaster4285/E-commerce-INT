"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

export default function SuperAdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ status: "loading", admin: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Checking session" />
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
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
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
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
