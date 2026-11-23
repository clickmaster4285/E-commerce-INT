"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gift, ShoppingBag, Sparkles, TicketPercent, X } from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";
import { loyaltyApi } from "@/apis/user/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pointsToValue } from "@/lib/loyalty";

const SEEN_PREFIX = "loyalty-welcome-seen:";
const FRESH_MS = 14 * 24 * 60 * 60 * 1000; // purana bonus dobara celebrate nahi

const seen = (id) => {
  try { return window.localStorage.getItem(SEEN_PREFIX + id) === "1"; } catch { return false; }
};
const markSeen = (id) => {
  try { window.localStorage.setItem(SEEN_PREFIX + id, "1"); } catch { /* private mode */ }
};

/** 0 → target tak ginti (reduced-motion par seedha target) */
function useCountUp(target, run) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { const id = requestAnimationFrame(() => setValue(target)); return () => cancelAnimationFrame(id); }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 900);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return value;
}

/**
 * Sign up / pehli Google login ke baad ek dafa: "Welcome! Aap ne X points kamaye".
 * Storefront layout me mount hota hai; bonus mila ho aur dekha na ho tab hi dikhta hai.
 */
export default function WelcomeRewardModal() {
  const { t, locale } = useTranslation();
  const [dismissed, setDismissed] = useState(null);

  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await userHttp.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: rewards } = useQuery({
    queryKey: ["myRewards", "welcome"],
    queryFn: () => loyaltyApi.me({ limit: 5 }),
    enabled: Boolean(user),
    retry: false,
    staleTime: 60 * 1000,
    // Sirf taza (14 din) signup bonus — purana dobara celebrate nahi
    select: (d) => {
      const txn = d?.program?.enabled
        ? (d.transactions || []).find((x) => x.type === "signup" && x.status === "available")
        : null;
      const fresh = txn && Date.now() - new Date(txn.created_at).getTime() <= FRESH_MS;
      return { ...d, welcomeTxn: fresh ? txn : null };
    },
  });

  const bonus = useMemo(() => {
    const txn = rewards?.welcomeTxn;
    if (!txn || typeof window === "undefined" || seen(txn._id)) return null;
    return txn;
  }, [rewards]);

  const open = Boolean(bonus) && dismissed !== bonus?._id;
  const count = useCountUp(bonus?.points || 0, open);

  const close = useCallback(() => {
    if (!bonus) return;
    markSeen(bonus._id);
    setDismissed(bonus._id);
  }, [bonus]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const program = rewards.program;
  const balance = rewards.account?.balance || 0;
  const redeem = program.redeem || {};
  const canRedeem = redeem.enabled && balance >= (redeem.minPoints || 0);
  const name = program.programName || "Rewards";
  const n = (v) => Number(v || 0).toLocaleString(locale);

  const perks = [
    program.earn?.enabled && { icon: ShoppingBag, text: t("rewards.welcome.perkEarn", { points: n(program.earn.pointsPerUnit), spend: n(program.earn.spendUnit) }) },
    redeem.enabled && { icon: TicketPercent, text: t("rewards.welcome.perkRedeem", { points: n(redeem.redeemPoints), value: n(redeem.redeemValue) }) },
  ].filter(Boolean);

  return createPortal(
    <div className="user-theme fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-reward-title">
      <button type="button" aria-label={t("rewards.welcome.close")} onClick={close} className="absolute inset-0 bg-black/55 backdrop-blur-[2px] motion-safe:animate-[fadeIn_.2s_ease-out]" />

      <div className="relative w-full max-w-[400px] overflow-hidden rounded-t-3xl bg-[var(--user-bg-card)] shadow-2xl motion-safe:animate-[welcomePop_.35s_cubic-bezier(.2,.9,.3,1.2)] sm:rounded-3xl">
        {/* Celebration header */}
        <div className="relative overflow-hidden px-6 pb-7 pt-8 text-center text-white" style={{ background: "linear-gradient(140deg, var(--user-accent) 0%, color-mix(in srgb, var(--user-accent) 50%, #7c3aed) 100%)" }}>
          {/* confetti dots */}
          {[
            "start-[12%] top-[18%] h-2 w-2 bg-yellow-300", "start-[22%] top-[62%] h-1.5 w-1.5 bg-white/80", "end-[14%] top-[22%] h-2.5 w-2.5 bg-pink-300",
            "end-[24%] top-[66%] h-1.5 w-1.5 bg-yellow-200", "start-[44%] top-[10%] h-1.5 w-1.5 bg-white/70", "end-[40%] bottom-[14%] h-2 w-2 bg-emerald-300",
          ].map((c) => <span key={c} aria-hidden="true" className={`absolute rounded-full ${c} motion-safe:animate-pulse`} />)}
          <div className="pointer-events-none absolute -end-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -start-10 h-44 w-44 rounded-full bg-white/10" />

          <button type="button" onClick={close} aria-label={t("rewards.welcome.close")} className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
            <X size={16} />
          </button>

          <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg ring-1 ring-white/30 backdrop-blur-sm motion-safe:animate-[welcomeBounce_1.2s_ease-in-out_.3s_2]">
            <Gift size={30} />
          </span>
          <p className="relative mt-4 text-[0.6875rem] font-black uppercase tracking-[0.18em] opacity-85">{t("rewards.welcome.eyebrow", { name })}</p>
          <h2 id="welcome-reward-title" className="relative mt-1.5 text-xl font-black">{t("rewards.welcome.title")}</h2>
          <p className="relative mt-4 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-black tabular-nums leading-none">+{n(count)}</span>
            <span className="text-sm font-bold opacity-90">{t("rewards.points")}</span>
          </p>
          {redeem.enabled && (
            <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <Sparkles size={12} />
              {canRedeem
                ? t("rewards.welcome.worth", { value: n(pointsToValue(program, balance)) })
                : t("rewards.welcome.almost", { points: n((redeem.minPoints || 0) - balance) })}
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="px-6 pb-6 pt-5">
          <p className="text-center text-sm leading-6 text-[var(--user-text-muted)]">{t("rewards.welcome.text")}</p>
          {perks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 rounded-xl border border-[var(--user-border)] px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><Icon size={15} /></span>
                  <span className="text-[0.8125rem] font-semibold text-[var(--user-text)]">{text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Link href="/account?tab=rewards" onClick={close}
              className="flex h-11 items-center justify-center rounded-xl border border-[var(--user-border)] text-sm font-bold text-[var(--user-text)] transition hover:bg-[var(--user-bg-hover)]">
              {t("rewards.welcome.view")}
            </Link>
            <Link href="/shop" onClick={close}
              className="flex h-11 items-center justify-center rounded-xl bg-[var(--user-accent)] text-sm font-black text-[var(--user-accent-text)] shadow-md transition hover:opacity-90">
              {t("rewards.welcome.shop")}
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes welcomePop { from { opacity: 0; transform: translateY(24px) scale(.96) } to { opacity: 1; transform: none } }
        @keyframes welcomeBounce { 0%,100% { transform: translateY(0) rotate(0) } 30% { transform: translateY(-6px) rotate(-6deg) } 60% { transform: translateY(0) rotate(5deg) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>,
    document.body,
  );
}
