"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import cc from "currency-codes";
import {
  ContactRound,
  FileText,
  MessageCircle,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Alert,
  TextInput,
  TextArea,
  SelectInput,
  SearchSelect,
  Badge,
  StatusBadge,
} from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const LIST = "/super-admin/plans";

export const BILLING_INTERVALS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly (every 2 weeks)" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual (every 6 months)" },
  { value: "yearly", label: "Yearly" },
  { value: "biennial", label: "Biennial (every 2 years)" },
  { value: "lifetime", label: "Lifetime" },
  { value: "one_time", label: "One-time" },
  { value: "custom", label: "Custom" },
];

const BILLING_PHRASE = {
  weekly: "every week",
  biweekly: "every 2 weeks",
  monthly: "every month",
  quarterly: "every quarter",
  semiannual: "every 6 months",
  yearly: "every year",
  biennial: "every 2 years",
  lifetime: "once, for the life of the store",
  one_time: "once",
  custom: "on a custom schedule",
};

/** Limit rows — key matches backend Plan.limits. null on save means unlimited. */
export const LIMIT_FIELDS = [
  { key: "maxProducts", label: "Products", hint: "Catalog items a store can publish", icon: Package },
  { key: "maxStaffAccounts", label: "Staff accounts", hint: "Admin and staff logins, not customers", icon: Users },
  { key: "maxOrders", label: "Orders", hint: "Orders the store can accept", icon: ShoppingCart },
  { key: "maxChats", label: "Chats", hint: "Customer conversations", icon: MessageCircle },
  { key: "maxLeads", label: "Leads", hint: "Sales leads in the pipeline", icon: ContactRound },
  { key: "maxQuotes", label: "Quotes", hint: "Quotes the store can issue", icon: FileText },
  { key: "maxInvoices", label: "Invoices", hint: "Invoices the store can issue", icon: Receipt },
];

// Khali limit = unlimited (save par null jata hai)
const emptyLimits = () => Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [key, ""]));

const EMPTY = {
  name: "",
  description: "",
  status: "active",
  sortOrder: "0",
  price: "0",
  billingInterval: "monthly",
  currency: "PKR",
  limits: emptyLimits(),
  pos: false,
};

const fromPlan = (plan) => {
  if (!plan) return { ...EMPTY, limits: emptyLimits() };
  const limits = emptyLimits();
  for (const { key } of LIMIT_FIELDS) {
    const v = plan.limits?.[key];
    limits[key] = v == null ? "" : String(v);
  }
  return {
    name: plan.name || "",
    description: plan.description || "",
    status: plan.status || "active",
    sortOrder: String(plan.sortOrder ?? 0),
    price: String(plan.price ?? 0),
    billingInterval: plan.billingInterval || "monthly",
    currency: plan.currency || "PKR",
    limits,
    pos: Boolean(plan.features?.pos),
  };
};

const moneyLabel = (price, currency) => {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "—";
  if (amount === 0) return "Free";
  const cur = String(currency || "PKR").trim().toUpperCase() || "PKR";
  return `${cur} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const billingSentence = (price, currency, interval) => {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "Enter a price to preview what stores pay.";
  if (amount === 0) return "Stores on this plan are not charged.";
  return `Stores pay ${moneyLabel(amount, currency)} ${BILLING_PHRASE[interval] || "on the selected schedule"}.`;
};

/** Full-page create / edit form for platform plans. */
export default function PlanForm({ plan = null }) {
  const editing = Boolean(plan);
  const router = useRouter();
  const qc = useQueryClient();
  const alertRef = useRef(null);
  const [form, setForm] = useState(() => fromPlan(plan));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const currencyOptions = useMemo(() => {
    let displayNames;
    try {
      displayNames = new Intl.DisplayNames(["en"], { type: "currency" });
    } catch {
      displayNames = null;
    }
    return cc
      .codes()
      .map((code) => {
        const currency = cc.code(code);
        if (!currency?.code) return null;
        const name = displayNames?.of(currency.code) || currency.currency;
        return { value: currency.code, label: `${currency.code} — ${name}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.value.localeCompare(b.value));
  }, []);

  useEffect(() => {
    if (!formError) return;
    alertRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [formError]);

  const update = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };
  const set = (key) => (e) => update(key, e.target.type === "checkbox" ? e.target.checked : e.target.value);

  const setLimit = (key, value) => {
    setForm((p) => ({ ...p, limits: { ...p.limits, [key]: value } }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const setAllUnlimited = () => {
    setForm((p) => ({ ...p, limits: emptyLimits() }));
    setErrors((p) => {
      const next = { ...p };
      for (const { key } of LIMIT_FIELDS) next[key] = "";
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: (payload) => (editing ? superAdminApi.updatePlan(plan.id, payload) : superAdminApi.createPlan(payload)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
      const savedId = editing ? plan.id : res?.data?.id;
      if (savedId) {
        qc.invalidateQueries({ queryKey: ["superadmin-plan", String(savedId)] });
        qc.invalidateQueries({ queryKey: ["superadmin-plan-activity", String(savedId)] });
        router.push(`/super-admin/plans/${savedId}`);
        return;
      }
      router.push(LIST);
    },
    onError: (err) => {
      const d = err?.response?.data || {};
      setErrors(d.errors || {});
      setFormError(d.message || "Could not save the plan.");
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const next = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";

    for (const { key } of LIMIT_FIELDS) {
      const raw = form.limits[key];
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) next[key] = "Whole number, or leave blank";
    }

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) next.price = "Price must be zero or greater.";
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder)) next.sortOrder = "Must be a whole number.";
    if (!/^[A-Z]{3}$/.test(String(form.currency || "").trim().toUpperCase())) next.currency = "Pick a valid currency.";

    setErrors(next);
    if (Object.keys(next).length) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    const limits = {};
    for (const { key } of LIMIT_FIELDS) {
      limits[key] = form.limits[key] === "" ? null : Number(form.limits[key]);
    }

    mutation.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      sortOrder,
      price,
      billingInterval: form.billingInterval,
      currency: form.currency.trim().toUpperCase(),
      limits,
      features: { pos: form.pos },
    });
  };

  const cappedCount = LIMIT_FIELDS.filter(({ key }) => form.limits[key] !== "").length;
  const intervalLabel = BILLING_INTERVALS.find((i) => i.value === form.billingInterval)?.label || "Monthly";
  const cancelHref = editing ? `/super-admin/plans/${plan.id}` : LIST;
  const submitLabel = editing ? "Save changes" : "Create plan";

  const actions = (
    <>
      <Button type="button" variant="secondary" href={cancelHref} disabled={mutation.isPending}>Cancel</Button>
      <Button type="submit" variant="primary" loading={mutation.isPending}>{submitLabel}</Button>
    </>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 xl:min-h-[calc(100dvh-7rem)]">
      <PageHeader
        title={editing ? `Edit ${plan.name}` : "Create a plan"}
        description={editing ? "Update the price, resource caps and point of sale for this plan." : "Set the price, resource caps and point of sale for stores on this plan."}
        backHref={cancelHref}
        backLabel={editing ? "Back to plan" : "Back to plans"}
        // xl par actions summary card me hain
        actions={<div className="flex flex-wrap gap-2 xl:hidden">{actions}</div>}
      />

      {formError && (
        <div ref={alertRef}>
          <Alert tone="danger" onDismiss={() => setFormError("")}>{formError}</Alert>
        </div>
      )}

      <div className="grid flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-stretch">
        <Card className="flex flex-col divide-y divide-[var(--border-color)]">
          <Section title="Plan details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_150px_120px]">
              <TextInput
                label="Plan name"
                required
                value={form.name}
                onChange={set("name")}
                error={errors.name}
                placeholder="e.g. Starter"
                autoFocus={!editing}
              />
              <SelectInput label="Status" value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </SelectInput>
              <TextInput
                label="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={set("sortOrder")}
                error={errors.sortOrder}
                title="Lower numbers appear first in the catalog"
              />
            </div>
            <TextArea
              label={<>Description <span className="font-normal text-[var(--text-muted)]">· internal only, stores don&apos;t see it</span></>}
              rows={2}
              value={form.description}
              onChange={set("description")}
              placeholder="Who this plan is for, in one or two lines"
            />
          </Section>

          <Section title="Pricing" description={billingSentence(form.price, form.currency, form.billingInterval)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Price" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} error={errors.price} />
              <SelectInput label="Billing interval" value={form.billingInterval} onChange={set("billingInterval")} error={errors.billingInterval}>
                {BILLING_INTERVALS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
              <SearchSelect
                label="Currency"
                value={form.currency}
                onChange={(v) => update("currency", v)}
                error={errors.currency}
                options={currencyOptions}
                searchPlaceholder="Search code or name…"
                emptyText="No currency found"
              />
            </div>
          </Section>

          <Section
            className="flex flex-1 flex-col"
            title="Limits & features"
            description={
              cappedCount
                ? `${cappedCount} of ${LIMIT_FIELDS.length} resources capped. Leave a field blank to keep it unlimited.`
                : "Every resource is unlimited. Enter a number to cap one."
            }
            action={
              cappedCount ? (
                <Button type="button" size="sm" variant="secondary" onClick={setAllUnlimited} disabled={mutation.isPending}>
                  Reset to unlimited
                </Button>
              ) : null
            }
          >
            {/* 7 limits + POS = 8 rows → 2 columns, koi akela cell nahi bachta */}
            <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-color)] lg:grid-cols-2">
              {LIMIT_FIELDS.map((field) => (
                <LimitCell
                  key={field.key}
                  field={field}
                  value={form.limits[field.key]}
                  onChange={(v) => setLimit(field.key, v)}
                  error={errors[field.key]}
                />
              ))}
              <PosCell checked={form.pos} onChange={set("pos")} />
            </div>
          </Section>
        </Card>

        <aside className="hidden xl:flex xl:flex-col">
          <Card className="flex flex-1 flex-col">
            <div className="border-b border-[var(--border-color)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Summary</p>
              <h2 className="mt-1.5 truncate text-[18px] font-semibold text-[var(--text-primary)]">
                {form.name.trim() || "Untitled plan"}
              </h2>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[var(--text-primary)]">
                  {moneyLabel(form.price, form.currency)}
                </span>
                <span className="text-[13px] text-[var(--text-muted)]">{intervalLabel}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge value={form.status} />
                {form.pos ? <Badge tone="accent" dot={false}>POS</Badge> : <Badge tone="neutral" dot={false}>No POS</Badge>}
              </div>
            </div>

            <SummaryGroup title="Billing">
              <SummaryRow label="Price" value={moneyLabel(form.price, form.currency)} strong={Number(form.price) > 0} />
              <SummaryRow label="Interval" value={intervalLabel} strong />
              <SummaryRow label="Currency" value={String(form.currency || "").toUpperCase()} strong />
              <SummaryRow label="Sort order" value={form.sortOrder || "0"} strong />
            </SummaryGroup>

            {/* Limits group bacha hua space le leta hai */}
            <SummaryGroup title="Limits & features" className="flex-1">
              {LIMIT_FIELDS.map(({ key, label, icon }) => {
                const v = form.limits[key];
                return (
                  <SummaryRow
                    key={key}
                    icon={icon}
                    label={label}
                    value={v === "" ? "Unlimited" : Number(v).toLocaleString()}
                    strong={v !== ""}
                    danger={Boolean(errors[key])}
                  />
                );
              })}
              <SummaryRow icon={ShoppingCart} label="Point of sale" value={form.pos ? "Included" : "Off"} strong={form.pos} />
            </SummaryGroup>

            <div className="grid grid-cols-2 gap-2 p-4">{actions}</div>
          </Card>
        </aside>
      </div>
    </form>
  );
}

/** Ek card ke andar section — chhota heading, divider se alag. */
function Section({ title, description, action, className = "", children }) {
  return (
    <div className={`space-y-3 px-4 pb-4 pt-3.5 ${className}`}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <p className="min-w-0 text-[12.5px] leading-5 text-[var(--text-muted)]">
          <span className="me-2 text-[14px] font-semibold text-[var(--text-primary)]">{title}</span>
          {description}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}


/** Status tag — har cell ke kone me, ek nazar me pata chale capped hai ya nahi. */
function StateTag({ on, onLabel, offLabel }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${
        on ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)]"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

function CellHead({ icon: Icon, label, hint }) {
  return (
    <div className="flex items-center gap-2" title={hint}>
      <Icon size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{label}</span>
    </div>
  );
}

/** Ek line ki row: icon + naam/hint baayen, input daayen. Khali = unlimited. */
function LimitCell({ field, value, onChange, error }) {
  const inputId = `limit-${field.key}`;
  const capped = value !== "";
  const Icon = field.icon;
  return (
    <div className={`flex flex-col justify-center px-3 py-2.5 ${error ? "bg-[color-mix(in_srgb,var(--danger)_6%,var(--bg-card))]" : "bg-[var(--bg-card)]"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${capped ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <label htmlFor={inputId} className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-5 text-[var(--text-primary)]">{field.label}</span>
          <span className="block truncate text-[12px] leading-4 text-[var(--text-muted)]">{field.hint}</span>
        </label>
        <div className="relative w-32 shrink-0">
          <input
            id={inputId}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Unlimited"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="sa-input !h-8 pe-7 text-end font-medium tabular-nums [appearance:textfield] placeholder:font-normal [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {capped ? (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={`Make ${field.label.toLowerCase()} unlimited`}
              title="Make unlimited"
              className="absolute end-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p id={`${inputId}-error`} className="mt-1 ps-11 text-[11.5px] font-medium text-[var(--danger-text)]">{error}</p> : null}
    </div>
  );
}

function PosCell({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 bg-[var(--bg-card)] px-3 py-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>
        <ShoppingCart size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-5 text-[var(--text-primary)]">Point of sale</span>
        <span className="block truncate text-[12px] leading-4 text-[var(--text-muted)]">{checked ? "In-store checkout included" : "In-store checkout not included"}</span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
        <span className="block h-5 w-9 rounded-full bg-[var(--border-strong)] transition-colors peer-checked:bg-[var(--accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-1" />
        <span className="pointer-events-none absolute start-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
      </span>
    </label>
  );
}

/** Read-only 4x2 grid — detail page par form jaisa hi layout. */
export function PlanLimitsGrid({ limits, pos }) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-color)] sm:grid-cols-2 lg:grid-cols-4">
      {LIMIT_FIELDS.map((field) => {
        const v = limits?.[field.key];
        const capped = v != null;
        return (
          <div key={field.key} className="space-y-1 bg-[var(--bg-card)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1"><CellHead icon={field.icon} label={field.label} hint={field.hint} /></span>
              <StateTag on={capped} onLabel="Capped" offLabel="Unlimited" />
            </div>
            <p className={`text-[18px] font-semibold leading-7 tabular-nums tracking-tight ${capped ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              {capped ? Number(v).toLocaleString() : "∞"}
            </p>
          </div>
        );
      })}
      <div className="space-y-1 bg-[var(--bg-card)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1"><CellHead icon={ShoppingCart} label="Point of sale" hint="In-store checkout for stores on this plan" /></span>
          <StateTag on={pos} onLabel="Included" offLabel="Off" />
        </div>
        <p className={`text-[14px] font-medium leading-7 ${pos ? "text-[var(--success-text)]" : "text-[var(--text-muted)]"}`}>
          {pos ? "In-store checkout on" : "Not included"}
        </p>
      </div>
    </div>
  );
}

function SummaryGroup({ title, className = "", children }) {
  return (
    <div className={`border-b border-[var(--border-color)] px-5 py-3 last:border-b-0 ${className}`}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{title}</p>
      <ul className="divide-y divide-[var(--border-color)]">{children}</ul>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value, strong = false, danger = false }) {
  const tone = danger ? "font-semibold text-[var(--danger-text)]" : strong ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]";
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="inline-flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
        {Icon ? <Icon size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" /> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 tabular-nums ${tone}`}>{value}</span>
    </li>
  );
}
