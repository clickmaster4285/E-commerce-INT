// StatusBadge — shared by all Super Admin pages (token-driven, dark-safe)
const STYLES = {
  pending: { background: "var(--warning-soft)", color: "var(--warning-text)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", label: "Pending" },
  approved: { background: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", label: "Approved" },
  rejected: { background: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 32%, transparent)", label: "Rejected" },
  open: { background: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", label: "Open" },
  closed: { background: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 32%, transparent)", label: "Suspended" },
  maintenance: { background: "var(--warning-soft)", color: "var(--warning-text)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", label: "Maintenance" },
  active: { background: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", label: "Active" },
  blocked: { background: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 32%, transparent)", label: "Blocked" },
  inactive: { background: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)", label: "Inactive" },
  seller: { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", label: "Seller" },
  customer: { background: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)", label: "Customer" },
};

export default function StatusBadge({ value }) {
  const key = String(value || "").toLowerCase();
  const style = STYLES[key] || STYLES.inactive;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ background: style.background, color: style.color, border: style.border }}
    >
      {style.label}
    </span>
  );
}
