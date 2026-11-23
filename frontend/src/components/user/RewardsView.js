"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Coins, Gift, History, Loader2, RotateCcw, ShoppingBag, SlidersHorizontal, Sparkles, TicketPercent } from "lucide-react";
import { loyaltyApi } from "@/apis/user/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pointsToValue } from "@/lib/loyalty";

const TYPE_ICON = { signup: Sparkles, earn: ShoppingBag, redeem: TicketPercent, refund: RotateCcw, adjust: SlidersHorizontal };

const n = (v, locale) => Number(v || 0).toLocaleString(locale);

/** Account → Rewards: balance card, kaise kamayen/kharch karen, aur history. */
export default function RewardsView() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["myRewards", page],
    queryFn: () => loyaltyApi.me({ page, limit: 10 }),
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-2xl bg-[var(--user-bg-hover)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--user-bg-hover)]" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-8 text-center">
        <p className="text-sm font-bold text-[var(--user-text)]">{t("rewards.loadError")}</p>
        <button type="button" onClick={() => refetch()} className="mt-3 text-sm font-bold text-[var(--user-accent)] hover:underline">{t("rewards.retry")}</button>
      </div>
    );
  }

  const { program, account, transactions, pagination } = data;
  const name = program.programName || "Rewards";

  if (!program.enabled) {
    return (
      <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-8 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"><Gift size={22} /></span>
        <p className="text-[0.9375rem] font-black text-[var(--user-text)]">{t("rewards.offTitle")}</p>
        <p className="mt-1 text-[0.8125rem] text-[var(--user-text-muted)]">
          {account.balance > 0 ? t("rewards.offTextBalance", { points: n(account.balance, locale) }) : t("rewards.offText")}
        </p>
      </div>
    );
  }

  const worth = pointsToValue(program, account.balance);
  const canRedeem = program.redeem.enabled && account.balance >= program.redeem.minPoints;
  const toUnlock = Math.max(0, program.redeem.minPoints - account.balance);

  const ways = [
    program.earn.enabled && {
      icon: ShoppingBag,
      title: t("rewards.way.shop"),
      text: t("rewards.way.shopText", { points: n(program.earn.pointsPerUnit, locale), spend: n(program.earn.spendUnit, locale) }),
    },
    program.signupBonus.enabled && program.signupBonus.points > 0 && {
      icon: Sparkles,
      title: t("rewards.way.signup"),
      text: t("rewards.way.signupText", { points: n(program.signupBonus.points, locale) }),
    },
    program.redeem.enabled && {
      icon: TicketPercent,
      title: t("rewards.way.redeem"),
      text: t("rewards.way.redeemText", { points: n(program.redeem.redeemPoints, locale), value: n(program.redeem.redeemValue, locale), pct: program.redeem.maxPercent }),
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:p-6" style={{ background: "linear-gradient(135deg, var(--user-accent) 0%, color-mix(in srgb, var(--user-accent) 55%, #7c3aed) 100%)" }}>
        <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 end-16 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-black uppercase tracking-[0.14em] opacity-80">{name}</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums leading-none">{n(account.balance, locale)}</span>
              <span className="text-sm font-bold opacity-85">{t("rewards.points")}</span>
            </p>
            {program.redeem.enabled && (
              <p className="mt-1.5 text-[0.8125rem] font-semibold opacity-90">
                {canRedeem ? t("rewards.worth", { value: n(worth, locale) }) : t("rewards.toUnlock", { points: n(toUnlock, locale) })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {account.pending > 0 && (
              <div className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                <p className="flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wider opacity-85"><Clock size={11} /> {t("rewards.pending")}</p>
                <p className="text-lg font-black tabular-nums">{n(account.pending, locale)}</p>
              </div>
            )}
            <div className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wider opacity-85"><Coins size={11} /> {t("rewards.lifetime")}</p>
              <p className="text-lg font-black tabular-nums">{n(account.lifetimeEarned, locale)}</p>
            </div>
          </div>
        </div>
        {account.pending > 0 && <p className="relative mt-4 text-[0.75rem] opacity-85">{t("rewards.pendingNote")}</p>}
        {canRedeem && (
          <Link href="/cart" className="relative mt-4 inline-flex h-9 items-center rounded-xl bg-white px-4 text-[0.8125rem] font-black text-[var(--user-accent)] transition hover:opacity-90">
            {t("rewards.useNow")}
          </Link>
        )}
      </div>

      {/* Ways to earn / use */}
      {ways.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {ways.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><Icon size={17} /></span>
              <p className="mt-3 text-[0.8125rem] font-black text-[var(--user-text)]">{title}</p>
              <p className="mt-0.5 text-[0.75rem] leading-5 text-[var(--user-text-muted)]">{text}</p>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div className="overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]">
        <div className="flex items-center justify-between border-b border-[var(--user-border)] px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 text-[0.9375rem] font-black text-[var(--user-text)]"><History size={16} className="text-[var(--user-accent)]" /> {t("rewards.history")}</p>
          {isFetching && <Loader2 size={15} className="animate-spin text-[var(--user-text-muted)]" />}
        </div>
        {transactions.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-bold text-[var(--user-text)]">{t("rewards.noHistory")}</p>
            <p className="mt-1 text-[0.75rem] text-[var(--user-text-muted)]">{t("rewards.noHistoryText")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--user-border)]">
            {transactions.map((tx) => {
              const Icon = TYPE_ICON[tx.type] || Gift;
              const reversed = tx.status === "reversed";
              const plus = tx.points > 0;
              return (
                <li key={tx._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${plus ? "bg-[var(--user-success)]/10 text-[var(--user-success)]" : "bg-[var(--user-accent)]/10 text-[var(--user-accent)]"}`}><Icon size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-bold text-[var(--user-text)]">
                      {t(`rewards.type.${tx.type}`)}{tx.order_number ? ` · ${tx.order_number}` : ""}
                    </p>
                    <p className="text-[0.6875rem] text-[var(--user-text-muted)]">
                      {new Date(tx.created_at).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}
                      {tx.status === "pending" && <span className="ms-2 rounded-full bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">{t("rewards.status.pending")}</span>}
                      {reversed && <span className="ms-2 rounded-full bg-[var(--user-bg-hover)] px-2 py-0.5 font-bold">{t("rewards.status.reversed")}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-black tabular-nums ${reversed ? "text-[var(--user-text-muted)] line-through" : plus ? "text-[var(--user-success)]" : "text-[var(--user-danger)]"}`}>
                    {plus ? "+" : "−"}{n(Math.abs(tx.points), locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {pagination?.pages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--user-border)] px-4 py-2.5 text-[0.75rem] text-[var(--user-text-muted)] sm:px-5">
            <span>{t("rewards.page", { page: pagination.page, pages: pagination.pages })}</span>
            <div className="flex gap-1.5">
              <button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((p) => p - 1)} aria-label={t("rewards.prev")}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--user-border)] disabled:opacity-40"><ChevronLeft size={15} className="rtl:rotate-180" /></button>
              <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((p) => p + 1)} aria-label={t("rewards.next")}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--user-border)] disabled:opacity-40"><ChevronRight size={15} className="rtl:rotate-180" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
