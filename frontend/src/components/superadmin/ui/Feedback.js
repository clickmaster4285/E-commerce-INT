import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cx } from "./cx";

const ALERT_TONES = {
  info: { icon: Info, bg: "var(--info-soft)", fg: "var(--info-text)", border: "var(--info)" },
  success: { icon: CheckCircle2, bg: "var(--success-soft)", fg: "var(--success-text)", border: "var(--success)" },
  warning: { icon: AlertTriangle, bg: "var(--warning-soft)", fg: "var(--warning-text)", border: "var(--warning)" },
  danger: { icon: XCircle, bg: "var(--danger-soft)", fg: "var(--danger-text)", border: "var(--danger)" },
};

/** Inline banner — success/error notices, "needs attention" callouts. */
export function Alert({ tone = "info", title, children, action, onDismiss, className }) {
  const t = ALERT_TONES[tone] || ALERT_TONES.info;
  const Icon = t.icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 sm:flex-nowrap", className)}
      style={{ background: t.bg, borderColor: `color-mix(in srgb, ${t.border} 28%, transparent)` }}
    >
      <Icon size={18} className="mt-px shrink-0" style={{ color: t.fg }} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 text-fg-secondary" : "font-medium text-fg"}>{children}</div> : null}
      </div>
      {action ? <div className="basis-full ps-[30px] sm:basis-auto sm:shrink-0 sm:self-center sm:ps-0">{action}</div> : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-me-1 shrink-0 rounded-md p-1 text-fg-muted transition-colors hover:bg-subtle hover:text-fg">
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Khaali list/table ki state. */
export function EmptyState({ icon: Icon, title, description, action, compact = false, className }) {
  return (
    <div className={cx("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 px-6 py-8" : "gap-2 px-6 py-14", className)}>
      {Icon ? (
        <span className={cx("mb-1 flex items-center justify-center rounded-full bg-subtle text-fg-muted", compact ? "h-10 w-10" : "h-12 w-12")}>
          <Icon size={compact ? 18 : 22} aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {description ? <p className="max-w-sm text-[13px] leading-5 text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }) {
  return <span className={cx("skeleton block", className)} aria-hidden="true" />;
}
