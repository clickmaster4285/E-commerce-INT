'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Package,
  Tag,
  FolderOpen,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

import DashboardCard from '../../Component/DashboardCard';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Dashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const [dashboardData, setDashboardData] = useState({
    products: 156,
    brands: 24,
    categories: 12,
    revenue: 12450,
    revenueTrend: 18,
  });

  const [revenueHistory, setRevenueHistory] = useState([
    8200,
    9100,
    8800,
    10400,
    11200,
    11900,
    12450,
  ]);

  const [monthlyData, setMonthlyData] = useState([
    {
      month: 'Jan',
      revenue: 60,
      expense: 40,
    },
    {
      month: 'Feb',
      revenue: 45,
      expense: 30,
    },
    {
      month: 'Mar',
      revenue: 80,
      expense: 60,
    },
    {
      month: 'Apr',
      revenue: 70,
      expense: 55,
    },
    {
      month: 'May',
      revenue: 90,
      expense: 70,
    },
    {
      month: 'Jun',
      revenue: 100,
      expense: 65,
    },
  ]);

  const updateRevenue = () => {
    setDashboardData((previous) => {
      const increase = Math.floor(Math.random() * 350) + 50;
      const newRevenue = previous.revenue + increase;

      setRevenueHistory((history) => {
        return [...history.slice(-6), newRevenue];
      });

      setMonthlyData((months) => {
        const updatedMonths = [...months];
        const lastIndex = updatedMonths.length - 1;

        updatedMonths[lastIndex] = {
...updatedMonths[lastIndex],
          revenue: Math.min(
            updatedMonths[lastIndex].revenue + 2,
            100
          ),
        };

        return updatedMonths;
      });

      return {
...previous,
        revenue: newRevenue,
        revenueTrend: previous.revenueTrend + 1,
      };
    });
  };

  // Revenue har 5 seconds baad update hogi
  useEffect(() => {
    const interval = setInterval(() => {
      updateRevenue();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const refreshDashboard = () => {
    setIsRefreshing(true);

    setTimeout(() => {
      updateRevenue();
      setIsRefreshing(false);
    }, 800);
  };

  const stats = useMemo(
    () => [
      {
        title: 'Total Products',
        value: dashboardData.products,
        icon: Package,
        trend: 12,
      },
      {
        title: 'Total Brands',
        value: dashboardData.brands,
        icon: Tag,
        trend: 3,
      },
      {
        title: 'Total Categories',
        value: dashboardData.categories,
        icon: FolderOpen,
        trend: 0,
      },
      {
        title: 'Revenue',
        value: formatCurrency(dashboardData.revenue),
        icon: DollarSign,
        trend: dashboardData.revenueTrend,
      },
    ],
    [dashboardData]
  );

  const getSalesTrendPoints = () => {
    const maxValue = Math.max(...revenueHistory);
    const minValue = Math.min(...revenueHistory);
    const range = maxValue - minValue || 1;

    return revenueHistory
.map((value, index) => {
        const x = (index / (revenueHistory.length - 1)) * 600;
        const y = 210 - ((value - minValue) / range) * 175;

        return `${x},${y}`;
      })
.join(' ');
  };

  const getPointPosition = (value, index) => {
    const maxValue = Math.max(...revenueHistory);
    const minValue = Math.min(...revenueHistory);
    const range = maxValue - minValue || 1;

    const x = (index / (revenueHistory.length - 1)) * 600;
    const y = 210 - ((value - minValue) / range) * 175;

    return { x, y };
  };

  return (
    <main className="w-full min-w-0 space-y-5 sm:space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
            Business Dashboard
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Unified view of finance, inventory, and sales metrics.
          </p>

          <div className="mt-2 flex items-center gap-2 text-xs text-green-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Revenue is updating live
          </div>
        </div>

        <button
          type="button"
          onClick={refreshDashboard}
          disabled={isRefreshing}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
        >
          <RefreshCw
            size={16}
            className={isRefreshing? 'animate-spin': ''}
          />

          {isRefreshing? 'Refreshing...': 'Refresh Data'}
        </button>
      </section>

      {/* Stats Cards */}
      <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <DashboardCard key={stat.title} {...stat} />
        ))}
      </section>

      {/* Charts Section */}
      <section className="grid min-w-0 grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {/* Revenue vs Expenses */}
        <div className="min-w-0 overflow-visible rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              Revenue vs Expenses
            </h3>

            <span className="text-xs text-green-500">
              Live
            </span>
          </div>

          <div className="h-56 w-full">
            <div className="flex h-full items-end justify-between gap-1.5 sm:gap-3">
              {monthlyData.map((item, index) => (
                <div
                  key={item.month}
                  className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-2"
                  onMouseEnter={() => setHoveredBar(index)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Bar Tooltip */}
                  {hoveredBar === index && (
                    <div className="absolute bottom-[88%] z-30 w-max rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-2 text-xs shadow-xl">
                      <p className="mb-1 font-semibold text-[var(--text-primary)]">
                        {item.month}
                      </p>

                      <p className="text-[var(--accent)]">
                        Revenue: {item.revenue}%
                      </p>

                      <p className="text-[var(--danger)]">
                        Expenses: {item.expense}%
                      </p>
                    </div>
                  )}

                  {/* Bars */}
                  <div className="flex h-[85%] w-full items-end justify-center gap-0.5 sm:gap-1">
                    {/* Revenue Bar */}
                    <div
                      className={`w-2 origin-bottom rounded-t-sm bg-[var(--accent)] transition-all duration-300 ease-out sm:w-5 md:w-7 ${
                        hoveredBar === index
? 'scale-y-110 brightness-125 shadow-[0_0_18px_var(--accent)]'
: 'group-hover:scale-y-105'
                      }`}
                      style={{
                        height: `${item.revenue}%`,
                      }}
                    />

                    {/* Expense Bar */}
                    <div
                      className={`w-2 origin-bottom rounded-t-sm bg-[var(--danger)] transition-all duration-300 ease-out sm:w-5 md:w-7 ${
                        hoveredBar === index
? 'scale-y-110 brightness-125 shadow-[0_0_18px_var(--danger)]'
: 'group-hover:scale-y-105'
                      }`}
                      style={{
                        height: `${item.expense}%`,
                      }}
                    />
                  </div>

                  <span
                    className={`text-[10px] transition-colors sm:text-xs ${
                      hoveredBar === index
? 'font-bold text-[var(--text-primary)]'
: 'text-[var(--text-muted)]'
                    }`}
                  >
                    {item.month}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
              <span className="text-xs text-[var(--text-muted)] sm:text-sm">
                Revenue
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[var(--danger)]" />
              <span className="text-xs text-[var(--text-muted)] sm:text-sm">
                Expenses
              </span>
            </div>
          </div>
        </div>

        {/* Sales Trend */}
        <div className="min-w-0 overflow-visible rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              Sales Trend
            </h3>

            <span className="text-sm font-semibold text-[var(--accent)]">
              {formatCurrency(dashboardData.revenue)}
            </span>
          </div>

          <div className="h-56 w-full">
            <svg
              className="h-[calc(100%-28px)] w-full overflow-visible"
              viewBox="0 0 600 250"
              preserveAspectRatio="none"
              role="img"
              aria-label="Sales trend chart"
            >
              {/* Horizontal Lines */}
              {[50, 100, 150, 200].map((lineY) => (
                <line
                  key={lineY}
                  x1="0"
                  y1={lineY}
                  x2="600"
                  y2={lineY}
                  stroke="var(--border-card)"
                  strokeWidth="1"
                />
              ))}

              {/* Vertical Hover Line */}
              {hoveredPoint!== null && (
                <line
                  x1={
                    (hoveredPoint /
                      (revenueHistory.length - 1)) *
                    600
                  }
                  y1="20"
                  x2={
                    (hoveredPoint /
                      (revenueHistory.length - 1)) *
                    600
                  }
                  y2="220"
                  stroke="var(--accent)"
                  strokeWidth="1"
                  strokeDasharray="5 5"
                  opacity="0.8"
                />
              )}

              {/* Sales Line */}
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={getSalesTrendPoints()}
                className="drop-shadow-[0_0_8px_var(--accent)] transition-all duration-700"
              />

              {/* Sales Points */}
              {revenueHistory.map((value, index) => {
                const { x, y } = getPointPosition(value, index);

                return (
                  <g
                    key={`${value}-${index}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Big invisible hover area */}
                    <circle
                      cx={x}
                      cy={y}
                      r="25"
                      fill="transparent"
                    />

                    {/* Tooltip */}
                    {hoveredPoint === index && (
                      <g>
                        <rect
                          x={Math.max(x - 48, 0)}
                          y={Math.max(y - 48, 0)}
                          width="96"
                          height="30"
                          rx="6"
                          fill="var(--bg-card)"
                          stroke="var(--accent)"
                        />

                        <text
                          x={Math.max(x, 48)}
                          y={Math.max(y - 28, 25)}
                          textAnchor="middle"
                          fill="var(--text-primary)"
                          fontSize="13"
                          fontWeight="600"
                        >
                          {formatCurrency(value)}
                        </text>
                      </g>
                    )}

                    {/* Outer Point */}
                    <circle
                      cx={x}
                      cy={y}
                      r={hoveredPoint === index? 10: 5}
                      fill="var(--accent)"
                      className="transition-all duration-300"
                    />

                    {/* Inner Point */}
                    {hoveredPoint === index && (
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="var(--bg-card)"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Month Labels */}
            <div className="mt-2 flex justify-between px-1 text-[10px] text-[var(--text-muted)] sm:px-2 sm:text-xs">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Now'].map(
                (month, index) => (
                  <span
                    key={month}
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className={`cursor-pointer transition-colors ${
                      hoveredPoint === index
? 'font-bold text-[var(--accent)]'
: ''
                    }`}
                  >
                    {month}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-[var(--text-primary)] sm:text-lg">
          Quick Access
        </h3>

        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <QuickAccessCard
            href="/admin/brands"
            title="Brands"
            description="View and manage all your brands."
            count={dashboardData.brands}
            icon={Tag}
          />

          <QuickAccessCard
            href="/admin/categories"
            title="Categories"
            description="Organize your products by category."
            count={dashboardData.categories}
            icon={FolderOpen}
          />

          <QuickAccessCard
            href="/admin/products"
            title="Products"
            description="Check your inventory and prices."
            count={dashboardData.products}
            icon={Package}
          />
        </div>
      </section>
    </main>
  );
}

function QuickAccessCard({
  href,
  title,
  description,
  count,
  icon: Icon,
}) {
  return (
    <a
      href={href}
      className="group min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] sm:p-5"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
            <Icon size={20} className="text-[var(--accent)]" />
          </div>

          <div className="min-w-0">
            <h4 className="truncate font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
              {title}
            </h4>

            <p className="truncate text-sm text-[var(--text-muted)]">
              {description}
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)]">
          {count}
        </span>
      </div>
    </a>
  );
}