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
    <div className="flex items-start gap-3 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg)] p-3.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[12.5px] text-[var(--user-text-muted)]">{label}</span>
          <span className="text-[15px] font-bold text-[var(--user-text)]">{value}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-[17px] text-[var(--user-text-muted)]">{text}</p>
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
  const data = query.data;
  const programOn = Boolean(data?.enabled);

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
        <section className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text)] shadow-[0_30px_90px_-30px_rgba(15,23,42,.55)]">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-br from-[var(--user-accent)] to-indigo-700 px-5 py-7 text-white sm:px-8 sm:py-8">
            <Link href="/shop" aria-label="Close referral setup and continue shopping" className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:end-5 sm:top-5">
              <X size={18} strokeWidth={1.9} />
            </Link>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Gift size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[.18em] text-white/75">Referral program</p>
            <h1 id="referral-setup-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{programOn ? "Your referral link is ready" : t("referral.offTitle")}</h1>
            <p id="referral-setup-description" className="mt-2 max-w-lg text-sm leading-6 text-white/85">{programOn ? "Share it with friends. When they join and verify their account, you both earn points toward future orders." : t("referral.offText")}</p>
          </div>

          {query.isLoading ? (
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2" aria-label="Loading referral link">
              <div className="space-y-3">
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--user-bg-hover)]" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--user-bg-hover)]" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--user-bg-hover)]" />
                <div className="h-16 w-full animate-pulse rounded-xl bg-[var(--user-bg-hover)]" />
                <div className="h-16 w-full animate-pulse rounded-xl bg-[var(--user-bg-hover)]" />
              </div>
            </div>
          ) : query.isError ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <p role="alert" className="text-sm text-[var(--user-text-muted)]">We couldn’t load your referral link.</p>
              <button type="button" onClick={() => query.refetch()} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] transition hover:bg-[var(--user-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">Try again</button>
            </div>
          ) : !programOn ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center sm:px-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"><Info size={20} aria-hidden="true" /></span>
              <p role="status" className="max-w-lg text-sm leading-6 text-[var(--user-text-muted)]">{t("referral.offNotice")}</p>
              <Link href="/shop" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-5 text-sm font-semibold text-[var(--user-accent-text)] transition hover:bg-[var(--user-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                Start shopping <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2 lg:gap-8">
                {/* Left: share link */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-[var(--user-accent)]" aria-hidden="true" />
                    <h2 className="text-[14px] font-semibold">Share your link</h2>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--user-text-muted)]">Anyone who creates an account through this link counts as your referral.</p>

                  <div className="mt-3 flex min-w-0 flex-col gap-2.5 sm:flex-row">
                    <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg)] px-3.5 focus-within:border-[var(--user-accent)] focus-within:ring-2 focus-within:ring-[var(--user-accent-soft)]">
                      <Link2 size={17} className="shrink-0 text-[var(--user-accent)]" aria-hidden="true" />
                      <input ref={referralInputRef} readOnly value={data?.shareUrl || ""} aria-label="Your referral link" title={data?.shareUrl || ""} dir="ltr" className="w-full min-w-0 bg-transparent text-[13px] text-[var(--user-text)] outline-none" />
                    </label>
                    <button type="button" onClick={copy} disabled={!data?.shareUrl} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] px-5 text-sm font-semibold text-[var(--user-accent-text)] transition hover:bg-[var(--user-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] disabled:cursor-not-allowed disabled:opacity-60">
                      <Copy size={16} strokeWidth={1.9} aria-hidden="true" />Copy link
                    </button>
                  </div>

                  {data?.code ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--user-border)] bg-[var(--user-bg)] px-3.5 py-2.5">
                      <span className="text-[11.5px] text-[var(--user-text-muted)]">Referral code</span>
                      <code className="rounded-md bg-[var(--user-accent-soft)] px-2 py-1 text-[12.5px] font-semibold tracking-[.08em] text-[var(--user-accent)]" dir="ltr">{data.code}</code>
                    </div>
                  ) : null}

                </div>

                {/* Right: benefits */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[var(--user-accent)]" aria-hidden="true" />
                    <h2 className="text-[14px] font-semibold">What you both get</h2>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--user-text-muted)]">Points are added after your friend verifies their new account.</p>

                  <div className="mt-3 space-y-2.5">
                    <BenefitRow icon={CheckCircle2} iconClassName="bg-[var(--user-accent-soft)] text-[var(--user-accent)]" label="You earn" value={`${referrerPoints} points`} text="For every friend who joins and verifies." />
                    <BenefitRow icon={Gift} iconClassName="bg-emerald-500/10 text-emerald-600" label="Your friend gets" value={`${friendPoints} points`} text="A welcome reward on their new account." />
                  </div>

                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--user-bg)] px-3 py-2.5 text-[11.5px] leading-5 text-[var(--user-text-muted)]">
                    <TicketPercent size={14} className="mt-0.5 shrink-0 text-[var(--user-accent)]" aria-hidden="true" />
                    <span>Use your points at checkout to save on future orders.</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--user-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="flex items-start gap-2 text-[11.5px] leading-5 text-[var(--user-text-muted)]">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--user-accent)]" aria-hidden="true" />
                  <span>Self-referrals and repeat sign-ups don’t qualify.</span>
                </p>
                <Link href="/shop" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-5 text-sm font-semibold text-[var(--user-accent-text)] transition hover:bg-[var(--user-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                  Start shopping <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  if (query.isLoading) return <main dir={dir} className="mx-auto flex min-h-[45vh] max-w-3xl items-center justify-center text-[var(--user-text-muted)]"><LoaderCircle className="animate-spin" /></main>;
  if (query.isError) return <main dir={dir} className="mx-auto max-w-3xl px-4 py-12 text-center text-[var(--user-text)]"><p>We couldn’t load your referral details.</p><button className="mt-4 rounded-xl bg-[var(--user-accent)] px-4 py-2 font-semibold text-white" onClick={() => query.refetch()}>Try again</button></main>;

  return (
    <main dir={dir} className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-[var(--user-shadow-lg)]">
        <div className="bg-gradient-to-br from-[var(--user-accent)] to-indigo-700 px-6 py-8 text-white sm:px-10 sm:py-10">
          <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Gift size={24} /></span>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/75">{onboarding ? "YOUR REFERRAL LINK" : "CUSTOMER REFERRAL PROGRAM"}</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{programOn ? data.headline : t("referral.offTitle")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{programOn ? "Share your personal link with friends. When a friend creates and verifies an account, both of you receive reward points to use on future purchases." : t("referral.offText")}</p>
        </div>
        {programOn ? (
          <>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
              <div className="rounded-2xl border border-[var(--user-border)] p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><Sparkles size={20} /></span><p className="mt-4 text-sm text-[var(--user-text-muted)]">Your reward for each verified friend</p><p className="mt-1 text-3xl font-black text-[var(--user-text)]">{Number(data.referrerPoints).toLocaleString()} <span className="text-base font-semibold">points</span></p></div>
              <div className="rounded-2xl border border-[var(--user-border)] p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Gift size={20} /></span><p className="mt-4 text-sm text-[var(--user-text-muted)]">Your friend’s welcome reward</p><p className="mt-1 text-3xl font-black text-[var(--user-text)]">{Number(data.friendPoints).toLocaleString()} <span className="text-base font-semibold">points</span></p></div>
            </div>
            <div className="mx-5 mb-5 rounded-2xl bg-[var(--user-bg)] p-5 sm:mx-8 sm:mb-8 sm:p-6">
              <p className="text-sm font-bold text-[var(--user-text)]">Your personal referral link</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input ref={referralInputRef} readOnly value={data.shareUrl} aria-label="Your referral link" title={data.shareUrl} className="min-w-0 flex-1 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-3 text-sm text-[var(--user-text)] outline-none" /><button type="button" onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"><Copy size={16} />Copy link</button></div>
              <p className="mt-3 text-xs leading-5 text-[var(--user-text-muted)]">Rewards are added after your friend verifies their new account. Self-referrals and repeat referrals are not eligible. Points can be redeemed when the store’s rewards program is available.</p>
            </div>
          </>
        ) : (
          <div className="mx-5 mb-5 flex flex-col items-center gap-3 rounded-2xl bg-[var(--user-bg)] p-6 text-center sm:mx-8 sm:mb-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"><Info size={20} aria-hidden="true" /></span>
            <p role="status" className="max-w-lg text-sm leading-6 text-[var(--user-text-muted)]">{t("referral.offNotice")}</p>
          </div>
        )}
        <div className="grid gap-4 border-t border-[var(--user-border)] p-5 sm:grid-cols-2 sm:p-8"><div className="rounded-2xl bg-[var(--user-bg)] p-5"><div className="flex items-center gap-3 text-[var(--user-text-muted)]"><Users size={18} /><span className="text-sm font-semibold">Friends who joined</span></div><p className="mt-3 text-3xl font-black text-[var(--user-text)]">{Number(data.successfulReferrals).toLocaleString()}</p></div><div className="rounded-2xl bg-[var(--user-bg)] p-5"><div className="flex items-center gap-3 text-[var(--user-text-muted)]"><CheckCircle2 size={18} /><span className="text-sm font-semibold">Referral points earned</span></div><p className="mt-3 text-3xl font-black text-[var(--user-text)]">{Number(data.pointsEarned).toLocaleString()}</p></div></div>
        {showContinue && <div className="px-5 pb-6 sm:px-8 sm:pb-8"><button type="button" onClick={() => router.push("/")} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--user-accent)]">Continue shopping <ArrowRight size={16} /></button></div>}
      </section>
    </main>
  );
}
