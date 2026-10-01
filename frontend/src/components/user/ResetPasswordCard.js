"use client";

import { useState } from "react";
import { Lock, Loader2, KeyRound, ArrowLeft, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { getApiErrorMessage } from "@/apis/user/authApi";

/**
 * ResetPasswordCard — OTP verify hone ke baad naya password set karne ke liye.
 */
export default function ResetPasswordCard({
  email,
  onSubmit,
  onBack,
  backLabel = "Back to login",
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputCls =
    "w-full h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-11 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15 transition";

  const rules = [
    { label: "At least 6 characters", ok: password.length >= 6 },
    { label: "Passwords match", ok: password.length > 0 && password === confirm },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not reset the password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-[var(--user-accent)]" />
          <span className="text-[var(--user-accent)] text-[0.625rem] font-bold uppercase tracking-widest">
            New Password
          </span>
        </div>
        <h2 className="text-2xl font-black text-[var(--user-text)] mb-1">Set new password</h2>
        <p className="text-[var(--user-text-muted)] text-sm">
          Choose a new password for <span className="font-semibold text-[var(--user-text)]">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="relative">
          <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="New password"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] hover:text-[var(--user-text)] transition"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <div className="relative">
          <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError("");
            }}
            placeholder="Confirm new password"
            className={inputCls}
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
          {rules.map((rule) => (
            <span
              key={rule.label}
              className={`flex items-center gap-1.5 text-[0.6875rem] font-semibold ${
                rule.ok ? "text-[var(--user-success)]" : "text-[var(--user-text-subtle)]"
              }`}
            >
              <CheckCircle2 size={12} /> {rule.label}
            </span>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
            <AlertCircle size={16} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
            <p className="text-[var(--user-danger)] text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
          {loading ? "Saving..." : "Reset Password"}
        </button>
      </form>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex items-center gap-1.5 mt-4 text-[0.75rem] font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition disabled:opacity-50"
        >
          <ArrowLeft size={13} /> {backLabel}
        </button>
      )}
    </div>
  );
}
