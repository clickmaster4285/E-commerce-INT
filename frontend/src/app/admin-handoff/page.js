"use client";

// ==========================================================
// ADMIN HANDOFF — platform se store subdomain par sign-in
// ----------------------------------------------------------
// Platform (192.168.88.35.nip.io) par login/signup ke baad backend ek
// 2-minute, ek-baar wala token deta hai aur yahan bhejta hai:
//   http://<store>.192.168.88.35.nip.io:3000/admin-handoff#token=...
// 🔒 Login-CSRF: koi attacker apna token wala link bhej kar victim ko apne
// account me sign-in na kara de — is liye load par auto-exchange NAHI hota;
// user ko "Continue to admin" click karna padta hai. (/admin ke bahar hai
// taake admin layout ka login-guard isay na roke.)
// ==========================================================
import { useEffect, useRef, useState } from "react";
import axiosInstance from "@/apis/axiosInstance";
import { toUserMessage } from "@/lib/toUserMessage";

export default function AdminHandoffPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasToken, setHasToken] = useState(null); // null = abhi check nahi hua
  const tokenRef = useRef("");

  useEffect(() => {
    // Token memory me rakho aur URL/history se foran hatao (exchange click par hoga)
    tokenRef.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(null, "", window.location.pathname);
    setHasToken(Boolean(tokenRef.current));
    if (!tokenRef.current) setError("This sign-in link is missing its token.");
  }, []);

  const onContinue = async () => {
    if (busy || !tokenRef.current) return;
    setBusy(true);
    setError("");
    try {
      await axiosInstance.post("/users/admin/handoff/exchange", { token: tokenRef.current });
      tokenRef.current = "";
      window.location.replace("/admin/dashboard");
    } catch (err) {
      setError(toUserMessage(err, "Could not sign you in to this store."));
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 text-center">
      <div className="w-full max-w-sm">
        {error ? (
          <>
            <h1 className="text-[20px] font-extrabold text-white">Sign-in link expired</h1>
            <p className="mt-3 text-[14px] text-slate-300">{error}</p>
            <a
              href="/admin/login"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110"
            >
              Log in to this store
            </a>
          </>
        ) : hasToken ? (
          <>
            <h1 className="text-[20px] font-extrabold text-white">Open your store admin</h1>
            <p className="mt-3 text-[14px] text-slate-300">Confirm to sign in to this store&apos;s admin panel.</p>
            <button
              type="button"
              onClick={onContinue}
              disabled={busy}
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Continue to admin"}
            </button>
          </>
        ) : (
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#f57224]" />
        )}
      </div>
    </main>
  );
}
