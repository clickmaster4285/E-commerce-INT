"use client";

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { Tag, Wallet, Package } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const fmt = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString()}`;
const fmtShort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
};
const rangeTabs = (t) => [
  { key: "7d", label: t("dateRange.7dShort") },
  { key: "30d", label: t("dateRange.30dShort") },
  { key: "3m", label: t("dateRange.3mShort") },
  { key: "6m", label: t("dateRange.6mShort") },
  { key: "1y", label: t("dateRange.1yShort") },
];
const CHART_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ec4899", "#94a3b8"];

function CardHead({ icon: Icon, title, subtitle, action, compact }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-line-card ${compact ? "mb-4 pb-3" : "mb-5 pb-4"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent-soft text-accent shadow-sm">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-bold tracking-tight text-fg">{title}</h3>
          {subtitle && <p className="mt-1 truncate text-[11.5px] text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function SectionEmpty({ icon: Icon = Package, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-fg-muted">
        <Icon size={20} />
      </span>
      <p className="text-[12.5px] text-fg-muted">{children}</p>
    </div>
  );
}

/* ==================== REVENUE OVERVIEW ==================== */
function ChartTooltip({ active, payload, label }) {
  const { t: __t } = useTranslation();
  const t = (k, p) => __t("admin.dashboard." + k, p);
  if (!active || !payload?.length) return null;

  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const orders = payload.find((p) => p.dataKey === "orders")?.value ?? 0;
  const average = Number(orders) > 0 ? Math.round(Number(revenue) / Number(orders)) : 0;

  return (
    <div className="animate-fade-in min-w-[168px] rounded-xl border border-line-card bg-card px-3.5 py-2.5 shadow-[var(--shadow-lg)]">
      <p className="mb-2 border-b border-line-card pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-fg-muted">
        {label}
      </p>

      <p className="flex items-center gap-2 text-xs text-fg">
        <span className="h-2 w-2 rounded-sm bg-blue-500" />
        {t("revenueOverview.revenue")}
        <b className="ms-auto tabular-nums">{fmt(revenue)}</b>
      </p>

      <p className="mt-1 flex items-center gap-2 text-xs text-fg">
        <span className="h-2 w-2 rounded-full bg-purple-500" />
        {t("revenueOverview.orders")}
        <b className="ms-auto tabular-nums">{orders}</b>
      </p>

          </div>
  );
}

export function RevenueOverview({ data, range, onRangeChange }) {
  const { t: __t } = useTranslation();
  const t = (k, p) => __t("admin.dashboard." + k, p);
  const series = data?.series || [];

  const totals = series.reduce(
    (acc, item) => ({
      revenue: acc.revenue + (Number(item?.revenue) || 0),
      orders: acc.orders + (Number(item?.orders) || 0),
    }),
    { revenue: 0, orders: 0 }
  );

  const averageRevenue =
    series.length > 0 ? Math.round(totals.revenue / series.length) : 0;

  const summary = [
    { label: t("revenueOverview.revenue"), value: fmt(totals.revenue), color: "#3b82f6" },
    { label: t("revenueOverview.orders"), value: totals.orders.toLocaleString(), color: "#a855f7" },
  ];

  const tabs = rangeTabs(t);

  return (
    <div className="card animate-slide-up flex min-w-0 flex-col rounded-xl p-4 shadow-[var(--shadow-sm)]">
      <CardHead
        compact
        icon={Wallet}
        title={t("revenueOverview.title")}
        subtitle={t("revenueOverview.subtitle")}
        action={
          <div className="no-scrollbar flex max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-line-card bg-page-alt p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onRangeChange(tab.key)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  range === tab.key
                    ? "bg-card text-accent shadow-[var(--shadow-sm)] ring-1 ring-line-card"
                    : "text-fg-muted hover:bg-card hover:text-fg"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Period summary — compact inline chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        {summary.map((s) => (
          <span key={s.label} className="flex min-w-0 items-center gap-2 rounded-xl border border-line-card bg-page-alt px-3 py-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              {s.label}
            </span>
            <span
              className="truncate text-[13px] font-bold tabular-nums tracking-tight text-fg"
              title={s.value}
            >
              {s.value}
            </span>
          </span>
        ))}

        <span className="ms-auto hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-success md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t("revenueOverview.reportingPoints", { count: series.length })}
        </span>
      </div>

      {series.length === 0 ? (
        <SectionEmpty icon={Wallet}>{t("revenueOverview.noData")}</SectionEmpty>
      ) : (
        <div className="mt-1 h-[175px] w-full min-w-0 sm:h-[195px] lg:h-[220px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={140}>
            <ComposedChart
              data={series}
              margin={{ top: 8, right: 4, left: -14, bottom: 0 }}
              animationDuration={500}
              animationEasing="ease-out"
            >
              <defs>
                <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="ordFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="rgba(148,163,184,0.2)" />

              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5, fill: "#94a3b8" }}
                tickMargin={6}
                interval="preserveStartEnd"
                minTickGap={14}
              />

              <YAxis
                yAxisId="rev"
                tickFormatter={(v) => fmtShort(v)}
                tick={{ fontSize: 10.5, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickCount={5}
              />
              <YAxis yAxisId="ord" orientation="right" hide />

              <Tooltip
                content={<ChartTooltip />}
                cursor={{
                  fill: "rgba(59,130,246,0.06)",
                  stroke: "rgba(59,130,246,0.35)",
                  strokeDasharray: "4 4",
                }}
              />

              <ReferenceLine
                yAxisId="rev"
                y={averageRevenue}
                stroke="rgba(148,163,184,0.55)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: t("revenueOverview.average"),
                  position: "insideTopRight",
                  fontSize: 9.5,
                  fill: "#94a3b8",
                }}
              />

              <Area
                yAxisId="ord"
                type="monotone"
                dataKey="orders"
                stroke="none"
                fill="url(#ordFill)"
                isAnimationActive={false}
              />

              <Area
                yAxisId="rev"
                type="monotone"
                dataKey="revenue"
                fill="url(#revBar)"
                stroke="#2563eb"
                strokeWidth={2.5}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                animationDuration={600}
              />

              <Line
                yAxisId="ord"
                type="monotone"
                dataKey="orders"
                stroke="#a855f7"
                strokeWidth={2}
                strokeLinecap="round"
                dot={{ r: 2.5, fill: "#a855f7", strokeWidth: 0 }}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff" }}
                animationDuration={700}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ==================== SALES DISTRIBUTION ==================== */
export function SalesDistribution({ data }) {
  const { t: __t } = useTranslation();
  const t = (k, p) => __t("admin.dashboard." + k, p);
  const dist = (data?.distribution || []).filter((d) => d.value > 0);
  const total = dist.reduce((s, d) => s + d.value, 0);
  const isRevenue = (dist[0]?.basis || "revenue") === "revenue";
  const formatValue = (v) => (isRevenue ? fmt(v) : t("salesDistribution.productsCount", { count: v }));

  return (
    <div className="card animate-slide-up flex flex-col rounded-2xl p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <CardHead icon={Tag} title={t("salesDistribution.title")} subtitle={t("salesDistribution.subtitle")} />

      {dist.length === 0 ? (
        <SectionEmpty icon={Tag}>{t("salesDistribution.noData")}</SectionEmpty>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-[190px] w-[190px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={3}
                  cornerRadius={4}
                  strokeWidth={0}
                >
                  {dist.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatValue(v)} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="max-w-[110px] truncate text-[15px] font-extrabold text-fg">
                {isRevenue ? fmtShort(total) : total}
              </span>
              <span className="text-[10.5px] text-fg-muted">
                {isRevenue ? t("salesDistribution.totalSales") : t("salesDistribution.products")}
              </span>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-3">
            {dist.map((d, i) => {
              const percent = total ? Math.round((d.value / total) * 100) : 0;

              return (
                <li key={`${d.name}-${i}`} className="group">
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="truncate text-fg-muted" title={d.name}>
                        {d.name}
                      </span>
                    </span>

                    <span className="shrink-0 font-bold tabular-nums text-fg">
                      {percent}%
                    </span>
                  </div>

                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(percent, 2)}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

