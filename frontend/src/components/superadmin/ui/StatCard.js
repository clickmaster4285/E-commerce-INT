import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "./Feedback";
import { cx } from "./cx";

const TONES = {
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning-text)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  info: { background: "var(--info-soft)", color: "var(--info-text)" },
  neutral: { background: "var(--bg-tertiary)", color: "var(--text-secondary)" },
};

/** KPI tile — label, bara number, ek line context. href ho to poora card link hai. */
export default function StatCard({ label, value, hint, icon: Icon, tone = "accent", href, linkLabel = "View", loading = false }) {
  const style = TONES[tone] || TONES.accent;

  const body = loading ? (
    <>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="mt-4 h-7 w-16" />
      <Skeleton className="mt-2.5 h-3 w-32" />
    </>
  ) : (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={style}>
              <Icon size={17} aria-hidden="true" />
            </span>
          ) : null}
          <p className="truncate text-[13px] font-medium text-fg-secondary">{label}</p>
        </div>
        {href ? (
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {linkLabel} <ArrowRight size={13} aria-hidden="true" className="rtl:rotate-180" />
          </span>
        ) : null}
      </div>
      <p className="mt-3.5 text-[28px] font-semibold leading-8 tracking-tight text-fg tabular-nums">{value}</p>
      {hint ? <p className="mt-1 truncate text-[12.5px] text-fg-muted">{hint}</p> : null}
    </>
  );

  const cls = "sa-card block p-4 sm:p-5";
  if (href && !loading) {
    return (
      <Link
        href={href}
        className={cx(cls, "group transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border-card))] hover:shadow-[var(--shadow-pop)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent")}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
