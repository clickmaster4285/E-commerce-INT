"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, Store, ClipboardList, CheckCircle2, XCircle, Ban, ShoppingBag, RefreshCw, Inbox, ArrowRight, TrendingUp } from "lucide-react";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Card, CardHeader, CardBody, Button, StatusBadge, Badge, Avatar, Alert, EmptyState, Skeleton } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { timeAgo } from "@/lib/superadminFormat";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="sa-card px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      <p className="font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="mt-0.5 text-[var(--text-muted)]">
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">{payload[0].value}</span> signup{payload[0].value === 1 ? "" : "s"}
      </p>
    </div>
  );
};

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
  const series = useMemo(() => data?.data?.registrationSeries || [], [data]);
  const weekTotal = useMemo(() => series.reduce((sum, p) => sum + (p.count || 0), 0), [series]);

  const pending = totals.pendingApplications ?? 0;
  const approved = totals.approvedApplications ?? 0;
  const rejected = totals.rejectedApplications ?? 0;
  const reviewTotal = pending + approved + rejected;
  const pct = (n) => (reviewTotal ? Math.round((n / reviewTotal) * 100) : 0);

  const kpis = [
    { label: "Pending requests", value: pending, icon: ClipboardList, tone: "warning", href: "/super-admin/applications", hint: pending ? "Waiting for your review" : "Inbox is clear", linkLabel: "Review" },
    { label: "Active sellers", value: totals.totalSellers ?? 0, icon: ShoppingBag, tone: "accent", href: "/super-admin/stores", hint: `${totals.totalStores ?? 0} store${totals.totalStores === 1 ? "" : "s"} on the platform` },
    { label: "Customers", value: totals.totalUsers ?? 0, icon: Users, tone: "info", href: "/super-admin/users", hint: `${weekTotal} joined in the last 7 days` },
    { label: "Suspended stores", value: totals.suspendedStores ?? 0, icon: Ban, tone: totals.suspendedStores ? "danger" : "neutral", href: "/super-admin/stores", hint: totals.suspendedStores ? "Blocked from trading" : "No stores suspended" },
  ];

  const split = [
    { label: "Approved", value: approved, color: "var(--success)", icon: CheckCircle2 },
    { label: "Pending", value: pending, color: "var(--warning)", icon: ClipboardList },
    { label: "Rejected", value: rejected, color: "var(--danger)", icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="What needs your attention across sellers, stores and customers."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>Refresh</Button>}
      />

      {isError && (
        <Alert tone="danger" title="Couldn't load dashboard data" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>}>
          Check that the backend is running, then try again.
        </Alert>
      )}

      {pending > 0 && !isLoading && (
        <Alert tone="warning" title={`${pending} seller request${pending === 1 ? "" : "s"} waiting for review`} action={<Button size="sm" variant="primary" iconRight={ArrowRight} href="/super-admin/applications">Review now</Button>}>
          Sellers can&apos;t open their store until you approve them.
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => <StatCard key={k.label} {...k} loading={isLoading} />)}
      </div>

      {/* Chart + approvals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Customer signups" description="New customer accounts per day, last 7 days" action={!isLoading && <Badge tone="accent" dot={false}><TrendingUp size={12} aria-hidden="true" />{weekTotal} this week</Badge>} />
          <CardBody className="px-2 pb-3 pt-4 sm:px-4">
            {isLoading ? (
              <Skeleton className="mx-3 h-56 rounded-xl" />
            ) : series.length === 0 || weekTotal === 0 ? (
              <EmptyState icon={Inbox} title="No signups this week" description="New customer accounts will chart here as they register." compact />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saRegFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 5" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11.5} stroke="var(--text-muted)" dy={6} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="var(--text-muted)" allowDecimals={false} width={40} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
                    <Area type="monotone" dataKey="count" name="Signups" stroke="var(--accent)" strokeWidth={2} fill="url(#saRegFill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--bg-card)", fill: "var(--accent)" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Seller review outcomes" description="All signup requests to date" />
          <CardBody>
            {isLoading ? (
              <div className="space-y-4"><Skeleton className="h-3 w-full rounded-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : reviewTotal === 0 ? (
              <EmptyState icon={ClipboardList} title="No requests yet" description="Outcomes appear once sellers start applying." compact />
            ) : (
              <>
                <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]" role="img" aria-label={`Approved ${pct(approved)}%, pending ${pct(pending)}%, rejected ${pct(rejected)}%`}>
                  {split.map((s) => s.value > 0 && <div key={s.label} className="h-full first:rounded-s-full last:rounded-e-full" style={{ width: `${pct(s.value)}%`, background: s.color }} />)}
                </div>
                <ul className="mt-5 divide-y divide-[var(--border-color)]">
                  {split.map((s) => (
                    <li key={s.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                      <span className="flex-1 text-[13px] text-[var(--text-secondary)]">{s.label}</span>
                      <span className="text-[12px] tabular-nums text-[var(--text-muted)]">{pct(s.value)}%</span>
                      <span className="w-8 text-end text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{s.value}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-[var(--border-color)] pt-3 text-[12px] text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-primary)]">{reviewTotal}</span> requests total
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent signup requests" action={<Button variant="link" size="sm" iconRight={ArrowRight} href="/super-admin/applications">View all</Button>} />
          {isLoading ? (
            <ListSkeleton />
          ) : recentRequests.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No signup requests yet" compact />
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {recentRequests.map((r) => (
                <li key={r._id}>
                  <button type="button" onClick={() => router.push(`/super-admin/applications/${r._id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-start transition-colors hover:bg-[var(--bg-row-hover)] focus-visible:bg-[var(--bg-row-hover)] focus-visible:outline-none">
                    <Avatar name={r.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{r.store_name || r.name}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">{r.name} · {r.email}</span>
                    </span>
                    <span className="hidden shrink-0 text-[12px] text-[var(--text-muted)] sm:block">{timeAgo(r.created_at)}</span>
                    <StatusBadge value={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent customers" action={<Button variant="link" size="sm" iconRight={ArrowRight} href="/super-admin/users">View all</Button>} />
          {isLoading ? (
            <ListSkeleton />
          ) : recentUsers.length === 0 ? (
            <EmptyState icon={Users} title="No customers yet" compact />
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {recentUsers.map((u) => (
                <li key={u._id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{u.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">{u.email}</span>
                  </span>
                  <span className="hidden shrink-0 text-[12px] text-[var(--text-muted)] sm:block">{timeAgo(u.created_at)}</span>
                  <StatusBadge value={u.storeId ? "seller" : "customer"} dot={false} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-[var(--border-color)]">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <span className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></span>
          <Skeleton className="h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
