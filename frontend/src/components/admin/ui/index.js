"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import BaseStatCard from "@/components/adminComponents/StatCard";

export const formatNumber = (value, locale) => Number(value || 0).toLocaleString(locale);
export const formatDate = (value, locale) =>
  value ? new Date(value).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : "—";

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const TONES = {
  success: {
    background: "color-mix(in srgb, var(--success) 14%, transparent)",
    color: "var(--success-text)",
    dot: "var(--success-text)",
  },
  warning: {
    background: "color-mix(in srgb, var(--warning) 16%, transparent)",
    color: "var(--warning-text)",
    dot: "var(--warning)",
  },
  danger: {
    background: "color-mix(in srgb, var(--danger) 14%, transparent)",
    color: "var(--danger-text)",
    dot: "var(--danger)",
  },
  info: {
    background: "color-mix(in srgb, var(--info) 14%, transparent)",
    color: "var(--info-text)",
    dot: "var(--info)",
  },
  muted: {
    background: "var(--muted)",
    color: "var(--muted-foreground)",
    dot: "var(--muted-foreground)",
  },
  accent: {
    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
    color: "var(--primary)",
    dot: "var(--primary)",
  },
  purple: {
    background: "var(--purple-soft)",
    color: "var(--purple-text)",
    dot: "var(--purple)",
  },
};

export function Card({ className = "", children }) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  badge,
  actions,
  icon: Icon,
  breadcrumbs,
}) {
  return (
    <div>
      {breadcrumbs?.length ? (
        <nav aria-label={breadcrumbs.label} className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
          {breadcrumbs.items.map((item, index) => (
            <span key={item.label} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href ? (
                <Link href={item.href} className="hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-2 rounded text-[13px] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ArrowLeft size={15} className="rtl:rotate-180" aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Icon ? (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={TONES.accent}
            >
              <Icon size={20} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-tight text-[var(--foreground)]">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-[60ch] text-[14px] leading-6 text-[var(--muted-foreground)]">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-3 sm:w-auto">
          {badge}
          {actions}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ tone = "muted", dot = true, children }) {
  const style = TONES[tone] || TONES.muted;
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12px] font-semibold" style={style}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Button({
  href,
  icon: Icon,
  children,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
  ...props
}) {
  const base =
    "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: { background: "var(--primary)", color: "var(--accent-text)" },
    secondary: { background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--foreground)" },
    danger: { background: "var(--danger)", color: "var(--accent-text)" },
  };
  const style = variants[variant] || variants.primary;
  const content = (
    <>
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`.trim()} style={style} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={`${base} ${className}`.trim()} style={style} disabled={disabled} {...props}>
      {content}
    </button>
  );
}

export function StatCard({ label, value, hint, icon, tone, loading }) {
  return (
    <BaseStatCard
      label={label}
      hint={hint}
      icon={icon}
      tone={tone}
      loading={loading}
      className="h-full"
      value={<span className="text-[28px] font-semibold">{value}</span>}
    />
  );
}

export function SectionCard({ title, subtitle, actions, footer, className = "", children }) {
  return (
    <Card className={`min-w-0 ${className}`.trim()}>
      {title || subtitle || actions ? (
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{actions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
        style={TONES.accent}
      >
        {Icon ? <Icon size={20} aria-hidden="true" /> : null}
      </span>
      <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
      {description ? <p className="mt-1 max-w-[44ch] text-[13px] leading-5 text-[var(--muted-foreground)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InlineAlert({ tone = "info", icon: Icon, children, action }) {
  const style = TONES[tone] || TONES.info;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[10px] px-3 py-2.5 text-[13px] leading-5" style={style}>
      {Icon ? <Icon size={16} className="shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, label, className = "" }) {
  return (
    <div className={`relative w-full sm:w-[280px] ${className}`.trim()}>
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] ps-9 pe-9 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={label}
          className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function Select({ value, onChange, options, label, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openMenu = () => {
    setOpen(true);
    window.requestAnimationFrame(() => optionRefs.current[0]?.focus());
  };

  const onOptionKeyDown = (event, index) => {
    if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + delta + options.length) % options.length;
      optionRefs.current[next]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`relative w-full sm:w-[150px] ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openMenu();
          }
        }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--foreground)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown size={15} className={`shrink-0 text-[var(--muted-foreground)] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => choose(option)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
              className={`flex h-9 w-full items-center rounded-md px-2 text-start text-[13px] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${option.value === value ? "font-semibold text-[var(--primary)]" : "text-[var(--foreground)]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TableScroll({ children }) {
  return <div className="w-full max-w-full overflow-x-auto">{children}</div>;
}

const TH_CLASS = "px-4 py-3 text-start text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]";
const TH_END_CLASS = "px-4 py-3 text-end text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]";
const TD_CLASS = "px-4 py-3 text-[13px] text-[var(--foreground)]";
const TD_END_CLASS = "px-4 py-3 text-end text-[13px] text-[var(--foreground)]";

export function Th({ children, className = "" }) {
  return <th className={`${TH_CLASS} ${className}`.trim()}>{children}</th>;
}
export function ThEnd({ children, className = "" }) {
  return <th className={`${TH_END_CLASS} ${className}`.trim()}>{children}</th>;
}
export function Td({ children, className = "" }) {
  return <td className={`${TD_CLASS} ${className}`.trim()}>{children}</td>;
}
export function TdEnd({ children, className = "" }) {
  return <td className={`${TD_END_CLASS} ${className}`.trim()}>{children}</td>;
}
export function Tr({ children, className = "" }) {
  return (
    <tr className={`h-[60px] border-b border-[var(--border)] transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] last:border-b-0 ${className}`.trim()}>
      {children}
    </tr>
  );
}

export function TableHead({ children }) {
  return (
    <thead style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
      <tr>{children}</tr>
    </thead>
  );
}

export function SkeletonRows({ rows = 4, columns = 5 }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <span key={column} className="h-9 flex-1 animate-pulse rounded-lg bg-[var(--muted)]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TableFooter({ showingLabel, page, pages, onPage, prevLabel, nextLabel }) {
  const button =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 text-[12.5px] text-[var(--muted-foreground)] sm:px-5">
      <span>{showingLabel}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={button} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={prevLabel}>
          <ChevronLeft size={15} className="rtl:rotate-180" aria-hidden="true" />
        </button>
        <span className="min-w-[52px] text-center tabular-nums">{page} / {pages}</span>
        <button type="button" className={button} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={nextLabel}>
          <ChevronRight size={15} className="rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function EntityCell({ name, email, fallbackName, avatar = true }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar ? (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
          style={TONES.accent}
          aria-hidden="true"
        >
          {initials(name)}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="max-w-[320px] truncate text-[14px] font-medium text-[var(--foreground)]" title={name || fallbackName}>
          {name || fallbackName}
        </p>
        <p className="max-w-[320px] truncate text-[12px] text-[var(--muted-foreground)]" title={email || ""}>
          {email || "—"}
        </p>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      style={{ background: checked ? "var(--primary)" : "var(--border)" }}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-[var(--card)] shadow transition-transform ${checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`}
      />
    </button>
  );
}

export function SettingSection({ icon: Icon, title, text, children }) {
  return (
    <div className="grid gap-4 border-b border-[var(--border)] px-4 py-5 last:border-b-0 sm:px-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={TONES.accent}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">{text}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-3 pb-6 lg:pb-0">{children}</div>
    </div>
  );
}

export function RewardField({ icon: Icon, tone = "accent", label, who, help, value, onChange, error, pointsLabel }) {
  const style = TONES[tone] || TONES.accent;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={style}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{label}</p>
            <StatusBadge tone={tone} dot={false}>{who}</StatusBadge>
          </div>
          <p className="mt-1 text-[12px] leading-[18px] text-[var(--muted-foreground)]">{help}</p>
        </div>
      </div>
      <div className="relative mt-3">
        <input
          type="number"
          min="0"
          max="1000000"
          step="1"
          inputMode="numeric"
          value={value ?? 0}
          onChange={onChange}
          aria-label={label}
          aria-invalid={Boolean(error)}
          className={`h-10 w-full rounded-lg border bg-[var(--card)] px-3 pe-20 text-[14px] font-semibold tabular-nums text-[var(--foreground)] outline-none transition [appearance:textfield] focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${error ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[12px] font-medium text-[var(--muted-foreground)]">
          {pointsLabel}
        </span>
      </div>
      {error ? <p role="alert" className="mt-1.5 text-[12px] font-medium text-[var(--danger-text)]">{error}</p> : null}
    </div>
  );
}
