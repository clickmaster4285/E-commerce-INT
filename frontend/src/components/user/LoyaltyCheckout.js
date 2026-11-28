"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Coins, Gift, Minus, Plus, Sparkles } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const n = (v, locale) => Number(v || 0).toLocaleString(locale);

/**
 * Order summary ke andar compact rewards wallet.
 * Props: checkout ka pointsCardProps (rewards, quote, maxQuote, …).
 * Har haalat ka saaf message: points nahi / kam / order chhota / use ho sakte.
 */
export function RewardsSummaryBox({ rewards, usePoints, points, onToggle, onPoints, quote, maxQuote, earnPoints, readOnly = false, className = "" }) {
  const { t, locale } = useTranslation();
  const program = rewards?.program;
  if (!program?.enabled) return null;

  const r = program.redeem || {};
  const balance = rewards?.account?.balance || 0;
  const minPoints = r.minPoints || 0;
  const max = maxQuote?.ok ? maxQuote.points : 0;
  const maxSave = maxQuote?.ok ? maxQuote.discount : 0;
  const canUse = Boolean(r.enabled && maxQuote?.ok);
  const applied = canUse && usePoints && quote?.ok;
  const reason = maxQuote?.reason;
  const name = program.programName || t("checkout.points.title");
  const low = Math.max(1, minPoints);
  const hasChoice = max > low; // chunne ko kuch hai?
  // Step = jitne points me poora Rs 1 banta hai (kam se kam 1)
  const per = Math.max(1, r.redeemPoints || 100);
  const step = Math.max(1, Math.round(per / Math.max(1, r.redeemValue || 1)));
  const current = applied ? quote.points : Math.min(Math.max(points || max, low), max);
  const clamp = (v) => Math.min(max, Math.max(low, Math.round(Number(v) || 0)));
  // Limit ki wajah: balance khatam ya order ka % cap
  const limitByBalance = max >= balance;

  // Message (koi points nahi / kam / order chhota)
  let message = null;
  if (r.enabled && !canUse) {
    if (balance === 0) message = { title: t("checkout.wallet.emptyTitle"), text: earnPoints > 0 ? t("checkout.wallet.emptyEarn", { points: n(earnPoints, locale) }) : t("checkout.wallet.emptyText") };
    else if (reason === "min_points") message = { title: t("checkout.wallet.lowTitle", { points: n(minPoints - balance, locale) }), text: t("checkout.wallet.lowText", { balance: n(balance, locale), min: n(minPoints, locale) }), progress: Math.min(100, Math.round((balance / Math.max(1, minPoints)) * 100)) };
    else message = { title: t("checkout.wallet.smallTitle"), text: t("checkout.wallet.smallText", { pct: r.maxPercent }) };
  }

  const stepBtn = "rw-step flex h-7 w-7 items-center justify-center rounded-md text-user-fg transition disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className={`checkout-rewards shrink-0 overflow-hidden rounded-xl border border-user-line transition-colors ${applied ? "rw-on" : ""} ${className}`}>
      {/* Header row: coin + balance + switch */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="rw-coin relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Coins size={15} />
          {applied && <span className="rw-tick absolute -end-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"><Check size={8} strokeWidth={3.5} /></span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-semibold text-user-fg">
            {canUse
              ? (applied ? t("checkout.wallet.applied", { points: n(quote.points, locale) }) : t("checkout.wallet.use", { points: n(max, locale) }))
              : name}
          </p>
          <p className="truncate text-[0.6875rem] text-user-fg-muted">
            {canUse
              ? (applied
                ? <span className="rw-save font-semibold">{t("checkout.wallet.saving", { value: n(quote.discount, locale) })}</span>
                : t("checkout.wallet.saveUpTo", { value: n(maxSave, locale), balance: n(balance, locale) }))
              : t("checkout.points.balanceShort", { points: n(balance, locale) })}
          </p>
        </div>
        {canUse && !readOnly && (
          <button type="button" role="switch" aria-checked={usePoints} aria-label={t("checkout.points.use")} onClick={() => onToggle(!usePoints)}
            className="rw-switch relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${usePoints ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
          </button>
        )}
      </div>

      {/* Applied → kitne points + limit */}
      {applied && !readOnly && (
        <div className="space-y-2 border-t border-user-line px-3 py-2.5">
          {hasChoice ? (
            <div className="flex items-center gap-2">
              <span className="me-auto text-[0.75rem] font-medium text-user-fg">{t("checkout.wallet.howMany")}</span>
              <div className="flex items-center rounded-lg border border-user-line bg-user-card p-0.5">
                <button type="button" className={stepBtn} onClick={() => onPoints(clamp(current - step))} disabled={current <= low} aria-label={t("checkout.wallet.less")}>
                  <Minus size={13} />
                </button>
                <PointsInput key={current} value={current} onCommit={(v) => onPoints(clamp(v))} label={t("checkout.wallet.howMany")} />
                <button type="button" className={stepBtn} onClick={() => onPoints(clamp(current + step))} disabled={current >= max} aria-label={t("checkout.wallet.more")}>
                  <Plus size={13} />
                </button>
              </div>
              <button type="button" onClick={() => onPoints(max)} disabled={current >= max}
                className="rw-max h-7 rounded-md px-2 text-[0.6875rem] font-semibold transition disabled:cursor-default disabled:opacity-50">
                {t("checkout.points.max")}
              </button>
            </div>
          ) : (
            <p className="text-[0.75rem] font-medium text-user-fg">{t("checkout.wallet.usingAll")}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[0.6875rem] text-user-fg-muted">
            <span>
              {t("checkout.wallet.limit", { points: n(max, locale), value: n(maxSave, locale) })}{" "}
              <span className="opacity-80">· {limitByBalance ? t("checkout.wallet.limitBalance") : t("checkout.wallet.limitCap", { pct: r.maxPercent })}</span>
            </span>
            <span className="tabular-nums">{t("checkout.wallet.left", { points: n(balance - quote.points, locale) })}</span>
          </div>
        </div>
      )}

      {/* Points nahi / kam / order chhota */}
      {message && (
        <div className="border-t border-user-line bg-user-hover/50 px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold text-user-fg">{message.title}</p>
          <p className="mt-0.5 text-[0.6875rem] leading-4 text-user-fg-muted">{message.text}</p>
          {message.progress != null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-user-line">
              <div className="rw-bar h-full rounded-full" style={{ width: `${message.progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Is order par kamaai */}
      {earnPoints > 0 && !(message && balance === 0) && (
        <p className="flex items-center gap-1.5 border-t border-user-line px-3 py-2 text-[0.6875rem] font-semibold text-user-fg">
          <Sparkles size={12} className="rw-spark shrink-0" />
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
      <span className="font-medium text-user-success">{t("checkout.points.summaryRow", { points: n(points, locale) })}</span>
      <span className="font-bold text-user-success">−Rs. {n(discount, locale)}</span>
    </div>
  );
}

/** Signup / login page ke liye — "Join and get 100 points" banner. */
export function SignupBonusBanner({ program, className = "" }) {
  const { t, locale } = useTranslation();
  if (!program?.enabled || !program.signupBonus?.enabled || !program.signupBonus.points) return null;
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-user-accent/20 bg-user-accent/8 px-3 py-2.5 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-user-accent text-user-accent-fg"><Gift size={15} /></span>
      <p className="text-xs leading-5 text-user-fg">
        <span className="font-black">{t("rewards.signupBanner", { points: n(program.signupBonus.points, locale) })}</span>{" "}
        <span className="text-user-fg-muted">{t("rewards.signupBannerText", { name: program.programName || "Rewards" })}</span>
      </p>
    </div>
  );
}

/** Product page / cart line — "Earn X points with this purchase" */
export function EarnHint({ points, className = "" }) {
  const { t, locale } = useTranslation();
  if (!points) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs font-semibold text-user-fg ${className}`}>
      <Coins size={13} className="shrink-0 text-user-accent" />
      {t("rewards.earnHint", { points: n(points, locale) })}
      <Link href="/account?tab=rewards" className="font-bold text-user-accent hover:underline">{t("rewards.learnMore")}</Link>
    </p>
  );
}

/** Stepper ka beech wala input — type karte waqt local text, blur/Enter par apply */
function PointsInput({ value, onCommit, label }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="number" inputMode="numeric" value={text} aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCommit(text); } }}
      className="h-7 w-16 bg-transparent text-center text-[0.8125rem] font-semibold tabular-nums text-user-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
