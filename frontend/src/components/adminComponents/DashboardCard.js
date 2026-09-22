'use client';
 
import { TrendingUp, TrendingDown } from 'lucide-react';
 
export default function DashboardCard({ title, value, icon: Icon, trend, trendLabel = 'vs last month' }) {
  const isNeutral = trend === undefined || trend === 0;
  const isPositive = typeof trend === 'number' && trend > 0;
 
  return (
    <div className="card card-hover group min-w-0 overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs sm:text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          {title}
        </span>
        {Icon && (
          <div className="p-2 bg-[var(--accent-soft)] rounded-[var(--radius-md)] shrink-0 transition-transform duration-200 group-hover:scale-110">
            <Icon size={20} className="text-[var(--accent)]" />
          </div>
        )}
      </div>
 
      <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2 tabular-nums">
        {value}
      </div>
 
      {trend !== undefined && (
        <div className="flex items-center text-sm">
          <span
            className={`font-semibold flex items-center gap-1 ${
              isNeutral
                ? 'text-[var(--text-muted)]'
                : isPositive
                  ? 'text-[var(--success-text)]'
                  : 'text-[var(--danger-text)]'
            }`}
          >
            {!isNeutral && (isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          <span className="text-[var(--text-muted)] ml-2 text-[13px]">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
 