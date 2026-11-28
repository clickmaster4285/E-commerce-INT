"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Loader2, Minus, Plus, X } from "lucide-react";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  Avatar, EmptyRow, Pager, PointsDelta, StatusPill, TxnIcon, fmtDate, fmtDateTime, fmtMoney, fmtPoints, inputCls, primaryBtn, primaryStyle,
} from "./shared";

/** Right side panel — ek member ka balance, manual adjust aur poori history. */
export default function MemberDrawer({ userId, onClose }) {
  const { t, locale } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("add");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  // Parent `key={userId}` deta hai — naya member = naya component (form khud reset)
  const open = Boolean(userId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["loyalty-admin", "member", userId, page],
    queryFn: () => loyaltyApi.member(userId, { page, limit: 15 }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const adjust = useMutation({
    mutationFn: (payload) => loyaltyApi.adjust(userId, payload),
    onSuccess: () => {
      toast.success(t("admin.loyalty.member.adjusted"));
      setPoints(""); setNote(""); setErrors({}); setPage(1);
      qc.invalidateQueries({ queryKey: ["loyalty-admin"] });
    },
    onError: (err) => {
      const d = err?.response?.data || {};
      setErrors(d.errors || {});
      toast.error(d.message || t("admin.loyalty.member.adjustFailed"));
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const n = Math.floor(Number(points));
    const next = {};
    if (!Number.isFinite(n) || n <= 0) next.points = t("admin.loyalty.member.pointsInvalid");
    if (note.trim().length < 3) next.note = t("admin.loyalty.member.reasonRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    adjust.mutate({ points: mode === "add" ? n : -n, note: note.trim() });
  };

  if (!open || typeof document === "undefined") return null;
  const acc = data?.account || {};
  const user = data?.user;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t("admin.loyalty.member.title")}>
      <button type="button" aria-label={t("admin.loyalty.common.close")} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-[440px] flex-col border-s border-line bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          {user ? <Avatar name={user.name} size={40} /> : <span className="h-10 w-10 animate-pulse rounded-full bg-subtle" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-fg">{user?.name || " "}</p>
            <p className="truncate text-[12px] text-fg-muted">{user ? `${user.email}${user.joined_at ? ` · ${t("admin.loyalty.member.joined", { date: fmtDate(user.joined_at, locale) })}` : ""}` : " "}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("admin.loyalty.common.close")} className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isError ? (
            <EmptyRow title={t("admin.loyalty.member.loadError")} />
          ) : (
            <>
              {/* Balance */}
              <div className="grid grid-cols-3 border-b border-line">
                {[
                  { label: t("admin.loyalty.member.available"), value: acc.balance, strong: true },
                  { label: t("admin.loyalty.member.pending"), value: acc.pending },
                  { label: t("admin.loyalty.member.redeemed"), value: acc.lifetimeRedeemed },
                ].map((c, i) => (
                  <div key={c.label} className={`px-4 py-3 ${i < 2 ? "border-e border-line" : ""}`}>
                    <p className="text-[11.5px] font-medium text-fg-muted">{c.label}</p>
                    {isLoading ? <div className="mt-1 h-6 w-14 animate-pulse rounded bg-subtle" /> : (
                      <p className={`mt-0.5 text-[18px] font-bold tabular-nums ${c.strong ? "text-accent" : "text-fg"}`}>{fmtPoints(c.value, locale)}</p>
                    )}
                  </div>
                ))}
              </div>
              {data?.orders && (
                <p className="border-b border-line px-4 py-2.5 text-[12.5px] text-fg-secondary">
                  {t("admin.loyalty.member.ordersLine", {
                    count: fmtPoints(data.orders.count, locale),
                    spent: fmtMoney(data.orders.spent, locale),
                    saved: fmtMoney(data.orders.saved, locale),
                    earned: fmtPoints(acc.lifetimeEarned, locale),
                  })}
                </p>
              )}

              {/* Adjust */}
              <form onSubmit={submit} className="space-y-2.5 border-b border-line px-4 py-3.5">
                <p className="text-[13px] font-semibold text-fg">{t("admin.loyalty.member.adjustTitle")}</p>
                <div className="flex gap-2">
                  <div role="group" aria-label={t("admin.loyalty.member.adjustTitle")} className="inline-flex shrink-0 rounded-lg border border-line p-0.5">
                    {[
                      { id: "add", icon: Plus, label: t("admin.loyalty.member.add") },
                      { id: "remove", icon: Minus, label: t("admin.loyalty.member.remove") },
                    ].map(({ id, icon: Icon, label }) => (
                      <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id}
                        className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-semibold transition ${mode === id ? "" : "text-fg-muted hover:text-fg"}`}
                        style={mode === id ? (id === "add" ? { background: "var(--success-soft)", color: "var(--success-text)" } : { background: "var(--danger-soft)", color: "var(--danger-text)" }) : undefined}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="1" step="1" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)}
                    placeholder={t("admin.loyalty.member.pointsPlaceholder")} aria-label={t("admin.loyalty.member.points")} aria-invalid={errors.points ? "true" : undefined}
                    className={`${inputCls} tabular-nums ${errors.points ? "!border-danger-solid" : ""}`} />
                </div>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
                  placeholder={t("admin.loyalty.member.reasonPlaceholder")} aria-label={t("admin.loyalty.member.reason")} aria-invalid={errors.note ? "true" : undefined}
                  className={`${inputCls} ${errors.note ? "!border-danger-solid" : ""}`} />
                {(errors.points || errors.note) && <p className="text-[12px] font-medium text-danger">{errors.points || errors.note}</p>}
                <button type="submit" disabled={adjust.isPending} className={`${primaryBtn} w-full`} style={primaryStyle}>
                  {adjust.isPending && <Loader2 size={14} className="animate-spin" />}
                  {mode === "add" ? t("admin.loyalty.member.addSubmit") : t("admin.loyalty.member.removeSubmit")}
                </button>
              </form>

              {/* History */}
              <p className="px-4 pb-1 pt-3.5 text-[13px] font-semibold text-fg">{t("admin.loyalty.member.history")}</p>
              {isLoading ? (
                <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-subtle" />)}</div>
              ) : !data?.transactions?.length ? (
                <EmptyRow icon={History} title={t("admin.loyalty.member.noHistory")} />
              ) : (
                <ul className="divide-y divide-line">
                  {data.transactions.map((tx) => (
                    <li key={tx._id} className="flex items-start gap-3 px-4 py-2.5">
                      <TxnIcon type={tx.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-medium text-fg">{t(`admin.loyalty.type.${tx.type}`)}</p>
                          {tx.status !== "available" && <StatusPill status={tx.status} />}
                        </div>
                        <p className="truncate text-[12px] text-fg-muted">
                          {[tx.order_number, tx.note && tx.note !== `Order ${tx.order_number}` ? tx.note : "", tx.actor_name].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="text-[11.5px] text-fg-muted">{fmtDateTime(tx.created_at, locale)}</p>
                      </div>
                      <PointsDelta points={tx.points} status={tx.status} locale={locale} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <Pager pagination={data?.pagination} onPage={setPage} />
      </aside>
    </div>,
    document.body,
  );
}
