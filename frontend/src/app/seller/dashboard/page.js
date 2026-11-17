"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  ShieldCheck,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Loader2,
  Globe,
} from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@clickmasterstore.pk";

export default function SellerDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    userHttp
      .get("/seller/dashboard")
      .then((res) => {
        if (cancelled) return;
        setState({ status: "ready", data: res?.data?.data ?? null });
      })
      .catch((err) => {
        if (cancelled) return;
        const httpStatus = err?.response?.status;
        const code = err?.response?.data?.code;
        if (httpStatus === 401) {
          router.replace("/login");
          return;
        }
        if (httpStatus === 403 && (code === "SELLER_NOT_APPROVED" || code === "SELLER_REJECTED" || code === "SELLER_NOT_APPLIED")) {
          router.replace("/seller/status");
          return;
        }
        setState({ status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
        <span className="spinner" aria-label="Loading seller dashboard" />
      </main>
    );
  }

  if (state.status === "error" || !state.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)] px-4">
        <div className="card max-w-md p-6 text-center">
          <AlertCircle size={28} className="mx-auto text-[var(--danger-text)]" aria-hidden="true" />
          <h1 className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">Couldn’t load your dashboard</h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">Check your connection and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-4 h-11 w-full">
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { store, application, user } = state.data;

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <ShieldCheck size={13} aria-hidden="true" />
              Seller Dashboard
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {store?.store_name || "Your store"}
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">Signed in as {user?.email}</p>
          </div>
          <span className={`badge ${store?.store_status === "open" ? "badge-success" : "badge-neutral"}`}>
            {store?.store_status === "open" ? "Store open" : `Store ${store?.store_status || "unknown"}`}
          </span>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Store size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Store</span>
              <span className="mt-0.5 block truncate text-[15px] font-semibold text-[var(--text-primary)]">{store?.store_name || "—"}</span>
            </span>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--success-soft)", color: "var(--success-text)" }}>
              <CheckCircle2 size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Approved</span>
              <span className="mt-0.5 block text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                {application?.reviewed_at ? new Date(application.reviewed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </span>
            </span>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--warning-soft)", color: "var(--warning-text)" }}>
              <Calendar size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Applied</span>
              <span className="mt-0.5 block text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                {application?.created_at ? new Date(application.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </span>
            </span>
          </div>
        </div>

        {/* Store contact */}
        <div className="card p-6">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Store contact</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Email</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[var(--text-secondary)]"><Mail size={13} aria-hidden="true" />{store?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Phone</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-[13px] tabular-nums text-[var(--text-secondary)]"><Phone size={13} aria-hidden="true" />{store?.phone || "—"}</dd>
            </div>
          </dl>
        </div>

        {/* What's next */}
        <div className="card p-6">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">What’s next</h2>
          <ul className="mt-2 list-disc space-y-1.5 ps-5 text-[13px] leading-6 text-[var(--text-secondary)]">
            <li>Your storefront is live. Customers can start ordering from it.</li>
            <li>Store profile editing, product management and order tools are rolling out — contact support for changes in the meantime.</li>
          </ul>
          <p className="mt-4 text-[12px] text-[var(--text-muted)]">
            Need something changed? <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-[var(--accent)] hover:underline">{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </main>
  );
}
