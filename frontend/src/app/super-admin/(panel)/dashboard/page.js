"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Store,
  LayoutGrid,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Ban,
  ShoppingBag,
  ScrollText,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import StatusBadge from "@/components/superadmin/StatusBadge";
import StatCard from "@/components/superadmin/StatCard";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const CHART_COLORS = { area: "var(--accent)", grid: "var(--border-color)" };

export default function SuperAdminDashboardPage() {
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["superadmin-dashboard"],
    queryFn: superAdminApi.getDashboard,
    retry: 1,
    staleTime: 15000,
  });

  const totals = useMemo(() => data?.data?.totals || {}, [data]);
  const recentRequests = useMemo(() => data?.data?.recentRequests || [], [data]);
  const recentUsers = useMemo(() => data?.data?.recentUsers || [], [data]);
  const recentActivity = useMemo(() => data?.data?.recentActivity || [], [data]);
  const registrationSeries = useMemo(() => data?.data?.registrationSeries || [], [data]);

  const hero = useMemo(
    () => [
      { label: "Total Users", value: totals.totalUsers ?? 0, icon: Users, tone: "accent", hint: "All registered customers & sellers" },
      { label: "Total Sellers", value: totals.totalSellers ?? 0, icon: ShoppingBag, tone: "accent", hint: "Approved store owners" },
      { label: "Total Stores", value: totals.totalStores ?? 0, icon: Store, tone: "accent", hint: "All stores on the platform" },
      { label: "Pending Requests", value: totals.pendingApplications ?? 0, icon: ClipboardList, tone: "warning", hint: "Awaiting your review" },
      { label: "Approved Stores", value: totals.approvedApplications ?? 0, icon: CheckCircle2, tone: "success", hint: "Active sellers" },
      { label: "Rejected Requests", value: totals.rejectedApplications ?? 0, icon: XCircle, tone: "danger", hint: "Declined applications" },
      { label: "Suspended Stores", value: totals.suspendedStores ?? 0, icon: Ban, tone: "danger", hint: "Store access restricted" },
    ],
    [totals]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform overview"
        subtitle="Real-time health of the multi-tenant store network."
        actions={
          <button type="button" onClick={() => refetch()} className="btn-secondary h-10">
            Refresh
          </button>
        }
      />

      {/* Errors / loading */}
      {isError && (
        <div
          role="alert"
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}
        >
          Failed to load dashboard data.{" "}
          <button type="button" onClick={() => refetch()} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse p-4" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {hero.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>
      )}

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Registration chart */}
        <section className="card lg:col-span-7 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Registrations · Last 7 days
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">New customer signups per day</p>
            </div>
            <LayoutGrid size={18} className="text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={registrationSeries} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="4 6" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--text-muted)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--text-muted)" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--accent-soft)" }}
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12 }}
                />
                <defs>
                  <linearGradient id="regAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="count" name="Signups" stroke={CHART_COLORS.area} fill="url(#regAreaFill)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Approval split */}
        <section className="card lg:col-span-5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Approval split</h2>
          <div className="mt-3 flex items-end gap-6">
            <SplitMetric label="Approved" value={totals.approvedApplications ?? 0} color="var(--success-text)" />
            <SplitMetric label="Pending" value={totals.pendingApplications ?? 0} color="var(--warning-text)" />
            <SplitMetric label="Rejected" value={totals.rejectedApplications ?? 0} color="var(--danger-text)" />
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full bg-[var(--success)] transition-all"
              style={{ width: `${pct(totals.approvedApplications, totals)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase text-[var(--text-muted)]">
            <span>Approved {pct(totals.approvedApplications, totals, 0)}%</span>
            <span>Total {((totals.approvedApplications ?? 0) + (totals.pendingApplications ?? 0) + (totals.rejectedApplications ?? 0))}</span>
          </div>
        </section>
      </div>

      {/* Recent signups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="card lg:col-span-7 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-3.5">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent signup requests</h2>
            <button onClick={() => router.push("/super-admin/applications")} className="text-[11px] font-bold text-[var(--accent)] hover:underline">
              View all
            </button>
          </div>
          {recentRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <ClipboardList size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">No requests yet. Sellers who register will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {recentRequests.map((r) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/super-admin/applications/${r._id}`)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-[var(--bg-row-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{r.name}</p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{r.store_name} · {r.email}</p>
                    </div>
                    <StatusBadge value={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent users */}
        <section className="card lg:col-span-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-3.5">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent users</h2>
            <button onClick={() => router.push("/super-admin/users")} className="text-[11px] font-bold text-[var(--accent)] hover:underline">
              View all
            </button>
          </div>
          {recentUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Users size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">No users yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {recentUsers.map((u) => (
                <li key={u._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{u.name}</p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                    {u.storeId ? "Seller" : "Customer"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent activity</h2>
          <button onClick={() => router.push("/super-admin/activity")} className="text-[11px] font-bold text-[var(--accent)] hover:underline">
            Full log
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ScrollText size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--text-muted)]">No activity recorded yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((a) => (
              <li key={a._id} className="flex items-start gap-2.5 text-[12px]">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span className="min-w-0 truncate text-[var(--text-secondary)]">{a.action}</span>
                <span className="ml-auto shrink-0 text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                  {timeAgo(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function pct(value = 0, totals = {}, floor = 0) {
  const sum = (totals.approvedApplications ?? 0) + (totals.pendingApplications ?? 0) + (totals.rejectedApplications ?? 0);
  if (!sum) return floor;
  return Math.round(((value ?? 0) / sum) * 100);
}

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SplitMetric({ label, value, color }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-2xl font-semibold tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
