"use client";

import { ChevronLeft, ChevronRight, Gift, ShoppingBag, RotateCcw, SlidersHorizontal, Sparkles, TicketPercent } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

/** Points ko locale ke hisaab se (1,250) */
export const fmtPoints = (n, locale) => Number(n || 0).toLocaleString(locale);
export const fmtMoney = (n, locale) => `Rs ${Number(n || 0).toLocaleString(locale)}`;
export const fmtDate = (v, locale) =>
  v ? new Date(v).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : "—";
export const fmtDateTime = (v, locale) =>
  v ? new Date(v).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "C";

// Transaction type → icon + rang
export const TXN_META = {
  signup: { icon: Sparkles, tone: "purple" },
  referral: { icon: Gift, tone: "success" },
  earn: { icon: ShoppingBag, tone: "success" },
  redeem: { icon: TicketPercent, tone: "accent" },
  refund: { icon: RotateCcw, tone: "info" },
  adjust: { icon: SlidersHorizontal, tone: "warning" },
};

const TONE_STYLE = {
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  info: { background: "var(--info-soft)", color: "var(--info-text)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning-text)" },
  purple: { background: "var(--purple-soft)", color: "var(--purple-text)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  neutral: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
};
export const toneStyle = (tone) => TONE_STYLE[tone] || TONE_STYLE.neutral;

/** Gol icon — transaction type ke liye */
export function TxnIcon({ type, size = 32 }) {
  const meta = TXN_META[type] || { icon: Gift, tone: "neutral" };
  const Icon = meta.icon;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, ...toneStyle(meta.tone) }}>
      <Icon size={Math.round(size * 0.47)} aria-hidden="true" />
    </span>
  );
}

export function Pill({ tone = "neutral", children }) {
  return (
    <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold" style={toneStyle(tone)}>
      {children}
    </span>
  );
}

/** Status pill: pending / available / reversed */
export function StatusPill({ status }) {
  const { t } = useTranslation();
  const tone = status === "pending" ? "warning" : status === "reversed" ? "neutral" : "success";
  return <Pill tone={tone}>{t(`admin.loyalty.status.${status}`)}</Pill>;
}

/** +120 / −50 — rang ke saath */
export function PointsDelta({ points, status, locale }) {
  const reversed = status === "reversed";
  const positive = points > 0;
  return (
    <span
      className={`whitespace-nowrap font-semibold tabular-nums ${reversed ? "line-through" : ""}`}
      style={{ color: reversed ? "var(--text-muted)" : positive ? "var(--success-text)" : "var(--danger-text)" }}
    >
      {positive ? "+" : "−"}{fmtPoints(Math.abs(points), locale)}
    </span>
  );
}

export function Card({ className = "", children }) {
  return <section className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] ${className}`}>{children}</section>;
}

export function CardHead({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle ? <p className="text-[12px] text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Customer avatar (initials) */
export function Avatar({ name, size = 32 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
      style={{ width: size, height: size, background: "var(--accent-soft)", color: "var(--accent)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function EmptyRow({ icon: Icon = Gift, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-[12.5px] text-[var(--text-muted)]">{text}</p> : null}
    </div>
  );
}

export function Pager({ pagination, onPage }) {
  const { t, locale } = useTranslation();
  if (!pagination || pagination.total === 0) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const btn = "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-2.5 text-[12.5px] text-[var(--text-muted)]">
      <span>{t("admin.loyalty.pager.showing", { from: fmtPoints(from, locale), to: fmtPoints(to, locale), total: fmtPoints(total, locale) })}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("admin.loyalty.pager.prev")}>
          <ChevronLeft size={15} className="rtl:rotate-180" />
        </button>
        <span className="min-w-[56px] text-center tabular-nums">{page} / {pages}</span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("admin.loyalty.pager.next")}>
          <ChevronRight size={15} className="rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

export const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input,var(--bg-card))] px-3 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export const primaryBtn =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const primaryStyle = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };
export const secondaryBtn =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-[13px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50";
