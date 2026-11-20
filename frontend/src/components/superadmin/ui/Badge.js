import { cx } from "./cx";

// value → { tone, label } — har page same status naming use kare
const STATUS = {
  pending: { tone: "warning", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  open: { tone: "success", label: "Open" },
  closed: { tone: "danger", label: "Suspended" },
  maintenance: { tone: "warning", label: "Maintenance" },
  active: { tone: "success", label: "Active" },
  blocked: { tone: "danger", label: "Blocked" },
  inactive: { tone: "neutral", label: "Inactive" },
  seller: { tone: "accent", label: "Seller" },
  customer: { tone: "neutral", label: "Customer" },
};

/** Generic pill. tone: success | warning | danger | info | accent | neutral */
export function Badge({ tone = "neutral", dot = true, className, children }) {
  return (
    <span className={cx("sa-badge", `sa-badge--${tone}`, className)}>
      {dot ? <span className="sa-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Status string se badge (pending/approved/open/blocked …). */
export default function StatusBadge({ value, dot = true }) {
  const meta = STATUS[String(value || "").toLowerCase()] || STATUS.inactive;
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}
