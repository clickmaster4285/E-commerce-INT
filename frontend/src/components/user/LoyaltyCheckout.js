"use client";

import Link from "next/link";
import { Coins, Gift, Sparkles } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const n = (v, locale) => Number(v || 0).toLocaleString(locale);

/**
 * Checkout "Use my points" card.
 * State parent ke paas hai (usePoints / points) taake total har jagah same rahe.
 *   rewards  → /loyalty/me ka data ({ program, account })
 *   quote    → lib/loyalty quoteRedemption ka result (current request ke liye)
 *   maxQuote → poore maxPoints par quote (slider ki upper limit)
 */
export function PointsRedeemCard({ rewards, usePoints, points, onToggle, onPoints, quote, maxQuote, earnPoints, compact = false, className = "" }) {
  const { t, locale } = useTranslation();
  const program = rewards?.program;
  const account = rewards?.account;
  if (!program?.enabled) return null;

  const balance = account?.balance || 0;
  const minPoints = program.redeem?.minPoints || 0;
  const redeemOn = program.redeem?.enabled;
  const max = maxQuote?.ok ? maxQuote.points : 0;
  const canUse = redeemOn && max > 0 && balance >= minPoints;
  const pad = compact ? "p-4" : "p-4 sm:p-5";

  return (
    <div className={`min-w-0 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm ${pad} ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`flex ${compact ? "h-9 w-9" : "h-10 w-10"} shrink-0 items-center justify-center rounded-xl border border-[var(--user-accent)]/15 bg-[var(--user-accent)]/10`}>
          <Coins size={compact ? 17 : 18} className="text-[var(--user-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`${compact ? "text-sm" : "text-base"} font-semibold leading-5 text-[var(--user-text)]`}>{program.programName || t("checkout.points.title")}</h2>
          <p className="mt-0.5 text-xs leading-4 text-[var(--user-text-muted)]">
            {t("checkout.points.balance", { points: n(balance, locale) })}
          </p>
        </div>
        {canUse && (
          <button type="button" role="switch" aria-checked={usePoints} aria-label={t("checkout.points.use")} onClick={() => onToggle(!usePoints)}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent)]/40"
            style={{ background: usePoints ? "var(--user-accent)" : "var(--user-border)" }}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${usePoints ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
          </button>
        )}
      </div>

      {canUse && usePoints && (
        <div className="mt-4 rounded-xl bg-[var(--user-bg-hover)]/60 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--user-text-muted)]">{t("checkout.points.using")}</p>
            <p className="text-sm font-black tabular-nums text-[var(--user-text)]">
              {n(quote?.ok ? quote.points : 0, locale)} <span className="text-xs font-semibold text-[var(--user-text-muted)]">/ {n(max, locale)}</span>
            </p>
          </div>
          <input type="range" min={minPoints || 1} max={max} step={1} value={Math.min(Math.max(points, minPoints || 1), max)}
            onChange={(e) => onPoints(Number(e.target.value))} aria-label={t("checkout.points.using")}
            className="mt-2 w-full accent-[var(--user-accent)]" />
          <div className="mt-1 flex items-center justify-between text-xs">
            <button type="button" onClick={() => onPoints(minPoints || 1)} className="font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-text)]">{t("checkout.points.min")}</button>
            <span className="font-black text-[var(--user-success)]">{quote?.ok ? t("checkout.points.saving", { value: n(quote.discount, locale) }) : ""}</span>
            <button type="button" onClick={() => onPoints(max)} className="font-semibold text-[var(--user-accent)] hover:underline">{t("checkout.points.max")}</button>
          </div>
          {max < balance && (
            <p className="mt-2 text-[0.6875rem] text-[var(--user-text-muted)]">{t("checkout.points.capNote", { pct: program.redeem.maxPercent })}</p>
          )}
        </div>
      )}

      {redeemOn && !canUse && (
        <p className="mt-3 text-xs text-[var(--user-text-muted)]">
          {balance < minPoints
            ? t("checkout.points.needMore", { points: n(minPoints - balance, locale), min: n(minPoints, locale) })
            : t("checkout.points.notThisOrder")}
        </p>
      )}

      {earnPoints > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--user-text)]">
          <Sparkles size={13} className="shrink-0 text-[var(--user-accent)]" />
          {t("checkout.points.willEarn", { points: n(earnPoints, locale) })}
        </p>
      )}
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
