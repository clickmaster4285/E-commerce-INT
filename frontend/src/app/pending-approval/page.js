import { ShieldCheck, Mail } from "lucide-react";

export const metadata = {
  title: "Application received — Click Master",
  robots: { index: false, follow: false },
};

export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070b] px-4 py-10 sm:px-6">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(255,106,31,0.16) 0%, transparent 60%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a]/80 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
        <span
          aria-hidden="true"
          className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#f57224]/15 ring-1 ring-[#f57224]/30"
        >
          <ShieldCheck size={34} strokeWidth={1.75} className="text-[#ff9a4d]" />
        </span>

        <h1 className="mt-6 text-[26px] font-extrabold leading-tight tracking-tight text-white sm:text-[30px]">
          Thank you for creating your account
        </h1>
        <p className="mt-2.5 text-[14px] leading-6 text-slate-300">
          We&apos;ve sent an email to <span className="font-semibold text-white">your inbox</span> confirming your application.
        </p>

        <div
          aria-hidden="true"
          className="mt-5 rounded-2xl border border-[#f57224]/25 bg-[#f57224]/8 px-5 py-4"
          style={{ background: "rgba(245,114,36,0.10)" }}
        >
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4d]">
            <Mail size={14} aria-hidden="true" />
            Pending approval
          </div>
          <p className="mt-2 text-[13px] leading-6 text-slate-200">
            A Super Admin is reviewing your application shortly. As soon as it&apos;s approved, you&apos;ll receive an email and your store will be ready to use.
          </p>
        </div>

        <p className="mt-6 text-[12px] leading-5 text-slate-500">
          Approval usually takes 24 hours or less. Until then your account will stay inactive.
        </p>
      </div>
    </main>
  );
}
