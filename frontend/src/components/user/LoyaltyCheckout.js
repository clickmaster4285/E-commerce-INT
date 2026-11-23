"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Coins, Gift, Info, Sparkles } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const n = (v, locale) => Number(v || 0).toLocaleString(locale);

/**
 * Checkout "Rewards wallet" card.
 * State parent ke paas hai (usePoints / points) taake total har jagah same rahe.
 *   rewards  → /loyalty/me ka data ({ program, account })
 *   quote    → current request ka quoteRedemption result
 *   maxQuote → poore balance par quote (slider ki upper limit + na chalne ki wajah)
 */
export function PointsRedeemCard({ rewards, usePoints, points, onToggle, onPoints, quote, maxQuote, earnPoints, compact = false, className = "" }) {
  const { t, locale } = useTranslation();
  const [showRules, setShowRules] = useState(false);
  const program = rewards?.program;
  const account = rewards?.account;
  if (!program?.enabled) return null;

  const r = program.redeem || {};
  const balance = account?.balance || 0;
  const minPoints = r.minPoints || 0;
  const per = Math.max(1, r.redeemPoints || 100);
  const worth = Math.floor((balance * (r.redeemValue || 0)) / per);
  const max = maxQuote?.ok ? maxQuote.points : 0;
  const maxSave = maxQuote?.ok ? maxQuote.discount : 0;
  const canUse = Boolean(r.enabled && maxQuote?.ok);
  const applied = canUse && usePoints && quote?.ok;
  const reason = maxQuote?.reason;
  const progress = minPoints > 0 ? Math.min(100, Math.round((balance / minPoints) * 100)) : 100;
  const pad = compact ? "p-4" : "p-4 sm:p-5";
  const name = program.programName || t("checkout.points.title");

  // Quick chips — 25% / 50% / Max (sirf alag aur min se upar wale)
  const chips = [0.25, 0.5, 1]
    .map((f) => ({ f, v: f === 1 ? max : Math.max(minPoints, Math.floor(max * f)) }))
    .filter((c, i, arr) => c.v > 0 && c.v <= max && arr.findIndex((x) => x.v === c.v) === i);

  return (
    <div className={`min-w-0 overflow-hidden rounded-2xl border bg-[var(--user-bg-card)] shadow-sm transition-colors ${applied ? "border-[var(--user-success)]/50" : "border-[var(--user-border)]"} ${className}`}>
      {/* Wallet header */}
      <div className={`flex items-center gap-3 ${pad}`} style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--user-accent) 9%, transparent), transparent 65%)" }}>
        <span
          className={`relative flex ${compact ? "h-10 w-10" : "h-11 w-11"} shrink-0 items-center justify-center rounded-xl text-white shadow-md`}
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <Coins size={compact ? 18 : 20} />
          {applied && (
            <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--user-success)] ring-2 ring-[var(--user-bg-card)]">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${compact ? "text-sm" : "text-base"} font-bold leading-5 text-[var(--user-text)]`}>{t("checkout.points.walletTitle", { name })}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--user-text-muted)]">
            <span className="font-bold tabular-nums text-[var(--user-text)]">{t("checkout.points.balanceShort", { points: n(balance, locale) })}</span>
            {r.enabled && worth > 0 && <span>· {t("checkout.points.worthShort", { value: n(worth, locale) })}</span>}
          </p>
        </div>
        {canUse && (
          <button
            type="button" role="switch" aria-checked={usePoints} aria-label={t("checkout.points.use")} onClick={() => onToggle(!usePoints)}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent)]/40"
            style={{ background: usePoints ? "var(--user-success)" : "var(--user-border)" }}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${usePoints ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
          </button>
        )}
      </div>

      <div className={`space-y-3 border-t border-[var(--user-border)] ${pad}`}>
        {/* 1) Use ho sakte hain lekin abhi off → saaf call to action */}
        {canUse && !usePoints && (
          <button
            type="button" onClick={() => onToggle(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--user-accent)]/40 bg-[var(--user-accent)]/5 px-3 py-2.5 text-start transition hover:bg-[var(--user-accent)]/10"
          >
            <Sparkles size={16} className="shrink-0 text-[var(--user-accent)]" />
            <span className="min-w-0 flex-1 text-[0.8125rem] text-[var(--user-text)]">
              {t("checkout.points.applyCta", { points: n(max, locale) })}{" "}
              <span className="font-black text-[var(--user-success)]">{t("checkout.points.saveUpTo", { value: n(maxSave, locale) })}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-[var(--user-accent)] px-2.5 py-1 text-xs font-bold text-[var(--user-accent-text)]">{t("checkout.points.apply")}</span>
          </button>
        )}

        {/* 2) Applied → kitne points, chips, slider */}
        {applied && (
          <div className="rounded-xl bg-[var(--user-success)]/8 p-3 ring-1 ring-[var(--user-success)]/25">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.8125rem] font-bold text-[var(--user-text)]">{t("checkout.points.applied", { points: n(quote.points, locale) })}</p>
              <p className="shrink-0 rounded-lg bg-[var(--user-success)] px-2 py-0.5 text-xs font-black tabular-nums text-white">−Rs. {n(quote.discount, locale)}</p>
            </div>
            {max > minPoints && (
              <>
                <input
                  type="range" min={Math.max(1, minPoints)} max={max} step={1} value={Math.min(Math.max(points, minPoints || 1), max)}
                  onChange={(e) => onPoints(Number(e.target.value))} aria-label={t("checkout.points.using")}
                  className="mt-3 w-full accent-[var(--user-success)]"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map(({ f, v }) => {
                    const active = f === 1 ? quote.points >= max : quote.points === v;
                    return (
                      <button
                        key={f} type="button" onClick={() => onPoints(v)} aria-pressed={active}
                        className={`h-7 rounded-lg px-2.5 text-xs font-bold transition ${active ? "bg-[var(--user-success)] text-white" : "bg-[var(--user-bg-card)] text-[var(--user-text)] ring-1 ring-[var(--user-border)] hover:ring-[var(--user-success)]"}`}
                      >
                        {f === 1 ? t("checkout.points.max") : `${Math.round(f * 100)}%`}
                        <span className="ms-1 font-semibold tabular-nums opacity-75">{n(v, locale)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="mt-2 text-[0.6875rem] text-[var(--user-text-muted)]">
              {t("checkout.points.leftAfter", { points: n(balance - quote.points, locale) })}
              {max < balance && ` · ${t("checkout.points.capNote", { pct: r.maxPercent })}`}
            </p>
          </div>
        )}

        {/* 3) Use nahi ho sakte → saaf wajah */}
        {r.enabled && !canUse && (reason === "min_points" ? (
          <div className="rounded-xl bg-[var(--user-bg-hover)]/60 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[var(--user-text)]">{t("checkout.points.needMoreTitle", { points: n(minPoints - balance, locale) })}</span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--user-text-muted)]">{n(balance, locale)} / {n(minPoints, locale)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--user-border)]">
              <div className="h-full rounded-full bg-[var(--user-accent)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[0.6875rem] text-[var(--user-text-muted)]">{t("checkout.points.needMoreText", { min: n(minPoints, locale) })}</p>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-[var(--user-bg-hover)]/60 p-3 text-xs text-[var(--user-text)]">
            <Info size={14} className="mt-0.5 shrink-0 text-[var(--user-text-muted)]" />
            {reason === "order_small"
              ? t("checkout.points.orderSmall", { pct: r.maxPercent, min: n(minPoints, locale) })
              : t("checkout.points.notThisOrder")}
          </p>
        ))}

        {/* Earn line + rules */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {earnPoints > 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--user-text)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"><Sparkles size={11} /></span>
              {t("checkout.points.willEarn", { points: n(earnPoints, locale) })}
            </p>
          ) : <span />}
          <button
            type="button" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--user-accent)] hover:underline"
          >
            {t("checkout.points.howItWorks")}
            <ChevronDown size={13} className={`transition-transform ${showRules ? "rotate-180" : ""}`} />
          </button>
        </div>
        {showRules && (
          <ul className="grid gap-1.5 rounded-xl border border-[var(--user-border)] p-3 text-xs text-[var(--user-text-muted)] sm:grid-cols-2">
            {program.earn?.enabled && <li>• {t("checkout.points.ruleEarn", { points: n(program.earn.pointsPerUnit, locale), spend: n(program.earn.spendUnit, locale) })}</li>}
            {r.enabled && <li>• {t("checkout.points.ruleValue", { points: n(per, locale), value: n(r.redeemValue, locale) })}</li>}
            {r.enabled && minPoints > 0 && <li>• {t("checkout.points.ruleMin", { min: n(minPoints, locale) })}</li>}
            {r.enabled && <li>• {t("checkout.points.ruleCap", { pct: r.maxPercent })}</li>}
            <li className="sm:col-span-2">
              <Link href="/account?tab=rewards" className="font-bold text-[var(--user-accent)] hover:underline">{t("checkout.points.viewHistory")}</Link>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

/** Summary me "Points (−Rs X)" row — har summary block me same. */
export function PointsSummaryRow({ discount, points, className = "" }) {
  const { t, locale } = useTranslation();
  if (!discount) return null;
  return (
    <div className={`flex justify-between ${className}`}>
      <span className="font-medium text-[var(--user-success)]">{t("checkout.points.summaryRow", { points: n(points, locale) })}</span>
      <span className="font-bold text-[var(--user-success)]">−Rs. {n(discount, locale)}</span>
    </div>
  );
}

/** Signup / login page ke liye — "Join and get 100 points" banner. */
export function SignupBonusBanner({ program, className = "" }) {
  const { t, locale } = useTranslation();
  if (!program?.enabled || !program.signupBonus?.enabled || !program.signupBonus.points) return null;
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-[var(--user-accent)]/20 bg-[var(--user-accent)]/8 px-3 py-2.5 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)]"><Gift size={15} /></span>
      <p className="text-xs leading-5 text-[var(--user-text)]">
        <span className="font-black">{t("rewards.signupBanner", { points: n(program.signupBonus.points, locale) })}</span>{" "}
        <span className="text-[var(--user-text-muted)]">{t("rewards.signupBannerText", { name: program.programName || "Rewards" })}</span>
      </p>
    </div>
  );
}

/** Product page / cart line — "Earn X points with this purchase" */
export function EarnHint({ points, className = "" }) {
  const { t, locale } = useTranslation();
  if (!points) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs font-semibold text-[var(--user-text)] ${className}`}>
      <Coins size={13} className="shrink-0 text-[var(--user-accent)]" />
      {t("rewards.earnHint", { points: n(points, locale) })}
      <Link href="/account?tab=rewards" className="font-bold text-[var(--user-accent)] hover:underline">{t("rewards.learnMore")}</Link>
    </p>
  );
}
