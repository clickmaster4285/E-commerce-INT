"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Coins, Gift, Info, Lightbulb, Loader2, Percent, ShoppingBag, TicketPercent } from "lucide-react";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pointsForAmount, quoteRedemption } from "@/lib/loyalty";
import { Card, fmtMoney, fmtPoints, inputCls, primaryBtn, primaryStyle, secondaryBtn } from "./shared";
import SetupGuide from "./SetupGuide";

// API (numbers) → form (strings, taake input khali ho sake)
const toForm = (s) => ({
  enabled: Boolean(s?.enabled),
  programName: s?.programName || "Rewards",
  earn: { enabled: s?.earn?.enabled !== false, pointsPerUnit: String(s?.earn?.pointsPerUnit ?? 1), spendUnit: String(s?.earn?.spendUnit ?? 100), minOrderSubtotal: String(s?.earn?.minOrderSubtotal ?? 0) },
  signupBonus: { enabled: s?.signupBonus?.enabled !== false, points: String(s?.signupBonus?.points ?? 100) },
  redeem: {
    enabled: s?.redeem?.enabled !== false,
    redeemPoints: String(s?.redeem?.redeemPoints ?? 100),
    redeemValue: String(s?.redeem?.redeemValue ?? 10),
    minPoints: String(s?.redeem?.minPoints ?? 100),
    maxPercent: String(s?.redeem?.maxPercent ?? 50),
  },
});
const toPayload = (f) => ({
  enabled: f.enabled,
  programName: f.programName.trim(),
  earn: { enabled: f.earn.enabled, pointsPerUnit: Number(f.earn.pointsPerUnit), spendUnit: Number(f.earn.spendUnit), minOrderSubtotal: Number(f.earn.minOrderSubtotal || 0) },
  signupBonus: { enabled: f.signupBonus.enabled, points: Number(f.signupBonus.points || 0) },
  redeem: {
    enabled: f.redeem.enabled,
    redeemPoints: Number(f.redeem.redeemPoints),
    redeemValue: Number(f.redeem.redeemValue),
    minPoints: Number(f.redeem.minPoints || 0),
    maxPercent: Number(f.redeem.maxPercent),
  },
});

// Guide ka "recommended" — 1 point = 10 paise, 2% wapas
const RECOMMENDED = {
  earn: { pointsPerUnit: "20", spendUnit: "100", minOrderSubtotal: "0" },
  signupBonus: { points: "100" },
  redeem: { redeemPoints: "100", redeemValue: "10", minPoints: "100", maxPercent: "50" },
};

// Rs with up to 2 decimals (1 point = Rs 0.10)
const fmtRs = (v, locale) => `Rs ${Number(v || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}`;
const fmtPct = (v, locale) => `${Number(v || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}%`;

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
      style={{ background: checked ? "var(--accent)" : "var(--border-color)" }}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
    </button>
  );
}

/** Number input + optional "Rs" / "points" / "%" addon (ek hi box me) */
function NumberInput({ value, onChange, error, label, before, after, width = "w-32" }) {
  return (
    <div className={`flex h-9 ${width} items-center overflow-hidden rounded-lg border bg-[var(--bg-input,var(--bg-card))] transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/20 ${error ? "border-[var(--danger)]" : "border-[var(--border-color)]"}`}>
      {before && <span className="flex h-full items-center border-e border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 text-[12px] font-medium text-[var(--text-muted)]">{before}</span>}
      <input type="number" min="0" step="1" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} aria-invalid={error ? "true" : undefined}
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13px] font-semibold tabular-nums text-[var(--text-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      {after && <span className="flex h-full items-center border-s border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 text-[12px] font-medium text-[var(--text-muted)]">{after}</span>}
    </div>
  );
}

/** Field: label + chhoti si explanation + input + error */
function Field({ label, help, error, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{label}</p>
      {help ? <p className="mb-2 text-[12px] leading-[18px] text-[var(--text-muted)]">{help}</p> : <div className="mb-1.5" />}
      {children}
      {error && <p className="mt-1 text-[12px] font-medium text-[var(--danger-text)]">{error}</p>}
    </div>
  );
}

/** "Simple words me" — setting ka live matlab */
function Explain({ tone = "info", children }) {
  const styles = {
    info: { icon: Info, bg: "var(--info-soft)", fg: "var(--info-text)" },
    tip: { icon: Lightbulb, bg: "var(--warning-soft)", fg: "var(--warning-text)" },
    warn: { icon: AlertTriangle, bg: "var(--danger-soft)", fg: "var(--danger-text)" },
  }[tone];
  const Icon = styles.icon;
  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-5" style={{ background: styles.bg }}>
      <Icon size={14} className="mt-[3px] shrink-0" style={{ color: styles.fg }} aria-hidden="true" />
      <p className="text-[var(--text-secondary)]">{children}</p>
    </div>
  );
}

/** Ek section: numbered title + explanation (left) aur controls (right) */
function Section({ step, icon: Icon, title, text, enabled, onToggle, children }) {
  const { t } = useTranslation();
  const off = onToggle && !enabled;
  return (
    <div className="grid gap-4 px-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Icon size={17} aria-hidden="true" />
          {step && <span className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--accent-text)]">{step}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
            {onToggle && <span className="lg:hidden"><Switch checked={enabled} onChange={onToggle} label={title} /></span>}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-[18px] text-[var(--text-muted)]">{text}</p>
          {onToggle && (
            <label className="mt-2.5 hidden cursor-pointer items-center gap-2 text-[12.5px] font-medium text-[var(--text-secondary)] lg:inline-flex">
              <Switch checked={enabled} onChange={onToggle} label={title} />
              {enabled ? t("admin.loyalty.settings.on") : t("admin.loyalty.settings.off")}
            </label>
          )}
        </div>
      </div>
      <div className={`min-w-0 space-y-3 transition-opacity ${off ? "pointer-events-none opacity-45" : ""}`}>{children}</div>
    </div>
  );
}

export default function SettingsTab() {
  const { t, locale } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["loyalty-admin", "settings"], queryFn: loyaltyApi.getSettings });
  // draft = sirf unsaved edits; khali ho to server wali settings hi form hain
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [sample, setSample] = useState("5000");
  const [sampleBalance, setSampleBalance] = useState("1000");
  const [guideOpen, setGuideOpen] = useState(false);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const form = draft ?? (data ? toForm(data) : null);

  const saved = useMemo(() => (data ? JSON.stringify(toPayload(toForm(data))) : ""), [data]);
  const dirty = form ? JSON.stringify(toPayload(form)) !== saved : false;

  const save = useMutation({
    mutationFn: () => loyaltyApi.saveSettings(toPayload(form)),
    onSuccess: (res) => {
      toast.success(t("admin.loyalty.settings.saved"));
      setErrors({});
      qc.setQueryData(["loyalty-admin", "settings"], res.data);
      setDraft(null);
    },
    onError: (err) => {
      const d = err?.response?.data || {};
      setErrors(d.errors || {});
      toast.error(d.message || t("admin.loyalty.settings.saveFailed"));
    },
  });

  if (isLoading || !form) {
    return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="h-[620px] animate-pulse rounded-xl bg-[var(--bg-tertiary)]" /><div className="h-96 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" /></div>;
  }

  const set = (path, value) => {
    setDraft((current) => {
      const prev = current ?? toForm(data);
      const next = structuredClone(prev);
      const keys = path.split(".");
      let o = next;
      keys.slice(0, -1).forEach((k) => { o = o[k]; });
      o[keys.at(-1)] = value;
      return next;
    });
    setErrors((e) => ({ ...e, [path]: "" }));
  };

  const applyRecommended = () => {
    setDraft((current) => {
      const prev = current ?? toForm(data);
      return {
        ...prev,
        earn: { ...prev.earn, enabled: true, ...RECOMMENDED.earn },
        signupBonus: { ...prev.signupBonus, enabled: true, ...RECOMMENDED.signupBonus },
        redeem: { ...prev.redeem, enabled: true, ...RECOMMENDED.redeem },
      };
    });
    setErrors({});
    toast.success(t("admin.loyalty.guide.recApplied"));
  };

  // ── Derived numbers (sab explanations isi se) ──
  const p = toPayload(form);
  const program = { ...p, enabled: true }; // preview hamesha "on" maan kar
  const perPoint = p.redeem.redeemPoints > 0 ? p.redeem.redeemValue / p.redeem.redeemPoints : 0; // 1 point = Rs ?
  const pointsPerRupee = p.earn.spendUnit > 0 ? p.earn.pointsPerUnit / p.earn.spendUnit : 0;
  const rewardRate = pointsPerRupee * perPoint * 100; // customer ko kitna % wapas
  const roundValue = p.redeem.redeemPoints % 10 === 0 || p.redeem.redeemPoints === 1;
  const exOrder = Math.max(1000, p.earn.minOrderSubtotal);
  const ex1000 = pointsForAmount(program, exOrder);
  const bonusWorth = p.signupBonus.points * perPoint;
  const minWorth = p.redeem.minPoints * perPoint;
  const bonusUsable = p.signupBonus.points >= p.redeem.minPoints;
  const pts = (v) => `${fmtPoints(v, locale)} ${Number(v) === 1 ? t("admin.loyalty.settings.pointWord") : t("admin.loyalty.settings.pointsWord")}`;

  // Calculator
  const sampleAmount = Math.max(0, Number(sample) || 0);
  const sampleBal = Math.max(0, Number(sampleBalance) || 0);
  const quote = quoteRedemption(program, { balance: sampleBal, subtotal: sampleAmount, requested: sampleBal });
  const discount = p.redeem.enabled && quote.ok ? quote.discount : 0;
  const earned = p.earn.enabled ? pointsForAmount(program, sampleAmount - discount) : 0;

  // Save / Discard buttons — card ke andar hi (alag dabba nahi)
  const discard = () => { setDraft(null); setErrors({}); };
  const actions = (
    <div className="flex items-center gap-2">
      <button type="button" className={secondaryBtn} onClick={discard} disabled={!dirty || save.isPending}>{t("admin.loyalty.settings.discard")}</button>
      <button type="button" className={primaryBtn} style={primaryStyle} onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
        {save.isPending && <Loader2 size={14} className="animate-spin" />}{t("admin.loyalty.settings.save")}
      </button>
    </div>
  );
  const status = (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: dirty ? "var(--warning-text)" : "var(--text-muted)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dirty ? "var(--warning)" : "var(--success)" }} aria-hidden="true" />
      {dirty ? t("admin.loyalty.settings.unsaved") : t("admin.loyalty.settings.allSaved")}
    </span>
  );

  return (
    <div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="divide-y divide-[var(--border-color)]">
          {/* Program on/off + naam + guide */}
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "var(--accent)" }}>
                <Coins size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">{t("admin.loyalty.settings.programTitle")}</p>
                  <span className="inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-semibold"
                    style={form.enabled ? { background: "var(--success-soft)", color: "var(--success-text)" } : { background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                    {form.enabled ? t("admin.loyalty.settings.live") : t("admin.loyalty.settings.off")}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--text-muted)]">{t("admin.loyalty.settings.programText")}</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="w-full lg:w-48">
                <p className="mb-1 text-[12px] font-medium text-[var(--text-muted)]">{t("admin.loyalty.settings.name")}</p>
                <input value={form.programName} onChange={(e) => set("programName", e.target.value)} maxLength={40} aria-label={t("admin.loyalty.settings.name")}
                  className={`${inputCls} ${errors.programName ? "!border-[var(--danger)]" : ""}`} />
              </div>
              <div className="pb-2"><Switch checked={form.enabled} onChange={(v) => set("enabled", v)} label={t("admin.loyalty.settings.programTitle")} /></div>
            </div>
          </div>

          {/* Guide banner — "pehli dafa? yahan se samjhein" */}
          <button type="button" onClick={() => setGuideOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-[var(--bg-row-hover)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--accent)" }}><BookOpen size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-[var(--text-primary)]">{t("admin.loyalty.guide.bannerTitle")}</span>
              <span className="block text-[12px] text-[var(--text-muted)]">{t("admin.loyalty.guide.bannerText")}</span>
            </span>
            <span className="shrink-0 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--accent)]">{t("admin.loyalty.guide.open")}</span>
          </button>

          <div className={form.enabled ? "" : "opacity-60"}>
            {/* 1. Point value — sab ki buniyaad */}
            <div className="border-b border-[var(--border-color)]">
              <Section step="1" icon={Coins} title={t("admin.loyalty.settings.valueTitle")} text={t("admin.loyalty.settings.valueText")}>
                <div className="flex flex-wrap items-center gap-2">
                  <NumberInput value={form.redeem.redeemPoints} onChange={(v) => set("redeem.redeemPoints", v)} after={t("admin.loyalty.settings.pointsWord")} label={t("admin.loyalty.settings.pointsLabel")} error={errors["redeem.redeemPoints"]} width="w-36" />
                  <span className="text-[15px] font-semibold text-[var(--text-muted)]">=</span>
                  <NumberInput value={form.redeem.redeemValue} onChange={(v) => set("redeem.redeemValue", v)} before="Rs" label={t("admin.loyalty.settings.valueLabel")} error={errors["redeem.redeemValue"]} width="w-32" />
                  <span className="ms-auto inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-1.5">
                    <span className="text-[12px] text-[var(--text-muted)]">{t("admin.loyalty.settings.onePoint")}</span>
                    <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{fmtRs(perPoint, locale)}</span>
                  </span>
                </div>
                <Explain>{t("admin.loyalty.settings.valueExplain2", { points: pts(p.redeem.redeemPoints), value: fmtRs(p.redeem.redeemValue, locale), k: fmtRs(perPoint * 1000, locale) })}</Explain>
                {!roundValue && <Explain tone="tip">{t("admin.loyalty.settings.valueTip", { points: fmtPoints(p.redeem.redeemPoints, locale) })}</Explain>}
              </Section>
            </div>

            {/* 2. Earning */}
            <div className="border-b border-[var(--border-color)]">
              <Section step="2" icon={ShoppingBag} title={t("admin.loyalty.settings.earnTitle")} text={t("admin.loyalty.settings.earnText")}
                enabled={form.earn.enabled} onToggle={(v) => set("earn.enabled", v)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("admin.loyalty.settings.earnRateLabel")} help={t("admin.loyalty.settings.earnRateHelp")} error={errors["earn.pointsPerUnit"] || errors["earn.spendUnit"]}>
                    <div className="flex flex-wrap items-center gap-2">
                      <NumberInput value={form.earn.pointsPerUnit} onChange={(v) => set("earn.pointsPerUnit", v)} after={t("admin.loyalty.settings.pointsWord")} label={t("admin.loyalty.settings.pointsLabel")} error={errors["earn.pointsPerUnit"]} width="w-32" />
                      <span className="text-[12.5px] text-[var(--text-muted)]">{t("admin.loyalty.settings.perEvery")}</span>
                      <NumberInput value={form.earn.spendUnit} onChange={(v) => set("earn.spendUnit", v)} before="Rs" label={t("admin.loyalty.settings.spendLabel")} error={errors["earn.spendUnit"]} width="w-28" />
                    </div>
                  </Field>
                  <Field label={t("admin.loyalty.settings.minOrder")} help={t("admin.loyalty.settings.minOrderHint")}>
                    <NumberInput value={form.earn.minOrderSubtotal} onChange={(v) => set("earn.minOrderSubtotal", v)} before="Rs" label={t("admin.loyalty.settings.minOrder")} width="w-36" />
                  </Field>
                </div>
                <Explain>
                  {t("admin.loyalty.settings.earnExplain2", { order: fmtRs(exOrder, locale), points: pts(ex1000), worth: fmtRs(ex1000 * perPoint, locale) })}{" "}
                  <strong className="font-semibold text-[var(--text-primary)]">{t("admin.loyalty.settings.rewardRate", { pct: fmtPct(rewardRate, locale) })}.</strong>
                </Explain>
                {form.earn.enabled && rewardRate === 0 && <Explain tone="tip">{t("admin.loyalty.settings.rateZero")}</Explain>}
                {rewardRate > 10 && <Explain tone="warn">{t("admin.loyalty.settings.rateHigh", { pct: fmtPct(rewardRate, locale) })}</Explain>}
              </Section>
            </div>

            {/* 3. Welcome bonus */}
            <div className="border-b border-[var(--border-color)]">
              <Section step="3" icon={Gift} title={t("admin.loyalty.settings.signupTitle")} text={t("admin.loyalty.settings.signupText")}
                enabled={form.signupBonus.enabled} onToggle={(v) => set("signupBonus.enabled", v)}>
                <Field label={t("admin.loyalty.settings.bonusLabel")}>
                  <div className="flex flex-wrap items-center gap-3">
                    <NumberInput value={form.signupBonus.points} onChange={(v) => set("signupBonus.points", v)} after={t("admin.loyalty.settings.pointsWord")} label={t("admin.loyalty.settings.signupTitle")} width="w-40" />
                    <span className="text-[12.5px] text-[var(--text-muted)]">= <strong className="font-semibold text-[var(--text-primary)]">{fmtRs(bonusWorth, locale)}</strong> {t("admin.loyalty.settings.discountWord")}</span>
                  </div>
                </Field>
                {p.redeem.enabled && (bonusUsable
                  ? <Explain>{t("admin.loyalty.settings.bonusUsable")}</Explain>
                  : <Explain tone="tip">{t("admin.loyalty.settings.bonusNotUsable", { min: fmtPoints(p.redeem.minPoints, locale), more: fmtPoints(p.redeem.minPoints - p.signupBonus.points, locale) })}</Explain>)}
              </Section>
            </div>

            {/* 4. Checkout use */}
            <Section step="4" icon={TicketPercent} title={t("admin.loyalty.settings.redeemTitle")} text={t("admin.loyalty.settings.redeemText")}
              enabled={form.redeem.enabled} onToggle={(v) => set("redeem.enabled", v)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("admin.loyalty.settings.minPoints")} help={t("admin.loyalty.settings.minPointsHelp")}>
                  <div className="flex flex-wrap items-center gap-3">
                    <NumberInput value={form.redeem.minPoints} onChange={(v) => set("redeem.minPoints", v)} after={t("admin.loyalty.settings.pointsWord")} label={t("admin.loyalty.settings.minPoints")} width="w-36" />
                    <span className="text-[12.5px] text-[var(--text-muted)]">= {fmtRs(minWorth, locale)}</span>
                  </div>
                </Field>
                <Field label={t("admin.loyalty.settings.maxPercent")} help={t("admin.loyalty.settings.maxPercentHelp")} error={errors["redeem.maxPercent"]}>
                  <NumberInput value={form.redeem.maxPercent} onChange={(v) => set("redeem.maxPercent", v)} after="%" label={t("admin.loyalty.settings.maxPercent")} error={errors["redeem.maxPercent"]} width="w-28" />
                </Field>
              </div>
              <Explain>{t("admin.loyalty.settings.redeemExplain", { min: fmtPoints(p.redeem.minPoints, locale), pct: p.redeem.maxPercent, cap: fmtRs(Math.floor((5000 * p.redeem.maxPercent) / 100), locale) })}</Explain>
            </Section>
          </div>
          {/* Save bar stays in the settings card flow so it never floats over the page while scrolling. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
            {status}
            {actions}
          </div>
        </Card>

        {/* Right: summary + calculator */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3" style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--purple, var(--accent)) 100%)", color: "#fff" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">{t("admin.loyalty.settings.summaryEyebrow")}</p>
              <p className="mt-0.5 text-[16px] font-semibold">{form.programName.trim() || "Rewards"}</p>
            </div>
            <dl className="divide-y divide-[var(--border-color)] text-[13px]">
              {[
                { icon: Coins, label: t("admin.loyalty.settings.sumValue"), value: fmtRs(perPoint, locale), show: true },
                { icon: Percent, label: t("admin.loyalty.settings.sumRate"), value: fmtPct(rewardRate, locale), show: p.earn.enabled },
                { icon: ShoppingBag, label: t("admin.loyalty.settings.sumEarn"), value: t("admin.loyalty.settings.sumEarnValue", { points: fmtPoints(p.earn.pointsPerUnit, locale), spend: fmtMoney(p.earn.spendUnit, locale) }), show: p.earn.enabled },
                { icon: Gift, label: t("admin.loyalty.settings.sumBonus"), value: `${fmtPoints(p.signupBonus.points, locale)} · ${fmtRs(bonusWorth, locale)}`, show: p.signupBonus.enabled },
                { icon: TicketPercent, label: t("admin.loyalty.settings.sumUse"), value: t("admin.loyalty.settings.sumUseValue", { min: fmtPoints(p.redeem.minPoints, locale), pct: p.redeem.maxPercent }), show: p.redeem.enabled },
              ].filter((r) => r.show).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5 px-4 py-2.5">
                  <Icon size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <dt className="flex-1 text-[var(--text-secondary)]">{label}</dt>
                  <dd className="text-end font-semibold tabular-nums text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Receipt-style calculator */}
          <Card className="p-4">
            <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{t("admin.loyalty.settings.calcTitle")}</p>
            <p className="text-[12px] text-[var(--text-muted)]">{t("admin.loyalty.settings.calcText")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Field label={t("admin.loyalty.settings.calcOrder")}>
                <NumberInput value={sample} onChange={setSample} before="Rs" label={t("admin.loyalty.settings.calcOrder")} width="w-full" />
              </Field>
              <Field label={t("admin.loyalty.settings.calcBalance")}>
                <NumberInput value={sampleBalance} onChange={setSampleBalance} after="pts" label={t("admin.loyalty.settings.calcBalance")} width="w-full" />
              </Field>
            </div>
            <dl className="mt-3 space-y-2 rounded-lg border border-dashed border-[var(--border-color)] p-3 text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">{t("admin.loyalty.settings.calcItems")}</dt><dd className="tabular-nums text-[var(--text-primary)]">{fmtRs(sampleAmount, locale)}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">{t("admin.loyalty.settings.calcUses", { points: fmtPoints(discount ? quote.points : 0, locale) })}</dt>
                <dd className="tabular-nums" style={{ color: discount ? "var(--success-text)" : "var(--text-muted)" }}>{discount ? `− ${fmtRs(discount, locale)}` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-[var(--border-color)] pt-2 font-semibold">
                <dt className="text-[var(--text-primary)]">{t("admin.loyalty.settings.calcPays")}</dt>
                <dd className="tabular-nums text-[var(--text-primary)]">{fmtRs(sampleAmount - discount, locale)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">{t("admin.loyalty.settings.calcEarns")}</dt>
                <dd className="font-semibold tabular-nums text-[var(--success-text)]">+{fmtPoints(earned, locale)} <span className="font-normal text-[var(--text-muted)]">({fmtRs(earned * perPoint, locale)})</span></dd>
              </div>
            </dl>
            {p.redeem.enabled && !quote.ok && sampleBal > 0 && sampleAmount > 0 && (
              <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                {quote.reason === "min_points" ? t("admin.loyalty.settings.calcNeedMin", { min: fmtPoints(p.redeem.minPoints, locale) }) : t("admin.loyalty.settings.calcTooSmall")}
              </p>
            )}
          </Card>
        </aside>
      </div>


      <SetupGuide open={guideOpen} onClose={closeGuide} payload={p} onApplyRecommended={applyRecommended} />
    </div>
  );
}
