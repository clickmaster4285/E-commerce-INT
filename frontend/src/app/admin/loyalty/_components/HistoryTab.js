"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, Search } from "lucide-react";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, EmptyRow, Pager, PointsDelta, StatusPill, TxnIcon, fmtDateTime, inputCls } from "./shared";

const TYPES = ["all", "earn", "redeem", "signup", "refund", "adjust"];
const STATUSES = ["all", "available", "pending", "reversed"];

export default function HistoryTab({ onOpenMember }) {
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["loyalty-admin", "transactions", debounced, type, status, page],
    queryFn: () => loyaltyApi.transactions({
      search: debounced || undefined,
      type: type === "all" ? undefined : type,
      status: status === "all" ? undefined : status,
      page,
      limit: 20,
    }),
    placeholderData: (prev) => prev,
  });
  const rows = data?.data || [];
  const filtered = Boolean(debounced || type !== "all" || status !== "all");

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-[var(--border-color)] p-3 md:flex-row md:items-center">
        <label className="relative block w-full md:max-w-sm">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.loyalty.history.search")}
            aria-label={t("admin.loyalty.history.search")} className={`${inputCls} ps-9`} />
        </label>
        <div className="flex flex-1 items-center gap-2 md:justify-end">
          {isFetching && !isLoading && <Loader2 size={15} className="animate-spin text-[var(--text-muted)]" aria-label={t("admin.loyalty.common.loading")} />}
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label={t("admin.loyalty.history.type")} className={`${inputCls} md:w-[170px]`}>
            {TYPES.map((x) => <option key={x} value={x}>{x === "all" ? t("admin.loyalty.history.allTypes") : t(`admin.loyalty.type.${x}`)}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={t("admin.loyalty.history.statusLabel")} className={`${inputCls} md:w-[150px]`}>
            {STATUSES.map((x) => <option key={x} value={x}>{x === "all" ? t("admin.loyalty.history.allStatuses") : t(`admin.loyalty.status.${x}`)}</option>)}
          </select>
        </div>
      </div>

      {isError ? (
        <EmptyRow title={t("admin.loyalty.history.loadError")} />
      ) : isLoading ? (
        <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyRow icon={History} title={t(filtered ? "admin.loyalty.history.noMatch" : "admin.loyalty.history.empty")} text={filtered ? "" : t("admin.loyalty.history.emptyText")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-table,var(--bg-card-alt))] text-[12px] font-semibold text-[var(--text-muted)]">
                <th className="px-4 py-2.5 text-start">{t("admin.loyalty.history.col.activity")}</th>
                <th className="px-4 py-2.5 text-start">{t("admin.loyalty.history.col.customer")}</th>
                <th className="px-4 py-2.5 text-start">{t("admin.loyalty.history.col.details")}</th>
                <th className="px-4 py-2.5 text-start">{t("admin.loyalty.history.col.status")}</th>
                <th className="px-4 py-2.5 text-end">{t("admin.loyalty.history.col.points")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {rows.map((tx) => (
                <tr key={tx._id} className="transition hover:bg-[var(--bg-row-hover)]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <TxnIcon type={tx.type} />
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{t(`admin.loyalty.type.${tx.type}`)}</p>
                        <p className="whitespace-nowrap text-[12px] text-[var(--text-muted)]">{fmtDateTime(tx.created_at, locale)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {tx.user ? (
                      <button type="button" onClick={() => onOpenMember(tx.user._id)} className="max-w-[220px] text-start hover:underline">
                        <span className="block truncate font-medium text-[var(--text-primary)]">{tx.user.name}</span>
                        <span className="block truncate text-[12px] text-[var(--text-muted)]">{tx.user.email}</span>
                      </button>
                    ) : <span className="text-[var(--text-muted)]">—</span>}
                  </td>
                  <td className="max-w-[260px] px-4 py-2.5 text-[12.5px] text-[var(--text-secondary)]">
                    <span className="line-clamp-2">
                      {[tx.order_number, tx.note && tx.note !== `Order ${tx.order_number}` ? tx.note : "", tx.actor_name ? t("admin.loyalty.history.by", { name: tx.actor_name }) : ""].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={tx.status} /></td>
                  <td className="px-4 py-2.5 text-end"><PointsDelta points={tx.points} status={tx.status} locale={locale} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager pagination={data?.pagination} onPage={setPage} />
    </Card>
  );
}
