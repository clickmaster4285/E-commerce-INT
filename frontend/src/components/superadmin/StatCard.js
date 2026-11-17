const TONE_STYLES = {
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning-text)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  slate: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
};

export default function StatCard({ icon: Icon, label, value, hint, tone = "accent" }) {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.accent;

  return (
    <div className="card card-hover flex h-full flex-col justify-between gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </p>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={toneStyle}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="text-3xl font-semibold tabular-nums leading-none text-[var(--text-primary)]">
          {value}
        </p>
        {hint ? <p className="mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}
