export default function StatCard({ icon: Icon, label, value, hint, tone = "accent" }) {
  const toneStyles = {
    accent: { bg: "rgba(37,99,235,0.12)", color: "#2563eb" },
    emerald: { bg: "rgba(16,185,129,0.12)", color: "#047857" },
    amber: { bg: "rgba(245,158,11,0.14)", color: "#B45309" },
    red: { bg: "rgba(239,68,68,0.12)", color: "#B91C1C" },
    slate: { bg: "rgba(100,116,139,0.14)", color: "#475569" },
    indigo: { bg: "rgba(99,102,241,0.12)", color: "#4338CA" },
  };
  const t = toneStyles[tone] || toneStyles.accent;

  return (
    <div className="card card-hover flex h-full flex-col justify-between gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: t.bg, color: t.color }}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="font-mono text-3xl font-extrabold tabular-nums leading-none text-[var(--text-primary)]">{value}</p>
        {hint ? <p className="mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}
