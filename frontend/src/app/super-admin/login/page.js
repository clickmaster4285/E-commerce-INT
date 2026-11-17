"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Already signed in? Jump straight to dashboard
  useEffect(() => {
    superAdminApi
      .me()
      .then(() => router.replace("/super-admin/dashboard"))
      .catch(() => {});
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await superAdminApi.login({ email: email.trim(), password });
      router.replace("/super-admin/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full bg-[#0b1220]">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex" style={{ background: "#0f172a" }}>
        <div
          aria-hidden="true"
          className="absolute -left-40 -top-40 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.35), transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.25), transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white shadow-lg shadow-blue-500/40">
              SA
            </span>
            <div>
              <p className="text-lg font-black leading-none text-white">Click Master</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Super Admin</p>
            </div>
          </div>
          <h1 className="mt-14 max-w-md text-4xl font-black leading-[1.05] tracking-tight text-white">
            One panel.<br />
            Every store.<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Total control.</span>
          </h1>
          <ul className="mt-10 space-y-3 text-[13px] text-white/70">
            {["Seller signup approvals", "Store suspension & reactivation", "User management across all tenants", "Audit log of every action"].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-blue-400" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.25em] text-white/35">
          Restricted access · Authorized personnel only
        </p>
      </aside>

      {/* Form panel */}
      <section className="relative flex min-w-0 flex-1 items-center justify-center px-6 py-12" style={{ background: "#0e1626" }}>
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white lg:hidden">SA</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Super Admin Access</p>
          </div>
          <h2 className="text-2xl font-black text-white">Sign in</h2>
          <p className="mt-1.5 text-sm text-white/55">Dedicated session for the multi-tenant platform.</p>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="sa-email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/50">Email</label>
              <div className="relative">
                <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" aria-hidden="true" />
                <input id="sa-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gmail.com" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label htmlFor="sa-password" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/50">Password</label>
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" aria-hidden="true" />
                <input id="sa-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-12 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60">
              {loading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Signing in…</> : "Sign in to Super Admin"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
