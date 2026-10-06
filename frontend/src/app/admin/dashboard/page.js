"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BadgePercent,
  Bookmark,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Cog,
  FolderOpen,
  FolderPlus,
  LayoutDashboard,
  Minus,
  Package,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
  Star,
  Tag,
  Tags,
  Wallet,
  Zap,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";

import { dashboardApi } from "../../../apis/admin/dashboardApi";
import { useStoreSocketSync } from "../../../hooks/useStoreSocketSync";
import { useSocket } from "../../../hooks/useSocket";

/* ==================== HELPERS ==================== */
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const fmt = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString()}`;

const fmtShort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
};

const imageUrl = (raw) => {
  if (!raw) return null;
  const s = String(raw);
  if (s.startsWith("http")) return s;
  return `${API_ORIGIN}${s.startsWith("/") ? "" : "/"}${s}`;
};

const timeAgo = (date) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const ORDER_STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  confirmed: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  shipped: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const ACTIVITY_META = {
  "Order Management": { icon: "cart", classes: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" },
  "Product Management": { icon: "package", classes: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  "Coupon Management": { icon: "tag", classes: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  "Brand Management": { icon: "brand", classes: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
};

const RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "3m", label: "Last 3 Months" },
  { key: "6m", label: "Last 6 Months" },
  { key: "1y", label: "Last 1 Year" },
];

const RANGE_TABS = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
];

const CHART_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ec4899", "#94a3b8"];

const TREND_TONES = {
  up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  down: "bg-red-500/10 text-red-500 dark:text-red-400",
  flat: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

const trendTone = (value) => (value > 0 ? "up" : value < 0 ? "down" : "flat");

// Socket events that should trigger a live dashboard refresh
const LIVE_EVENTS = [
  "order:created", "order:updated", "order:deleted", "order:statusChanged", "order:paymentUpdated",
  "productCreated", "productUpdated", "productDeleted",
  "brandCreated", "brandUpdated", "brandDeleted",
  "categoryCreated", "categoryUpdated", "categoryDeleted",
  "deal:created", "deal:updated", "deal:deleted",
  "discount:created", "discount:updated", "discount:deleted", "activity:new",
];

/* ==================== SMALL PIECES ==================== */
function CardHead({ icon: Icon, title, subtitle, action, compact }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 border-b border-[var(--border-card)] ${
        compact ? "mb-4 pb-3" : "mb-5 pb-4"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/10 bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
          <Icon size={17} />
        </span>

        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-bold tracking-tight text-[var(--text-primary)]">{title}</h3>
          {subtitle && (
            <p className="mt-1 truncate text-[11.5px] text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function SectionEmpty({ icon: Icon = Package, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        <Icon size={20} />
      </span>
      <p className="text-[12.5px] text-[var(--text-muted)]">{children}</p>
    </div>
  );
}

function Sparkline({ data, color, id }) {
  const w = 76;
  const h = 36;
  const arr = data?.length ? data : [0, 0];
  const max = Math.max(...arr, 1);
  const pts = arr.map((v, i) => {
    const x = (i / Math.max(arr.length - 1, 1)) * w;
    const y = h - 6 - (v / max) * (h - 14);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = pts[pts.length - 1]?.split(",") || [0, 0];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-9 w-[76px] shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="5" fill={color} opacity="0.22" />
    </svg>
  );
}

/* ==================== STAT CARDS ==================== */
function StatCards({ data }) {
  const orderCount = Number(data?.orders?.count) || 0;
  const revenueFactor = 1 + (Number(data?.revenue?.trend) || 0) / 100;
  const ordersFactor = 1 + (Number(data?.orders?.trend) || 0) / 100;
  const cards = [
    {
      title: "Total Revenue",
      value: fmt(data?.revenue?.total),
      trend: data?.revenue?.trend ?? 0,
      icon: Wallet,
      color: "#3b82f6",
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      spark: data?.sparklines?.revenue,
    },
    {
      title: "Total Orders",
      value: orderCount.toLocaleString(),
      trend: data?.orders?.trend ?? 0,
      icon: ShoppingCart,
      color: "#a855f7",
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      spark: data?.series?.map((point) => Number(point.orders) || 0),
    },
    {
      title: "Total Products",
      value: data?.counts?.products ?? 0,
      trend: data?.counts?.productsTrend ?? 0,
      icon: Package,
      color: "#f97316",
      bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      spark: data?.sparklines?.products,
    },
    {
      title: "Total Brands",
      value: data?.counts?.brands ?? 0,
      trend: data?.counts?.brandsTrend ?? 0,
      icon: Bookmark,
      color: "#8b5cf6",
      bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      spark: data?.sparklines?.brands,
    },
    {
      title: "Total Categories",
      value: data?.counts?.categories ?? 0,
      trend: data?.counts?.categoriesTrend ?? 0,
      icon: FolderOpen,
      color: "#06b6d4",
      bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      spark: data?.sparklines?.categories,
    },
    {
      title: "Featured Products",
      value: data?.counts?.featuredProducts ?? 0,
      trend: data?.counts?.featuredProductsTrend ?? 0,
      icon: Star,
      color: "#f59e0b",
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      spark: data?.sparklines?.featuredProducts,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c, i) => {
        const TrendIcon = c.trend > 0 ? ArrowUp : c.trend < 0 ? ArrowDown : Minus;
        const isText = typeof c.value === "string";

        return (
          <div
            key={c.title}
            className="card card-hover animate-slide-up group relative overflow-hidden rounded-xl p-3.5 shadow-[var(--shadow-sm)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 opacity-80"
              style={{ background: `linear-gradient(90deg, ${c.color}, ${c.color}22 75%, transparent)` }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
              style={{ background: c.color }}
            />

            <div className="relative min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${c.bg}`}
                >
                  <c.icon size={15} />
                </span>
                <p className="min-w-0 flex-1 whitespace-nowrap text-[11px] font-semibold leading-tight text-[var(--text-muted)]" title={c.title}>
                  {c.title}
                </p>
              </div>

              <div className="mt-2 flex min-w-0 items-end justify-between gap-1.5">
                <p
                  className={`min-w-0 truncate font-extrabold tracking-tight tabular-nums text-[var(--text-primary)] ${
                    isText ? "text-[17px]" : "text-[22px]"
                  }`}
                  title={String(c.value)}
                >
                  {c.value}
                </p>
                <Sparkline data={c.spark} color={c.color} id={`spark-${i}`} />
              </div>
            </div>

            <div className="relative mt-2.5 flex items-center gap-2 border-t border-[var(--border-card)] pt-2">
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${TREND_TONES[trendTone(c.trend)]}`}
              >
                <TrendIcon size={11} />
                {Math.abs(c.trend)}%
              </span>
              <span className="truncate text-[11px] text-[var(--text-muted)]">vs previous period</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==================== REVENUE OVERVIEW ==================== */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const orders = payload.find((p) => p.dataKey === "orders")?.value ?? 0;
  const average = Number(orders) > 0 ? Math.round(Number(revenue) / Number(orders)) : 0;

  return (
    <div className="animate-fade-in min-w-[168px] rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] px-3.5 py-2.5 shadow-[var(--shadow-lg)]">
      <p className="mb-2 border-b border-[var(--border-card)] pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>

      <p className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
        <span className="h-2 w-2 rounded-sm bg-blue-500" />
        Revenue
        <b className="ml-auto tabular-nums">{fmt(revenue)}</b>
      </p>

      <p className="mt-1 flex items-center gap-2 text-xs text-[var(--text-primary)]">
        <span className="h-2 w-2 rounded-full bg-purple-500" />
        Orders
        <b className="ml-auto tabular-nums">{orders}</b>
      </p>

          </div>
  );
}

function RevenueOverview({ data, range, onRangeChange }) {
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
    { label: "Revenue", value: fmt(totals.revenue), color: "#3b82f6" },
    { label: "Orders", value: totals.orders.toLocaleString(), color: "#a855f7" },
  ];

  return (
    <div className="card animate-slide-up flex min-w-0 flex-col rounded-xl p-4 shadow-[var(--shadow-sm)]">
      <CardHead
        compact
        icon={Wallet}
        title="Revenue Overview"
        subtitle="Store performance across the selected period"
        action={
          <div className="no-scrollbar flex max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-card)] bg-[var(--bg-secondary)] p-1">
            {RANGE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onRangeChange(t.key)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  range === t.key
                    ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--border-card)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Period summary — compact inline chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        {summary.map((s) => (
          <span key={s.label} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-secondary)] px-3 py-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {s.label}
            </span>
            <span
              className="truncate text-[13px] font-bold tabular-nums tracking-tight text-[var(--text-primary)]"
              title={s.value}
            >
              {s.value}
            </span>
          </span>
        ))}

        <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {series.length} reporting points
        </span>
      </div>

      {series.length === 0 ? (
        <SectionEmpty icon={Wallet}>No revenue data for this period</SectionEmpty>
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
                  value: "Avg",
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
function SalesDistribution({ data }) {
  const dist = (data?.distribution || []).filter((d) => d.value > 0);
  const total = dist.reduce((s, d) => s + d.value, 0);
  const isRevenue = (dist[0]?.basis || "revenue") === "revenue";
  const formatValue = (v) => (isRevenue ? fmt(v) : `${v} product${v === 1 ? "" : "s"}`);

  return (
    <div className="card animate-slide-up flex flex-col rounded-2xl p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <CardHead icon={Tag} title="Sales Distribution" subtitle="By product category" />

      {dist.length === 0 ? (
        <SectionEmpty icon={Tag}>No sales data yet</SectionEmpty>
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
              <span className="max-w-[110px] truncate text-[15px] font-extrabold text-[var(--text-primary)]">
                {isRevenue ? fmtShort(total) : total}
              </span>
              <span className="text-[10.5px] text-[var(--text-muted)]">
                {isRevenue ? "Total Sales" : "Products"}
              </span>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-3">
            {dist.map((d, i) => {
              const percent = total ? Math.round((d.value / total) * 100) : 0;

              return (
                <li key={d.name} className="group">
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="truncate text-[var(--text-muted)]" title={d.name}>
                        {d.name}
                      </span>
                    </span>

                    <span className="shrink-0 font-bold tabular-nums text-[var(--text-primary)]">
                      {percent}%
                    </span>
                  </div>

                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
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

/* ==================== RECENT ACTIVITY ==================== */
function RecentActivity({ data }) {
  const items = data?.activities || [];
  const ICONS = { cart: ShoppingCart, package: Package, tag: Tag, brand: Bookmark };

  return (
    <div className="card animate-slide-up flex h-full flex-col rounded-2xl p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <CardHead icon={Zap} title="Recent Activity" subtitle="Latest events across your store" />

      {items.length === 0 ? (
        <SectionEmpty icon={Zap}>No activity yet</SectionEmpty>
      ) : (
        <ul className="custom-scrollbar max-h-[320px] flex-1 space-y-0.5 overflow-y-auto pr-1">
          {items.map((a, i) => {
            const meta =
              ACTIVITY_META[a.category] ||
              { icon: "system", classes: "bg-slate-200 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400" };
            const Icon = ICONS[meta.icon] || Cog;
            const isLast = i === items.length - 1;

            return (
              <li key={a.key} className="relative flex gap-3 pb-3.5 last:pb-0">
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[15px] top-9 h-full w-px bg-[var(--border-card)]"
                  />
                )}

                <span
                  className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.classes}`}
                >
                  <Icon size={15} />
                </span>

                <span className="min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--bg-tertiary)]">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
                        {a.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-muted)]">
                        {a.subtitle}
                      </span>
                    </span>

                    <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                      {timeAgo(a.timestamp)}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ==================== RECENT ORDERS ==================== */
function RecentOrders({ data }) {
  const orders = data?.recentOrders || [];

  return (
    <div className="card animate-slide-up flex flex-col rounded-2xl p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <CardHead
        icon={ShoppingCart}
        title="Recent Orders"
        subtitle="Latest customer orders"
        action={
          <Link
            href="/admin/orders"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-card)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            View All <ChevronRight size={12} />
          </Link>
        }
      />

      {orders.length === 0 ? (
        <SectionEmpty icon={ShoppingCart}>No orders yet</SectionEmpty>
      ) : (
        <ul className="custom-scrollbar -mx-1 flex-1 divide-y divide-[var(--border-card)] overflow-y-auto px-1">
          {orders.map((o) => (
            <li key={String(o.id)}>
              <Link
                href="/admin/orders"
                className="group flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-tertiary)]">
                  {o.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(o.image)}
                      alt={o.order_number}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <Package size={16} className="text-[var(--text-muted)]" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-[var(--text-primary)]">
                      #{o.order_number}
                    </span>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--text-primary)]">
                      {fmt(o.total)}
                    </span>
                  </span>

                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] text-[var(--text-muted)]">{o.customer}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        ORDER_STATUS_STYLES[o.status] || ""
                      }`}
                    >
                      {o.status}
                    </span>
                  </span>

                  <span className="mt-0.5 block text-right text-[10px] text-[var(--text-muted)]">
                    {timeAgo(o.created_at)}
                  </span>
                </span>

                <ChevronRight
                  size={14}
                  className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ==================== TOP SELLING PRODUCTS ==================== */
const RANK_STYLES = [
  "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  "bg-slate-400/20 text-slate-600 dark:text-slate-300",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
];

function TopProducts({ data }) {
  const products = data?.topProducts || [];

  return (
    <div className="card animate-slide-up rounded-2xl p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <CardHead
        icon={Package}
        title="Top Selling Products"
        subtitle="Ranked by units sold"
        action={
          <Link
            href="/admin/products"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-card)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            View All <ChevronRight size={12} />
          </Link>
        }
      />

      {products.length === 0 ? (
        <SectionEmpty icon={Package}>No sales data yet</SectionEmpty>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-card)] bg-[var(--bg-secondary)] text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 font-semibold">Product</th>
                <th className="py-2 text-right font-semibold">Sold</th>
                <th className="py-2 text-right font-semibold">Revenue</th>
                <th className="py-2 text-right font-semibold">Trend</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-card)]">
              {products.map((p, i) => {
                const TrendIcon = p.trend > 0 ? ArrowUp : p.trend < 0 ? ArrowDown : Minus;

                return (
                  <tr
                    key={String(p.id) || i}
                    className="transition-colors hover:bg-[var(--bg-tertiary)]/70"
                  >
                    <td className="py-2.5 pr-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${
                          RANK_STYLES[i] || "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>

                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-tertiary)]">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl(p.image)} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package size={15} className="text-[var(--text-muted)]" />
                          )}
                        </span>

                        <span
                          className="max-w-[220px] truncate font-medium text-[var(--text-primary)]"
                          title={p.name}
                        >
                          {p.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                      {p.sold}
                    </td>

                    <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                      {fmt(p.revenue)}
                    </td>

                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                          TREND_TONES[trendTone(p.trend)]
                        }`}
                      >
                        <TrendIcon size={11} />
                        {Math.abs(p.trend)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== QUICK ACTIONS + PROMO ==================== */
const QUICK_ACTIONS = [
  { label: "Add Product", href: "/admin/products", icon: PackagePlus, classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { label: "Add Category", href: "/admin/categories", icon: FolderPlus, classes: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { label: "Create Discount", href: "/admin/discounts", icon: BadgePercent, classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { label: "Manage Stock", href: "/admin/manage-stock", icon: Boxes, classes: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
];

function QuickActions() {
  return (
    <div className="card animate-slide-up rounded-2xl p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <CardHead icon={Zap} title="Quick Actions" subtitle="Jump to frequent tasks" />

      <div className="grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex min-h-[64px] items-center gap-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--bg-secondary)] px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--bg-card)] hover:shadow-[var(--shadow-sm)]"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${a.classes}`}
            >
              <a.icon size={16} />
            </span>

            <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-[var(--text-primary)]">
              {a.label}
            </span>

            <ChevronRight
              size={13}
              className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function GrowBanner() {
  return (
    <div className="animate-slide-up relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-5 text-white shadow-[var(--shadow-md)]">
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-orange-400/20 blur-xl" />

      <svg
        viewBox="0 0 100 60"
        className="absolute -bottom-1 right-2 h-20 w-24 text-white/10"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        aria-hidden="true"
      >
        <polyline points="0,55 25,40 50,45 75,20 100,5" />
      </svg>

      <div className="relative">
        <h3 className="text-[15px] font-bold">Grow Your Business</h3>
        <p className="mt-1 text-xs text-white/70">Better tools. More sales. Bigger success.</p>

        <Link
          href="/admin/orders"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-400"
        >
          View Analytics <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

/* ==================== PAGE ==================== */
export default function Dashboard() {
  useStoreSocketSync();

  const [range, setRange] = useState("7d");
  const [rangeOpen, setRangeOpen] = useState(false);
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-stats", range],
    queryFn: () => dashboardApi.getStats(range),
    staleTime: 30000,
  });

  // Realtime refresh via socket
  useEffect(() => {
    if (!socket) return undefined;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    LIVE_EVENTS.forEach((e) => socket.on(e, invalidate));
    return () => LIVE_EVENTS.forEach((e) => socket.off(e, invalidate));
  }, [socket, queryClient]);

  // Close the range dropdown on outside click
  useEffect(() => {
    if (!rangeOpen) return undefined;
    const close = () => setRangeOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [rangeOpen]);

  const activeLabel = RANGE_OPTIONS.find((r) => r.key === range)?.label || "Last 7 Days";
  const isLive = Boolean(socket?.connected);

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="relative mb-4 overflow-visible rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)] sm:px-5 sm:py-3.5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden rounded-r-2xl bg-gradient-to-l from-blue-500/[0.06] to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
              <LayoutDashboard size={17} />
            </span>

            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
                Store overview
              </p>
              <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--text-primary)] sm:text-[18px]">
                Dashboard
              </h1>
              <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
                Track sales, orders, and store activity in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLive && (
              <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            )}

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-muted)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
              title="Refresh"
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={15} className={isRefetching ? "animate-spin" : ""} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRangeOpen((v) => !v);
                }}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] px-3 text-[11px] font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--accent)]"
              >
                <CalendarDays size={14} className="text-[var(--accent)]" />
                {activeLabel}
                <ChevronDown
                  size={13}
                  className={`text-[var(--text-muted)] transition-transform ${rangeOpen ? "rotate-180" : ""}`}
                />
              </button>

              {rangeOpen && (
                <div className="animate-fade-in absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] py-1 shadow-[var(--shadow-lg)]">
                  {RANGE_OPTIONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setRange(r.key);
                        setRangeOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      <span
                        className={`flex-1 ${
                          range === r.key
                            ? "font-semibold text-[var(--accent)]"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {r.label}
                      </span>

                      {range === r.key && <Check size={13} className="text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Refetch progress */}
      {isRefetching && !isLoading && (
        <div className="mb-4 h-0.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--accent)]" />
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-[120px]" />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="skeleton h-[310px] xl:col-span-7" />
            <div className="skeleton h-[310px] xl:col-span-5" />
            <div className="skeleton h-[300px] xl:col-span-7" />
            <div className="skeleton h-[300px] xl:col-span-5" />
          </div>
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 rounded-2xl p-12 text-center shadow-[var(--shadow-sm)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertCircle size={22} />
          </span>

          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Failed to load dashboard</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Something went wrong while fetching your store stats.
            </p>
          </div>

          <button type="button" onClick={() => refetch()} className="btn-primary mt-1">
            Try again
          </button>
        </div>
      ) : (
        <>
          <StatCards data={data} />

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7">
              <RevenueOverview data={data} range={range} onRangeChange={setRange} />
            </div>

            <div className="min-w-0 xl:col-span-5">
              <SalesDistribution data={data} />
            </div>

            <div className="xl:col-span-7">
              <TopProducts data={data} />
            </div>

            <div className="flex flex-col gap-3 xl:col-span-5">
              <RecentOrders data={data} />
            </div>

            <div className="xl:col-span-7">
              <RecentActivity data={data} />
            </div>

            <div className="flex flex-col gap-3 xl:col-span-5">
              <QuickActions />
              <GrowBanner />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
