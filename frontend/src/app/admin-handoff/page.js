"use client";

// ==========================================================
// ADMIN HANDOFF — platform se store subdomain par sign-in
// ----------------------------------------------------------
// Platform (192.168.88.35.nip.io) par login/signup ke baad backend ek
// 10-minute, ek-baar wala token deta hai aur yahan bhejta hai:
//   http://<store>.192.168.88.35.nip.io:3000/admin-handoff#token=...
// Ye page token exchange karke ISI store host par session cookies set
// karta hai, phir admin dashboard khol deta hai. (/admin ke bahar hai
// taake admin layout ka login-guard isay na roke.)
// ==========================================================
import { useEffect, useRef, useState } from "react";
import axiosInstance from "@/apis/axiosInstance";

export default function AdminHandoffPage() {
  const [error, setError] = useState("");
  const exchangeStarted = useRef(false);

  useEffect(() => {
    // React Strict Mode replays effects in development. This token is
    // intentionally single-use, so don't exchange it twice in one page load.
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    // Token URL/history se foran hatao
    window.history.replaceState(null, "", window.location.pathname);

    const exchange = async () => {
      if (!token) throw new Error("This sign-in link is missing its token.");
      await axiosInstance.post("/users/admin/handoff/exchange", { token });
    };
    exchange()
      .then(() => window.location.replace("/admin/dashboard"))
      .catch((err) => setError(err?.response?.data?.message || err?.message || "Could not sign you in to this store."));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 text-center">
      <div className="w-full max-w-sm">
        {error ? (
          <>
            <h1 className="text-[20px] font-extrabold text-white">Could not open your store admin</h1>
            <p className="mt-3 text-[14px] text-slate-300">{error}</p>
            <a
              href="/admin/login"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110"
            >
              Log in to this store
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#f57224]" />
            <p className="mt-5 text-[14px] font-semibold text-slate-200">Opening your store admin…</p>
          </>
        )}
      </div>
    </main>
  );
}
