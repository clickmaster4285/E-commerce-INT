"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Mail, CheckCircle2, LogIn } from "lucide-react";

const FREEZE_MS = 2500;
const POLL_MS = 3000;
const POLL_FIRST_DELAY = 1200;

const fetchStatus = async (email) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SERVERURL}/seller/apply/status?email=${encodeURIComponent(email)}`);
  const body = await res.json().catch(() => null);
  return body;
};

export default function PendingApprovalPage() {
  return (
    <Suspense fallback={<PendingApprovalFallback />}>
      <PendingApprovalInner />
    </Suspense>
  );
}

function PendingApprovalFallback() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#05070b] px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a]/80 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
        <div className="spinner mx-auto" aria-label="Loading status" />
      </div>
    </main>
  );
}

function PendingApprovalInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params?.get("email") || "";
  const [state, setState] = useState({ status: "pending", application: null });
  const timerRef = useRef(null);

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;

    const check = async () => {
      try {
        const body = await fetchStatus(email);
        if (cancelled) return;
        if (body?.success && body?.data) {
          setState((prev) => ({
            ...prev,
            status: body.data.status === "approved" ? "approved" : "pending",
            application: body.data,
          }));
          if (body.data.status === "approved") {
            const id = window.setTimeout(() => {
              router.replace("/login?approved=1");
            }, FREEZE_MS);
            timerRef.current = id;
          }
        }
      } catch {
        // non-fatal — keep showing pending
      }
    };

    const iv = window.setInterval(check, POLL_MS);
    const first = window.setTimeout(check, POLL_FIRST_DELAY);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.clearTimeout(first);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [email, router]);

  const isApproved = state.status === "approved";
  const app = state.application;
  const setupComplete = !!app?.setup_completed;
  const infoMessage = app?.info_request_message?.trim();

  const pendingBody = (
    <>
      <span
        aria-hidden="true"
        className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#f57224]/15 ring-1 ring-[#f57224]/30"
      >
        <ShieldCheck size={34} strokeWidth={1.75} className="text-[#ff9a4d]" />
      </span>

      <h1 className="mt-6 text-[26px] font-extrabold leading-tight tracking-tight text-white sm:text-[30px]">
        {setupComplete ? "Your application is under review" : "Finish your store setup"}
      </h1>
      <p className="mt-2.5 text-[14px] leading-6 text-slate-300">
        {setupComplete
          ? "We’ve received your details. A Super Admin is reviewing your application shortly."
          : "Your account is almost ready — submit your store details and verification documents to be reviewed."}
      </p>

      <div
        aria-hidden="true"
        className="mt-5 rounded-2xl border border-[#f57224]/25 bg-[#f57224]/10 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4d]">
          <Mail size={14} aria-hidden="true" />
          {setupComplete ? "Pending approval" : "Action needed"}
        </div>
        {app?.store_name ? (
          <p className="mt-2 text-[13px] font-semibold leading-6 text-white">{app.store_name}</p>
        ) : null}
        <p className="mt-2 text-[13px] leading-6 text-slate-200">
          {setupComplete
            ? "As soon as your application is approved, you’ll receive an email and the storefront will open for you."
            : "Complete your store setup to move this application into the review queue."}
        </p>
        {infoMessage ? (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-5 text-amber-200">
            <span className="font-bold">Requested by Super Admin:</span> {infoMessage}
          </p>
        ) : null}
      </div>

      {!setupComplete && (
        <a
          href={`/store-setup?email=${encodeURIComponent(email || "")}`}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#f57224] px-6 py-3 text-[14px] font-bold text-white transition hover:brightness-110"
        >
          Complete store setup
        </a>
      )}

      <p className="mt-6 text-[12px] leading-5 text-slate-500">
        This screen updates automatically. Approval usually takes 24 hours or less.
      </p>
    </>
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#05070b] px-4 py-10 sm:px-6">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(255,106,31,0.16) 0%, transparent 60%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a]/80 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
        {isApproved ? (
          <>
            <span
              aria-hidden="true"
              className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30"
            >
              <CheckCircle2 size={36} strokeWidth={1.75} className="text-emerald-400" />
            </span>
            <h1 className="mt-6 text-[24px] font-extrabold leading-tight tracking-tight text-white sm:text-[28px]">
              You&apos;re approved!
            </h1>
            <p className="mt-2.5 text-[14px] leading-6 text-slate-300">
              Your account is active. Sign in to open your storefront.
            </p>
            <p className="mt-4 text-[11px] text-slate-500">Redirecting you in a moment…</p>
            <button
              type="button"
              onClick={() => {
                if (timerRef.current) window.clearTimeout(timerRef.current);
                router.replace("/login?approved=1");
              }}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#f57224] px-6 py-3 text-[14px] font-bold text-white transition hover:brightness-110"
            >
              <LogIn size={17} aria-hidden="true" />
              Continue to sign in
            </button>
          </>
        ) : (
          pendingBody
        )}
      </div>
    </main>
  );
}
