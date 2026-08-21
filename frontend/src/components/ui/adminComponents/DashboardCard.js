'use client';
 
import { TrendingUp, TrendingDown } from 'lucide-react';
 
export default function DashboardCard({ title, value, icon: Icon, trend, trendLabel = 'vs last month' }) {
  const isNeutral = trend === undefined || trend === 0;
  const isPositive = typeof trend === 'number' && trend > 0;
 
  return (
    <div className="min-w-0 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[var(--radius-lg)] p-4 sm:p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs sm:text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide">
          {title}ff
        </span>
        {Icon && (
          <div className="p-2 bg-[var(--accent-soft)] rounded-[var(--radius-md)] shrink-0">
            <Icon size={20} className="text-[var(--accent)]" />
          </div>
        )}
      </div>
 
      <div className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">
        {value}
      </div>
 
      {trend !== undefined && (
        <div className="flex items-center text-sm">
          <span
            className={`font-medium flex items-center gap-1 ${
              isNeutral ? 'text-[var(--text-muted)]' : 'text-[var(--success)]'
            }`}
          >
            {!isNeutral && (isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          <span className="text-[var(--text-muted)] ml-2">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
 