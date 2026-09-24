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
  ChevronDown,
  ChevronRight,
  Cog,
  FolderOpen,
  FolderPlus,
  Minus,
  Package,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
  Tag,
  Tags,
  Wallet,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { dashboardApi } from "../../../apis/admin/dashboardApi";
import { useStoreSocketSync } from "../../../hooks/useStoreSocketSync";
import { useSocket } from "../../../hooks/useSocket";

/* ==================== HELPERS ==================== */
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "";

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

// Socket events that should trigger a live dashboard refresh
const LIVE_EVENTS = [
  "order:created", "order:updated", "order:deleted", "order:statusChanged", "order:paymentUpdated",
  "productCreated", "productUpdated", "productDeleted",
  "brandCreated", "brandUpdated", "brandDeleted",
  "categoryCreated", "categoryUpdated", "categoryDeleted",
  "deal:created", "deal:updated", "deal:deleted",
  "discount:created", "discount:updated", "discount:deleted", "activity:new",
];

/* ==================== STAT CARDS ==================== */
function Sparkline({ data, color, id }) {
  const w = 110;
  const h = 44;
  const arr = data?.length ? data : [0, 0];
  const max = Math.max(...arr, 1);
  const pts = arr.map((v, i) => {
    const x = (i / Math.max(arr.length - 1, 1)) * w;
    const y = h - 4 - (v / max) * (h - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-[110px] shrink-0" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCards({ data }) {
  const cards = [
    {
      title: "Total Products",
      value: data?.counts?.products ?? 0,
      trend: data?.counts?.productsTrend ?? 0,
      icon: Package,
      color: "#3b82f6",
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      spark: data?.sparklines?.products,
    },
    {
      title: "Total Brands",
      value: data?.counts?.brands ?? 0,
      trend: data?.counts?.brandsTrend ?? 0,
      icon: Tags,
      color: "#a855f7",
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      spark: data?.sparklines?.brands,
    },
    {
      title: "Total Categories",
      value: data?.counts?.categories ?? 0,
      trend: data?.counts?.categoriesTrend ?? 0,
      icon: FolderOpen,
      color: "#22c55e",
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      spark: data?.sparklines?.categories,
    },
    {
      title: "Total Revenue",
      value: fmt(data?.revenue?.total),
      trend: data?.revenue?.trend ?? 0,
      icon: Wallet,
      color: "#f97316",
      bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      spark: data?.sparklines?.revenue,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => {
        const TrendIcon = c.trend > 0 ? ArrowUp : c.trend < 0 ? ArrowDown : Minus;
        return (
          <div key={c.title} className="card flex items-center justify-between gap-2 p-4 sm:p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
                  <c.icon size={20} />
                </span>
                <span className="truncate text-[13px] font-medium text-[var(--text-muted)]">{c.title}</span>
              </div>
              <div className="mt-3 text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">{c.value}</div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <span
                  className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ${
                    c.trend > 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : c.trend < 0
                        ? "bg-red-500/10 text-red-500"
                        : "bg-slate-500/10 text-slate-500"
                  }`}
                >
                  <TrendIcon size={11} />
                  {Math.abs(c.trend)}%
                </span>
                <span className="text-[var(--text-muted)]">vs last week</span>
              </div>
            </div>
            <Sparkline data={c.spark} color={c.color} id={`spark-${i}`} />
          </div>
        );
      })}
    </div>
  );
}

/* ==================== REVENUE OVERVIEW ==================== */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="text-blue-500">
        Revenue: <b>{fmt(payload[0]?.value)}</b>
      </p>
      <p className="text-purple-500">
        Orders: <b>{payload[1]?.value ?? 0}</b>
      </p>
    </div>
  );
}

function RevenueOverview({ data, range, onRangeChange }) {
  const series = data?.series || [];
  const barSize = series.length > 20 ? 10 : 22;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Revenue Overview</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Your store performance overview</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
          {RANGE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onRangeChange(t.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                range === t.key
                  ? "bg-[var(--accent)] text-[var(--accent-text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-4 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-blue-500" /> Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-purple-500" /> Orders
        </span>
      </div>

      <div className="mt-1 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              yAxisId="rev"
              tickFormatter={(v) => fmtShort(v)}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis yAxisId="ord" orientation="right" hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
            <Bar yAxisId="rev" dataKey="revenue" fill="url(#revBar)" radius={[6, 6, 0, 0]} barSize={barSize} />
            <Line
              yAxisId="ord"
              type="monotone"
              dataKey="orders"
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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
    <div className="card p-4 sm:p-5">
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Sales Distribution</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">By product category</p>

      {dist.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
          No sales data yet
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={86}
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
              <span className="text-base font-bold text-[var(--text-primary)]">{isRevenue ? fmt(total) : total}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{isRevenue ? "Total Sales" : "Products"}</span>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-2.5">
            {dist.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate text-[var(--text-muted)]">{d.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-[var(--text-primary)]">
                  {total ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
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
    <div className="card flex h-full flex-col p-4 sm:p-5">
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Recent Activity</h3>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-[var(--text-muted)]">
          No activity yet
        </div>
      ) : (
        <ul className="mt-3 flex-1 space-y-1">
          {items.map((a) => {
            const meta =
              ACTIVITY_META[a.category] ||
              { icon: "system", classes: "bg-slate-200 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400" };
            const Icon = ICONS[meta.icon] || Cog;
            return (
              <li
                key={a.key}
                className="flex items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.classes}`}>
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">{a.title}</span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">{a.subtitle}</span>
                </span>
                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{timeAgo(a.timestamp)}</span>
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
    <div className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Recent Orders</h3>
        <Link href="/admin/orders" className="text-xs font-semibold text-blue-500 hover:underline">
          View All
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-[var(--text-muted)]">
          No orders yet
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-[var(--border-card)]">
          {orders.map((o) => (
            <li key={String(o.id)}>
              <Link
                href="/admin/orders"
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-tertiary)]">
                  {o.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl(o.image)} alt={o.order_number} className="h-full w-full object-cover" />
                  ) : (
                    <Package size={16} className="text-[var(--text-muted)]" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">#{o.order_number}</span>
                    <span className="shrink-0 text-[13px] font-bold text-[var(--text-primary)]">{fmt(o.total)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[var(--text-muted)]">{o.customer}</span>
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
function TopProducts({ data }) {
  const products = data?.topProducts || [];

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Top Selling Products</h3>
        <Link href="/admin/products" className="text-xs font-semibold text-blue-500 hover:underline">
          View All
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]">
          No sales data yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-card)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
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
                  <tr key={String(p.id) || i} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                    <td className="py-2.5 pr-2 font-semibold text-[var(--text-muted)]">{i + 1}</td>
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
                        <span className="max-w-[180px] truncate font-medium text-[var(--text-primary)]">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-muted)]">{p.sold}</td>
                    <td className="py-2.5 text-right font-semibold text-[var(--text-primary)]">{fmt(p.revenue)}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                          p.trend > 0
                            ? "bg-emerald-500/10 text-emerald-600"
                            : p.trend < 0
                              ? "bg-red-500/10 text-red-500"
                              : "bg-slate-500/10 text-slate-500"
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
    <div className="card p-4 sm:p-5">
      <h3 className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex items-center gap-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-secondary)] px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow-sm)]"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.classes}`}>
              <a.icon size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{a.label}</span>
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
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-5 text-white shadow-[var(--shadow-md)]">
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-orange-400/20 blur-xl" />
      <svg viewBox="0 0 100 60" className="absolute -bottom-1 right-2 h-20 w-24 text-white/10" fill="none" stroke="currentColor" strokeWidth="4">
        <polyline points="0,55 25,40 50,45 75,20 100,5" />
      </svg>
      <div className="relative">
        <h3 className="text-[15px] font-bold">Grow Your Business</h3>
        <p className="mt-1 text-xs text-white/70">Better tools. More sales. Bigger success.</p>
        <Link
          href="/admin/orders"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-400"
        >
          View Analytics
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

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {`Here's what's happening with your store today.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-muted)] transition hover:text-[var(--accent)] disabled:opacity-60"
            title="Refresh"
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
              className="flex items-center gap-2 rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"
            >
              <CalendarDays size={14} className="text-[var(--accent)]" />
              {activeLabel}
              <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform ${rangeOpen ? "rotate-180" : ""}`} />
            </button>

            {rangeOpen && (
              <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] py-1 shadow-[var(--shadow-lg)]">
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setRange(r.key);
                      setRangeOpen(false);
                    }}
                    className={`flex w-full items-center px-3.5 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)] ${
                      range === r.key ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-[120px] animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="card h-[400px] animate-pulse" />
            <div className="card h-[400px] animate-pulse" />
            <div className="card h-[400px] animate-pulse" />
          </div>
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <AlertCircle size={32} className="text-red-500" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Failed to load dashboard</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <StatCards data={data} />

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-5">
              <RevenueOverview data={data} range={range} onRangeChange={setRange} />
              <TopProducts data={data} />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <SalesDistribution data={data} />
              <RecentActivity data={data} />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <RecentOrders data={data} />
              <QuickActions />
              <GrowBanner />
            </div>
          </div>
        </>
      )}
    </div>
  );
}







