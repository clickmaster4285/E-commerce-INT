"use client";

// ==========================================
// ADMIN PANEL — SHARED KPI / STAT CARD
// ==========================================
// Reusable summary tile for admin pages (dashboard, referrals, reports...).
// Matches the admin theme tokens so it drops into any page unchanged.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const TONES = {
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning-text)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  info: { background: "var(--info-soft)", color: "var(--info-text)" },
  purple: { background: "var(--purple-soft)", color: "var(--purple-text)" },
  neutral: { background: "var(--bg-tertiary)", color: "var(--text-secondary)" },
};

/**
 * @param {string} label          Small caption above the number.
 * @param {React.ReactNode} value Big number / value.
 * @param {string} [hint]         One-line context under the value.
 * @param {React.ComponentType} [icon] Lucide icon shown in a soft tile.
 * @param {string} [tone]         accent | success | warning | danger | info | purple | neutral
 * @param {boolean} [loading]     Renders skeleton blocks.
 * @param {string} [href]         Makes the whole card a link.
 * @param {string} [linkLabel]    Label shown on hover when href is set.
 */
export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "accent",
  loading = false,
  href,
  linkLabel = "View",
  className = "",
}) {
  const style = TONES[tone] || TONES.accent;

  const body = loading ? (
    <>
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 animate-pulse rounded-lg bg-subtle" />
        <span className="h-3 w-24 animate-pulse rounded bg-subtle" />
      </div>
      <span className="mt-4 block h-7 w-16 animate-pulse rounded bg-subtle" />
      <span className="mt-2.5 block h-3 w-28 animate-pulse rounded bg-subtle" />
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
          <p className="truncate text-[12.5px] font-medium text-fg-secondary">{label}</p>
        </div>
        {href ? (
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {linkLabel} <ArrowRight size={13} aria-hidden="true" className="rtl:rotate-180" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[26px] font-semibold leading-8 tracking-tight tabular-nums text-fg">{value}</p>
      {hint ? <p className="mt-1 truncate text-[12px] text-fg-muted">{hint}</p> : null}
    </>
  );

  const base = `block rounded-xl border border-line bg-card p-4 sm:p-5 ${className}`.trim();

  if (href && !loading) {
    return (
      <Link
        href={href}
        className={`${base} group transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border-color))] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      >
        {body}
      </Link>
    );
  }

  return <div className={base}>{body}</div>;
}
