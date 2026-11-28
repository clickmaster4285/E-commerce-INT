"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Users } from "lucide-react";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Avatar, Card, EmptyRow, Pager, fmtDate, fmtPoints, inputCls } from "./shared";

const FILTERS = ["all", "with_points", "pending", "redeemed"];
const SORTS = ["balance", "earned", "redeemed", "newest", "name"];

export default function MembersTab({ onOpenMember }) {
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("balance");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["loyalty-admin", "members", debounced, filter, sort, page],
    queryFn: () => loyaltyApi.members({ search: debounced, filter: filter === "all" ? undefined : filter, sort, page, limit: 15 }),
    placeholderData: (prev) => prev,
  });
  const rows = data?.data || [];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-[var(--border-color)] p-3 md:flex-row md:items-center">
        <label className="relative block w-full md:max-w-sm">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.loyalty.members.search")}
            aria-label={t("admin.loyalty.members.search")} className={`${inputCls} ps-9`} />
        </label>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => { setFilter(f); setPage(1); }} aria-pressed={filter === f}
              className={`h-8 rounded-lg px-3 text-[12.5px] font-semibold transition ${filter === f ? "" : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"}`}
              style={filter === f ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}>
              {t(`admin.loyalty.members.filter.${f}`)}
            </button>
          ))}
          {isFetching && !isLoading && <Loader2 size={15} className="animate-spin text-[var(--text-muted)]" aria-label={t("admin.loyalty.common.loading")} />}
        </div>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label={t("admin.loyalty.members.sortBy")}
          className={`${inputCls} md:w-[180px]`}>
          {SORTS.map((s) => <option key={s} value={s}>{t(`admin.loyalty.members.sort.${s}`)}</option>)}
        </select>
      </div>

      {isError ? (
        <EmptyRow title={t("admin.loyalty.members.loadError")} />
      ) : isLoading ? (
        <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyRow icon={Users} title={t(debounced || filter !== "all" ? "admin.loyalty.members.noMatch" : "admin.loyalty.members.empty")} text={t("admin.loyalty.members.emptyText")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-table,var(--bg-card-alt))] text-[12px] font-semibold text-[var(--text-muted)]">
                <th className="px-4 py-2.5 text-start">{t("admin.loyalty.members.col.customer")}</th>
                <th className="px-4 py-2.5 text-end">{t("admin.loyalty.members.col.available")}</th>
                <th className="px-4 py-2.5 text-end">{t("admin.loyalty.members.col.pending")}</th>
                <th className="px-4 py-2.5 text-end">{t("admin.loyalty.members.col.earned")}</th>
                <th className="px-4 py-2.5 text-end">{t("admin.loyalty.members.col.redeemed")}</th>
                <th className="px-4 py-2.5 text-end">{t("admin.loyalty.members.col.joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {rows.map((m) => (
                <tr key={m._id} tabIndex={0} onClick={() => onOpenMember(m._id)} onKeyDown={(e) => { if (e.key === "Enter") onOpenMember(m._id); }}
                  className="cursor-pointer transition hover:bg-[var(--bg-row-hover)] focus-visible:bg-[var(--bg-row-hover)] focus-visible:outline-none">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <div className="min-w-0">
                        <p className="max-w-[260px] truncate font-medium text-[var(--text-primary)]">{m.name}</p>
                        <p className="max-w-[260px] truncate text-[12px] text-[var(--text-muted)]">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-end font-semibold tabular-nums" style={{ color: m.balance > 0 ? "var(--accent)" : "var(--text-muted)" }}>{fmtPoints(m.balance, locale)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-[var(--text-secondary)]">{m.pending ? fmtPoints(m.pending, locale) : "—"}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-[var(--text-secondary)]">{fmtPoints(m.lifetimeEarned, locale)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-[var(--text-secondary)]">{fmtPoints(m.lifetimeRedeemed, locale)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end text-[var(--text-muted)]">{fmtDate(m.joined_at, locale)}</td>
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
