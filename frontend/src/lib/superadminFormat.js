// Super Admin — date/time + small display helpers (sab pages same format use karein)
import { getBackendOrigin } from "./tenantHost";

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "20 Nov 2026" */
export const formatDate = (value) => {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
};

/** "10:43 AM" */
export const formatTime = (value) => {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
};

/** "20 Nov 2026, 10:43 AM" */
export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? `${formatDate(d)}, ${formatTime(d)}` : "—";
};

const RTF = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "2 hours ago", "yesterday", "just now" */
export const timeAgo = (value) => {
  const d = toDate(value);
  if (!d) return "";
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      const amount = Math.round(seconds / size);
      return RTF ? RTF.format(amount, unit) : `${Math.abs(amount)} ${unit}s ago`;
    }
  }
  return "just now";
};

/** "Hamza Asif" → "HA" */
export const initials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

/** Backend relative upload path → absolute URL */
const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
// Browser me PAGE ke hostname par backend (getBackendOrigin / alignBackendUrl):
// KYC documents (/uploads/documents) private hain aur sirf super admin ke sa_at
// cookie ke saath milte hain — wo host-only hai, raw IP wale URL par jata hi nahi.
export const assetUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|data:)/.test(path)) return path;
  const origin = (typeof window !== "undefined" && getBackendOrigin()) || API_ORIGIN;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
};
