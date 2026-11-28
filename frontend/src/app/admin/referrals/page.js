"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Coins,
  Gift,
  Info,
  RotateCcw,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { loyaltyApi } from "@/apis/admin/loyaltyApi";
import {
  Button,
  EmptyState,
  EntityCell,
  InlineAlert,
  PageHeader,
  SearchInput,
  SectionCard,
  Select,
  SkeletonRows,
  StatCard,
  StatusBadge,
  TableFooter,
  TableHead,
  TableScroll,
  Td,
  TdEnd,
  Th,
  ThEnd,
  Tr,
  formatDate,
  formatNumber,
} from "@/components/admin/ui";

const PAGE_SIZE = 5;
const SETTINGS_ACTION_KEY = "admin.referrals.page.settings";
const EMPTY_ROWS = [];

function paginate(rows, page) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * PAGE_SIZE;
  return {
    rows: rows.slice(start, current * PAGE_SIZE),
    current,
    pages,
    from: total ? start + 1 : 0,
    to: Math.min(current * PAGE_SIZE, total),
    total,
  };
}

export default function AdminReferralsPage() {
  const { t, dir, locale } = useTranslation();
  const query = useQuery({ queryKey: ["admin-referrals"], queryFn: loyaltyApi.referrals, retry: false });

  const [searchDraft, setSearchDraft] = useState("");
  const [referralSearch, setReferralSearch] = useState("");
  const [referralStatus, setReferralStatus] = useState("all");
  const [referralPage, setReferralPage] = useState(1);
  const [saleStatus, setSaleStatus] = useState("all");
  const [salePage, setSalePage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReferralSearch(searchDraft.trim());
      setReferralPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const changeReferralStatus = (value) => {
    setReferralStatus(value);
    setReferralPage(1);
  };
  const changeSaleStatus = (value) => {
    setSaleStatus(value);
    setSalePage(1);
  };

  const stats = query.data?.stats;
  const recent = query.data?.recent ?? EMPTY_ROWS;
  const recentSales = query.data?.recentSales ?? EMPTY_ROWS;
  const enabled = Boolean(query.data?.settings?.enabled);
  const saleOff = Number(query.data?.settings?.saleReferrerPoints || 0) === 0;

  const filteredReferrals = useMemo(() => {
    const term = referralSearch.toLowerCase();
    return recent.filter((row) => {
      const friend = row.friend || {};
      const referrer = row.referrer || {};
      const matches = !term || [friend.name, friend.email, referrer.name, referrer.email]
        .some((value) => String(value || "").toLowerCase().includes(term));
      if (!matches) return false;
      if (referralStatus === "pending") return row.status === "pending";
      if (referralStatus === "rewarded") return row.status === "rewarded";
      if (referralStatus === "verified") return row.status !== "pending";
      return true;
    });
  }, [recent, referralSearch, referralStatus]);

  const filteredSales = useMemo(() => {
    return recentSales.filter((row) => {
      if (saleStatus === "available") return row.status === "available";
      if (saleStatus === "pending") return row.status === "pending";
      if (saleStatus === "reversed") return row.status === "reversed";
      return true;
    });
  }, [recentSales, saleStatus]);

  const referralsPager = paginate(filteredReferrals, referralPage);
  const salesPager = paginate(filteredSales, salePage);

  const referralStatusMeta = (status) => {
    if (status === "pending") return { tone: "warning", label: t("admin.referrals.common.pending") };
    if (status === "rewarded") return { tone: "success", label: t("admin.referrals.common.signedUp") };
    if (status === "cancelled") return { tone: "muted", label: t("admin.referrals.common.cancelled") };
    return { tone: "muted", label: t("admin.referrals.common.ineligible") };
  };
  const saleStatusMeta = (status) => {
    if (status === "pending") return { tone: "warning", label: t("admin.referrals.common.pending") };
    if (status === "reversed") return { tone: "muted", label: t("admin.referrals.common.cancelled") };
    return { tone: "success", label: t("admin.referrals.common.credited") };
  };

  const referralFilterOptions = [
    { value: "all", label: t("admin.referrals.common.all") },
    { value: "pending", label: t("admin.referrals.common.pending") },
    { value: "verified", label: t("admin.referrals.common.verified") },
    { value: "rewarded", label: t("admin.referrals.common.rewarded") },
  ];
  const saleStatusOptions = [
    { value: "all", label: t("admin.referrals.common.all") },
    { value: "available", label: t("admin.referrals.common.credited") },
    { value: "pending", label: t("admin.referrals.common.pending") },
    { value: "reversed", label: t("admin.referrals.common.cancelled") },
  ];

  const statCards = stats
    ? [
        {
          icon: Users,
          tone: "accent",
          label: t("admin.referrals.stats.total"),
          value: formatNumber(stats.total, locale),
          hint: t("admin.referrals.stats.totalHint", {
            rewarded: formatNumber(stats.rewarded, locale),
            pending: formatNumber(stats.pending, locale),
          }),
        },
        {
          icon: CheckCircle2,
          tone: "success",
          label: t("admin.referrals.stats.signup"),
          value: formatNumber(stats.rewarded, locale),
          hint: t("admin.referrals.stats.signupHint"),
        },
        {
          icon: Clock3,
          tone: "warning",
          label: t("admin.referrals.stats.awaiting"),
          value: formatNumber(stats.pending, locale),
          hint: t("admin.referrals.stats.awaitingHint"),
        },
        {
          icon: Coins,
          tone: "purple",
          label: t("admin.referrals.stats.sale"),
          value: formatNumber(stats.saleRewardPoints, locale),
          hint: t("admin.referrals.stats.saleHint", { count: formatNumber(stats.saleRewards, locale) }),
        },
      ]
    : [];

  return (
    <div dir={dir} className="min-h-full space-y-4 text-fg">
      <PageHeader
        title={t("admin.referrals.page.title")}
        description={t("admin.referrals.page.subtitle")}
        badge={
          <StatusBadge tone={enabled ? "success" : "muted"}>
            {enabled ? t("admin.referrals.page.enabled") : t("admin.referrals.page.disabled")}
          </StatusBadge>
        }
        actions={
          <Button href="/admin/referrals/settings" icon={Settings}>
            {t(SETTINGS_ACTION_KEY)}
          </Button>
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
      ) : (
        <>
          <section aria-label={t("admin.referrals.stats.total")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {query.isLoading || statCards.length === 0
              ? [0, 1, 2, 3].map((item) => <StatCard key={item} loading />)
              : statCards.map((card) => <StatCard key={card.label} {...card} />)}
          </section>

          <SectionCard
            title={t("admin.referrals.recent.title")}
            subtitle={t("admin.referrals.recent.subtitle")}
            actions={
              <>
                <SearchInput
                  value={searchDraft}
                  onChange={setSearchDraft}
                  placeholder={t("admin.referrals.recent.searchPlaceholder")}
                  label={t("admin.referrals.recent.search")}
                />
                <Select
                  value={referralStatus}
                  onChange={changeReferralStatus}
                  options={referralFilterOptions}
                  label={t("admin.referrals.recent.filter")}
                />
              </>
            }
            footer={
              !query.isLoading && referralsPager.total > 0 ? (
                <TableFooter
                  showingLabel={t("admin.referrals.common.showing", {
                    from: formatNumber(referralsPager.from, locale),
                    to: formatNumber(referralsPager.to, locale),
                    total: formatNumber(referralsPager.total, locale),
                  })}
                  page={referralsPager.current}
                  pages={referralsPager.pages}
                  onPage={setReferralPage}
                  prevLabel={t("admin.referrals.common.prev")}
                  nextLabel={t("admin.referrals.common.next")}
                />
              ) : null
            }
          >
            {query.isLoading ? (
              <SkeletonRows rows={4} columns={5} />
            ) : referralsPager.total === 0 ? (
              <EmptyState
                icon={Users}
                title={t("admin.referrals.recent.emptyTitle")}
                description={t("admin.referrals.recent.emptyText")}
              />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[820px] border-collapse">
                  <TableHead>
                    <Th>{t("admin.referrals.recent.customer")}</Th>
                    <Th>{t("admin.referrals.recent.invitedBy")}</Th>
                    <Th>{t("admin.referrals.sale.status")}</Th>
                    <ThEnd>{t("admin.referrals.recent.signup")}</ThEnd>
                    <ThEnd>{t("admin.referrals.recent.date")}</ThEnd>
                  </TableHead>
                  <tbody>
                    {referralsPager.rows.map((row) => {
                      const status = referralStatusMeta(row.status);
                      return (
                        <Tr key={row.id}>
                          <Td>
                            <EntityCell
                              name={row.friend?.name}
                              email={row.friend?.email}
                              fallbackName={t("admin.referrals.common.unknownCustomer")}
                            />
                          </Td>
                          <Td>
                            <EntityCell
                              name={row.referrer?.name}
                              email={row.referrer?.email}
                              fallbackName={t("admin.referrals.common.unknownReferrer")}
                              avatar={false}
                            />
                          </Td>
                          <Td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></Td>
                          <TdEnd>
                            <span className="font-semibold tabular-nums text-success">
                              {t("admin.referrals.common.pts", { points: formatNumber(row.referrerPoints, locale) })}
                            </span>
                          </TdEnd>
                          <TdEnd className="whitespace-nowrap text-fg-muted">
                            {formatDate(row.createdAt, locale)}
                          </TdEnd>
                        </Tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </SectionCard>

          <SectionCard
            title={t("admin.referrals.sale.title")}
            subtitle={t("admin.referrals.sale.subtitle")}
            actions={
              <Select
                value={saleStatus}
                onChange={changeSaleStatus}
                options={saleStatusOptions}
                label={t("admin.referrals.sale.filterStatus")}
              />
            }
            footer={
              !query.isLoading && salesPager.total > 0 ? (
                <TableFooter
                  showingLabel={t("admin.referrals.common.showing", {
                    from: formatNumber(salesPager.from, locale),
                    to: formatNumber(salesPager.to, locale),
                    total: formatNumber(salesPager.total, locale),
                  })}
                  page={salesPager.current}
                  pages={salesPager.pages}
                  onPage={setSalePage}
                  prevLabel={t("admin.referrals.common.prev")}
                  nextLabel={t("admin.referrals.common.next")}
                />
              ) : null
            }
          >
            {saleOff ? (
              <div className="px-4 pt-4 sm:px-5">
                <InlineAlert tone="warning" icon={Info}>
                  {t("admin.referrals.sale.offNotice")}{" "}
                  <Link
                    href="/admin/referrals/settings"
                    className="font-semibold underline underline-offset-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t("admin.referrals.sale.offLink")}
                  </Link>
                </InlineAlert>
              </div>
            ) : null}
            {query.isLoading ? (
              <SkeletonRows rows={4} columns={7} />
            ) : salesPager.total === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title={t("admin.referrals.sale.emptyTitle")}
                description={t("admin.referrals.sale.emptyText")}
              />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[920px] border-collapse">
                  <TableHead>
                    <Th>{t("admin.referrals.sale.order")}</Th>
                    <Th>{t("admin.referrals.sale.inviter")}</Th>
                    <Th>{t("admin.referrals.sale.customer")}</Th>
                    <ThEnd>{t("admin.referrals.sale.total")}</ThEnd>
                    <ThEnd>{t("admin.referrals.sale.points")}</ThEnd>
                    <Th>{t("admin.referrals.sale.status")}</Th>
                    <ThEnd>{t("admin.referrals.sale.date")}</ThEnd>
                  </TableHead>
                  <tbody>
                    {salesPager.rows.map((row) => {
                      const status = saleStatusMeta(row.status);
                      return (
                        <Tr key={row.id}>
                          <Td>
                            {row.order?.id ? (
                              <Link
                                href={`/admin/orders/${row.order.id}`}
                                className="font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              >
                                {row.order.number || t("admin.referrals.common.orderRemoved")}
                              </Link>
                            ) : (
                              <span className="font-medium">{t("admin.referrals.common.orderRemoved")}</span>
                            )}
                          </Td>
                          <Td>
                            <EntityCell
                              name={row.referrer?.name}
                              email={row.referrer?.email}
                              fallbackName={t("admin.referrals.common.unknownReferrer")}
                              avatar={false}
                            />
                          </Td>
                          <Td>
                            <EntityCell
                              name={row.order?.customer?.name}
                              email={row.order?.customer?.email}
                              fallbackName={t("admin.referrals.common.unknownCustomer")}
                              avatar={false}
                            />
                          </Td>
                          <TdEnd className="tabular-nums">
                            {row.order?.total != null ? `Rs ${formatNumber(row.order.total, locale)}` : "—"}
                          </TdEnd>
                          <TdEnd>
                            {row.status === "reversed" ? (
                              <span className="text-fg-muted line-through">
                                {t("admin.referrals.common.pts", { points: formatNumber(row.reversedPoints, locale) })}
                              </span>
                            ) : (
                              <span className="font-semibold tabular-nums text-success">
                                {t("admin.referrals.common.pts", { points: formatNumber(row.points, locale) })}
                              </span>
                            )}
                          </TdEnd>
                          <Td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></Td>
                          <TdEnd className="whitespace-nowrap text-fg-muted">
                            {formatDate(row.createdAt, locale)}
                          </TdEnd>
                        </Tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
