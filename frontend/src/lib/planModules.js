/**
 * Plan helpers — module catalog lives in adminModules.js (shared with sidebar).
 */
import { getPlanModules, getPlanSections } from "@/lib/adminModules";

export const PLAN_MODULES = getPlanModules();
export const MODULE_SECTIONS = getPlanSections();

export const BILLING_INTERVALS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual" },
  { value: "yearly", label: "Yearly" },
  { value: "biennial", label: "Biennial" },
  { value: "lifetime", label: "Lifetime" },
  { value: "one_time", label: "One-time" },
  { value: "custom", label: "Custom" },
];

export const defaultModuleState = () => {
  const out = {};
  for (const m of PLAN_MODULES) out[m.key] = { enabled: true, limit: "", unlimited: true };
  return out;
};

export const modulesFromPlan = (plan) => {
  const out = defaultModuleState();
  const src = plan?.modules || {};
  for (const m of PLAN_MODULES) {
    const entry = src[m.key];
    if (!entry) continue;
    out[m.key] = {
      enabled: entry.enabled !== false,
      unlimited: !m.countable || entry.limit == null,
      limit: m.countable && entry.limit != null ? String(entry.limit) : "",
    };
  }
  return out;
};

export const modulesToPayload = (state) => {
  const out = {};
  for (const m of PLAN_MODULES) {
    const row = state[m.key] || { enabled: true, unlimited: true, limit: "" };
    out[m.key] = {
      enabled: row.enabled !== false,
      limit: m.countable && !row.unlimited && row.limit !== "" ? Number(row.limit) : null,
    };
  }
  return out;
};

export const formatPlanPrice = (price, currency, interval) => {
  const amount = Number(price) || 0;
  const cur = currency || "PKR";
  if (amount === 0) return "Free";
  const suffix = {
    weekly: "/wk",
    biweekly: "/2wk",
    monthly: "/mo",
    quarterly: "/qtr",
    semiannual: "/6mo",
    yearly: "/yr",
    biennial: "/2yr",
    lifetime: " lifetime",
    one_time: " once",
    custom: "",
  }[interval] || "";
  return `${cur} ${amount.toLocaleString()}${suffix}`;
};

export const limitLabel = (n) => (n == null ? "Unlimited" : String(n));
