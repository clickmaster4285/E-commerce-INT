"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Coins, Gift, LoaderCircle, Save, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { useTranslation } from "@/i18n/LanguageProvider";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";

const initialSettings = {
  enabled: false,
  referrerPoints: 100,
  friendPoints: 100,
  saleReferrerPoints: 0,
  headline: "Invite a friend, earn rewards",
};

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function AdminReferralsPage() {
  const { dir } = useTranslation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-referrals"], queryFn: loyaltyApi.referrals, retry: false });
  const [form, setForm] = useState(initialSettings);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState({});
  const values = dirty ? form : query.data?.settings || initialSettings;

  const save = useMutation({
    mutationFn: loyaltyApi.saveReferrals,
    onSuccess: async (response) => {
      toast.success("Referral program settings saved.");
      setErrors({});
      client.setQueryData(["admin-referrals"], (old) => old ? { ...old, settings: response.data } : old);
      setDirty(false);
      await client.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (error) => {
      setErrors(error.response?.data?.errors || {});
      toast.error(error.response?.data?.message || "Could not save referral settings.");
    },
  });

  const update = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => save.mutate({
    ...values,
    referrerPoints: Number(values.referrerPoints),
    friendPoints: Number(values.friendPoints),
    saleReferrerPoints: Number(values.saleReferrerPoints),
  });

  const statCards = query.data ? [
    { icon: Users, label: "Total referrals", value: query.data.stats.total, tone: "text-[var(--accent)] bg-[var(--accent-soft)]" },
    { icon: CheckCircle2, label: "Signup rewards issued", value: query.data.stats.rewarded, tone: "text-emerald-600 bg-emerald-500/10" },
    { icon: Clock3, label: "Awaiting verification", value: query.data.stats.pending, tone: "text-amber-600 bg-amber-500/10" },
    { icon: Coins, label: "Sale reward points issued", value: query.data.stats.saleRewardPoints, tone: "text-violet-600 bg-violet-500/10", detail: `${formatNumber(query.data.stats.saleRewards)} delivered orders` },
  ] : [];

  const pointField = (key, label, description) => (
    <label className="block rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-5">
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1 block min-h-10 text-xs leading-5 text-[var(--text-muted)]">{description}</span>
      <span className="relative mt-3 block">
        <input type="number" min="0" max="1000000" step="1" value={values[key] ?? 0} onChange={update(key)} aria-invalid={Boolean(errors[key])} className="h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input,var(--bg-card))] px-3 pe-16 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]" />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-[var(--text-muted)]">points</span>
      </span>
      {errors[key] && <span role="alert" className="mt-1.5 block text-xs text-red-500">{errors[key]}</span>}
    </label>
  );

  return (
    <main dir={dir} className="min-h-full space-y-5 p-4 text-[var(--text-primary)] sm:space-y-6 sm:p-6">
      <AdminPageHeader title="Referral program" subtitle="Control signup rewards and points earned when referred customers complete an order." />

      {query.isLoading ? (
        <div className="flex min-h-48 items-center justify-center text-[var(--text-muted)]"><LoaderCircle className="animate-spin" /></div>
      ) : query.isError ? (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 text-sm">Could not load referral settings.<button className="ms-2 font-semibold text-[var(--accent)]" onClick={() => query.refetch()}>Try again</button></div>
      ) : (
        <>
          <section aria-label="Referral program overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(({ icon: Icon, label, value, tone, detail }) => (
              <article key={label} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-5">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span>
                <p className="mt-3 text-xs text-[var(--text-muted)]">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
                {detail && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{detail}</p>}
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="flex flex-col gap-4 border-b border-[var(--border-color)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
              <div><h2 className="text-base font-semibold">Program settings</h2><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Choose signup and completed-sale rewards. All rewards are loyalty points.</p></div>
              <label className="inline-flex min-h-10 items-center gap-3 self-start rounded-lg bg-[var(--bg-tertiary)] px-3 text-sm font-medium sm:self-auto">
                <input type="checkbox" checked={Boolean(values.enabled)} onChange={update("enabled")} className="h-4 w-4 accent-[var(--accent)]" />
                <span>{values.enabled ? "Program enabled" : "Program disabled"}</span>
              </label>
            </div>

            <div className="space-y-6 p-4 sm:p-6">
              <label className="block max-w-2xl text-sm font-semibold">Customer-facing headline
                <input value={values.headline || ""} onChange={update("headline")} maxLength={100} aria-invalid={Boolean(errors.headline)} className="mt-2 block h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input,var(--bg-card))] px-3 text-sm font-normal outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]" />
                {errors.headline && <span role="alert" className="mt-1.5 block text-xs text-red-500">{errors.headline}</span>}
              </label>

              <div>
                <div className="mb-3 flex items-center gap-2"><Gift size={17} className="text-[var(--accent)]" /><h3 className="text-sm font-semibold">Signup rewards</h3></div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {pointField("referrerPoints", "Inviter reward", "Points awarded to the referrer when their friend verifies a new account.")}
                  {pointField("friendPoints", "New customer reward", "Welcome points awarded to the friend after account verification.")}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2"><ShoppingBag size={17} className="text-violet-600" /><h3 className="text-sm font-semibold">Completed-sale reward</h3></div>
                <div className="max-w-2xl">
                  {pointField("saleReferrerPoints", "Inviter reward per delivered order", "Fixed points for each order placed by a referred customer. Points are issued once the order is marked Delivered. Set to 0 to turn off sale rewards.")}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-[var(--text-muted)]">Cancelled orders have their sale reward reversed. Repeated status changes won’t duplicate points.</p>
                <button type="button" disabled={save.isPending || !dirty} onClick={submit} className="inline-flex min-h-11 items-center justify-center gap-2 self-stretch rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 sm:self-auto">
                  {save.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  {save.isPending ? "Saving…" : "Save settings"}
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-color)] px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold">Recent referrals</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Latest invited customers and signup reward status.</p></div>
            {query.data.recent.length ? <div className="divide-y divide-[var(--border-color)]">{query.data.recent.map((row) => <div key={row.id} className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-5"><div className="min-w-0"><p className="truncate font-medium">{row.referrer?.name || "Customer"}</p><p className="truncate text-xs text-[var(--text-muted)]">{row.referrer?.email || "Referrer"}</p></div><div className="min-w-0"><p className="truncate">{row.friend?.name || "Customer"}</p><p className="truncate text-xs text-[var(--text-muted)]">{row.friend?.email || "Invited customer"}</p></div><div className="flex items-center justify-between gap-3 text-xs sm:flex-col sm:items-end"><span className={`font-medium ${row.status === "rewarded" ? "text-emerald-600" : row.status === "pending" ? "text-amber-600" : "text-[var(--text-muted)]"}`}>{row.status === "rewarded" ? "Signup rewarded" : row.status === "pending" ? "Awaiting verification" : row.status}</span><span className="text-[var(--text-muted)]">{formatDate(row.createdAt)}</span></div></div>)}</div> : <p className="px-5 py-8 text-sm text-[var(--text-muted)]">No referrals have been recorded yet.</p>}
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-color)] px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold">Recent sale rewards</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Points credited to inviters for delivered orders placed by their referrals.</p></div>
            {query.data.recentSales?.length ? <div className="divide-y divide-[var(--border-color)]">{query.data.recentSales.map((row) => <div key={row.id} className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-5"><div className="min-w-0"><p className="truncate font-medium">{row.referrer?.name || "Referrer"}</p><p className="truncate text-xs text-[var(--text-muted)]">Reward recipient</p></div><div className="min-w-0"><p className="truncate">{row.order?.number || "Order removed"}</p><p className="truncate text-xs text-[var(--text-muted)]">{row.order?.customer?.name || "Referred customer"}{row.order?.total != null ? ` · Rs ${formatNumber(row.order.total)}` : ""}</p></div><div className="flex items-center justify-between gap-3 text-xs sm:flex-col sm:items-end"><span className={`font-medium ${row.status === "available" ? "text-emerald-600" : "text-[var(--text-muted)]"}`}>{row.status === "available" ? `+${formatNumber(row.points)} points` : `Reversed · ${formatNumber(row.reversedPoints)} points recovered`}</span><span className="text-[var(--text-muted)]">{formatDate(row.createdAt)}</span></div></div>)}</div> : <p className="px-5 py-8 text-sm text-[var(--text-muted)]">No referred customer orders have earned sale rewards yet.</p>}
          </section>
        </>
      )}
    </main>
  );
}
