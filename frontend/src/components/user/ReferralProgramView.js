"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, Copy, Users, Sparkles, ArrowRight, LoaderCircle, CheckCircle2, UserRound, Link2, X, Info } from "lucide-react";
import { toast } from "sonner";
import { loyaltyApi } from "@/apis/user/loyaltyApi";
import { useTranslation } from "@/i18n/LanguageProvider";

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
  const { dir } = useTranslation();
  const referralInputRef = useRef(null);
  const query = useQuery({ queryKey: ["my-referrals"], queryFn: loyaltyApi.referrals, retry: false });
  const data = query.data;

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
    return (
      <main dir={dir} className="user-theme fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-6 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-labelledby="referral-setup-title" aria-describedby="referral-setup-description">
        <section className="relative my-auto w-full max-w-xl rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-5 py-7 text-[var(--user-text)] shadow-[0_24px_80px_-24px_rgba(15,23,42,.38)] sm:px-8 sm:py-9">
          <Link href="/shop" aria-label="Close referral setup and continue shopping" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text-muted)] transition hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] sm:right-5 sm:top-5">
            <X size={18} strokeWidth={1.8} />
          </Link>

          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
            <UserRound size={20} strokeWidth={1.8} />
          </div>
          <h1 id="referral-setup-title" className="mt-4 text-center text-xl font-semibold tracking-tight">Your Referral Link</h1>
          <p id="referral-setup-description" className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-[var(--user-text-muted)]">Share this link with your friends and earn rewards.</p>

          {query.isLoading ? (
            <div className="mt-7 flex min-h-12 items-center justify-center text-[var(--user-accent)]" aria-label="Loading referral link"><LoaderCircle size={20} className="animate-spin" /></div>
          ) : query.isError ? (
            <div className="mt-7 flex flex-col items-center gap-3">
              <p role="alert" className="text-sm text-[var(--user-text-muted)]">We couldn’t load your referral link.</p>
              <button type="button" onClick={() => query.refetch()} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--user-accent)] px-4 text-sm font-semibold text-[var(--user-accent-text)] transition hover:bg-[var(--user-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">Try again</button>
            </div>
          ) : (
            <>
              <div className="mt-7 flex min-w-0 flex-col gap-2.5 sm:flex-row">
                <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg)] px-3.5 focus-within:border-[var(--user-accent)] focus-within:ring-2 focus-within:ring-[var(--user-accent-soft)]">
                  <Link2 size={17} className="shrink-0 text-[var(--user-accent)]" aria-hidden="true" />
                  <input ref={referralInputRef} readOnly value={data?.shareUrl || ""} aria-label="Your referral link" title={data?.shareUrl || ""} dir="ltr" className="min-w-0 w-full bg-transparent text-sm text-[var(--user-text)] outline-none" />
                </label>
                <button type="button" onClick={copy} disabled={!data?.shareUrl} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-5 text-sm font-semibold text-[var(--user-accent-text)] transition hover:bg-[var(--user-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] disabled:cursor-not-allowed disabled:opacity-60">
                  <Copy size={16} strokeWidth={1.9} />Copy Link
                </button>
              </div>
              <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-[var(--user-accent-soft)] px-3.5 py-3 text-left text-xs leading-5 text-[var(--user-text-muted)]">
                <Info size={15} className="mt-0.5 shrink-0 text-[var(--user-accent)]" aria-hidden="true" />
                <span>Friends who join using your referral link can earn rewards.</span>
              </p>
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
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{onboarding ? "Your link is ready to share" : data.headline}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{onboarding ? "Invite friends with your personal link. When a friend joins and verifies their account, you both can earn points toward future purchases." : "Share your personal link with friends. When a friend creates and verifies an account, both of you receive reward points to use on future purchases."}</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
          <div className="rounded-2xl border border-[var(--user-border)] p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--user-accent)]/10 text-[var(--user-accent)]"><Sparkles size={20} /></span><p className="mt-4 text-sm text-[var(--user-text-muted)]">Your reward for each verified friend</p><p className="mt-1 text-3xl font-black text-[var(--user-text)]">{Number(data.referrerPoints).toLocaleString()} <span className="text-base font-semibold">points</span></p></div>
          <div className="rounded-2xl border border-[var(--user-border)] p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Gift size={20} /></span><p className="mt-4 text-sm text-[var(--user-text-muted)]">Your friend’s welcome reward</p><p className="mt-1 text-3xl font-black text-[var(--user-text)]">{Number(data.friendPoints).toLocaleString()} <span className="text-base font-semibold">points</span></p></div>
        </div>
        <div className="mx-5 mb-5 rounded-2xl bg-[var(--user-bg)] p-5 sm:mx-8 sm:mb-8 sm:p-6">
          <p className="text-sm font-bold text-[var(--user-text)]">Your personal referral link</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input ref={referralInputRef} readOnly value={data.shareUrl} aria-label="Your referral link" title={data.shareUrl} className="min-w-0 flex-1 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-3 text-sm text-[var(--user-text)] outline-none" /><button type="button" onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"><Copy size={16} />Copy link</button></div>
          <p className="mt-3 text-xs leading-5 text-[var(--user-text-muted)]">Rewards are added after your friend verifies their new account. Self-referrals and repeat referrals are not eligible. Points can be redeemed when the store’s rewards program is available.</p>
          {!data.enabled && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700">The store has not activated referral rewards yet. Your link is ready; rewards will begin when the program is enabled.</p>}
        </div>
        <div className="grid gap-4 border-t border-[var(--user-border)] p-5 sm:grid-cols-2 sm:p-8"><div className="rounded-2xl bg-[var(--user-bg)] p-5"><div className="flex items-center gap-3 text-[var(--user-text-muted)]"><Users size={18} /><span className="text-sm font-semibold">Friends who joined</span></div><p className="mt-3 text-3xl font-black text-[var(--user-text)]">{Number(data.successfulReferrals).toLocaleString()}</p></div><div className="rounded-2xl bg-[var(--user-bg)] p-5"><div className="flex items-center gap-3 text-[var(--user-text-muted)]"><CheckCircle2 size={18} /><span className="text-sm font-semibold">Referral points earned</span></div><p className="mt-3 text-3xl font-black text-[var(--user-text)]">{Number(data.pointsEarned).toLocaleString()}</p></div></div>
        {showContinue && <div className="px-5 pb-6 sm:px-8 sm:pb-8"><button type="button" onClick={() => router.push("/")} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--user-accent)]">Continue shopping <ArrowRight size={16} /></button></div>}
      </section>
    </main>
  );
}
