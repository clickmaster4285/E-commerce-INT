"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Mail,
  XCircle,
  Search,
} from "lucide-react";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@clickmasterstore.pk";

export default function SellerStatusPage() {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading", data: null, auth: false });
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupState, setLookupState] = useState({ status: "idle", data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    // Signed-in? Show MY application. Otherwise fall back to a guest lookup form.
    const run = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVERURL}/seller/status`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: "ready", data: null, auth: false });
          return;
        }
        const body = await res.json().catch(() => null);
        const data = body?.data ?? null;
        if (data?.status === "approved") {
          router.replace("/seller/dashboard");
          return;
        }
        setState({ status: "ready", data, auth: true });
      } catch {
        if (cancelled) return;
        setState({ status: "ready", data: null, auth: false });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submitLookup = async (e) => {
    e.preventDefault();
    setLookupState({ status: "loading", data: null, error: "" });
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVERURL}/seller/apply/status?email=${encodeURIComponent(lookupEmail.trim().toLowerCase())}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setLookupState({ status: "error", data: null, error: body?.message || "No application found for this email." });
        return;
      }
      setLookupState({ status: "ready", data: body?.data ?? null, error: "" });
    } catch {
      setLookupState({ status: "error", data: null, error: "Something went wrong. Please try again." });
    }
  };

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
        <span className="spinner" aria-label="Loading application status" />
      </main>
    );
  }

  const application = state.auth ? state.data : lookupState.data;
  const rejected = application?.status === "rejected";

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
            <h1 className="text-[19px] font-semibold tracking-tight text-[var(--text-primary)]">Application status</h1>
          </div>
          {!state.auth && (
            <Link href="/seller/apply" className="text-[13px] font-medium text-[var(--accent)] hover:underline">
              Apply
            </Link>
          )}
        </div>

        {/* Guest lookup */}
        {!state.auth && (
          <form onSubmit={submitLookup} className="card flex flex-wrap items-center gap-2 p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                type="email"
                required
                autoFocus
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="you@company.com"
                aria-label="Your application email"
                className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button type="submit" disabled={lookupState.status === "loading"} className="btn-primary h-10 px-4 text-[13px]">
              {lookupState.status === "loading" ? "Checking…" : "Check status"}
            </button>
            {lookupState.status === "error" && (
              <p role="alert" className="w-full text-[12px] font-medium text-[var(--danger-text)]">{lookupState.error}</p>
            )}
          </form>
        )}

        {application ? (
          <>
            {/* Status card */}
            <div className="card p-6 sm:p-7">
              <div className="flex items-center gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: rejected ? "var(--danger-soft)" : "var(--warning-soft)",
                    color: rejected ? "var(--danger-text)" : "var(--warning-text)",
                  }}
                >
                  {rejected ? <XCircle size={28} aria-hidden="true" /> : <Clock size={28} aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <span className={`badge ${rejected ? "badge-danger" : "badge-warning"}`}>
                    {rejected ? "Rejected" : "Under review"}
                  </span>
                  <h2 className="mt-2 text-[19px] font-semibold leading-snug text-[var(--text-primary)]">
                    {rejected ? "Not approved" : "Under review"}
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-[13.5px] leading-6 text-[var(--text-secondary)]">
                {rejected
                  ? "We’ve reviewed your seller application and, unfortunately, we can’t approve it at this time. The reason is shown below. You’re welcome to reapply after addressing it."
                  : "Thank you for registering. Our team is reviewing your seller application. You’ll receive an email once your account is approved — there’s nothing else you need to do right now."}
              </p>

              <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--border-color)] pt-5 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Business</dt>
                  <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{application.store_name}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Email</dt>
                  <dd className="mt-0.5 truncate font-medium text-[var(--text-primary)]">{application.email}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Submitted</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                    {new Date(application.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </dd>
                </div>
                {application.reviewed_at && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Reviewed</dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                      {new Date(application.reviewed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </dd>
                  </div>
                )}
              </dl>

              {rejected && application.rejection_reason ? (
                <div
                  className="mt-4 rounded-xl border p-4"
                  style={{ background: "var(--danger-soft)", borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--danger-text)]">Reason</p>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--danger-text)]">{application.rejection_reason}</p>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]">
                <Mail size={15} aria-hidden="true" />
                {SUPPORT_EMAIL}
              </a>
              {rejected ? (
                <Link href="/seller/apply" className="btn-primary h-10 px-4 text-[13px]">
                  Reapply
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-muted)]">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  We’ll email you at {application.email}
                </span>
              )}
            </div>
          </>
        ) : state.auth && state.status === "ready" ? (
          <div className="card p-7 text-center">
            <ShieldCheck size={30} className="mx-auto text-[var(--accent)]" aria-hidden="true" />
            <h2 className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">No application found</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-muted)]">
              Your account has no seller application. Apply to become a seller and our team will review it.
            </p>
            <Link href="/seller/apply" className="btn-primary mt-4 h-11 w-full">
              Apply to become a seller
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
