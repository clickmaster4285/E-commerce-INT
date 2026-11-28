"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, Copy, Users, Sparkles, ArrowRight, LoaderCircle, CheckCircle2, Link2, X, Info, ShieldCheck, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { loyaltyApi } from "@/apis/user/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";

function BenefitRow({ icon: Icon, iconClassName, label, value, text }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-user-line bg-user-page p-3.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[12.5px] text-user-fg-muted">{label}</span>
          <span className="text-[15px] font-bold text-user-fg">{value}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-[17px] text-user-fg-muted">{text}</p>
      </div>
    </div>
  );
}

function copyTextFallback(value) {
  if (typeof document.execCommand !== "function") throw new Error("Clipboard copy is unavailable");
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "-9999px";
  field.style.opacity = "0";
  document.body.appendChild(field);
  let copied = false;
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    copied = document.execCommand("copy");
  } finally {
    field.remove();
  }
  if (!copied) throw new Error("Clipboard copy was rejected");
}

export default function ReferralProgramView({ showContinue = true, onboarding = false }) {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const referralInputRef = useRef(null);
  const query = useQuery({ queryKey: ["my-referrals"], queryFn: loyaltyApi.referrals, retry: false });
  // Referral visibility follows its own program switch; redemption availability
  // is still controlled by the separate Rewards program.
  const programQuery = useQuery({ queryKey: ["loyaltyProgram"], queryFn: loyaltyApi.program, staleTime: 60 * 1000, retry: false });
  const data = query.data;
  const rewardsEnabled = Boolean(programQuery.data?.enabled);
  const programOn = Boolean(data?.enabled);
  const loading = query.isLoading || programQuery.isLoading;

  useEffect(() => {
    if (query.error?.response?.status === 401) router.replace("/login");
  }, [query.error, router]);

  useEffect(() => {
    if (!onboarding) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") router.push("/shop");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onboarding, router]);

  const copy = async () => {
    const shareUrl = String(data?.shareUrl || "");
    if (!shareUrl) return;
    try {
      if (window.isSecureContext && typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        copyTextFallback(shareUrl);
      }
    } catch {
      try {
        copyTextFallback(shareUrl);
      } catch {
        referralInputRef.current?.focus();
        referralInputRef.current?.select();
        toast.error("Couldn’t copy automatically. The link is selected; press Ctrl+C to copy it.");
        return;
      }
    }
    toast.success("Referral link copied. Share it with a friend.");
  };

  if (onboarding) {
    const referrerPoints = Number(data?.referrerPoints || 0).toLocaleString();
    const friendPoints = Number(data?.friendPoints || 0).toLocaleString();
    return (
      <main dir={dir} className="user-theme fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-labelledby="referral-setup-title" aria-describedby="referral-setup-description">
        <section className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-user-line bg-user-card text-user-fg shadow-[0_30px_90px_-30px_rgba(15,23,42,.55)]">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-br from-user-accent to-indigo-700 px-5 py-7 text-white sm:px-8 sm:py-8">
            <Link href="/shop" aria-label="Close referral setup and continue shopping" className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:end-5 sm:top-5">
              <X size={18} strokeWidth={1.9} />
            </Link>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Gift size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[.18em] text-white/75">Referral program</p>
            <h1 id="referral-setup-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{programOn ? "Your referral link is ready" : t("referral.offTitle")}</h1>
            <p id="referral-setup-description" className="mt-2 max-w-lg text-sm leading-6 text-white/85">{programOn ? (rewardsEnabled ? "Share it with friends. When they join and verify their account, you both earn points toward future orders." : "Share it with friends. When they join and verify, you both earn referral points. Points are saved to your rewards balance and can be redeemed when Rewards is enabled.") : t("referral.offText")}</p>
          </div>

          {loading ? (
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2" aria-label="Loading referral link">
              <div className="space-y-3">
                <div className="h-4 w-32 animate-pulse rounded bg-user-hover" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-user-hover" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-user-hover" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-28 animate-pulse rounded bg-user-hover" />
                <div className="h-16 w-full animate-pulse rounded-xl bg-user-hover" />
                <div className="h-16 w-full animate-pulse rounded-xl bg-user-hover" />
              </div>
            </div>
          ) : query.isError ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <p role="alert" className="text-sm text-user-fg-muted">We couldn’t load your referral link.</p>
              <button type="button" onClick={() => query.refetch()} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-user-accent px-4 text-sm font-semibold text-user-accent-fg transition hover:bg-user-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-user-accent">Try again</button>
            </div>
          ) : !programOn ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center sm:px-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-user-hover text-user-fg-muted"><Info size={20} aria-hidden="true" /></span>
              <p role="status" className="max-w-lg text-sm leading-6 text-user-fg-muted">{t("referral.offNotice")}</p>
              <Link href="/shop" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-user-accent px-5 text-sm font-semibold text-user-accent-fg transition hover:bg-user-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-user-accent">
                Start shopping <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2 lg:gap-8">
                {/* Left: share link */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-user-accent" aria-hidden="true" />
                    <h2 className="text-[14px] font-semibold">Share your link</h2>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-user-fg-muted">Anyone who creates an account through this link counts as your referral.</p>

                  <div className="mt-3 flex min-w-0 flex-col gap-2.5 sm:flex-row">
                    <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-user-line bg-user-page px-3.5 focus-within:border-user-accent focus-within:ring-2 focus-within:ring-user-accent-soft">
                      <Link2 size={17} className="shrink-0 text-user-accent" aria-hidden="true" />
                      <input ref={referralInputRef} readOnly value={data?.shareUrl || ""} aria-label="Your referral link" title={data?.shareUrl || ""} dir="ltr" className="w-full min-w-0 bg-transparent text-[13px] text-user-fg outline-none" />
                    </label>
                    <button type="button" onClick={copy} disabled={!data?.shareUrl} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-user-accent px-5 text-sm font-semibold text-user-accent-fg transition hover:bg-user-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-user-accent disabled:cursor-not-allowed disabled:opacity-60">
                      <Copy size={16} strokeWidth={1.9} aria-hidden="true" />Copy link
                    </button>
                  </div>

                  {data?.code ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-user-line bg-user-page px-3.5 py-2.5">
                      <span className="text-[11.5px] text-user-fg-muted">Referral code</span>
                      <code className="rounded-md bg-user-accent-soft px-2 py-1 text-[12.5px] font-semibold tracking-[.08em] text-user-accent" dir="ltr">{data.code}</code>
                    </div>
                  ) : null}

                </div>

                {/* Right: benefits */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-user-accent" aria-hidden="true" />
                    <h2 className="text-[14px] font-semibold">What you both get</h2>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-user-fg-muted">Points are added after your friend verifies their new account.</p>

                  <div className="mt-3 space-y-2.5">
                    <BenefitRow icon={CheckCircle2} iconClassName="bg-user-accent-soft text-user-accent" label="You earn" value={`${referrerPoints} points`} text="For every friend who joins and verifies." />
                    <BenefitRow icon={Gift} iconClassName="bg-emerald-500/10 text-emerald-600" label="Your friend gets" value={`${friendPoints} points`} text="A welcome reward on their new account." />
                  </div>

                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-user-page px-3 py-2.5 text-[11.5px] leading-5 text-user-fg-muted">
                    <TicketPercent size={14} className="mt-0.5 shrink-0 text-user-accent" aria-hidden="true" />
                    <span>{rewardsEnabled ? "Use your points at checkout to save on future orders." : "Your referral points are saved with your rewards balance and can be redeemed when the Rewards program is enabled."}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-user-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="flex items-start gap-2 text-[11.5px] leading-5 text-user-fg-muted">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-user-accent" aria-hidden="true" />
                  <span>Self-referrals and repeat sign-ups don’t qualify.</span>
                </p>
                <Link href="/shop" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-user-accent px-5 text-sm font-semibold text-user-accent-fg transition hover:bg-user-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-user-accent">
                  Start shopping <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  if (loading) return <main dir={dir} className="mx-auto flex min-h-[45vh] max-w-3xl items-center justify-center text-user-fg-muted"><LoaderCircle className="animate-spin" /></main>;
  if (query.isError) return <main dir={dir} className="mx-auto max-w-3xl px-4 py-12 text-center text-user-fg"><p>We couldn’t load your referral details.</p><button className="mt-4 rounded-xl bg-user-accent px-4 py-2 font-semibold text-white" onClick={() => query.refetch()}>Try again</button></main>;

  return (
    <main dir={dir} className="w-full max-w-none px-0 py-0">
      <section className="w-full overflow-hidden bg-transparent">
        <header className="rounded-xl bg-gradient-to-r from-user-accent to-indigo-700 px-4 py-4 text-white sm:px-5 sm:py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Gift size={20} aria-hidden="true" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-white/80">Customer referral program</p>
                {programOn && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Active</span>}
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{programOn ? data.headline : t("referral.offTitle")}</h1>
              <p className="mt-1 max-w-3xl text-[13px] leading-5 text-white/90">{programOn ? (rewardsEnabled ? "Invite friends with your personal link. You both earn points after they verify their account." : "Invite friends with your personal link. You both earn referral points after verification; redeem them when Rewards is enabled.") : t("referral.offText")}</p>
            </div>
          </div>
        </header>

        {programOn ? (
          <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)] sm:py-3">
            <section className="min-w-0 rounded-xl border border-user-line p-3.5 sm:p-4">
              <div className="flex items-center gap-2">
                <Link2 size={15} className="text-user-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-user-fg">Your personal referral link</h2>
              </div>
              <div className="mt-2.5 flex min-w-0 flex-col gap-2 sm:flex-row">
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-user-line bg-user-page px-3 focus-within:border-user-accent focus-within:ring-2 focus-within:ring-user-accent-soft">
                  <Link2 size={15} className="shrink-0 text-user-accent" aria-hidden="true" />
                  <input ref={referralInputRef} readOnly value={data.shareUrl} aria-label="Your referral link" title={data.shareUrl} dir="ltr" className="w-full min-w-0 bg-transparent text-[13px] text-user-fg outline-none" />
                </label>
                <button type="button" onClick={copy} disabled={!data.shareUrl} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-user-accent px-4 text-[13px] font-semibold text-user-accent-fg transition hover:bg-user-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-user-accent disabled:cursor-not-allowed disabled:opacity-60">
                  <Copy size={14} aria-hidden="true" />Copy link
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-user-line pt-2.5">
                <p className="text-xs leading-4 text-user-fg-muted">Points arrive after your friend verifies. Self-referrals don’t qualify.</p>
                {data.code && <span className="inline-flex items-center gap-2 rounded-md bg-user-accent-soft px-2.5 py-1 text-[11px] text-user-fg-muted">Code <code className="font-semibold tracking-[.08em] text-user-accent" dir="ltr">{data.code}</code></span>}
              </div>
            </section>

            <section className="min-w-0 rounded-xl border border-user-line p-3.5 sm:p-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-user-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-user-fg">Referral rewards</h2>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-user-page p-2.5">
                  <p className="text-[11px] leading-4 text-user-fg-muted">You earn per verified friend</p>
                  <p className="mt-1 text-[22px] font-bold leading-7 text-user-fg">{Number(data.referrerPoints).toLocaleString()} <span className="text-xs font-semibold">pts</span></p>
                </div>
                <div className="rounded-lg bg-user-page p-2.5">
                  <p className="text-[11px] leading-4 text-user-fg-muted">Friend welcome points</p>
                  <p className="mt-1 text-[22px] font-bold leading-7 text-user-fg">{Number(data.friendPoints).toLocaleString()} <span className="text-xs font-semibold">pts</span></p>
                </div>
              </div>
              {!rewardsEnabled && <p className="mt-2 text-[11px] leading-4 text-user-fg-muted">Points stay in your rewards balance until Rewards is enabled.</p>}
            </section>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-user-hover text-user-fg-muted"><Info size={17} aria-hidden="true" /></span>
            <p role="status" className="text-xs leading-5 text-user-fg-muted">{t("referral.offNotice")}</p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 border-y border-user-line">
          <div className="flex items-center gap-2.5 px-4 py-3 sm:px-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-user-page text-user-fg-muted"><Users size={15} aria-hidden="true" /></span>
            <div><p className="text-xs text-user-fg-muted">Friends who joined</p><p className="text-lg font-bold leading-6 text-user-fg">{Number(data.successfulReferrals).toLocaleString()}</p></div>
          </div>
          <div className="flex items-center gap-2.5 border-s border-user-line px-4 py-3 sm:px-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-user-accent-soft text-user-accent"><CheckCircle2 size={15} aria-hidden="true" /></span>
            <div><p className="text-xs text-user-fg-muted">Referral points earned</p><p className="text-lg font-bold leading-6 text-user-fg">{Number(data.pointsEarned).toLocaleString()}</p></div>
          </div>
        </div>
        {showContinue && <div className="flex justify-end border-t border-user-line px-4 py-2.5 sm:px-5"><button type="button" onClick={() => router.push("/")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-user-accent">Continue shopping <ArrowRight size={14} /></button></div>}
      </section>
    </main>
  );
}
