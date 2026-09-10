"use client";
import React, { useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Tag, Activity, Clock, User, Percent, Layers, Target,
  Edit3, Trash2, Plus, Pencil, AlertTriangle, DollarSign, Calendar,
  TrendingUp, Hash, Box, Eye, CheckCircle2, Zap, Shield, Award,
  Package, Gift, Truck, Sparkles
} from "lucide-react";
import { dealApi } from "../../../../apis/admin/dealApi";
import { productApi } from "../../../../apis/admin/productApi";
import { categoryApi } from "../../../../apis/admin/categoryApi";
import { brandApi } from "../../../../apis/admin/brandApi";
import useDealSocketSync from "@/hooks/useDealSocketSync";

/* =========================================================
   HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function fd(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fdt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function tago(date) {
  if (!date) return "";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : fd(date);
}

function getDealStatus(deal) {
  if (deal?.isActive === false) return "disabled";
  const now = new Date();
  const start = deal?.startDate ? new Date(deal.startDate) : null;
  const end = deal?.endDate ? new Date(deal.endDate) : null;
  if (start && start > now) return "scheduled";
  if (end && end < now) return "expired";
  return "active";
}

function formatDealValue(deal) {
  const type = deal?.type || "";
  const value = Number(deal?.discountValue ?? 0);
  switch (type) {
    case "percentage": return `${value}% OFF`;
    case "fixed_amount": case "fixed": return `Rs. ${value} OFF`;
    case "buy_x_get_y": return `Buy ${deal.buyQuantity || 1} Get ${deal.getQuantity || 1}`;
    case "bundle": return `Bundle @ Rs. ${deal.bundlePrice || 0}`;
    case "free_shipping": return "Free Shipping";
    default: return value > 0 ? `${value}` : "-";
  }
}

function formatTarget(value) {
  if (!value) return "All Products";
  const map = {
    all: "All Products", product: "Specific Products",
    category: "Categories", brand: "Brands",
  };
  return map[value] || String(value).replace(/\b\w/g, (l) => l.toUpperCase());
}

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusBadge({ status }) {
  const config = {
    active: { bg: "rgba(16,185,129,0.12)", color: "#10b981", border: "rgba(16,185,129,0.3)", label: "ACTIVE" },
    scheduled: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "rgba(59,130,246,0.3)", label: "SCHEDULED" },
    expired: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.3)", label: "EXPIRED" },
    disabled: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.3)", label: "DISABLED" },
  };
  const item = config[status] || config.disabled;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
      {item.label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, subValue, color = "emerald" }) {
  const colors = {
    emerald: { bg: "rgba(16,185,129,0.08)", text: "#10b981", border: "rgba(16,185,129,0.2)" },
    blue: { bg: "rgba(59,130,246,0.08)", text: "#3b82f6", border: "rgba(59,130,246,0.2)" },
    purple: { bg: "rgba(168,85,247,0.08)", text: "#a855f7", border: "rgba(168,85,247,0.2)" },
    amber: { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    red: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.2)" },
  };
  const c = colors[color] || colors.emerald;

  return (
    <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
          <Icon className="w-5 h-5" style={{ color: c.text }} />
        </div>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
      {subValue && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{subValue}</p>}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children, action, bodyClassName = "" }) {
  return (
    <div className="rounded-xl overflow-hidden h-full flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className={`p-5 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function DataRow({ label, value, mono, highlight, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span className={`text-[13px] font-semibold text-right truncate max-w-[60%] ${mono ? "font-mono" : ""}`}
        style={{ color: highlight ? "#10b981" : "var(--text-primary)" }}>{value || "—"}</span>
    </div>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-[10px]", lg: "w-11 h-11 text-xs" };
  const colors = {
    emerald: { bg: "rgba(16,185,129,0.12)", text: "#10b981" },
    blue: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
    purple: { bg: "rgba(168,85,247,0.12)", text: "#a855f7" },
  };
  const c = colors[color] || colors.emerald;

  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ backgroundColor: c.bg, color: c.text }}>
      {ini(user?.name || user?.email || "?")}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
        <Icon className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-[12px] max-w-sm mb-5" style={{ color: "var(--text-muted)" }}>{description}</p>
      {action}
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function DealDetailPage() {
  useDealSocketSync();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();

  const dealId = params.id;
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/deals";

  const [tab, setTab] = useState("info");
  const [showDelete, setShowDelete] = useState(false);

  const { data: deal, isLoading: loading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => dealApi.getById(dealId),
    enabled: !!dealId,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["deal-products"], queryFn: productApi.getAll, staleTime: 60000,
    enabled: !!deal?.applyTo && deal.applyTo === "product" && !!deal.productIds?.length,
  });
  const { data: allCategories = [] } = useQuery({
    queryKey: ["deal-categories"], queryFn: categoryApi.getAll, staleTime: 60000,
    enabled: !!deal?.applyTo && deal.applyTo === "category" && !!deal.categoryIds?.length,
  });
  const { data: allBrands = [] } = useQuery({
    queryKey: ["deal-brands"], queryFn: brandApi.getAll, staleTime: 60000,
    enabled: !!deal?.applyTo && deal.applyTo === "brand" && !!deal.brandIds?.length,
  });

  const deleteMutation = useMutation({
    mutationFn: () => dealApi.delete(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      router.push(backPath);
    },
    onError: (err) => {
      // silent
    },
  });

  const status = deal ? getDealStatus(deal) : "unknown";
  const isActive = status === "active" || status === "scheduled";
  const hasUpdates = Boolean(
    deal && (deal.updated_at || deal.updatedAt) &&
    (deal.created_at || deal.createdAt) &&
    (deal.updated_at || deal.updatedAt) !== (deal.created_at || deal.createdAt)
  );

  // Resolve targeted items
  const selectedProducts = useMemo(() => {
    if (deal?.applyTo !== "product" || !deal?.productIds?.length) return [];
    return allProducts.filter((p) => deal.productIds.includes(p._id || p.id));
  }, [allProducts, deal]);

  const selectedCategories = useMemo(() => {
    if (deal?.applyTo !== "category" || !deal?.categoryIds?.length) return [];
    return allCategories.filter((c) => deal.categoryIds.includes(c._id || c.id));
  }, [allCategories, deal]);

  const selectedBrands = useMemo(() => {
    if (deal?.applyTo !== "brand" || !deal?.brandIds?.length) return [];
    return allBrands.filter((b) => deal.brandIds.includes(b._id || b.id));
  }, [allBrands, deal]);

  const targetCount =
    deal?.applyTo === "product" ? selectedProducts.length :
    deal?.applyTo === "category" ? selectedCategories.length :
    deal?.applyTo === "brand" ? selectedBrands.length : 0;

  // Loading
  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Loading deal details...</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "#ef4444" }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Deal Not Found</h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>This deal does not exist or has been removed.</p>
          <button onClick={() => router.push(backPath)} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <ArrowLeft className="w-4 h-4" /> Back to Deals
          </button>
        </div>
      </div>
    );
  }

  const creator = deal.createdby || deal.createdBy || null;
  const editor = deal.updatedby || deal.updatedBy || null;

  const tabList = [
    { id: "info", label: "Overview", icon: Eye },
    { id: "offer", label: "Offer Rules", icon: Gift },
    { id: "activity", label: "Activity", icon: Activity, badge: hasUpdates ? "2" : "1" },
  ];

  return (
    <div className="w-full pb-8 space-y-6">
      {/* HEADER */}
      <div>
        <button onClick={() => router.push(backPath)} className="flex items-center gap-2 text-[12px] font-medium mb-4 hover:opacity-80 transition" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Deals
        </button>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Icon */}
              <div className="w-full lg:w-48 shrink-0">
                <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <Tag className="w-20 h-20" style={{ color: "var(--accent)" }} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="text-2xl md:text-3xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{deal.name}</h1>
                      <StatusBadge status={status} />
                      {deal.isFeatured && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                          <Sparkles className="w-3 h-3" /> Featured
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {deal.code ? (
                        <>
                          <span className="flex items-center gap-1.5 font-mono"><Hash className="w-3.5 h-3.5" />{deal.code}</span>
                          <span className="opacity-50">•</span>
                        </>
                      ) : null}
                      <span className="flex items-center gap-1.5 font-bold" style={{ color: "#10b981" }}>
                        <Percent className="w-3.5 h-3.5" /> {formatDealValue(deal)}
                      </span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{formatTarget(deal.applyTo)}</span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fd(deal.startDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => router.push(backPath)} className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={() => router.push(`${backPath}?edit=${dealId}`)} className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      <Edit3 className="w-4 h-4" /> Edit Deal
                    </button>
                    <button disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}
                      className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Value</p>
                    <p className="text-[14px] font-bold" style={{ color: "#10b981" }}>{formatDealValue(deal)}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Target</p>
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{formatTarget(deal.applyTo)}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Usage</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {deal.usageLimit ? `${deal.usageCount || 0} / ${deal.usageLimit}` : "Unlimited"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Priority</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{deal.priority || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl p-1.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", scrollbarWidth: "none" }}>
        {tabList.map((tb) => {
          const active = tab === tb.id;
          const Icon = tb.icon;
          return (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              className="relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                backgroundColor: active ? "var(--bg-card)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-muted)",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                border: active ? "1px solid var(--border-color)" : "1px solid transparent",
              }}>
              <Icon className="w-4 h-4" />
              {tb.label}
              {tb.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                  style={{ backgroundColor: active ? "var(--accent-soft)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  {tb.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "info" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Percent} label="Discount" value={formatDealValue(deal)} color="emerald" />
            <MetricCard icon={Target} label="Targets" value={targetCount === 0 && deal.applyTo === "all" ? "All" : String(targetCount || "All")} subValue={formatTarget(deal.applyTo)} color="blue" />
            <MetricCard icon={TrendingUp} label="Usage" value={String(deal.usageCount || 0)} subValue={deal.usageLimit ? `of ${deal.usageLimit}` : "Unlimited"} color="purple" />
            <MetricCard
              icon={Calendar}
              label="Duration"
              value={fd(deal.startDate).replace(/, \d{4}/, "")}
              subValue={`→ ${fd(deal.endDate).replace(/, \d{4}/, "")}`}
              color="amber"
            />
          </div>

          {/* Info LEFT + Description RIGHT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard icon={Tag} title="Deal Information">
              <div className="space-y-1">
                <DataRow icon={Hash} label="Deal Name" value={deal.name} />
                <DataRow icon={Hash} label="Deal Code" value={deal.code || "—"} mono />
                <DataRow icon={Target} label="Target Type" value={formatTarget(deal.applyTo)} />
                <DataRow icon={Percent} label="Deal Value" value={formatDealValue(deal)} highlight />
                <DataRow icon={Activity} label="Status" value={status.toUpperCase()} highlight={status === "active"} />
                <DataRow icon={Sparkles} label="Featured" value={deal.isFeatured ? "Yes" : "No"} highlight={deal.isFeatured} />
              </div>
            </InfoCard>

            <InfoCard icon={Activity} title="Description" bodyClassName="flex flex-col">
              {deal.description ? (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>
                  {deal.description}
                </p>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState icon={Activity} title="No Description" description="No description has been provided for this deal." />
                </div>
              )}
            </InfoCard>
          </div>

          {/* Created & Updated — single card */}
          <InfoCard icon={User} title="Created & Updated">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Created By</p>
                {creator ? (
                  <div className="flex items-center gap-3">
                    <Avatar user={creator} size="lg" color="emerald" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {creator.name || creator.email}
                      </p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{creator.email}</p>
                      <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                        {fd(deal.created_at || deal.createdAt)} · {tago(deal.created_at || deal.createdAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>System</p>
                )}
              </div>
              <div className="md:border-l md:pl-6" style={{ borderColor: "var(--border-color)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Last Updated</p>
                {hasUpdates ? (
                  editor ? (
                    <div className="flex items-center gap-3">
                      <Avatar user={editor} size="lg" color="blue" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {editor.name || editor.email}
                        </p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{editor.email}</p>
                        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                          {fd(deal.updated_at || deal.updatedAt)} · {tago(deal.updated_at || deal.updatedAt)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {fd(deal.updated_at || deal.updatedAt)} · {tago(deal.updated_at || deal.updatedAt)}
                    </p>
                  )
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    No updates yet — deal has not been modified since creation.
                  </p>
                )}
              </div>
            </div>
          </InfoCard>

          {/* Schedule & Limits */}
          <InfoCard icon={Clock} title="Schedule & Limits">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              <DataRow icon={Calendar} label="Start Date" value={fdt(deal.startDate)} />
              <DataRow icon={Calendar} label="End Date" value={fdt(deal.endDate)} />
              <DataRow icon={TrendingUp} label="Total Usage Limit" value={deal.usageLimit ? String(deal.usageLimit) : "Unlimited"} mono />
              <DataRow icon={User} label="Per User Limit" value={deal.perUserLimit ? String(deal.perUserLimit) : "Unlimited"} mono />
              <DataRow icon={DollarSign} label="Min Order Value" value={deal.minOrderValue ? `Rs. ${deal.minOrderValue}` : "None"} />
              <DataRow icon={Package} label="Min Quantity" value={deal.minQuantity ? String(deal.minQuantity) : "None"} />
            </div>
          </InfoCard>
        </div>
      )}

      {/* OFFER RULES TAB */}
      {tab === "offer" && (
        <div className="space-y-6">
          {/* Type-specific configuration */}
          <InfoCard icon={Percent} title="Discount Configuration">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <p className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Discount Type</p>
                <p className="text-[16px] font-bold capitalize" style={{ color: "var(--text-primary)" }}>
                  {deal.type?.replace(/_/g, " ") || "—"}
                </p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <p className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Offer Value</p>
                <p className="text-[16px] font-bold" style={{ color: "#10b981" }}>{formatDealValue(deal)}</p>
              </div>
            </div>

            {/* Buy X Get Y */}
            {deal.type === "buy_x_get_y" && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <Box className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Buy Quantity</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{deal.buyQuantity}</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <Gift className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Get Quantity</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{deal.getQuantity}</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <Percent className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Discount</p>
                  <p className="text-2xl font-bold" style={{ color: "#10b981" }}>{deal.getDiscountValue || 100}%</p>
                </div>
              </div>
            )}

            {/* Bundle */}
            {deal.type === "bundle" && (
              <div className="p-5 rounded-lg text-center mb-6" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <Gift className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                <p className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Bundle Fixed Price</p>
                <p className="text-3xl font-bold" style={{ color: "#10b981" }}>Rs. {deal.bundlePrice}</p>
              </div>
            )}

            {/* Free Shipping */}
            {deal.type === "free_shipping" && (
              <div className="p-5 rounded-lg text-center mb-6" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <Truck className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                <p className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Free Shipping Offer</p>
                <p className="text-2xl font-bold" style={{ color: "#10b981" }}>Free Shipping</p>
                {deal.minOrderValue && (
                  <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>On orders above Rs. {deal.minOrderValue}</p>
                )}
              </div>
            )}

            {/* Conditions */}
            <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Conditions</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                <DataRow icon={DollarSign} label="Min Order Value" value={deal.minOrderValue ? `Rs. ${deal.minOrderValue}` : "None"} />
                <DataRow icon={Package} label="Min Quantity" value={deal.minQuantity ? String(deal.minQuantity) : "None"} />
                <DataRow icon={TrendingUp} label="Usage Limit" value={deal.usageLimit ? String(deal.usageLimit) : "Unlimited"} />
                <DataRow icon={User} label="Per User Limit" value={deal.perUserLimit ? String(deal.perUserLimit) : "Unlimited"} />
              </div>
            </div>
          </InfoCard>

          {/* Applied Targets */}
          <InfoCard icon={Target} title="Applied Targets">
            <div className="p-4 rounded-lg mb-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Applies To</p>
              <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{formatTarget(deal.applyTo)}</p>
            </div>

            {deal.applyTo === "product" && selectedProducts.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Selected Products ({selectedProducts.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map((p) => (
                    <span key={p._id || p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Box className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {p.name || "Product"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {deal.applyTo === "category" && selectedCategories.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Selected Categories ({selectedCategories.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((c) => (
                    <span key={c._id || c.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Layers className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {c.name || "Category"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {deal.applyTo === "brand" && selectedBrands.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Selected Brands ({selectedBrands.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedBrands.map((b) => (
                    <span key={b._id || b.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Award className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {b.name || "Brand"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {deal.applyTo === "all" && (
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#10b981" }} />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>This deal applies to <strong style={{ color: "var(--text-primary)" }}>all products</strong> in the store automatically.</span>
              </div>
            )}
          </InfoCard>
        </div>
      )}

      {/* ACTIVITY TAB */}
      {tab === "activity" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <InfoCard icon={Activity} title="Activity Timeline">
            <div className="space-y-6">
              {/* Created Event */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16,185,129,0.12)" }}>
                    <Plus className="w-5 h-5" style={{ color: "#10b981" }} />
                  </div>
                  {hasUpdates && <div className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border-color)" }} />}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Deal Created</h4>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Added to the system</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {fd(deal.created_at || deal.createdAt)}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {tago(deal.created_at || deal.createdAt)}
                      </p>
                    </div>
                  </div>
                  {creator && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Avatar user={creator} size="sm" color="emerald" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {creator.name || creator.email}
                        </p>
                        <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{creator.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Updated Event */}
              {hasUpdates ? (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(59,130,246,0.12)" }}>
                      <Pencil className="w-5 h-5" style={{ color: "#3b82f6" }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Deal Updated</h4>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Details were modified</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                          {fd(deal.updated_at || deal.updatedAt)}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {tago(deal.updated_at || deal.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {editor && (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <Avatar user={editor} size="sm" color="blue" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {editor.name || editor.email}
                          </p>
                          <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{editor.email}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                  <Clock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No updates yet — deal has not been modified since creation.</span>
                </div>
              )}
            </div>
          </InfoCard>

          <InfoCard icon={User} title="User Details">
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Creator</p>
                {creator ? (
                  <div className="flex items-center gap-3">
                    <Avatar user={creator} size="md" color="emerald" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {creator.name || creator.email}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{creator.email || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>System</p>
                )}
              </div>

              {hasUpdates && (
                <div className="pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Last Editor</p>
                  {editor ? (
                    <div className="flex items-center gap-3">
                      <Avatar user={editor} size="md" color="blue" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {editor.name || editor.email}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{editor.email || "—"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Unknown</p>
                  )}
                </div>
              )}
            </div>
          </InfoCard>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "#ef4444" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete "{deal.name}"?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The deal will be permanently removed.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                Cancel
              </button>
              <button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Delete Deal</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}