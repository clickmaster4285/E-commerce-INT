"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const TONE_STYLES = {
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning-text)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  neutral: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
};

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "accent",
  href,
  loading = false,
  trend,
}) {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.accent;

  const inner = loading ? (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>
      <div>
        <div className="skeleton h-7 w-20" />
        <div className="skeleton mt-2 h-3 w-24" />
      </div>
    </div>
  ) : (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 flex-1 truncate text-[12px] font-medium leading-5 text-[var(--text-muted)]"
          title={label}
        >
          {label}
        </p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={toneStyle}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex min-w-0 items-end justify-between gap-2">
        <p className="min-w-0 truncate text-[28px] font-semibold leading-7 tabular-nums text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
          {value}
        </p>
        {trend ? (
          <span
            className="shrink-0 text-[11px] font-semibold tabular-nums"
            style={{ color: trend.up === false ? "var(--danger-text)" : "var(--success-text)" }}
          >
            {trend.value}
          </span>
        ) : null}
        {href ? (
          <ArrowUpRight
            size={16}
            aria-hidden="true"
            className="shrink-0 opacity-0 transition-opacity duration-150 text-[var(--text-muted)] group-hover:opacity-100"
          />
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1.5 truncate text-[12px] leading-4 text-[var(--text-muted)]" title={hint}>
          {hint}
        </p>
      ) : null}
    </>
  );

  const baseClass =
    "card flex min-h-[112px] flex-col justify-between border border-[var(--border-card)] p-[16px_18px] shadow-[var(--shadow-sm)]";

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} group transition-all duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border-card))] hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--accent)_14%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
