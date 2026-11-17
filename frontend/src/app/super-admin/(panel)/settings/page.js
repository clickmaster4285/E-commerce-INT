"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => { superAdminApi.getSettings().then((r) => { setData(r?.data || null); setLoading(false); }).catch(() => { setError("Failed to load settings"); setLoading(false); }); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setFormError(""); setDone(false);
    if (!current || !next) { setFormError("Current and new password are required."); return; }
    if (next.length < 8) { setFormError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setFormError("Passwords do not match."); return; }
    setBusy(true);
    try { await superAdminApi.changePassword({ currentPassword: current, newPassword: next }); setDone(true); setCurrent(""); setNext(""); setConfirm(""); } catch (err) { setFormError(err?.response?.data?.message || "Failed to change password"); } finally { setBusy(false); }
  };

  if (loading) return <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Loading settings…</div>;
  if (error || !data) return <div className="card p-6 text-sm text-red-600">{error}</div>;

  const { profile, environment } = data;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Account, security and environment configuration.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="card lg:col-span-7 p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-black text-white">{String(profile?.name || "SA").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-[var(--text-primary)]">{profile?.name}</p>
              <p className="truncate font-mono text-[13px] text-[var(--text-muted)]">{profile?.email}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Last login: {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "—"}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Tile label="Environment" value={environment?.nodeEnv || "development"} />
            <Tile label="JWT secret" value={environment?.jwtSecretConfigured ? "Configured" : "Missing"} tone={environment?.jwtSecretConfigured ? "ok" : "bad"} />
            <Tile label="SMTP" value={environment?.smtpConfigured ? "Connected" : "Not configured"} tone={environment?.smtpConfigured ? "ok" : "warn"} />
            <Tile label="Super Admin" value="Isolated session" />
          </div>
        </section>

        <section className="card lg:col-span-5 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Change password</h2>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" placeholder="Current password" className="h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-4 text-sm" aria-label="Current password" />
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="New password (min 8 chars)" className="h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-4 text-sm" aria-label="New password" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Confirm new password" className="h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-4 text-sm" aria-label="Confirm new password" />
            {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            {done && <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14}/> Password updated.</p>}
            <button type="submit" disabled={busy} className="btn-primary h-11 w-full">{busy ? <><Loader2 size={16} className="animate-spin"/> Updating…</> : "Update password"}</button>
          </form>
        </section>
      </div>

      <div className="card p-4 text-[11px] leading-5 text-[var(--text-muted)]">
        <p className="font-bold text-[var(--text-primary)]">Security notes</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>Super Admin session is independent from customer/seller sessions (own cookie, own secret).</li>
          <li>Seeded credentials are for local development only. Change <code>SUPER_ADMIN_PASSWORD</code> before production.</li>
          <li>All destructive actions are written to <strong>Activity Logs</strong>.</li>
        </ul>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "text-[var(--text-primary)]";
  return (<div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">{label}</p><p className={`mt-1 font-mono text-sm font-bold ${color}`}>{value}</p></div>);
}
