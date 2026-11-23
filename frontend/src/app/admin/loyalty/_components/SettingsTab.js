"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Gift, Loader2, ShoppingBag, Sparkles, TicketPercent } from "lucide-react";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pointsForAmount, pointsToValue, quoteRedemption } from "@/lib/loyalty";
import { Card, fmtMoney, fmtPoints, inputCls, primaryBtn, primaryStyle, secondaryBtn } from "./shared";

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

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
      style={{ background: checked ? "var(--accent)" : "var(--border-color)" }}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
    </button>
  );
}

/** Ek setting group — header me icon + title + switch, neeche fields */
function Group({ icon: Icon, title, text, enabled, onToggle, disabled, children }) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
          <p className="text-[12.5px] text-[var(--text-muted)]">{text}</p>
        </div>
        {onToggle && <Switch checked={enabled} onChange={onToggle} label={title} />}
      </div>
      {children && <div className={`mt-3 ps-11 transition-opacity ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>}
    </div>
  );
}

/** "Customers earn [1] points for every Rs [100]" — inputs jumle ke andar */
function NumberField({ value, onChange, error, width = "w-24", prefix, suffix, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {prefix && <span className="text-[12.5px] text-[var(--text-muted)]">{prefix}</span>}
      <input type="number" min="0" step="1" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        aria-invalid={error ? "true" : undefined}
        className={`${inputCls} ${width} text-center font-semibold tabular-nums ${error ? "!border-[var(--danger)]" : ""}`} />
      {suffix && <span className="text-[12.5px] text-[var(--text-muted)]">{suffix}</span>}
    </span>
  );
}

function Labeled({ label, hint, error, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">{label}</p>
      {children}
      {error ? <p className="mt-1 text-[12px] font-medium text-[var(--danger-text)]">{error}</p> : hint ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">{hint}</p> : null}
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
      qc.invalidateQueries({ queryKey: ["loyalty-admin", "overview"] });
    },
    onError: (err) => {
      const d = err?.response?.data || {};
      setErrors(d.errors || {});
      toast.error(d.message || t("admin.loyalty.settings.saveFailed"));
    },
  });

  if (isLoading || !form) {
    return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="h-[520px] animate-pulse rounded-xl bg-[var(--bg-tertiary)]" /><div className="h-72 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" /></div>;
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

  // Preview — wahi formula jo server use karta hai
  const program = { ...toPayload(form) };
  const sampleAmount = Math.max(0, Number(sample) || 0);
  const sampleEarn = pointsForAmount(program, sampleAmount);
  const sampleQuote = quoteRedemption(program, { balance: 1000, subtotal: sampleAmount, requested: 1000 });
  const off = !form.enabled;

  return (
    <div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="divide-y divide-[var(--border-color)]">
          {/* Program on/off */}
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{t("admin.loyalty.settings.programTitle")}</p>
                <span className="inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-semibold"
                  style={form.enabled ? { background: "var(--success-soft)", color: "var(--success-text)" } : { background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                  {form.enabled ? t("admin.loyalty.settings.live") : t("admin.loyalty.settings.off")}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--text-muted)]">{t("admin.loyalty.settings.programText")}</p>
            </div>
            <Switch checked={form.enabled} onChange={(v) => set("enabled", v)} label={t("admin.loyalty.settings.programTitle")} />
          </div>

          <div className={`divide-y divide-[var(--border-color)] ${off ? "opacity-60" : ""}`}>
            <div className="px-4 py-4">
              <Labeled label={t("admin.loyalty.settings.name")} hint={t("admin.loyalty.settings.nameHint")} error={errors.programName}>
                <input value={form.programName} onChange={(e) => set("programName", e.target.value)} maxLength={40}
                  className={`${inputCls} max-w-sm ${errors.programName ? "!border-[var(--danger)]" : ""}`} />
              </Labeled>
            </div>

            <Group icon={ShoppingBag} title={t("admin.loyalty.settings.earnTitle")} text={t("admin.loyalty.settings.earnText")}
              enabled={form.earn.enabled} onToggle={(v) => set("earn.enabled", v)} disabled={!form.earn.enabled}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-[var(--text-secondary)]">
                <span>{t("admin.loyalty.settings.earnSentenceA")}</span>
                <NumberField value={form.earn.pointsPerUnit} onChange={(v) => set("earn.pointsPerUnit", v)} width="w-20" label={t("admin.loyalty.settings.pointsLabel")} error={errors["earn.pointsPerUnit"]} />
                <span>{t("admin.loyalty.settings.earnSentenceB")}</span>
                <NumberField value={form.earn.spendUnit} onChange={(v) => set("earn.spendUnit", v)} prefix="Rs" label={t("admin.loyalty.settings.spendLabel")} error={errors["earn.spendUnit"]} />
                <span>{t("admin.loyalty.settings.earnSentenceC")}</span>
              </div>
              <div className="mt-3 max-w-xs">
                <Labeled label={t("admin.loyalty.settings.minOrder")} hint={t("admin.loyalty.settings.minOrderHint")}>
                  <NumberField value={form.earn.minOrderSubtotal} onChange={(v) => set("earn.minOrderSubtotal", v)} prefix="Rs" width="w-32" label={t("admin.loyalty.settings.minOrder")} />
                </Labeled>
              </div>
              <p className="mt-3 text-[12px] text-[var(--text-muted)]">{t("admin.loyalty.settings.earnNote")}</p>
            </Group>

            <Group icon={Sparkles} title={t("admin.loyalty.settings.signupTitle")} text={t("admin.loyalty.settings.signupText")}
              enabled={form.signupBonus.enabled} onToggle={(v) => set("signupBonus.enabled", v)} disabled={!form.signupBonus.enabled}>
              <NumberField value={form.signupBonus.points} onChange={(v) => set("signupBonus.points", v)} suffix={t("admin.loyalty.settings.pointsWord")} label={t("admin.loyalty.settings.signupTitle")} />
            </Group>

            <Group icon={TicketPercent} title={t("admin.loyalty.settings.redeemTitle")} text={t("admin.loyalty.settings.redeemText")}
              enabled={form.redeem.enabled} onToggle={(v) => set("redeem.enabled", v)} disabled={!form.redeem.enabled}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-[var(--text-secondary)]">
                <NumberField value={form.redeem.redeemPoints} onChange={(v) => set("redeem.redeemPoints", v)} suffix={t("admin.loyalty.settings.pointsWord")} label={t("admin.loyalty.settings.pointsLabel")} error={errors["redeem.redeemPoints"]} />
                <span>=</span>
                <NumberField value={form.redeem.redeemValue} onChange={(v) => set("redeem.redeemValue", v)} prefix="Rs" width="w-20" label={t("admin.loyalty.settings.valueLabel")} error={errors["redeem.redeemValue"]} />
                <span>{t("admin.loyalty.settings.redeemSentence")}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:max-w-lg">
                <Labeled label={t("admin.loyalty.settings.minPoints")} hint={t("admin.loyalty.settings.minPointsHint")}>
                  <NumberField value={form.redeem.minPoints} onChange={(v) => set("redeem.minPoints", v)} width="w-28" label={t("admin.loyalty.settings.minPoints")} />
                </Labeled>
                <Labeled label={t("admin.loyalty.settings.maxPercent")} hint={t("admin.loyalty.settings.maxPercentHint")} error={errors["redeem.maxPercent"]}>
                  <NumberField value={form.redeem.maxPercent} onChange={(v) => set("redeem.maxPercent", v)} suffix="%" width="w-20" label={t("admin.loyalty.settings.maxPercent")} error={errors["redeem.maxPercent"]} />
                </Labeled>
              </div>
            </Group>
          </div>
        </Card>

        {/* Live preview */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="overflow-hidden">
            <div className="px-4 pb-4 pt-4" style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--purple, var(--accent)) 100%)", color: "#fff" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">{t("admin.loyalty.settings.previewEyebrow")}</p>
              <p className="mt-1 text-[18px] font-bold">{form.programName.trim() || "Rewards"}</p>
              <p className="mt-3 text-[28px] font-bold leading-none tabular-nums">1,000 <span className="text-[13px] font-semibold opacity-85">{t("admin.loyalty.settings.pointsWord")}</span></p>
              <p className="mt-1 text-[12.5px] opacity-85">{t("admin.loyalty.settings.previewWorth", { value: fmtMoney(pointsToValue(program, 1000), locale) })}</p>
            </div>
            <ul className="divide-y divide-[var(--border-color)] text-[13px]">
              {form.signupBonus.enabled && Number(form.signupBonus.points) > 0 && (
                <li className="flex items-center gap-2.5 px-4 py-2.5"><Gift size={15} className="shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 text-[var(--text-secondary)]">{t("admin.loyalty.settings.previewSignup")}</span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">+{fmtPoints(form.signupBonus.points, locale)}</span></li>
              )}
              {form.earn.enabled && (
                <li className="flex items-center gap-2.5 px-4 py-2.5"><ShoppingBag size={15} className="shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 text-[var(--text-secondary)]">{t("admin.loyalty.settings.previewEarn", { points: fmtPoints(form.earn.pointsPerUnit, locale), spend: fmtMoney(form.earn.spendUnit, locale) })}</span></li>
              )}
              {form.redeem.enabled && (
                <li className="flex items-center gap-2.5 px-4 py-2.5"><Coins size={15} className="shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 text-[var(--text-secondary)]">{t("admin.loyalty.settings.previewRedeem", { points: fmtPoints(form.redeem.redeemPoints, locale), value: fmtMoney(form.redeem.redeemValue, locale) })}</span></li>
              )}
            </ul>
          </Card>

          <Card className="p-4">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{t("admin.loyalty.settings.exampleTitle")}</p>
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
              {t("admin.loyalty.settings.exampleOrder")}
              <NumberField value={sample} onChange={setSample} prefix="Rs" width="w-28" label={t("admin.loyalty.settings.exampleOrder")} />
            </label>
            <dl className="mt-3 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">{t("admin.loyalty.settings.exampleEarns")}</dt><dd className="font-semibold tabular-nums text-[var(--success-text)]">+{fmtPoints(sampleEarn, locale)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">{t("admin.loyalty.settings.exampleSave")}</dt><dd className="font-semibold tabular-nums text-[var(--text-primary)]">{sampleQuote.ok ? `${fmtMoney(sampleQuote.discount, locale)} · ${fmtPoints(sampleQuote.points, locale)} pts` : "—"}</dd></div>
            </dl>
          </Card>
        </aside>
      </div>

      {/* Save bar — sirf jab kuch badla ho */}
      {dirty && (
        <div className="sticky bottom-3 z-30 mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/95 shadow-lg backdrop-blur">
          <div className="flex items-center justify-end gap-2 px-4 py-2.5">
            <p className="me-auto text-[12.5px] font-medium text-[var(--text-secondary)]">{t("admin.loyalty.settings.unsaved")}</p>
            <button type="button" className={secondaryBtn} onClick={() => { setDraft(null); setErrors({}); }} disabled={save.isPending}>{t("admin.loyalty.settings.discard")}</button>
            <button type="button" className={primaryBtn} style={primaryStyle} onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 size={14} className="animate-spin" />}{t("admin.loyalty.settings.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
