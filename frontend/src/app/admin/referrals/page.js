"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Coins,
  Gift,
  Info,
  LoaderCircle,
  RotateCcw,
  Save,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import StatCard from "@/components/adminComponents/StatCard";
import { useTranslation } from "@/i18n/LanguageProvider";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";

const initialSettings = {
  enabled: false,
  referrerPoints: 100,
  friendPoints: 100,
  saleReferrerPoints: 0,
  headline: "Invite a friend, earn rewards",
};

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const normalize = (s) => ({
  enabled: Boolean(s?.enabled),
  referrerPoints: Number(s?.referrerPoints || 0),
  friendPoints: Number(s?.friendPoints || 0),
  saleReferrerPoints: Number(s?.saleReferrerPoints || 0),
  headline: String(s?.headline || "").trim(),
});
const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "C";

const TONE = {
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  success: { background: "var(--success-soft)", color: "var(--success-text)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning-text)" },
  info: { background: "var(--info-soft)", color: "var(--info-text)" },
  purple: { background: "var(--purple-soft)", color: "var(--purple-text)" },
  neutral: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
};

function Pill({ tone = "neutral", children }) {
  return (
    <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold" style={TONE[tone]}>
      {children}
    </span>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
      style={{ background: checked ? "var(--accent)" : "var(--border-color)" }}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
    </button>
  );
}

function Card({ className = "", children }) {
  return <section className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] ${className}`}>{children}</section>;
}

function CardHead({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle ? <p className="text-[12px] text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function Avatar({ name }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function Explain({ tone = "info", children }) {
  const style = tone === "tip" ? { icon: Sparkles, ...TONE.warning } : { icon: Info, ...TONE.info };
  const Icon = style.icon;
  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-5" style={{ background: style.background }}>
      <Icon size={14} className="mt-[3px] shrink-0" style={{ color: style.color }} aria-hidden="true" />
      <p className="text-[var(--text-secondary)]">{children}</p>
    </div>
  );
}

/** Ek setting block: icon + title + explanation (left), controls (right) */
function SettingSection({ icon: Icon, title, text, children }) {
  return (
    <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={TONE.accent}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-0.5 text-[12.5px] leading-[18px] text-[var(--text-muted)]">{text}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

/** Points input + "who gets it" pill + help text + error */
function RewardField({ icon: Icon, tone = "accent", label, who, help, value, onChange, error }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input,var(--bg-card))] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={TONE[tone]}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{label}</p>
            <Pill tone={tone}>{who}</Pill>
          </div>
          <p className="mt-1 text-[12px] leading-[18px] text-[var(--text-muted)]">{help}</p>
        </div>
      </div>
      <div className="relative mt-3">
        <input
          type="number"
          min="0"
          max="1000000"
          step="1"
          inputMode="numeric"
          value={value ?? 0}
          onChange={onChange}
          aria-label={label}
          aria-invalid={Boolean(error)}
          className={`h-11 w-full rounded-lg border bg-[var(--bg-card)] px-3 pe-20 text-[14px] font-semibold tabular-nums text-[var(--text-primary)] outline-none transition [appearance:textfield] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${error ? "border-[var(--danger)]" : "border-[var(--border-color)]"}`}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[12px] font-medium text-[var(--text-muted)]">points</span>
      </div>
      {error && <p role="alert" className="mt-1.5 text-[12px] font-medium text-[var(--danger-text)]">{error}</p>}
    </div>
  );
}

function EmptyRow({ icon: Icon = Gift, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-[12.5px] text-[var(--text-muted)]">{text}</p> : null}
    </div>
  );
}

const TH = "px-4 py-2.5 text-start text-[12px] font-semibold text-[var(--text-muted)]";
const TH_END = "px-4 py-2.5 text-end text-[12px] font-semibold text-[var(--text-muted)]";

export default function AdminReferralsPage() {
  const { dir } = useTranslation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-referrals"], queryFn: loyaltyApi.referrals, retry: false });

  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});

  const saved = query.data?.settings || initialSettings;
  const values = draft ?? saved;
  const dirty = draft ? JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(saved)) : false;

  const save = useMutation({
    mutationFn: loyaltyApi.saveReferrals,
    onSuccess: async (response) => {
      toast.success("Referral program settings saved.");
      setErrors({});
      client.setQueryData(["admin-referrals"], (old) => (old ? { ...old, settings: response.data } : old));
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (error) => {
      setErrors(error.response?.data?.errors || {});
      toast.error(error.response?.data?.message || "Could not save referral settings.");
    },
  });

  const setField = (key, value) => {
    setDraft((current) => ({ ...(current ?? saved), [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const update = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setField(key, value);
  };

  const submit = () => save.mutate({
    ...values,
    referrerPoints: Number(values.referrerPoints || 0),
    friendPoints: Number(values.friendPoints || 0),
    saleReferrerPoints: Number(values.saleReferrerPoints || 0),
  });

  const discard = () => { setDraft(null); setErrors({}); };

  const stats = query.data?.stats;
  const recent = query.data?.recent || [];
  const recentSales = query.data?.recentSales || [];
  const enabled = Boolean(values.enabled);

  const statCards = stats ? [
    { icon: Users, tone: "accent", label: "Total referrals", value: formatNumber(stats.total), hint: `${formatNumber(stats.rewarded)} rewarded · ${formatNumber(stats.pending)} pending` },
    { icon: CheckCircle2, tone: "success", label: "Signup rewards issued", value: formatNumber(stats.rewarded), hint: "Inviter + friend points credited" },
    { icon: Clock3, tone: "warning", label: "Awaiting verification", value: formatNumber(stats.pending), hint: "Rewards release after verification" },
    { icon: Coins, tone: "purple", label: "Sale reward points issued", value: formatNumber(stats.saleRewardPoints), hint: `${formatNumber(stats.saleRewards)} delivered orders` },
  ] : [];

  return (
    <main dir={dir} className="w-full min-h-full space-y-5 text-[var(--text-primary)]">
      <AdminPageHeader
        title="Referral program"
        subtitle="Reward customers with loyalty points for inviting friends and for delivered orders."
        actions={
          <span
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 text-[12.5px] font-semibold"
            style={enabled ? TONE.success : TONE.neutral}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: enabled ? "var(--success-text)" : "var(--text-muted)" }} aria-hidden="true" />
            {enabled ? "Program enabled" : "Program disabled"}
          </span>
        }
      />

      {query.isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <StatCard key={i} loading />)}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />
        </div>
      ) : query.isError ? (
        <Card className="p-6 text-sm">
          Could not load referral settings.
          <button className="ms-2 font-semibold text-[var(--accent)]" onClick={() => query.refetch()}>Try again</button>
        </Card>
      ) : (
        <>
          <section aria-label="Referral program overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => <StatCard key={card.label} {...card} />)}
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
            <Card className="overflow-hidden">
              {/* Program header + master switch */}
              <div className="flex flex-col gap-4 border-b border-[var(--border-color)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "var(--accent)" }}>
                    <Gift size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold">Program settings</h2>
                      <Pill tone={enabled ? "success" : "neutral"}>{enabled ? "Live" : "Off"}</Pill>
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">
                      All rewards below are loyalty points. The master switch turns the whole program on or off.
                    </p>
                  </div>
                </div>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-3 self-start rounded-lg bg-[var(--bg-tertiary)] px-3 text-[13px] font-medium sm:self-auto">
                  <Switch checked={enabled} onChange={(value) => setField("enabled", value)} label="Enable referral program" />
                  {enabled ? "Enabled" : "Disabled"}
                </label>
              </div>

              <div className={`divide-y divide-[var(--border-color)] transition-opacity ${enabled ? "" : "opacity-70"}`}>
                {/* 1. Headline */}
                <SettingSection icon={Sparkles} title="Customer-facing headline" text="The title customers see on their referral page.">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
                    <label className="block">
                      <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">Headline text</span>
                      <input
                        value={values.headline || ""}
                        onChange={update("headline")}
                        maxLength={100}
                        aria-invalid={Boolean(errors.headline)}
                        placeholder="Invite a friend, earn rewards"
                        className={`mt-2 block h-11 w-full rounded-lg border bg-[var(--bg-input,var(--bg-card))] px-3 text-[13.5px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ${errors.headline ? "border-[var(--danger)]" : "border-[var(--border-color)]"}`}
                      />
                      <span className="mt-1 flex items-center justify-between text-[11.5px] text-[var(--text-muted)]">
                        {errors.headline ? <span role="alert" className="font-medium text-[var(--danger-text)]">{errors.headline}</span> : <span>5–100 characters</span>}
                        <span className="tabular-nums">{(values.headline || "").length}/100</span>
                      </span>
                    </label>
                    <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
                      <div className="px-3.5 py-3 text-white" style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--purple, var(--accent)) 100%)" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">Preview</p>
                        <p className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug">{values.headline || "Invite a friend, earn rewards"}</p>
                      </div>
                      <p className="bg-[var(--bg-card)] px-3.5 py-2 text-[11.5px] text-[var(--text-muted)]">Shown at the top of the customer referral page.</p>
                    </div>
                  </div>
                </SettingSection>

                {/* 2. Signup rewards */}
                <SettingSection icon={Gift} title="Signup rewards" text="Points given once a friend verifies a new account.">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <RewardField
                      icon={Users}
                      tone="accent"
                      label="Inviter reward"
                      who="To inviter"
                      help="Goes to the customer who shared the referral link."
                      value={values.referrerPoints}
                      onChange={update("referrerPoints")}
                      error={errors.referrerPoints}
                    />
                    <RewardField
                      icon={Gift}
                      tone="success"
                      label="New customer reward"
                      who="To friend"
                      help="Welcome points for the friend who signed up."
                      value={values.friendPoints}
                      onChange={update("friendPoints")}
                      error={errors.friendPoints}
                    />
                  </div>
                  <Explain>
                    When a friend signs up with a link and verifies their account: inviter gets{" "}
                    <strong className="font-semibold text-[var(--text-primary)]">{formatNumber(values.referrerPoints)} points</strong> and the friend gets{" "}
                    <strong className="font-semibold text-[var(--text-primary)]">{formatNumber(values.friendPoints)} points</strong>.
                  </Explain>
                </SettingSection>

                {/* 3. Sale reward */}
                <SettingSection icon={ShoppingBag} title="Completed-sale reward" text="Extra points each time an invited customer's order is delivered.">
                  <RewardField
                    icon={ShoppingBag}
                    tone="purple"
                    label="Inviter reward per delivered order"
                    who="To inviter"
                    help="Paid once per delivered order placed by an invited customer. Set to 0 to turn this off."
                    value={values.saleReferrerPoints}
                    onChange={update("saleReferrerPoints")}
                    error={errors.saleReferrerPoints}
                  />
                  <Explain tone={Number(values.saleReferrerPoints) > 0 ? "info" : "tip"}>
                    {Number(values.saleReferrerPoints) > 0 ? (
                      <>Every delivered order by an invited customer adds <strong className="font-semibold text-[var(--text-primary)]">{formatNumber(values.saleReferrerPoints)} points</strong> to the inviter. Cancelled orders have the reward reversed automatically.</>
                    ) : (
                      <>Sale rewards are off. The inviter only earns the one-time signup reward. Enter a number above 0 to reward delivered orders too.</>
                    )}
                  </Explain>
                </SettingSection>
              </div>

              {/* Save bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-3 sm:px-6">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: dirty ? "var(--warning-text)" : "var(--text-muted)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: dirty ? "var(--warning)" : "var(--success)" }} aria-hidden="true" />
                  {dirty ? "Unsaved changes" : "All changes saved"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={discard}
                    disabled={!dirty || save.isPending}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-[13px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Discard
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!dirty || save.isPending}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    {save.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                    {save.isPending ? "Saving…" : "Save settings"}
                  </button>
                </div>
              </div>
            </Card>

            {/* Right rail: how it works + live summary */}
            <aside className="space-y-4 xl:sticky xl:top-4">
              <Card className="overflow-hidden">
                <CardHead title="How it works" subtitle="3 steps from invite to reward" />
                <ol className="divide-y divide-[var(--border-color)]">
                  {[
                    { icon: Users, title: "Customer shares a link", text: "Every customer gets a personal referral link." },
                    { icon: Gift, title: "Friend joins & verifies", text: "Both sides receive the signup rewards above." },
                    { icon: ShoppingBag, title: "Order gets delivered", text: "The inviter earns the per-order sale reward." },
                  ].map(({ icon: Icon, title, text }, i) => (
                    <li key={title} className="flex items-start gap-3 px-4 py-3">
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={TONE.accent}>
                        <Icon size={15} aria-hidden="true" />
                        <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--accent-text)]">{i + 1}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
                        <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card className="overflow-hidden">
                <CardHead title="At a glance" subtitle="Updates as you edit" />
                <dl className="divide-y divide-[var(--border-color)] text-[13px]">
                  {[
                    { icon: CheckCircle2, label: "Status", value: enabled ? "Enabled" : "Disabled", tone: enabled ? "var(--success-text)" : "var(--text-muted)" },
                    { icon: Users, label: "Inviter signup", value: `${formatNumber(values.referrerPoints)} pts` },
                    { icon: Gift, label: "Friend signup", value: `${formatNumber(values.friendPoints)} pts` },
                    { icon: ShoppingBag, label: "Per delivered order", value: Number(values.saleReferrerPoints) > 0 ? `${formatNumber(values.saleReferrerPoints)} pts` : "Off", tone: Number(values.saleReferrerPoints) > 0 ? undefined : "var(--text-muted)" },
                  ].map(({ icon: Icon, label, value, tone }) => (
                    <div key={label} className="flex items-center gap-2.5 px-4 py-2.5">
                      <Icon size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                      <dt className="flex-1 text-[var(--text-secondary)]">{label}</dt>
                      <dd className="text-end font-semibold tabular-nums" style={{ color: tone || "var(--text-primary)" }}>{value}</dd>
                    </div>
                  ))}
                </dl>
                {!enabled && (
                  <div className="border-t border-[var(--border-color)] px-4 py-3">
                    <Explain tone="tip">The program is off. Customers can still share links, but no points are issued until you enable it and save.</Explain>
                  </div>
                )}
              </Card>
            </aside>
          </div>

          {/* Recent referrals */}
          <Card className="overflow-hidden">
            <CardHead title="Recent referrals" subtitle="Latest invited customers and signup reward status." />
            {recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-table,var(--bg-tertiary))]">
                      <th className={TH}>Referrer</th>
                      <th className={TH}>Invited customer</th>
                      <th className={TH}>Signup reward</th>
                      <th className={TH}>Status</th>
                      <th className={TH_END}>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {recent.map((row) => (
                      <tr key={row.id} className="transition hover:bg-[var(--bg-row-hover)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={row.referrer?.name || "Customer"} />
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-medium text-[var(--text-primary)]">{row.referrer?.name || "Customer"}</p>
                              <p className="max-w-[220px] truncate text-[12px] text-[var(--text-muted)]">{row.referrer?.email || "Referrer"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate font-medium text-[var(--text-primary)]">{row.friend?.name || "Customer"}</p>
                          <p className="max-w-[220px] truncate text-[12px] text-[var(--text-muted)]">{row.friend?.email || "Invited customer"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[12px]">
                            <span className="font-semibold text-[var(--accent)]">+{formatNumber(row.referrerPoints)}</span>
                            <span className="text-[var(--text-muted)]">inviter</span>
                            <span className="text-[var(--text-muted)]">/</span>
                            <span className="font-semibold text-[var(--success-text)]">+{formatNumber(row.friendPoints)}</span>
                            <span className="text-[var(--text-muted)]">friend</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Pill tone={row.status === "rewarded" ? "success" : row.status === "pending" ? "warning" : "neutral"}>
                            {row.status === "rewarded" ? "Signup rewarded" : row.status === "pending" ? "Awaiting verification" : row.status}
                          </Pill>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-end text-[12px] text-[var(--text-muted)]">{formatDate(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRow icon={Users} title="No referrals yet" text="Invited customers will appear here as soon as they sign up with a referral link." />
            )}
          </Card>

          {/* Recent sale rewards */}
          <Card className="overflow-hidden">
            <CardHead title="Recent sale rewards" subtitle="Points credited to inviters for delivered orders placed by their referrals." />
            {recentSales.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-table,var(--bg-tertiary))]">
                      <th className={TH}>Inviter</th>
                      <th className={TH}>Order</th>
                      <th className={TH}>Reward</th>
                      <th className={TH_END}>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {recentSales.map((row) => {
                      const reversed = row.status === "reversed";
                      return (
                        <tr key={row.id} className="transition hover:bg-[var(--bg-row-hover)]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={row.referrer?.name || "Referrer"} />
                              <div className="min-w-0">
                                <p className="max-w-[220px] truncate font-medium text-[var(--text-primary)]">{row.referrer?.name || "Referrer"}</p>
                                <p className="max-w-[220px] truncate text-[12px] text-[var(--text-muted)]">{row.referrer?.email || "Reward recipient"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--text-primary)]">{row.order?.number || "Order removed"}</p>
                            <p className="truncate text-[12px] text-[var(--text-muted)]">
                              {row.order?.customer?.name || "Referred customer"}
                              {row.order?.total != null ? ` · Rs ${formatNumber(row.order.total)}` : ""}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {reversed ? (
                              <Pill tone="neutral">Reversed · {formatNumber(row.reversedPoints)} pts</Pill>
                            ) : (
                              <span className="font-semibold text-[var(--success-text)]">+{formatNumber(row.points)} pts</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-end text-[12px] text-[var(--text-muted)]">{formatDate(row.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRow icon={ShoppingBag} title="No sale rewards yet" text="When an invited customer's order is delivered, the inviter's sale reward will show up here." />
            )}
          </Card>
        </>
      )}
    </main>
  );
}
