// StatusBadge — shared by all Super Admin pages
const STYLES = {
  pending: { bg: "rgba(245,158,11,0.14)", color: "#B45309", border: "1px solid rgba(245,158,11,0.35)", label: "Pending" },
  approved: { bg: "rgba(16,185,129,0.14)", color: "#047857", border: "1px solid rgba(16,185,129,0.35)", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.12)", color: "#B91C1C", border: "1px solid rgba(239,68,68,0.32)", label: "Rejected" },
  open: { bg: "rgba(16,185,129,0.14)", color: "#047857", border: "1px solid rgba(16,185,129,0.35)", label: "Open" },
  closed: { bg: "rgba(239,68,68,0.12)", color: "#B91C1C", border: "1px solid rgba(239,68,68,0.32)", label: "Suspended" },
  maintenance: { bg: "rgba(245,158,11,0.14)", color: "#B45309", border: "1px solid rgba(245,158,11,0.35)", label: "Maintenance" },
  active: { bg: "rgba(16,185,129,0.14)", color: "#047857", border: "1px solid rgba(16,185,129,0.35)", label: "Active" },
  blocked: { bg: "rgba(239,68,68,0.12)", color: "#B91C1C", border: "1px solid rgba(239,68,68,0.32)", label: "Blocked" },
  inactive: { bg: "rgba(100,116,139,0.14)", color: "#475569", border: "1px solid rgba(100,116,139,0.3)", label: "Inactive" },
  seller: { bg: "rgba(37,99,235,0.12)", color: "#1D4ED8", border: "1px solid rgba(37,99,235,0.3)", label: "Seller" },
  customer: { bg: "rgba(100,116,139,0.14)", color: "#475569", border: "1px solid rgba(100,116,139,0.3)", label: "Customer" },
};

export default function StatusBadge({ value }) {
  const key = String(value || "").toLowerCase();
  const style = STYLES[key] || STYLES.inactive;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ background: style.bg, color: style.color, border: style.border }}
    >
      {style.label}
    </span>
  );
}
