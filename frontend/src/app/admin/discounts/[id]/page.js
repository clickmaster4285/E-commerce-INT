"use client";

import React, { useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Tag, Activity, Clock, User, Percent, Layers, Target,
  Edit3, Trash2, Plus, Pencil, AlertTriangle, DollarSign, Calendar,
  TrendingUp, Hash, Box, Eye, CheckCircle2, XCircle, Zap, Shield
} from "lucide-react";
import { discountApi } from "../../../../apis/admin/discountApi";
import useDiscountSocketSync from "../../../../hooks/useDiscountSocketSync";

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

function formatTarget(value) {
  if (!value) return "All Products";
  const map = {
    all: "All Products", all_products: "All Products",
    specific_products: "Specific Products", product: "Specific Products",
    specific_categories: "Categories", category: "Categories",
    specific_brands: "Brands", brand: "Brands",
    price_range: "Price Range",
  };
  return map[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDiscountValue(discount) {
  const type = discount?.type || "percentage";
  const value = discount?.value ?? 0;
  if (type === "percentage") return `${value}%`;
  if (type === "fixed") return `Rs. ${value}`;
  if (type === "fixed_price") return `Fixed Rs. ${value}`;
  return `Rs. ${value}`;
}

function getDiscountStatus(discount) {
  if (discount?.status) return discount.status;
  if (discount?.isActive === false) return "inactive";
  const end = discount?.endDate || discount?.end_at;
  if (end && new Date(end) < new Date()) return "expired";
  return "active";
}

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusBadge({ active, label }) {
  const displayLabel = label || (active ? "Active" : "Inactive");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        color: active ? "#10b981" : "#ef4444",
        border: `1px solid ${active ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "#10b981" : "#ef4444" }} />
      {displayLabel}
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
export default function DiscountDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();
  const { markSelfAction } = useDiscountSocketSync();

  const discountId = params.id;
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/discounts";

  const [tab, setTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);

  const { data: discount, isLoading: loading } = useQuery({
    queryKey: ["discount", discountId],
    queryFn: () => discountApi.getById(discountId),
    enabled: !!discountId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      markSelfAction("delete");
      return discountApi.delete(discountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success("Discount deleted successfully");
      router.push(backPath);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete discount");
    },
  });

  const isActive = getDiscountStatus(discount) === "active" || getDiscountStatus(discount) === "scheduled";
  const hasUpdates = Boolean(discount?.created_at && discount?.updated_at && discount.created_at !== discount.updated_at);
  
  const targetCount = useMemo(() => {
    if (!discount) return 0;
    const applyTo = discount.applyTo || discount.target_type || "all";
    if (applyTo === "all" || applyTo === "all_products") return 0;
    if (discount.selectedProducts?.length) return discount.selectedProducts.length;
    if (discount.selectedCategories?.length) return discount.selectedCategories.length;
    if (discount.selectedBrands?.length) return discount.selectedBrands.length;
    if (discount.selected_product_ids?.length) return discount.selected_product_ids.length;
    if (discount.selected_category_ids?.length) return discount.selected_category_ids.length;
    if (discount.selected_brand_ids?.length) return discount.selected_brand_ids.length;
    return 0;
  }, [discount]);

  const targetLabel = useMemo(() => {
    if (!discount) return "Targets";
    const applyTo = discount.applyTo || discount.target_type || "all";
    if (applyTo === "all" || applyTo === "all_products") return "All Products";
    if (applyTo === "specific_products" || applyTo === "product") return "Products";
    if (applyTo === "specific_categories" || applyTo === "category") return "Categories";
    if (applyTo === "specific_brands" || applyTo === "brand") return "Brands";
    return "Targets";
  }, [discount]);

  // Loading
  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Loading discount details...</p>
        </div>
      </div>
    );
  }

  // Not Found
  if (!discount) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "#ef4444" }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Discount Not Found</h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>This discount does not exist or has been deleted.</p>
          <button onClick={() => router.push(backPath)} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <ArrowLeft className="w-4 h-4" /> Back to Discounts
          </button>
        </div>
      </div>
    );
  }

  const tabList = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "rules", label: "Offer Rules", icon: Shield, badge: null },
    { id: "activity", label: "Activity", icon: Activity, badge: hasUpdates ? "2" : "1" },
  ];

  return (
    <div className="w-full pb-8 space-y-6">
      {/* HEADER */}
      <div>
        <button onClick={() => router.push(backPath)} className="flex items-center gap-2 text-[12px] font-medium mb-4 hover:opacity-80 transition" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Discounts
        </button>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Icon */}
              <div className="w-full lg:w-48 shrink-0">
                <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <Percent className="w-20 h-20" style={{ color: "var(--accent)" }} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="text-2xl md:text-3xl font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {discount.name || "Untitled Discount"}
                      </h1>
                      <StatusBadge active={isActive} label={getDiscountStatus(discount).toUpperCase()} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {discount.code && (
                        <>
                          <span className="flex items-center gap-1.5 font-mono"><Hash className="w-3.5 h-3.5" />{discount.code}</span>
                          <span className="opacity-50">•</span>
                        </>
                      )}
                      <span className="flex items-center gap-1.5 font-bold" style={{ color: "#10b981" }}>
                        <Percent className="w-3.5 h-3.5" /> {formatDiscountValue(discount)}
                      </span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{formatTarget(discount.applyTo || discount.target_type)}</span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fd(discount.startDate || discount.start_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => router.push(backPath)} className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <ArrowLeft className="w-4 h-4" /> Back
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
                    <p className="text-[14px] font-bold" style={{ color: "#10b981" }}>{formatDiscountValue(discount)}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Apply To</p>
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{formatTarget(discount.applyTo || discount.target_type)}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Usage</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {discount.usageLimit ? `${discount.usageCount || 0} / ${discount.usageLimit}` : "Unlimited"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Priority</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{discount.priority || "1"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)", scrollbarWidth: "none" }}>
        {tabList.map((tb) => {
          const active = tab === tb.id;
          const Icon = tb.icon;
          return (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              className="relative flex items-center gap-2 whitespace-nowrap pb-2.5 text-[12px] font-semibold transition-all bg-transparent border-none shadow-none"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}>
              <Icon className="w-4 h-4" />
              {tb.label}
              {tb.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                  style={{ backgroundColor: active ? "var(--accent-soft)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  {tb.badge}
                </span>
              )}
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-all" style={{ backgroundColor: active ? "var(--accent)" : "transparent" }} />
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Percent} label="Discount Type" value={discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed" : "Fixed Price"} color="emerald" />
            <MetricCard icon={DollarSign} label="Value" value={formatDiscountValue(discount)} color="blue" />
            <MetricCard icon={Target} label="Targets" value={targetCount === 0 ? "All" : String(targetCount)} subValue={targetLabel} color="purple" />
            <MetricCard icon={TrendingUp} label="Usage" value={String(discount.usageCount || 0)} subValue={discount.usageLimit ? `of ${discount.usageLimit}` : "Unlimited"} color="amber" />
          </div>

                   {/* ✅ Discount Info LEFT + Description RIGHT — equal height */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard icon={Tag} title="Discount Information">
              <div className="space-y-1">
                <DataRow icon={Hash} label="Discount Name" value={discount.name} />
                <DataRow icon={Hash} label="Coupon Code" value={discount.code || "—"} mono />
                <DataRow icon={Percent} label="Discount Type" value={discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
                <DataRow icon={DollarSign} label="Discount Value" value={formatDiscountValue(discount)} highlight />
                <DataRow icon={Activity} label="Status" value={getDiscountStatus(discount).toUpperCase()} highlight={isActive} />
                <DataRow icon={Zap} label="Priority" value={discount.priority || "1"} />
                <DataRow icon={Shield} label="Stackable" value={discount.isStackable ? "Yes" : "No"} />
              </div>
            </InfoCard>

                       <InfoCard icon={Activity} title="Description" bodyClassName="flex flex-col">
              {discount.description ? (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>
                  {discount.description}
                </p>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState icon={Activity} title="No Description" description="No description has been provided for this discount." />
                </div>
              )}
            </InfoCard>
          </div>

                 {/* ✅ Created + Updated — single card, andar 2 columns = hamesha aligned */}
          <InfoCard icon={User} title="Created & Updated">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Created By</p>
                {discount.createdBy ? (
                  <div className="flex items-center gap-3">
                    <Avatar user={discount.createdBy} size="lg" color="emerald" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{discount.createdBy.name || discount.createdBy.email}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{discount.createdBy.email}</p>
                      <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{fd(discount.created_at || discount.createdAt)} · {tago(discount.created_at || discount.createdAt)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>System</p>
                )}
              </div>
              <div className="md:border-l md:pl-6" style={{ borderColor: "var(--border-color)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Last Updated</p>
                {hasUpdates ? (
                  discount.updatedBy ? (
                    <div className="flex items-center gap-3">
                      <Avatar user={discount.updatedBy} size="lg" color="blue" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{discount.updatedBy.name || discount.updatedBy.email}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{discount.updatedBy.email}</p>
                        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{fd(discount.updated_at || discount.updatedAt)} · {tago(discount.updated_at || discount.updatedAt)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{fd(discount.updated_at || discount.updatedAt)} · {tago(discount.updated_at || discount.updatedAt)}</p>
                  )
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No updates yet — discount has not been modified since creation.</p>
                )}
              </div>
            </div>
          </InfoCard>

          {/* Quick Summary Card */}
          <InfoCard icon={Layers} title="Quick Summary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              <DataRow icon={Target} label="Apply To" value={formatTarget(discount.applyTo || discount.target_type)} />
              <DataRow icon={DollarSign} label="Min Order Value" value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} />
              <DataRow icon={TrendingUp} label="Usage Limit" value={discount.usageLimit ? `${discount.usageCount || 0} / ${discount.usageLimit}` : "Unlimited"} />
              <DataRow icon={User} label="Per User Limit" value={discount.perUserLimit ? String(discount.perUserLimit) : "1"} />
              <DataRow icon={Zap} label="Priority" value={discount.priority || "1"} />
              <DataRow icon={Shield} label="Stackable" value={discount.isStackable ? "Yes" : "No"} />
              <DataRow icon={Calendar} label="Start Date" value={fd(discount.startDate || discount.start_at)} />
              <DataRow icon={Calendar} label="End Date" value={fd(discount.endDate || discount.end_at)} />
            </div>
          </InfoCard>
        </div>
      )}

      {/* OFFER RULES TAB */}
      {tab === "rules" && (
               <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard icon={Percent} title="Discount Rules">
              <div className="space-y-1">
                <DataRow icon={Percent} label="Discount Type" value={discount.type === "percentage" ? "Percentage (%)" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
                <DataRow icon={DollarSign} label="Discount Value" value={formatDiscountValue(discount)} highlight />
                {discount.maxDiscountAmount && (
                  <DataRow icon={Shield} label="Max Discount Cap" value={`Rs. ${discount.maxDiscountAmount}`} />
                )}
                <DataRow icon={DollarSign} label="Min Order Value" value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} />
                <DataRow icon={Box} label="Min Quantity" value={discount.minQuantity ? String(discount.minQuantity) : "No minimum"} />
                <DataRow icon={Zap} label="Priority" value={discount.priority || "1"} />
                <DataRow icon={Shield} label="Stackable" value={discount.isStackable ? "Yes" : "No"} />
              </div>
            </InfoCard>

            <InfoCard icon={Clock} title="Usage Limits">
              <div className="space-y-1">
                <DataRow icon={TrendingUp} label="Total Usage Limit" value={discount.usageLimit ? String(discount.usageLimit) : "Unlimited"} />
                <DataRow icon={Hash} label="Usage Count" value={String(discount.usageCount || 0)} />
                <DataRow icon={User} label="Per User Limit" value={discount.perUserLimit ? String(discount.perUserLimit) : "1"} />
                <DataRow icon={Activity} label="Status" value={discount.status || "draft"} highlight={isActive} />
                <DataRow icon={CheckCircle2} label="Is Active" value={discount.isActive ? "Yes" : "No"} highlight={discount.isActive} />
              </div>
            </InfoCard>
          </div>

          <InfoCard icon={Target} title="Applied Targets">
            <div className="p-4 rounded-lg mb-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Applies To</p>
              <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                {formatTarget(discount.applyTo || discount.target_type)}
              </p>
            </div>

            {discount.selectedProducts?.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Selected Products ({discount.selectedProducts.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {discount.selectedProducts.map((product) => (
                    <span key={product._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Box className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {product.name || "Product"}
                      {product.sku && <span className="text-[9px] font-mono opacity-60">({product.sku})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {discount.selectedCategories?.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Selected Categories ({discount.selectedCategories.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {discount.selectedCategories.map((cat) => (
                    <span key={cat._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Layers className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {cat.name || "Category"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {discount.selectedBrands?.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Selected Brands ({discount.selectedBrands.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {discount.selectedBrands.map((brand) => (
                    <span key={brand._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Tag className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {brand.name || "Brand"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!discount.selectedProducts?.length && !discount.selectedCategories?.length && !discount.selectedBrands?.length && (
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#10b981" }} />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>This discount applies to all products automatically.</span>
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
                      <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Discount Created</h4>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Added to the system</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {fd(discount.created_at || discount.createdAt)}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {tago(discount.created_at || discount.createdAt)}
                      </p>
                    </div>
                  </div>
                  {discount.createdBy && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Avatar user={discount.createdBy} size="sm" color="emerald" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {discount.createdBy.name || discount.createdBy.email}
                        </p>
                        <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{discount.createdBy.email}</p>
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
                        <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Discount Updated</h4>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Details were modified</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                          {fd(discount.updated_at || discount.updatedAt)}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {tago(discount.updated_at || discount.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {discount.updatedBy && (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <Avatar user={discount.updatedBy} size="sm" color="blue" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {discount.updatedBy.name || discount.updatedBy.email}
                          </p>
                          <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{discount.updatedBy.email}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                  <Clock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No updates yet — discount has not been modified since creation.</span>
                </div>
              )}
            </div>
          </InfoCard>

          <InfoCard icon={User} title="User Details">
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Creator</p>
                {discount.createdBy ? (
                  <div className="flex items-center gap-3">
                    <Avatar user={discount.createdBy} size="md" color="emerald" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {discount.createdBy.name || discount.createdBy.email}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{discount.createdBy.email || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>System</p>
                )}
              </div>

              {hasUpdates && (
                <div className="pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Last Editor</p>
                  {discount.updatedBy ? (
                    <div className="flex items-center gap-3">
                      <Avatar user={discount.updatedBy} size="md" color="blue" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {discount.updatedBy.name || discount.updatedBy.email}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{discount.updatedBy.email || "—"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>System Admin</p>
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
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete "{discount.name}"?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The discount will be permanently removed.</p>
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
                  <><Trash2 className="w-4 h-4" /> Delete Discount</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}