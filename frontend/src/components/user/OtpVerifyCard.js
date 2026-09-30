"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, RotateCw, ArrowLeft, AlertCircle, Clock } from "lucide-react";
import OtpInput from "./OtpInput";
import { getApiErrorMessage, getApiRetryAfter } from "@/apis/user/authApi";

/**
 * OtpVerifyCard — OTP verification UI (email verify + forgot password dono ke liye).
 * Internally verify/resend loading, error aur resend countdown manage karta hai.
 */
export default function OtpVerifyCard({
  email,
  title = "Verify your email",
  subtitle,
  submitLabel = "Verify code",
  onVerify,
  onResend,
  onBack,
  backLabel = "Use a different email",
  expiresInMinutes = 5,
  resendAfterSeconds = 60,
  icon: Icon = ShieldCheck,
}) {
  const [otp, setOtp] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(resendAfterSeconds);
  const [expiresLeft, setExpiresLeft] = useState(expiresInMinutes * 60);

  // ⏱️ Resend cooldown + expiry countdown
  useEffect(() => {
    const id = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
      setExpiresLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mmss = (total) =>
    `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await onVerify(otp);
    } catch (err) {
      setError(getApiErrorMessage(err, "Verification failed. Please try again."));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || verifying) return;
    setError("");
    setResending(true);
    try {
      await onResend();
      setOtp("");
      setFormKey((k) => k + 1); // ✅ input boxes clear (remount)
      setCooldown(resendAfterSeconds);
      setExpiresLeft(expiresInMinutes * 60);
    } catch (err) {
      const retryAfter = getApiRetryAfter(err);
      if (retryAfter) setCooldown(retryAfter);
      setError(getApiErrorMessage(err, "Could not resend the code. Please try again."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon size={16} className="text-[var(--user-accent)]" />
          <span className="text-[var(--user-accent)] text-[0.625rem] font-bold uppercase tracking-widest">
            Verification
          </span>
        </div>
        <h2 className="text-2xl font-black text-[var(--user-text)] mb-1">{title}</h2>
        <p className="text-[var(--user-text-muted)] text-sm">
          {subtitle || "Enter the 6-digit code we sent to"}{" "}
          <span className="font-semibold text-[var(--user-text)]">{email}</span>
        </p>
      </div>

      <div className="mb-4">
        <OtpInput
          key={formKey}
          defaultValue={otp}
          onChange={setOtp}
          disabled={verifying || resending}
        />
      </div>

      <div className="flex items-center justify-center gap-1.5 mb-4 text-[0.75rem] font-semibold">
        <Clock size={13} className="text-[var(--user-accent)]" />
        {expiresLeft > 0 ? (
          <span className="text-[var(--user-text-muted)]">
            Code expires in <span className="text-[var(--user-text)]">{mmss(expiresLeft)}</span>
          </span>
        ) : (
          <span className="text-[var(--user-danger)]">Code expired — please resend</span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
          <p className="text-[var(--user-danger)] text-sm">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleVerify}
        disabled={verifying || otp.length < 6}
        className="w-full h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
        {verifying ? "Verifying..." : submitLabel}
      </button>

      <div className="flex items-center justify-between gap-3 mt-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={verifying}
            className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition disabled:opacity-50"
          >
            <ArrowLeft size={13} /> {backLabel}
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending || verifying}
          className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--user-accent)] hover:underline transition disabled:opacity-50 disabled:no-underline"
        >
          {resending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RotateCw size={13} />
          )}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
