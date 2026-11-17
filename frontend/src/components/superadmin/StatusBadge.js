// StatusBadge — shared by all Super Admin pages (uses global .badge classes)
const BADGE_CLASS = {
  pending: "badge badge-warning",
  approved: "badge badge-success",
  rejected: "badge badge-danger",
  open: "badge badge-success",
  closed: "badge badge-danger",
  maintenance: "badge badge-warning",
  active: "badge badge-success",
  blocked: "badge badge-danger",
  inactive: "badge badge-neutral",
  seller: "badge badge-accent",
  customer: "badge badge-neutral",
};

const LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  open: "Open",
  closed: "Suspended",
  maintenance: "Maintenance",
  active: "Active",
  blocked: "Blocked",
  inactive: "Inactive",
  seller: "Seller",
  customer: "Customer",
};

export default function StatusBadge({ value }) {
  const key = String(value || "").toLowerCase();
  const className = BADGE_CLASS[key] || BADGE_CLASS.inactive;
  const label = LABELS[key] || LABELS.inactive;
  return <span className={className}>{label}</span>;
}
