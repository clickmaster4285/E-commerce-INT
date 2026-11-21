"use client";

import { useState } from "react";
import { Activity, CalendarDays, CalendarRange } from "lucide-react";
import { PageHeader, StatCard } from "@/components/superadmin/ui";
import ActivityFeed from "@/components/superadmin/ActivityFeed";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

// Apni activity — sidebar me nahi, user menu (Topbar) se khulti hai
export default function MyActivityPage() {
  const [stats, setStats] = useState(null);
  return (
    <div className="space-y-6">
      <PageHeader title="My activity" description="Everything you've done in the Super Admin panel, newest first." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today" value={stats?.today ?? 0} icon={CalendarDays} tone="accent" hint="Since midnight" loading={!stats} />
        <StatCard label="Last 7 days" value={stats?.week ?? 0} icon={CalendarRange} tone="info" hint="Including today" loading={!stats} />
        <StatCard label="All time" value={stats?.all ?? 0} icon={Activity} tone="neutral" hint="Since your account was created" loading={!stats} />
      </div>
      <ActivityFeed queryKey={["superadmin-my-activity"]} fetcher={superAdminApi.myActivity} onStats={setStats} />
    </div>
  );
}
