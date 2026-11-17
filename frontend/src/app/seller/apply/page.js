"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  Lock,
  Store as StoreIcon,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";

export default function SellerApplyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const validPhone = (v) => /^\d{10,16}$/.test(String(v || ""));
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || name.trim().length < 2) { setError("Name must be at least 2 characters."); return; }
    if (!validPhone(phone)) { setError("Phone must be 10–16 digits."); return; }
    if (!validEmail(email)) { setError("Please enter a valid email."); return; }
    if (!storeName || storeName.trim().length < 2) { setError("Store name must be at least 2 characters."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      await userHttp.post("/seller/apply", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone,
        username: username.trim(),
        password,
        storeName: storeName.trim(),
        storeDescription: storeDescription.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1220] px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-blue-500/20 bg-white/5 p-8 text-center">
          <ShieldCheck size={48} className="mx-auto text-blue-400" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-black text-white">Application received</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Our Super Admin team will review your application. You will be notified at <strong className="text-white">{email}</strong> once your store is approved.
          </p>
          <button type="button" onClick={() => router.push("/")} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white transition hover:bg-blue-500">
            Back to Home <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-[#0b1220]">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex" style={{ background: "#0f172a" }}>
        <div aria-hidden="true" className="absolute -left-40 -top-40 h-96 w-96 rounded-full" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.35), transparent 70%)" }} />
        <div aria-hidden="true" className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full" style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.25), transparent 70%)" }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white shadow-lg shadow-blue-500/40">SA</span>
            <div>
              <p className="text-lg font-black leading-none text-white">Click Master</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Seller Program</p>
            </div>
          </div>
          <h1 className="mt-14 max-w-md text-4xl font-black leading-[1.05] tracking-tight text-white">Launch your<br /><span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">own store.</span></h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">Join Pakistan&apos;s emerging multi-tenant commerce platform. Submit your application — our Super Admin team reviews every request within 24 hours.</p>
          <ul className="mt-10 space-y-3 text-[13px] text-white/70">
            {["No setup fees", "Your own tenant storefront", "COD & bank-transfer ready", "Full Urdu (RTL) support"].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-blue-400" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.25em] text-white/35">Authorized seller onboarding only</p>
      </aside>

      {/* Form panel */}
      <section className="flex min-w-0 flex-1 items-center justify-center px-6 py-12" style={{ background: "#0e1626" }}>
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white lg:hidden">SA</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Seller Application</p>
          </div>
          <h2 className="text-2xl font-black text-white">Apply to become a seller</h2>
          <p className="mt-1.5 text-sm text-white/55">Fill in your details below. We review every application manually.</p>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-3.5" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <Field icon={User} label="Full Name" id="name" value={name} onChange={setName} autoComplete="name" />
              <Field icon={Phone} label="Phone" id="phone" value={phone} onChange={setPhone} autoComplete="tel" inputMode="numeric" />
            </div>
            <Field icon={Mail} label="Email" id="email" value={email} onChange={setEmail} autoComplete="email" type="email" />
            <Field icon={User} label="Username (optional)" id="username" value={username} onChange={setUsername} autoComplete="username" placeholder="seller123" />
            <Field icon={Lock} label="Password" id="password" value={password} onChange={setPassword} autoComplete="new-password" type="password" />
            <div>
              <label htmlFor="storeName" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Store name</label>
              <div className="relative">
                <StoreIcon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" aria-hidden="true" />
                <input id="storeName" type="text" required value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Al-Noor Electronics" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-[15px] text-white placeholder-white/30 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label htmlFor="storeDescription" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Store description (optional)</label>
              <textarea id="storeDescription" rows={2} value={storeDescription} onChange={(e) => setStoreDescription(e.target.value)} placeholder="Briefly describe what you sell…" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-white placeholder-white/30 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60">
              {loading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Submitting…</> : "Submit application"}
            </button>
          </form>
          <p className="mt-6 text-[11px] text-white/40">Already applied? <a href="/login" className="font-semibold text-blue-300 hover:underline">Sign in</a></p>
        </div>
      </section>
    </main>
  );
}

function Field({ icon: Icon, label, id, value, onChange, autoComplete, inputMode, type = "text", placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</label>
      <div className="relative">
        <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" aria-hidden="true" />
        <input id={id} type={type} required value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} placeholder={placeholder} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-[15px] text-white placeholder-white/30 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
