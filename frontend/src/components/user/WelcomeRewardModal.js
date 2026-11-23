"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Coins, Gift, Package, ShoppingBag, TicketPercent, Truck } from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";
import { loyaltyApi } from "@/apis/user/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pointsToValue } from "@/lib/loyalty";

const SEEN_PREFIX = "loyalty-welcome-seen:";
const ORDER_SEEN_PREFIX = "loyalty-order-celebrated:";
const FRESH_MS = 14 * 24 * 60 * 60 * 1000; // purana bonus dobara celebrate nahi
const COIN_COUNT = 7;

const seen = (id) => {
  try { return window.localStorage.getItem(SEEN_PREFIX + id) === "1"; } catch { return false; }
};
const markSeen = (id) => {
  try { window.localStorage.setItem(SEEN_PREFIX + id, "1"); } catch { /* private mode */ }
};
const seenOrder = (id) => {
  try { return window.localStorage.getItem(ORDER_SEEN_PREFIX + id) === "1"; } catch { return false; }
};
const markOrderSeen = (id) => {
  try { window.localStorage.setItem(ORDER_SEEN_PREFIX + id, "1"); } catch { /* private mode */ }
};
const reducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** 0 → target tak ginti (reduced-motion par seedha target) */
function useCountUp(target, run) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return undefined;
    if (reducedMotion()) { const id = requestAnimationFrame(() => setValue(target)); return () => cancelAnimationFrame(id); }
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
 * Golden coins: reward se header ke loyalty icon tak curved flight.
 * Web Animations API — koi extra library nahi. Sab elements khud hi remove hote hain.
 */
function flyCoins({ fromEl, toEl, onArrive, onLayer }) {
  return new Promise((resolve) => {
    if (!fromEl || !toEl || typeof document === "undefined" || reducedMotion() || typeof fromEl.animate !== "function") {
      onArrive?.();
      resolve();
      return;
    }

    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const sx = a.left + a.width / 2;
    const sy = a.top + a.height / 2;
    const tx = b.left + b.width / 2;
    const ty = b.top + b.height / 2;
    const dx = tx - sx;
    const cx = sx + dx * 0.45;
    const cy = Math.min(sy, ty) - 95;

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.className = "pointer-events-none fixed inset-0 z-[200] overflow-hidden";
    document.body.appendChild(layer);
    onLayer?.(layer);

    let arrived = 0;
    const duration = 900;
    const stagger = 110;

    for (let i = 0; i < COIN_COUNT; i += 1) {
      const coin = document.createElement("span");
      coin.textContent = "★";
      coin.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin-left:-9px;margin-top:-9px;display:flex;align-items:center;justify-content:center;border-radius:9999px;font-size:9px;line-height:1;color:rgba(255,255,255,.9);background:radial-gradient(circle at 35% 28%, #ffe9a8, #f5b73d 62%, #d98a16);box-shadow:0 3px 10px rgba(217,138,22,.3), inset 0 0 0 1px rgba(255,255,255,.5);will-change:transform,opacity;";
      layer.appendChild(coin);

      const frames = [];
      const steps = 16;
      for (let s = 0; s <= steps; s += 1) {
        const p = s / steps;
        const q = 1 - p;
        const x = q * q * sx + 2 * q * p * cx + p * p * tx;
        const y = q * q * sy + 2 * q * p * cy + p * p * ty;
        const scale = 1 - 0.32 * p;
        const rotation = p * (200 + i * 24);
        frames.push({
          offset: p,
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
          opacity: p > 0.86 ? (1 - p) / 0.14 : 1,
        });
      }

      const anim = coin.animate(frames, {
        duration,
        delay: i * stagger,
        easing: "cubic-bezier(.36,.05,.24,1)",
        fill: "forwards",
      });
      anim.onfinish = () => {
        coin.remove();
        arrived += 1;
        if (arrived === COIN_COUNT) { layer.remove(); onArrive?.(); resolve(); }
      };
    }
  });
}

/**
 * Ek hi modal, do occasions:
 *  • welcome → signup bonus claim (server se confirm, phir coins)
 *  • order   → order confirm par kamaye points (server ne already credit kiye,
 *              checkout se event aata hai, coins + success dikhate hain)
 */
export default function WelcomeRewardModal() {
  const { t, locale } = useTranslation();
  const [dismissed, setDismissed] = useState(null);
  const [orderReward, setOrderReward] = useState(null);
  const [preorderClaim, setPreorderClaim] = useState(null); // { points, resolve }
  const [phase, setPhase] = useState("idle"); // idle | claiming | flying | success
  const [error, setError] = useState(null);
  const [claimedPoints, setClaimedPoints] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const rewardRef = useRef(null);
  const coinLayerRef = useRef(null);
  const stateRef = useRef({ bonus: null, orderReward: null, preorderClaim: null, phase: "idle" });

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

  // Checkout: order place karne se PEHLE yahi popup claim ke liye kholta hai.
  useEffect(() => {
    window.__rewardClaimListener = true;
    const onClaimRequest = (e) => {
      const points = Number(e.detail?.points) || 0;
      const resolve = e.detail?.resolve;
      if (points <= 0) { resolve?.(true); return; }
      setError(null);
      setPhase("idle");
      setPreorderClaim({ points, resolve });
    };
    const onOrderEarned = (e) => {
      const points = Number(e.detail?.points) || 0;
      const id = String(e.detail?.orderId || `${points}-${Date.now()}`);
      if (points <= 0 || seenOrder(id)) return;
      markOrderSeen(id);
      setPreorderClaim(null);
      setError(null);
      setOrderReward({ points, id });
    };
    window.addEventListener("loyalty:claim-request", onClaimRequest);
    window.addEventListener("loyalty:order-earned", onOrderEarned);
    return () => {
      delete window.__rewardClaimListener;
      window.removeEventListener("loyalty:claim-request", onClaimRequest);
      window.removeEventListener("loyalty:order-earned", onOrderEarned);
    };
  }, []);

  const welcomeOpen = Boolean(bonus) && dismissed !== bonus?._id;
  const orderOpen = Boolean(orderReward);
  const preorderOpen = Boolean(preorderClaim);
  const open = welcomeOpen || orderOpen || preorderOpen;
  const mode = preorderOpen ? "preorder" : orderOpen ? "order" : "welcome";
  const displayPoints = mode === "preorder" ? preorderClaim.points : mode === "order" ? orderReward.points : (bonus?.points || 0);
  const count = useCountUp(displayPoints, open);
  const successPoints = mode === "order" ? orderReward.points : claimedPoints;

  useEffect(() => {
    stateRef.current = { bonus, orderReward, preorderClaim, phase };
  }, [bonus, orderReward, preorderClaim, phase]);

  const close = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "claiming" || s.phase === "flying") return;
    if (s.preorderClaim) { s.preorderClaim.resolve?.(false); setPreorderClaim(null); return; }
    if (s.orderReward) { setOrderReward(null); return; }
    if (!s.bonus) return;
    markSeen(s.bonus._id);
    setDismissed(s.bonus._id);
  }, []);

  // Pre-order claim → checkout ko continue karne deta hai (order ab place hota hai).
  const handlePreorderClaim = () => {
    if (!preorderClaim) return;
    preorderClaim.resolve?.(true);
    setPreorderClaim(null);
  };

  // Focus / Escape / scroll-lock — modal khulte hi.
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);

    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open, close]);

  useEffect(() => () => coinLayerRef.current?.remove(), []);

  // Order mode: points PENDING hain (delivery par milenge) — balance me nahi
  // daalte, coins header ki taraf nahi udte. Popup timeline dikhata hai.

  const handleClaim = async () => {
    if (phase !== "idle" || !bonus) return;
    setPhase("claiming");
    setError(null);
    try {
      const res = await loyaltyApi.claimWelcome();
      if (!res) throw new Error("empty claim response");
      const points = Number(res.points) || bonus.points || 0;
      setClaimedPoints(points);

      const creditToHeader = () => {
        window.dispatchEvent(new CustomEvent("loyalty:coins-incoming", {
          detail: { points, balance: Number(res.account?.balance) || 0 },
        }));
      };

      if (reducedMotion()) {
        creditToHeader();
        setPhase("success");
        return;
      }

      setPhase("flying");
      await flyCoins({
        fromEl: rewardRef.current,
        toEl: document.querySelector("[data-loyalty-coin-target]"),
        onArrive: creditToHeader,
        onLayer: (layer) => { coinLayerRef.current = layer; },
      });
      coinLayerRef.current = null;
      setPhase("success");
    } catch {
      setError(t("rewards.claim.error"));
      setPhase("idle");
    }
  };

  if (!open || typeof document === "undefined") return null;

  const program = rewards?.program || {};
  const balance = rewards?.account?.balance || 0;
  const redeem = program.redeem || {};
  const n = (v) => Number(v || 0).toLocaleString(locale);

  const perks = [
    program.earn?.enabled && { icon: ShoppingBag, text: t("rewards.welcome.perkEarn", { points: n(program.earn.pointsPerUnit), spend: n(program.earn.spendUnit) }) },
    redeem.enabled && { icon: TicketPercent, text: t("rewards.welcome.perkRedeem", { points: n(redeem.redeemPoints), value: n(redeem.redeemValue) }) },
  ].filter(Boolean);

  const busy = phase === "claiming" || phase === "flying";

  return createPortal(
    <div className="user-theme fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-reward-title" aria-describedby="welcome-reward-desc">
      <button type="button" aria-label={t("rewards.welcome.close")} onClick={close} className="absolute inset-0 bg-black/45 backdrop-blur-[3px] motion-safe:animate-[rewardFade_.35s_ease-out]" />

      <div ref={dialogRef} className="relative w-full max-w-[420px] overflow-hidden rounded-t-[22px] bg-[var(--user-bg-card)] shadow-[0_18px_50px_-12px_rgba(0,0,0,.25)] ring-1 ring-black/5 motion-safe:animate-[rewardIn_.55s_cubic-bezier(.16,1.02,.3,1)_both] sm:rounded-[22px]">
        <button ref={closeRef} type="button" onClick={close} aria-label={t("rewards.welcome.close")} className="absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[var(--user-text-muted)] transition-colors duration-200 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        {phase === "success" ? (
          <div className="px-6 pb-7 pt-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--user-accent-soft)] text-[var(--user-accent)] motion-safe:animate-[rewardCheck_.5s_cubic-bezier(.2,1.2,.3,1)_both]">
              <Check size={26} strokeWidth={1.8} />
            </span>
            <h2 id="welcome-reward-title" className="mt-5 text-xl font-semibold leading-snug tracking-tight text-[var(--user-text)]">
              {mode === "order" ? t("rewards.orderEarned.successTitle") : t("rewards.claim.successTitle")}
            </h2>
            <p id="welcome-reward-desc" className="mt-2 text-[0.8125rem] leading-6 text-[var(--user-text-muted)]">
              {mode === "order"
                ? t("rewards.orderEarned.successText", { points: n(successPoints) })
                : t("rewards.claim.successText", { points: n(successPoints) })}
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/account?tab=rewards" onClick={close}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-sm font-medium text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                <Gift size={15} strokeWidth={1.75} />
                {t("rewards.welcome.view")}
              </Link>
              <Link href="/shop" onClick={close}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] text-sm font-medium text-[var(--user-accent-text)] transition-all duration-300 hover:bg-[var(--user-accent-hover)] hover:shadow-md active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                {t("rewards.welcome.shop")}
                <ArrowRight size={15} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--user-border)] px-6 pb-7 pt-8 text-center" style={{ background: "linear-gradient(180deg, var(--user-bg-card) 0%, color-mix(in srgb, var(--user-accent) 4%, var(--user-bg-card)) 100%)" }}>
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--user-accent-soft)] text-[var(--user-accent)] motion-safe:animate-[rewardGiftIn_.5s_cubic-bezier(.16,1.02,.3,1)_.12s_both]">
                {mode === "order" ? <Package size={20} strokeWidth={1.75} /> : <Gift size={20} strokeWidth={1.75} />}
              </span>
              <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--user-text-muted)] motion-safe:animate-[rewardRise_.45s_ease-out_.2s_both]">
                {mode === "order" ? t("rewards.orderEarned.eyebrow") : mode === "preorder" ? t("rewards.claim.preorder.eyebrow") : t("rewards.welcome.eyebrow")}
              </p>
              <h2 id="welcome-reward-title" className="mx-auto mt-2 max-w-[19rem] text-xl font-semibold leading-snug tracking-tight text-[var(--user-text)] motion-safe:animate-[rewardRise_.45s_ease-out_.26s_both] sm:text-[1.375rem]">
                {mode === "order" ? t("rewards.orderEarned", { points: n(displayPoints) }) : mode === "preorder" ? t("rewards.claim.preorder.title", { points: n(displayPoints) }) : t("rewards.claim.title")}
              </h2>

              <p ref={rewardRef} className="mt-5 flex items-baseline justify-center gap-1.5 motion-safe:animate-[rewardRise_.5s_ease-out_.32s_both]">
                <span className="text-[2.75rem] font-medium leading-none tracking-tight tabular-nums text-[var(--user-text)] motion-safe:animate-[rewardPointsGlow_1.6s_ease-out_.35s_both] sm:text-[3.25rem]">+{n(count)}</span>
                <span className="text-base font-medium text-[var(--user-text-muted)]">{t("rewards.points")}</span>
              </p>

              {redeem.enabled && (
                <span className="mt-3 inline-flex items-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-1 text-xs font-medium text-[var(--user-text-muted)] motion-safe:animate-[rewardRise_.45s_ease-out_.46s_both]">
                  {t("rewards.welcome.worth", { value: n(pointsToValue(program, mode === "welcome" ? balance : displayPoints)) })}
                </span>
              )}
            </div>

            <div className="px-6 pb-6 pt-5">
              <p id="welcome-reward-desc" className="text-center text-[0.8125rem] leading-6 text-[var(--user-text-muted)]">
                {mode === "order" ? t("rewards.orderEarnedText") : mode === "preorder" ? t("rewards.claim.preorder.text") : t("rewards.welcome.text")}
              </p>

              {mode === "welcome" && perks.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {perks.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-3 rounded-xl border border-[var(--user-border)] px-3.5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"><Icon size={16} strokeWidth={1.75} /></span>
                      <span className="text-[0.8125rem] font-medium leading-snug text-[var(--user-text)]">{text}</span>
                    </li>
                  ))}
                </ul>
              )}

              {mode === "preorder" ? (
                <button type="button" onClick={handlePreorderClaim}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] text-sm font-medium text-[var(--user-accent-text)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[var(--user-accent-hover)] hover:shadow-md active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                  <Gift size={15} strokeWidth={1.75} />
                  {t("rewards.claim.button")}
                  <ArrowRight size={15} strokeWidth={1.75} />
                </button>
              ) : mode === "welcome" ? (
                <button type="button" onClick={handleClaim} disabled={busy}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] text-sm font-medium text-[var(--user-accent-text)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[var(--user-accent-hover)] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                  {phase === "claiming" ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("rewards.claim.loading")}
                    </>
                  ) : phase === "flying" ? (
                    <>
                      <Coins size={16} strokeWidth={1.75} className="animate-pulse" />
                      {t("rewards.claim.loading")}
                    </>
                  ) : (
                    <>
                      <Gift size={15} strokeWidth={1.75} />
                      {t("rewards.claim.button")}
                      <ArrowRight size={15} strokeWidth={1.75} />
                    </>
                  )}
                </button>
              ) : (
                <>
                  {/* Coins ka safar — order se delivery tak */}
                  <ol className="mt-5 rounded-xl border border-[var(--user-border)] px-4 py-3.5" aria-label={t("rewards.orderEarned.timeline")}>
                    {[
                      { icon: Check, title: t("rewards.orderEarned.step1"), text: t("rewards.orderEarned.step1Text"), state: "done" },
                      { icon: Truck, title: t("rewards.orderEarned.step2"), text: t("rewards.orderEarned.step2Text"), state: "current" },
                      { icon: Coins, title: t("rewards.orderEarned.step3", { points: n(displayPoints) }), text: t("rewards.orderEarned.step3Text"), state: "next" },
                    ].map(({ icon: Icon, title, text, state }, i, arr) => (
                      <li key={title} className="relative flex gap-3 pb-3.5 last:pb-0">
                        {i < arr.length - 1 && (
                          <span aria-hidden="true" className={`absolute start-[13px] top-7 h-[calc(100%-1.25rem)] w-px ${state === "done" ? "bg-emerald-500" : "bg-[var(--user-border)]"}`} />
                        )}
                        <span
                          className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            state === "done" ? "bg-emerald-500 text-white"
                              : state === "current" ? "bg-[var(--user-accent-soft)] text-[var(--user-accent)] ring-2 ring-[var(--user-accent)]/30"
                                : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                          }`}
                        >
                          <Icon size={14} strokeWidth={2} className={state === "current" ? "motion-safe:animate-pulse" : ""} />
                        </span>
                        <span className="min-w-0 pt-0.5 text-start">
                          <span className="block text-[0.8125rem] font-semibold text-[var(--user-text)]">{title}</span>
                          <span className="block text-[0.75rem] leading-5 text-[var(--user-text-muted)]">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <Link href="/orders" onClick={close}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-sm font-medium text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                      <Truck size={15} strokeWidth={1.75} />
                      {t("rewards.orderEarned.track")}
                    </Link>
                    <Link href="/shop" onClick={close}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] text-sm font-medium text-[var(--user-accent-text)] transition-all duration-300 hover:bg-[var(--user-accent-hover)] hover:shadow-md active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                      {t("rewards.orderEarned.shop")}
                      <ArrowRight size={15} strokeWidth={1.75} />
                    </Link>
                  </div>
                </>
              )}

              {error && <p role="alert" className="mt-2 text-center text-xs text-[var(--user-danger)]">{error}</p>}
              <p className="mt-3 text-center text-[0.6875rem] text-[var(--user-text-subtle)]">{t("rewards.welcome.esc")}</p>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes rewardFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rewardIn { from { opacity: 0; transform: translateY(14px) scale(.94) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes rewardGiftIn { from { opacity: 0; transform: translateY(8px) scale(.92) } to { opacity: 1; transform: none } }
        @keyframes rewardRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes rewardPointsGlow { 0%, 100% { text-shadow: 0 0 0 transparent } 45% { text-shadow: 0 0 22px var(--user-accent-soft) } }
        @keyframes rewardCheck { from { opacity: 0; transform: scale(.6) } 60% { opacity: 1; transform: scale(1.1) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>,
    document.body,
  );
}
