"use client";

import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock, Coins, Gift, PowerOff, TicketPercent, Trophy, Users } from "lucide-react";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  Avatar, Card, CardHead, EmptyRow, PointsDelta, TxnIcon, fmtDateTime, fmtMoney, fmtPoints, primaryBtn, primaryStyle, toneStyle,
} from "./shared";

function Kpi({ icon: Icon, tone, label, value, hint, loading }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={toneStyle(tone)}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <p className="truncate text-[12.5px] font-medium text-[var(--text-secondary)]">{label}</p>
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" />
      ) : (
        <p className="mt-3 text-[24px] font-bold leading-7 tracking-tight tabular-nums text-[var(--text-primary)]">{value}</p>
      )}
      <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{loading ? " " : hint}</p>
    </div>
  );
}

export default function OverviewTab({ onGoTo, onOpenMember }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["loyalty-admin", "overview"],
    queryFn: loyaltyApi.overview,
    retry: 1,
  });
  const s = data?.stats || {};
  const program = data?.program;
  // Points ki rupay value (redeem rate se)
  const per = program?.redeem?.redeemPoints || 100;
  const val = program?.redeem?.redeemValue || 0;
  const worth = (p) => Math.floor((p * val) / per);

  if (isError) {
    return (
      <Card>
        <EmptyRow title={t("admin.loyalty.overview.loadError")} text={<button type="button" className="mt-2 text-[var(--accent)] underline" onClick={() => refetch()}>{t("admin.loyalty.common.retry")}</button>} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {program && !program.enabled && (
        <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
          <div className="flex items-start gap-3">
            <PowerOff size={18} className="mt-0.5 shrink-0" style={{ color: "var(--warning-text)" }} aria-hidden="true" />
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{t("admin.loyalty.overview.offTitle")}</p>
              <p className="text-[12.5px] text-[var(--text-secondary)]">{t("admin.loyalty.overview.offText")}</p>
            </div>
          </div>
          <button type="button" onClick={() => onGoTo("settings")} className={primaryBtn} style={primaryStyle}>
            {t("admin.loyalty.overview.turnOn")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} tone="accent" loading={isLoading} label={t("admin.loyalty.overview.members")}
          value={fmtPoints(s.members, locale)} hint={t("admin.loyalty.overview.membersHint", { total: fmtPoints(s.customers, locale) })} />
        <Kpi icon={Coins} tone="purple" loading={isLoading} label={t("admin.loyalty.overview.outstanding")}
          value={fmtPoints(s.outstanding, locale)} hint={t("admin.loyalty.overview.worth", { value: fmtMoney(worth(s.outstanding), locale) })} />
        <Kpi icon={Clock} tone="warning" loading={isLoading} label={t("admin.loyalty.overview.pending")}
          value={fmtPoints(s.pending, locale)} hint={t("admin.loyalty.overview.pendingHint")} />
        <Kpi icon={TicketPercent} tone="success" loading={isLoading} label={t("admin.loyalty.overview.discountGiven")}
          value={fmtMoney(s.discountValue, locale)} hint={t("admin.loyalty.overview.discountHint", { orders: fmtPoints(s.ordersWithPoints, locale), points: fmtPoints(s.redeemed, locale) })} />
      </div>

      <Card>
        <CardHead
          title={t("admin.loyalty.overview.chartTitle")}
          subtitle={t("admin.loyalty.overview.chartSubtitle")}
          action={
            <div className="flex items-center gap-3 text-[12px] text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" />{t("admin.loyalty.overview.earned")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" />{t("admin.loyalty.overview.redeemed")}</span>
            </div>
          }
        />
        <div className="h-[240px] px-2 pb-2 pt-3" dir="ltr">
          {isLoading ? (
            <div className="h-full animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.series || []} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="loyEarn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="loyRedeem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24}
                  tickFormatter={(d) => new Date(d).toLocaleDateString(locale, { month: "short", day: "numeric" })} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} width={44} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}
                  formatter={(v, key) => [fmtPoints(v, locale), key === "earned" ? t("admin.loyalty.overview.earned") : t("admin.loyalty.overview.redeemed")]}
                />
                <Area type="monotone" dataKey="earned" stroke="var(--success)" strokeWidth={2} fill="url(#loyEarn)" />
                <Area type="monotone" dataKey="redeemed" stroke="var(--accent)" strokeWidth={2} fill="url(#loyRedeem)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHead
            title={t("admin.loyalty.overview.recent")}
            action={<button type="button" className="text-[12.5px] font-semibold text-[var(--accent)] hover:underline" onClick={() => onGoTo("history")}>{t("admin.loyalty.common.viewAll")}</button>}
          />
          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />)}</div>
          ) : !data?.recent?.length ? (
            <EmptyRow icon={Gift} title={t("admin.loyalty.overview.noActivity")} text={t("admin.loyalty.overview.noActivityText")} />
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {data.recent.map((tx) => (
                <li key={tx._id}>
                  <button type="button" onClick={() => tx.user?._id && onOpenMember(tx.user._id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition hover:bg-[var(--bg-row-hover)]">
                    <TxnIcon type={tx.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{tx.user?.name || "—"}</span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">
                        {t(`admin.loyalty.type.${tx.type}`)}{tx.order_number ? ` · ${tx.order_number}` : ""} · {fmtDateTime(tx.created_at, locale)}
                      </span>
                    </span>
                    <PointsDelta points={tx.points} status={tx.status} locale={locale} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title={t("admin.loyalty.overview.top")} subtitle={t("admin.loyalty.overview.topSubtitle")} />
          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />)}</div>
          ) : !data?.top?.length ? (
            <EmptyRow icon={Trophy} title={t("admin.loyalty.overview.noTop")} />
          ) : (
            <ol className="divide-y divide-[var(--border-color)]">
              {data.top.map((m, i) => (
                <li key={m.user._id}>
                  <button type="button" onClick={() => onOpenMember(m.user._id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition hover:bg-[var(--bg-row-hover)]">
                    <span className="w-4 text-center text-[12px] font-semibold tabular-nums text-[var(--text-muted)]">{i + 1}</span>
                    <Avatar name={m.user.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{m.user.name}</span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">{m.user.email}</span>
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{fmtPoints(m.balance, locale)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
