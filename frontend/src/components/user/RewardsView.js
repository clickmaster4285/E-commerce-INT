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

/** Account → Rewards: balance, earning rules aur points history. */
export default function RewardsView() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["myRewards", viewAll ? "all" : page],
    queryFn: () => loyaltyApi.me(viewAll ? { page: 1, limit: 100 } : { page, limit: 10 }),
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="h-12 w-56 rounded-lg bg-[var(--user-bg-hover)] animate-pulse" />
        <div className="h-40 rounded-xl bg-[var(--user-bg-hover)] animate-pulse" />
        <div className="h-56 rounded-xl bg-[var(--user-bg-hover)] animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-8 text-center">
        <p className="text-sm font-medium text-[var(--user-text)]">{t("rewards.loadError")}</p>
        <button type="button" onClick={() => refetch()} className="mt-3 text-sm font-medium text-[var(--user-accent)] hover:underline">{t("rewards.retry")}</button>
      </div>
    );
  }

  const { program, account, transactions, pagination } = data;
  const name = program.programName || "Rewards";

  if (!program.enabled) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"><Gift size={20} strokeWidth={1.7} /></span>
          <p className="mt-4 text-base font-semibold text-[var(--user-text)]">{t("rewards.offTitle")}</p>
          <p className="mt-1 text-[0.8125rem] leading-6 text-[var(--user-text-muted)]">{t("rewards.offText")}</p>
          {account.balance > 0 && <p className="mt-2 text-xs text-[var(--user-text-muted)]">{t("rewards.offTextBalance", { points: n(account.balance, locale) })}</p>}
        </div>
      </div>
    );
  }

  const worth = pointsToValue(program, account.balance);
  const canRedeem = program.redeem.enabled && account.balance >= program.redeem.minPoints;
  const toUnlock = Math.max(0, program.redeem.minPoints - account.balance);

  const cards = [
    program.earn?.enabled && {
      icon: ShoppingBag,
      title: t("rewards.card.shopTitle"),
      text: t("rewards.way.shopText", { points: n(program.earn.pointsPerUnit, locale), spend: n(program.earn.spendUnit, locale) }),
    },
    program.redeem.enabled && {
      icon: TicketPercent,
      title: t("rewards.card.redeemTitle"),
      text: t("rewards.way.redeemText", { points: n(program.redeem.redeemPoints, locale), value: n(program.redeem.redeemValue, locale), pct: program.redeem.maxPercent }),
    },
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--user-text)] sm:text-2xl">{t("rewards.pageTitle")}</h1>
        <p className="mt-1 text-[0.8125rem] text-[var(--user-text-muted)]">{t("rewards.pageSubtitle")}</p>
      </div>

      {/* Balance */}
      <section className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--user-text-muted)]">
              <Coins size={13} strokeWidth={1.9} className="text-[var(--user-accent)]" />
              {t("rewards.available")}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[2.75rem] font-medium leading-none tracking-tight tabular-nums text-[var(--user-text)]">{n(account.balance, locale)}</span>
              <span className="text-sm font-medium text-[var(--user-text-muted)]">{t("rewards.points")}</span>
            </p>
            {program.redeem.enabled && (
              <p className="mt-2 text-[0.8125rem] text-[var(--user-text-muted)]">
                {canRedeem ? t("rewards.worth", { value: n(worth, locale) }) : t("rewards.toUnlock", { points: n(toUnlock, locale) })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {account.pending > 0 && (
              <div className="rounded-lg bg-[var(--user-bg-hover)] px-3 py-2">
                <p className="flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-wide text-[var(--user-text-muted)]"><Clock size={11} /> {t("rewards.pending")}</p>
                <p className="mt-0.5 text-base font-medium tabular-nums text-[var(--user-text)]">{n(account.pending, locale)}</p>
              </div>
            )}
            <div className="rounded-lg bg-[var(--user-bg-hover)] px-3 py-2">
              <p className="flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-wide text-[var(--user-text-muted)]"><Coins size={11} /> {t("rewards.lifetime")}</p>
              <p className="mt-0.5 text-base font-medium tabular-nums text-[var(--user-text)]">{n(account.lifetimeEarned, locale)}</p>
            </div>
          </div>
        </div>
        {account.pending > 0 && <p className="mt-4 text-xs text-[var(--user-text-muted)]">{t("rewards.pendingNote")}</p>}
      </section>

      {/* Earning / redemption rules */}
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)]"><Icon size={16} strokeWidth={1.8} /></span>
              <p className="mt-3 text-[0.875rem] font-medium text-[var(--user-text)]">{title}</p>
              <p className="mt-1 text-[0.75rem] leading-5 text-[var(--user-text-muted)]">{text}</p>
            </div>
          ))}
        </div>
      )}

      {program.signupBonus.enabled && program.signupBonus.points > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-2.5 text-xs text-[var(--user-text-muted)]">
          <Sparkles size={14} strokeWidth={1.8} className="shrink-0 text-[var(--user-accent)]" />
          {t("rewards.way.signupText", { points: n(program.signupBonus.points, locale) })}
        </div>
      )}

      {canRedeem && (
        <Link href="/cart" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-[var(--user-accent)] hover:underline">
          {t("rewards.useNow")}
          <ChevronRight size={14} className="rtl:rotate-180" />
        </Link>
      )}

      {/* History */}
      <section className="overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--user-border)] px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 text-[0.9375rem] font-medium text-[var(--user-text)]">
            <History size={15} strokeWidth={1.8} className="text-[var(--user-text-muted)]" />
            {t("rewards.history")}
          </p>
          <div className="flex items-center gap-3">
            {isFetching && <Loader2 size={15} className="animate-spin text-[var(--user-text-muted)]" />}
            {pagination?.pages > 1 && (
              <button type="button" onClick={() => { setViewAll((v) => !v); setPage(1); }} className="text-xs font-medium text-[var(--user-accent)] hover:underline">
                {viewAll ? t("rewards.showLess") : t("rewards.viewAll")}
              </button>
            )}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--user-text)]">{t("rewards.noHistory")}</p>
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
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${plus ? "bg-[var(--user-success)]/10 text-[var(--user-success)]" : "bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"}`}>
                    <Icon size={15} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium text-[var(--user-text)]">
                      {t(`rewards.type.${tx.type}`)}{tx.order_number ? ` · ${tx.order_number}` : ""}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--user-text-muted)]">
                      <span>{new Date(tx.created_at).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</span>
                      {tx.status !== "available" && (
                        <span className="rounded-full bg-[var(--user-bg-hover)] px-2 py-0.5 font-medium">
                          {t(`rewards.status.${tx.status}`)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-medium tabular-nums ${reversed ? "text-[var(--user-text-muted)] line-through" : plus ? "text-[var(--user-success)]" : "text-[var(--user-danger)]"}`}>
                    {plus ? "+" : "−"}{n(Math.abs(tx.points), locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {pagination?.pages > 1 && !viewAll && (
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
      </section>
    </div>
  );
}
