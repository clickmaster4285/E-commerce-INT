"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Info,
  LoaderCircle,
  RotateCcw,
  Save,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import {
  Button,
  Card,
  InlineAlert,
  PageHeader,
  RewardField,
  SectionCard,
  SettingSection,
  StatusBadge,
  Switch,
  formatNumber,
} from "@/components/admin/ui";

const initialSettings = {
  enabled: false,
  referrerPoints: 100,
  friendPoints: 100,
  saleReferrerPoints: 0,
  headline: "Invite a friend, earn rewards",
};

const normalize = (settings) => ({
  enabled: Boolean(settings?.enabled),
  referrerPoints: Number(settings?.referrerPoints || 0),
  friendPoints: Number(settings?.friendPoints || 0),
  saleReferrerPoints: Number(settings?.saleReferrerPoints || 0),
  headline: String(settings?.headline || "").trim(),
});

export default function AdminReferralSettingsPage() {
  const { t, dir, locale } = useTranslation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-referrals"], queryFn: loyaltyApi.referrals, retry: false });

  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});

  const saved = query.data?.settings || initialSettings;
  const values = draft ?? saved;
  const dirty = draft ? JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(saved)) : false;

  const save = useMutation({
    mutationFn: loyaltyApi.saveReferrals,
    onSuccess: async (response) => {
      toast.success(t("admin.referrals.settings.toast.success"));
      setErrors({});
      client.setQueryData(["admin-referrals"], (old) => (old ? { ...old, settings: response.data } : old));
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (error) => {
      setErrors(error.response?.data?.errors || {});
      toast.error(error.response?.data?.message || t("admin.referrals.settings.toast.error"));
    },
  });

  const setField = (key, value) => {
    setDraft((current) => ({ ...(current ?? saved), [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const update = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setField(key, value);
  };

  const submit = () =>
    save.mutate({
      ...values,
      referrerPoints: Number(values.referrerPoints || 0),
      friendPoints: Number(values.friendPoints || 0),
      saleReferrerPoints: Number(values.saleReferrerPoints || 0),
    });

  const discard = () => {
    setDraft(null);
    setErrors({});
  };

  useEffect(() => {
    if (!dirty) return undefined;
    const message = t("admin.referrals.settings.leaveConfirm");
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, t]);

  const enabled = Boolean(values.enabled);
  const headlineLength = String(values.headline || "").length;
  const salePoints = Number(values.saleReferrerPoints || 0);
  const pointsLabel = t("admin.referrals.settings.points");
  const invalidNumber = t("admin.referrals.common.invalidNumber");

  const isValidPoints = (key) => {
    const number = Number(values[key]);
    return Number.isInteger(number) && number >= 0 && number <= 1000000;
  };
  const pointError = (key) => (isValidPoints(key) ? errors[key] : errors[key] || invalidNumber);
  const headlineError = headlineLength >= 5 && headlineLength <= 100
    ? errors.headline
    : errors.headline || t("admin.referrals.settings.headline.hint");
  const valid =
    headlineLength >= 5 && headlineLength <= 100 &&
    isValidPoints("referrerPoints") && isValidPoints("friendPoints") && isValidPoints("saleReferrerPoints");

  const howSteps = [
    { icon: Users, title: t("admin.referrals.settings.how.step1.title"), text: t("admin.referrals.settings.how.step1.text") },
    { icon: Gift, title: t("admin.referrals.settings.how.step2.title"), text: t("admin.referrals.settings.how.step2.text") },
    { icon: ShoppingBag, title: t("admin.referrals.settings.how.step3.title"), text: t("admin.referrals.settings.how.step3.text") },
  ];

  const glanceRows = [
    {
      icon: CheckCircle2,
      label: t("admin.referrals.settings.glance.status"),
      value: enabled ? t("admin.referrals.settings.enabledLabel") : t("admin.referrals.settings.disabledLabel"),
      tone: enabled ? "success" : "muted",
    },
    {
      icon: Users,
      label: t("admin.referrals.settings.glance.inviter"),
      value: t("admin.referrals.settings.glance.points", { points: formatNumber(values.referrerPoints, locale) }),
      tone: "default",
    },
    {
      icon: Gift,
      label: t("admin.referrals.settings.glance.friend"),
      value: t("admin.referrals.settings.glance.points", { points: formatNumber(values.friendPoints, locale) }),
      tone: "default",
    },
    {
      icon: ShoppingBag,
      label: t("admin.referrals.settings.glance.sale"),
      value: salePoints > 0
        ? t("admin.referrals.settings.glance.points", { points: formatNumber(salePoints, locale) })
        : t("admin.referrals.settings.glance.off"),
      tone: salePoints > 0 ? "default" : "muted",
    },
  ];

  return (
    <div dir={dir} className="min-h-full space-y-4 text-fg">
      <PageHeader
        backHref="/admin/referrals"
        backLabel={t("admin.referrals.settings.back")}
        title={t("admin.referrals.settings.title")}
        description={t("admin.referrals.settings.subtitle")}
        badge={
          <StatusBadge tone={dirty ? "warning" : "success"}>
            {dirty ? t("admin.referrals.settings.unsaved") : t("admin.referrals.settings.saved")}
          </StatusBadge>
        }
        actions={
          <>
            <Button variant="secondary" icon={RotateCcw} onClick={discard} disabled={!dirty || save.isPending}>
              {t("admin.referrals.settings.discard")}
            </Button>
            <Button
              icon={save.isPending ? LoaderCircle : Save}
              onClick={submit}
              disabled={!dirty || !valid || save.isPending}
              className={save.isPending ? "[&_svg]:animate-spin" : ""}
            >
              {save.isPending ? t("admin.referrals.settings.saving") : t("admin.referrals.settings.save")}
            </Button>
          </>
        }
      />

      {query.isError ? (
        <InlineAlert
          tone="danger"
          icon={AlertCircle}
          action={
            <Button variant="secondary" icon={RotateCcw} onClick={() => query.refetch()}>
              {t("admin.referrals.common.retry")}
            </Button>
          }
        >
          {t("admin.referrals.common.loadError")}
        </InlineAlert>
      ) : query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="h-[560px] animate-pulse rounded-xl bg-subtle" />
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-xl bg-subtle" />
            <div className="h-56 animate-pulse rounded-xl bg-subtle" />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
              <StatusBadge tone={enabled ? "success" : "muted"}>
                {enabled ? t("admin.referrals.settings.live") : t("admin.referrals.settings.off")}
              </StatusBadge>
              <label className="inline-flex items-center gap-2.5 text-[13px] font-medium text-fg">
                <Switch
                  checked={enabled}
                  onChange={(value) => setField("enabled", value)}
                  label={t("admin.referrals.settings.enabled")}
                />
                {t("admin.referrals.settings.programLabel")}
              </label>
            </div>

            <div>
              <SettingSection
                icon={Settings}
                title={t("admin.referrals.settings.headline.title")}
                text={t("admin.referrals.settings.headline.text")}
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  <label className="block">
                    <span className="text-[12.5px] font-semibold text-fg">{t("admin.referrals.settings.headline.label")}</span>
                    <input
                      value={values.headline || ""}
                      onChange={update("headline")}
                      maxLength={100}
                      aria-invalid={Boolean(headlineError)}
                      placeholder={t("admin.referrals.settings.headline.placeholder")}
                      className={`mt-2 h-10 w-full rounded-lg border bg-card px-3 text-[13.5px] text-fg outline-none transition placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent ${headlineError ? "border-danger-solid" : "border-line"}`}
                    />
                    <span className="mt-1 flex items-center justify-between gap-2 text-[11.5px] text-fg-muted">
                      {headlineError ? (
                        <span role="alert" className="font-medium text-danger">{headlineError}</span>
                      ) : (
                        <span>{t("admin.referrals.settings.headline.hint")}</span>
                      )}
                      <span className="tabular-nums">
                        {t("admin.referrals.settings.headline.counter", { count: headlineLength })}
                      </span>
                    </span>
                  </label>
                  <div className="overflow-hidden rounded-xl border border-line">
                    <div
                      className="px-3.5 py-3 text-accent-fg"
                      style={{
                        background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, var(--text-inverse) 30%) 100%)",
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                        {t("admin.referrals.settings.headline.preview")}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug">
                        {values.headline || t("admin.referrals.settings.headline.placeholder")}
                      </p>
                    </div>
                    <p className="bg-card px-3.5 py-2 text-[11.5px] text-fg-muted">
                      {t("admin.referrals.settings.headline.previewText")}
                    </p>
                  </div>
                </div>
              </SettingSection>

              <SettingSection
                icon={Gift}
                title={t("admin.referrals.settings.signup.title")}
                text={t("admin.referrals.settings.signup.text")}
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  <RewardField
                    icon={Users}
                    tone="accent"
                    label={t("admin.referrals.settings.signup.inviter")}
                    who={t("admin.referrals.settings.signup.inviterWho")}
                    help={t("admin.referrals.settings.signup.inviterHelp")}
                    value={values.referrerPoints}
                    onChange={update("referrerPoints")}
                    error={pointError("referrerPoints")}
                    pointsLabel={pointsLabel}
                  />
                  <RewardField
                    icon={Gift}
                    tone="success"
                    label={t("admin.referrals.settings.signup.friend")}
                    who={t("admin.referrals.settings.signup.friendWho")}
                    help={t("admin.referrals.settings.signup.friendHelp")}
                    value={values.friendPoints}
                    onChange={update("friendPoints")}
                    error={pointError("friendPoints")}
                    pointsLabel={pointsLabel}
                  />
                </div>
                <InlineAlert tone="info" icon={Info}>
                  {t("admin.referrals.settings.signup.explain", {
                    inviter: formatNumber(values.referrerPoints, locale),
                    friend: formatNumber(values.friendPoints, locale),
                  })}
                </InlineAlert>
              </SettingSection>

              <SettingSection
                icon={ShoppingBag}
                title={t("admin.referrals.settings.sale.title")}
                text={t("admin.referrals.settings.sale.text")}
              >
                <RewardField
                  icon={ShoppingBag}
                  tone="purple"
                  label={t("admin.referrals.settings.sale.label")}
                  who={t("admin.referrals.settings.sale.who")}
                  help={t("admin.referrals.settings.sale.help")}
                  value={values.saleReferrerPoints}
                  onChange={update("saleReferrerPoints")}
                  error={pointError("saleReferrerPoints")}
                  pointsLabel={pointsLabel}
                />
                <InlineAlert tone={salePoints > 0 ? "info" : "warning"} icon={Info}>
                  {salePoints > 0
                    ? t("admin.referrals.settings.sale.on", { points: formatNumber(salePoints, locale) })
                    : t("admin.referrals.settings.sale.off")}
                </InlineAlert>
              </SettingSection>
            </div>

          </Card>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <SectionCard
              title={t("admin.referrals.settings.how.title")}
              subtitle={t("admin.referrals.settings.how.subtitle")}
            >
              <ol className="divide-y divide-line">
                {howSteps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                      <step.icon size={16} aria-hidden="true" />
                      <span
                        className="absolute -start-1 -top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-semibold"
                        style={{ background: "var(--primary)", color: "var(--accent-text)" }}
                      >
                        {index + 1}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-fg">{step.title}</p>
                      <p className="mt-1 text-[13px] leading-5 text-fg-muted">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>

            <SectionCard
              title={t("admin.referrals.settings.glance.title")}
              subtitle={t("admin.referrals.settings.glance.subtitle")}
            >
              <dl className="divide-y divide-line text-[13px]">
                {glanceRows.map((row) => (
                  <div key={row.label} className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5">
                    <row.icon size={15} className="shrink-0 text-fg-muted" aria-hidden="true" />
                    <dt className="flex-1 text-fg-muted">{row.label}</dt>
                    <dd
                      className="text-end font-semibold tabular-nums"
                      style={{
                        color: row.tone === "success"
                          ? "var(--success-text)"
                          : row.tone === "muted"
                            ? "var(--muted-foreground)"
                            : "var(--foreground)",
                      }}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {!enabled ? (
                <div className="border-t border-line px-4 py-3 sm:px-5">
                  <InlineAlert tone="warning" icon={Info}>
                    {t("admin.referrals.settings.noticeOff")}
                  </InlineAlert>
                </div>
              ) : null}
            </SectionCard>
          </aside>
        </div>
      )}
    </div>
  );
}
