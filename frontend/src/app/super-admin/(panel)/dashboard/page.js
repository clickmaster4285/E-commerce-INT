"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Store,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Ban,
  ShoppingBag,
  RefreshCw,
  Inbox,
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
import PageHeader from "@/components/superadmin/PageHeader";
import StatCard from "@/components/superadmin/StatCard";
import SectionCard from "@/components/superadmin/SectionCard";
import StatusBadge from "@/components/superadmin/StatusBadge";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const initialsOf = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function SuperAdminDashboardPage() {
  const router = useRouter();

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["superadmin-dashboard"],
    queryFn: superAdminApi.getDashboard,
    retry: 1,
    staleTime: 15000,
  });

  const totals = useMemo(() => data?.data?.totals || {}, [data]);
  const recentRequests = useMemo(() => data?.data?.recentRequests || [], [data]);
  const recentUsers = useMemo(() => data?.data?.recentUsers || [], [data]);
  const registrationSeries = useMemo(() => data?.data?.registrationSeries || [], [data]);
  const allZero = useMemo(
    () => registrationSeries.length > 0 && registrationSeries.every((p) => !p.count),
    [registrationSeries]
  );

  const approvalTotal =
    (totals.approvedApplications ?? 0) + (totals.pendingApplications ?? 0) + (totals.rejectedApplications ?? 0);
  const approvalPct = (value) => (approvalTotal ? Math.round((value / approvalTotal) * 100) : 0);

  const cards = [
    { label: "Users", value: totals.totalUsers ?? 0, icon: Users, tone: "accent" },
    { label: "Sellers", value: totals.totalSellers ?? 0, icon: ShoppingBag, tone: "accent" },
    { label: "Stores", value: totals.totalStores ?? 0, icon: Store, tone: "accent" },
    { label: "Pending", value: totals.pendingApplications ?? 0, icon: ClipboardList, tone: "warning" },
    { label: "Approved", value: totals.approvedApplications ?? 0, icon: CheckCircle2, tone: "success" },
    { label: "Rejected", value: totals.rejectedApplications ?? 0, icon: XCircle, tone: "danger" },
    { label: "Suspended", value: totals.suspendedStores ?? 0, icon: Ban, tone: "danger" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Overview of sellers, stores and users."
        breadcrumbs={[{ label: "Super Admin" }, { label: "Dashboard" }]}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-ghost h-10 gap-2 text-[13px] font-medium text-[var(--text-secondary)]"
          >
            <RefreshCw size={15} aria-hidden="true" className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

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

      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} loading={isLoading} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          title="Registrations"
          description="New customer signups, last 7 days"
          bodyClassName="px-4 py-4"
        >
          {isLoading ? (
            <div className="skeleton h-52 w-full rounded-xl" />
          ) : allZero || registrationSeries.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-center">
              <Inbox size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">No signups in the last 7 days.</p>
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={registrationSeries} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="4 6" />
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
                  <Area type="monotone" dataKey="count" name="Signups" stroke="var(--accent)" strokeWidth={2} fill="url(#regAreaFill)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Approvals"
          description="Seller application outcomes"
          bodyClassName="flex min-h-[190px] flex-col justify-center px-5 py-5"
        >
          {approvalTotal === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <ClipboardList size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">No requests yet.</p>
            </div>
          ) : (
            <>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]"
                role="img"
                aria-label={`Approved ${approvalPct(totals.approvedApplications ?? 0)}%, pending ${approvalPct(totals.pendingApplications ?? 0)}%, rejected ${approvalPct(totals.rejectedApplications ?? 0)}%`}
              >
                <div className="h-full bg-[var(--success)] transition-all duration-300" style={{ width: `${approvalPct(totals.approvedApplications ?? 0)}%` }} />
                <div className="h-full bg-[var(--warning)] transition-all duration-300" style={{ width: `${approvalPct(totals.pendingApplications ?? 0)}%` }} />
                <div className="h-full bg-[var(--danger)] transition-all duration-300" style={{ width: `${approvalPct(totals.rejectedApplications ?? 0)}%` }} />
              </div>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                {[
                  { label: "Approved", value: totals.approvedApplications ?? 0, dot: "var(--success)" },
                  { label: "Pending", value: totals.pendingApplications ?? 0, dot: "var(--warning)" },
                  { label: "Rejected", value: totals.rejectedApplications ?? 0, dot: "var(--danger)" },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: row.dot }} aria-hidden="true" />
                    <span className="flex-1 text-[var(--text-secondary)]">{row.label}</span>
                    <span className="font-semibold tabular-nums text-[var(--text-primary)]">{row.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Recent signup requests"
          bodyClassName=""
          action={
            <button type="button" onClick={() => router.push("/super-admin/applications")} className="text-[13px] font-medium text-[var(--accent)] hover:underline">
              View all
            </button>
          }
        >
          {recentRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <ClipboardList size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">No signup requests yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {recentRequests.map((r) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/super-admin/applications/${r._id}`)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--bg-row-hover)] focus-visible:outline-none focus-visible:bg-[var(--bg-row-hover)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
                      {initialsOf(r.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{r.name}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">{r.store_name} · {r.email}</span>
                    </span>
                    <StatusBadge value={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent users"
          bodyClassName=""
          action={
            <button type="button" onClick={() => router.push("/super-admin/users")} className="text-[13px] font-medium text-[var(--accent)] hover:underline">
              View all
            </button>
          }
        >
          {recentUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Users size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">No users yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {recentUsers.map((u) => (
                <li key={u._id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
                    {initialsOf(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{u.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">{u.email}</span>
                  </span>
                  <span className="badge badge-neutral">{u.storeId ? "Seller" : "Customer"}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
