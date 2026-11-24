"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import cc from "currency-codes";
import {
  BadgeDollarSign,
  ClipboardList,
  ContactRound,
  FileText,
  Infinity as InfinityIcon,
  MessageCircle,
  Package,
  Paintbrush,
  Receipt,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Alert,
  TextInput,
  TextArea,
  SelectInput,
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
  { key: "maxProducts", label: "Products", hint: "Catalog items a store can publish", placeholder: "50", icon: Package },
  { key: "maxStaffAccounts", label: "Staff accounts", hint: "Admin and staff logins, not customers", placeholder: "3", icon: Users },
  { key: "maxOrders", label: "Orders", hint: "Orders the store can accept", placeholder: "500", icon: ShoppingCart },
  { key: "maxChats", label: "Chats", hint: "Customer conversations", placeholder: "100", icon: MessageCircle },
  { key: "maxLeads", label: "Leads", hint: "Sales leads in the pipeline", placeholder: "200", icon: ContactRound },
  { key: "maxQuotes", label: "Quotes", hint: "Quotes the store can issue", placeholder: "100", icon: FileText },
  { key: "maxInvoices", label: "Invoices", hint: "Invoices the store can issue", placeholder: "100", icon: Receipt },
];

const emptyLimits = () => {
  const out = {};
  for (const { key } of LIMIT_FIELDS) {
    out[`${key}Unlimited`] = true;
    out[key] = "";
  }
  return out;
};

const EMPTY = {
  name: "",
  description: "",
  status: "active",
  sortOrder: "0",
  price: "0",
  billingInterval: "monthly",
  currency: "PKR",
  ...emptyLimits(),
  pos: false,
  storeEditor: true,
};

const fromPlan = (plan) => {
  if (!plan) return { ...EMPTY };
  const limits = emptyLimits();
  for (const { key } of LIMIT_FIELDS) {
    const v = plan.limits?.[key];
    limits[`${key}Unlimited`] = v == null;
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
    ...limits,
    pos: Boolean(plan.features?.pos),
    // Missing (purane plans) = ON
    storeEditor: plan.features?.storeEditor !== false,
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
  if (!Number.isFinite(amount)) return "Enter a price to preview what stores will pay.";
  if (amount === 0) return "Stores on this plan are not charged.";
  const phrase = BILLING_PHRASE[interval] || "on the selected schedule";
  return `Stores on this plan pay ${moneyLabel(amount, currency)} ${phrase}.`;
};

/** Full-page create / edit form for platform plans. */
export default function PlanForm({ plan = null }) {
  const editing = Boolean(plan);
  const router = useRouter();
  const qc = useQueryClient();
  const formRef = useRef(null);
  const alertRef = useRef(null);
  const inputRefs = useRef({});
  const pendingFocus = useRef(null);
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
    const key = pendingFocus.current;
    if (!key || form[`${key}Unlimited`]) return;
    pendingFocus.current = null;
    const node = inputRefs.current[key];
    node?.focus();
    node?.select?.();
  }, [form]);

  useEffect(() => {
    if (!formError) return;
    alertRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [formError]);

  const update = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };
  const set = (key) => (e) => update(key, e.target.type === "checkbox" ? e.target.checked : e.target.value);

  const setUnlimited = (key, unlimited) => {
    if (!unlimited) pendingFocus.current = key;
    setForm((p) => ({ ...p, [`${key}Unlimited`]: unlimited }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const setAllUnlimited = () => {
    setForm((p) => {
      const next = { ...p };
      for (const { key } of LIMIT_FIELDS) next[`${key}Unlimited`] = true;
      return next;
    });
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

    for (const { key, label } of LIMIT_FIELDS) {
      if (form[`${key}Unlimited`]) continue;
      const n = Number(form[key]);
      if (!Number.isInteger(n) || n < 0) next[key] = `Enter a whole number for ${label.toLowerCase()}, or leave it unlimited.`;
    }

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) next.price = "Price must be zero or greater.";
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder)) next.sortOrder = "Sort order must be a whole number.";
    if (!/^[A-Z]{3}$/.test(String(form.currency || "").trim().toUpperCase())) next.currency = "Pick a valid currency.";

    setErrors(next);
    if (Object.keys(next).length) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    const limits = {};
    for (const { key } of LIMIT_FIELDS) {
      limits[key] = form[`${key}Unlimited`] ? null : Number(form[key]);
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
      features: { pos: form.pos, storeEditor: form.storeEditor },
    });
  };

  const cappedCount = LIMIT_FIELDS.filter(({ key }) => !form[`${key}Unlimited`]).length;
  const allUnlimited = cappedCount === 0;
  const intervalLabel = BILLING_INTERVALS.find((i) => i.value === form.billingInterval)?.label || "Monthly";
  const cancelHref = editing ? `/super-admin/plans/${plan.id}` : LIST;

  return (
    <form ref={formRef} onSubmit={submit} className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title={editing ? `Edit ${plan.name}` : "Create a plan"}
        description={editing ? "Update the price, resource caps and point of sale for this plan." : "Set the price, resource caps and point of sale for stores on this plan."}
        backHref={cancelHref}
        backLabel={editing ? "Back to plan" : "Back to plans"}
        actions={
          <>
            <Button type="button" variant="secondary" href={cancelHref} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" variant="primary" loading={mutation.isPending}>{editing ? "Save changes" : "Create plan"}</Button>
          </>
        }
      />

      {formError && (
        <div ref={alertRef}>
          <Alert tone="danger" onDismiss={() => setFormError("")}>{formError}</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Plan details" description="Name and where it sits in the catalog." icon={ClipboardList} />
            <CardBody className="space-y-3.5">
              <TextInput
                label="Plan name"
                required
                value={form.name}
                onChange={set("name")}
                error={errors.name}
                placeholder="e.g. Starter"
                autoFocus={!editing}
              />
              <TextArea
                label="Description"
                rows={3}
                value={form.description}
                onChange={set("description")}
                placeholder="Who this plan is for, in one or two lines"
                hint="Internal only — stores do not see this text."
              />
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
                  hint="Lower numbers appear first in the catalog"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pricing" description="What a store pays to stay on this plan." icon={BadgeDollarSign} />
            <CardBody className="space-y-3.5">
              <TextInput label="Price" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} error={errors.price} />
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <SelectInput label="Billing interval" value={form.billingInterval} onChange={set("billingInterval")} error={errors.billingInterval}>
                  {BILLING_INTERVALS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
                <SelectInput label="Currency" value={form.currency} onChange={set("currency")} error={errors.currency}>
                  {currencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </div>
              <p className="rounded-lg bg-subtle px-3.5 py-2.5 text-[13px] leading-5 text-fg-secondary">
                {billingSentence(form.price, form.currency, form.billingInterval)}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Resource limits"
              description={allUnlimited ? "Every resource is unlimited." : `${cappedCount} of ${LIMIT_FIELDS.length} resources are capped. The rest stay unlimited.`}
              icon={InfinityIcon}
              action={
                <Button type="button" size="sm" variant="secondary" onClick={setAllUnlimited} disabled={allUnlimited || mutation.isPending}>
                  All unlimited
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {LIMIT_FIELDS.map((field) => (
                <LimitRow
                  key={field.key}
                  field={field}
                  unlimited={form[`${field.key}Unlimited`]}
                  onUnlimited={(unlimited) => setUnlimited(field.key, unlimited)}
                  value={form[field.key]}
                  onChange={set(field.key)}
                  error={errors[field.key]}
                  inputRef={(node) => { inputRefs.current[field.key] = node; }}
                />
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Point of sale" description="In-store checkout for stores on this plan." icon={ShoppingCart} />
            <PosToggle checked={form.pos} onChange={set("pos")} />
          </Card>

          <Card>
            <CardHeader title="Store editor" description="Theme, homepage sections, menus and custom pages." icon={Paintbrush} />
            <FeatureToggle
              icon={Paintbrush}
              title="Store editor access"
              on="Sellers on this plan can customize their storefront."
              off="Storefront customization stays off for this plan."
              checked={form.storeEditor}
              onChange={set("storeEditor")}
            />
          </Card>
        </div>

        <aside className="xl:sticky xl:top-4">
          <Card>
            <div className="border-b border-line px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Preview</p>
              <h2 className="mt-1 truncate text-[18px] font-semibold tracking-tight text-fg">
                {form.name.trim() || "Untitled plan"}
              </h2>
              <p className="mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-fg">
                {moneyLabel(form.price, form.currency)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-fg-muted">{intervalLabel}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge value={form.status} />
                {form.pos ? <Badge tone="accent" dot={false}>POS</Badge> : <Badge tone="neutral" dot={false}>No POS</Badge>}
              </div>
            </div>
            <ul className="divide-y divide-line">
              {LIMIT_FIELDS.map(({ key, label, icon: Icon }) => {
                const unlimited = form[`${key}Unlimited`];
                const empty = !unlimited && form[key] === "";
                return (
                  <li key={key} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[12.5px]">
                    <span className="inline-flex min-w-0 items-center gap-2 text-fg-muted">
                      <Icon size={13} aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className={`shrink-0 tabular-nums ${unlimited || empty ? "text-fg-muted" : errors[key] ? "font-semibold text-danger" : "font-semibold text-fg"}`}>
                      {unlimited ? "Unlimited" : empty ? "—" : form[key]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <CardFooter>
              <div className="ms-auto flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" href={cancelHref} disabled={mutation.isPending}>Cancel</Button>
                <Button type="submit" variant="primary" loading={mutation.isPending}>{editing ? "Save changes" : "Create plan"}</Button>
              </div>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </form>
  );
}

function segmentClass(active) {
  return `h-8 rounded-md px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    active
      ? "bg-card text-fg shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
      : "text-fg-muted hover:text-fg"
  }`;
}

function LimitRow({ field, unlimited, onUnlimited, value, onChange, error, inputRef }) {
  const Icon = field.icon;
  const inputId = `limit-${field.key}`;
  return (
    <li className={error ? "bg-[color-mix(in_srgb,var(--danger)_7%,transparent)]" : undefined}>
      <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-muted ring-1 ring-line">
            <Icon size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-fg">{field.label}</p>
            <p className="text-[12px] leading-5 text-fg-muted">{field.hint}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <div role="group" aria-label={`${field.label} allowance`} className="inline-flex rounded-lg bg-subtle p-0.5 ring-1 ring-line">
            <button type="button" aria-pressed={unlimited} onClick={() => onUnlimited(true)} className={segmentClass(unlimited)}>
              Unlimited
            </button>
            <button type="button" aria-pressed={!unlimited} onClick={() => onUnlimited(false)} className={segmentClass(!unlimited)}>
              Capped
            </button>
          </div>
          {unlimited ? (
            <span className="inline-flex h-9 w-[6.75rem] items-center justify-center rounded-lg border border-dashed border-line text-[12px] font-medium text-fg-muted">
              No cap
            </span>
          ) : (
            <input
              ref={inputRef}
              id={inputId}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={value}
              onChange={onChange}
              placeholder={field.placeholder}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className="sa-input h-9 w-[6.75rem]"
            />
          )}
        </div>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="px-5 pb-3 text-[12px] font-medium text-danger sm:ps-[4.25rem]">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function FeatureToggle({ icon: Icon, title, on, off, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-5 text-fg-muted">{checked ? on : off}</span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
        <span className="block h-6 w-11 rounded-full bg-subtle ring-1 ring-line-strong transition-colors peer-checked:bg-accent peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card" />
        <span className="pointer-events-none absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

function PosToggle({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <ShoppingCart size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-fg">POS access</span>
        <span className="mt-0.5 block text-[12.5px] leading-5 text-fg-muted">
          {checked ? "Stores on this plan can use in-store checkout." : "In-store checkout stays off for this plan."}
        </span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
        <span className="block h-6 w-11 rounded-full bg-subtle ring-1 ring-line-strong transition-colors peer-checked:bg-accent peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card" />
        <span className="pointer-events-none absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}
