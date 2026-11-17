"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Send, CheckCircle2, AlertCircle } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();

    if (!value) {
      setError("Email required hai.");
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setError("Valid email daalo — jaise name@example.com");
      return;
    }

    setLoading(true);
    // Placeholder — TODO(api): POST /newsletter/subscribe
    window.setTimeout(() => {
      setLoading(false);
      setDone(true);
      setError("");
    }, 700);
  };

  return (
    <section aria-labelledby="newsletter-title" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-6 text-center shadow-sm sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
          <Mail size={26} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h2 id="newsletter-title" className="mt-4 text-2xl font-extrabold text-[var(--user-text)] sm:text-3xl">
          Deals Seedha Inbox Mein
        </h2>
        <p className="mt-2 text-sm text-[var(--user-text-muted)]">
          Flash sale alerts, exclusive coupons aur nayi launches — haftay mein sirf 2 emails.
        </p>

        {done ? (
          <div className="mt-6 flex flex-col items-center gap-2" role="status">
            <CheckCircle2 size={52} className="success-pop text-emerald-500" aria-hidden="true" />
            <p className="text-lg font-extrabold text-[var(--user-text)]">Mubarak ho! Aap subscribed hain 🎉</p>
            <p className="text-sm text-[var(--user-text-muted)]">
              Best deals ab seedha {email.trim().toLowerCase()} par aayengi.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-6">
            <div
              className={`flex flex-col gap-2 sm:flex-row ${
                error ? "sm:[&_input]:border-red-400" : ""
              }`}
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="apka@email.com"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "newsletter-error" : undefined}
                className="h-12 w-full rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] px-4 text-[var(--user-text)] outline-none transition-colors placeholder:text-[var(--user-text-muted)] focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent-soft)]"
              />
              <button
                type="submit"
                disabled={loading}
                className="landing-btn landing-btn-primary h-12 justify-center disabled:opacity-70"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
                Subscribe
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  id="newsletter-error"
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-red-500"
                >
                  <AlertCircle size={16} aria-hidden="true" />
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <p className="mt-3 text-[11px] text-[var(--user-text-muted)]">
              Koi spam nahi. Unsubscribe kisi bhi waqt ek click mein.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
