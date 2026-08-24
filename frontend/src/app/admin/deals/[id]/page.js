"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dealApi } from "../../../../apis/admin/dealApi"; // Adjust path if needed
import { productApi } from "../../../../apis/productApi";
import useDealSocketSync from "@/hooks/useDealSocketSync"; 
/* =========================================================
   ICON COMPONENTS
========================================================= */
function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d={d} />
    </svg>
  );
}

const D = {
  back: "M15 19l-7-7 7-7",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M16 3.13a4 4 0 010 7.75 M23 21v-2a4 4 0 00-3-3.87",
  chart: "M3 3v18h18",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  chevron: "M9 5l7 7-7 7",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  percent: "M19 5l-14 14M10 5a5 5 0 100 10M14 19a5 5 0 100-10",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  check: "M5 13l4 4L19 7",
};

/* =========================================================
   HELPERS
========================================================= */
function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function getDealStatus(deal) {
  if (!deal?.isActive) return "disabled";
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
    case "fixed_amount": return `Rs. ${value} OFF`;
    case "buy_x_get_y": return `Buy ${deal.buyQuantity || 1} Get ${deal.getQuantity || 1}`;
    case "bundle": return `Bundle @ Rs. ${deal.bundlePrice || 0}`;
    case "free_shipping": return "Free Shipping";
    default: return value > 0 ? `${value}` : "-";
  }
}

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusPill({ status }) {
  const config = {
    active: { bg: "rgba(34,197,94,.10)", color: "var(--success)", border: "rgba(34,197,94,.25)" },
    scheduled: { bg: "rgba(59,130,246,.10)", color: "#60a5fa", border: "rgba(59,130,246,.25)" },
    expired: { bg: "rgba(245,158,11,.10)", color: "#fbbf24", border: "rgba(245,158,11,.25)" },
    disabled: { bg: "rgba(239,68,68,.10)", color: "var(--danger)", border: "rgba(239,68,68,.25)" },
  };
  const item = config[status] || config.disabled;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
      {status}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: primary ? "var(--accent)" : danger ? "rgba(239,68,68,.08)" : "var(--bg-tertiary)",
        color: primary ? "var(--accent-text)" : danger ? "var(--danger)" : "var(--text-primary)",
        border: primary ? "none" : danger ? "1px solid rgba(239,68,68,.25)" : "1px solid var(--border-color)",
        boxShadow: primary ? "0 6px 16px var(--accent-soft)" : "none",
      }}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title }) {
  return (
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
      {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
      <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
    </div>
  );
}

function InfoRow({ label, value, green = false, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`text-[12px] text-right truncate max-w-[62%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function DealDetailPage() {
  useDealSocketSync(); // ✅ Real-time sync enabled
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const dealId = params.id;
  const queryClient = useQueryClient();
  
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/deals";

  const [tab, setTab] = useState("info");
  const [showDelete, setShowDelete] = useState(false);

  // Fetch Deal Details
  const { data: deal, isLoading: loading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => dealApi.getById(dealId), // Ensure this API exists in your dealApi
    enabled: !!dealId,
  });

  // Fetch Related Products (if specific products are targeted)
  const { data: relatedProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["deal-products", dealId],
    queryFn: () => {
      if (deal?.applyTo !== "product" || !deal.productIds?.length) return Promise.resolve([]);
      return productApi.getAll(); // Filter locally or use specific endpoint
    },
    enabled: !!dealId && deal?.applyTo === "product",
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => dealApi.delete(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries(["deals"]);
      router.push(backPath);
    },
  });

  // Derived Data
  const status = deal ? getDealStatus(deal) : "unknown";
  const filteredProducts = relatedProducts.filter(p => deal.productIds?.includes(p._id));
  const targetCount = 
    deal?.applyTo === "product" ? filteredProducts.length :
    deal?.applyTo === "category" ? (deal.categoryIds?.length || 0) :
    deal?.applyTo === "brand" ? (deal.brandIds?.length || 0) : "All";

  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2"><Spin className="w-5 h-5" /><span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading deal details...</span></div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Deal Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>Back to Deals</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full pb-8" style={{ color: "var(--text-primary)" }}>
      <div className="space-y-6">
        
        {/* HEADER */}
        <div>
          <div className="mb-4 flex items-center gap-2 text-[12px]">
            <button onClick={() => router.push(backPath)} className="transition hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>Deals</button>
            <Ico d={D.chevron} className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-primary)" }}>Deal Details</span>
          </div>

          <div className="rounded-2xl p-5 sm:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {/* Deal Icon Placeholder */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl" 
                  style={{ backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 0 0 4px rgba(16,185,129,0.05)" }}>
                  <Ico d={D.tag} className="h-8 w-8" style={{ color: "var(--accent)" }} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{deal.name}</h1>
                    <StatusPill status={status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    <span className="font-mono">{deal.code || "No Code"}</span>
                    <span>•</span>
                    <span className="font-semibold" style={{ color: "#34d399" }}>{formatDealValue(deal)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => router.push(backPath)}><Ico d={D.back} className="h-3.5 w-3.5" /> Back</Button>
                <Button primary onClick={() => router.push(`${backPath}?edit=${dealId}`)}>
                  <Ico d={D.edit} className="h-3.5 w-3.5" /> Edit Deal
                </Button>
                <Button danger disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}>
                  <Ico d={D.trash} className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY STRIP */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.check} className="h-3.5 w-3.5" /> Current Status</div>
            <StatusPill status={status} />
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.users} className="h-3.5 w-3.5" /> Target Count</div>
            <p className="text-2xl font-bold tracking-tight">{targetCount}</p>
            <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Applies to {deal.applyTo || "all"}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.calendar} className="h-3.5 w-3.5" /> Start Date</div>
            <p className="text-sm font-semibold">{formatDate(deal.startDate)}</p>
            <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Deal activation</p>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.clock} className="h-3.5 w-3.5" /> End Date</div>
            <p className="truncate text-sm font-semibold">{formatDate(deal.endDate)}</p>
            <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Deal expiration</p>
          </Card>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)" }}>
          {[
            { id: "info", label: "Overview" },
            { id: "offer", label: "Offer Rules" },
            { id: "activity", label: "Activity" },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)}
                className="relative flex items-center gap-2 py-3 text-[12px] font-medium whitespace-nowrap"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                {item.label}
                {active && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Basic Info */}
              <Card>
                <CardHeader title="Deal Information" icon={<Ico d={D.tag} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Deal Name" value={deal.name} />
                  <InfoRow label="Deal Code" value={deal.code} mono />
                  <InfoRow label="Target Type" value={deal.applyTo?.toUpperCase() || "ALL"} />
                  <InfoRow label="Featured" value={deal.isFeatured ? "Yes" : "No"} green={deal.isFeatured} />
                  
                  <div className="py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created By</span>
                      <span className="text-[12px] font-medium">{deal.createdby?.name || "System"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created At</span>
                      <span className="text-[12px]">{formatDateTime(deal.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader title="Description" icon={<Ico d={D.activity} className="w-4 h-4" />} />
                <div className="p-5 min-h-[250px] flex flex-col">
                  {deal.description ? (
                    <p className="text-[12px] leading-6 whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>{deal.description}</p>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Ico d={D.activity} className="w-7 h-7 mb-3" sw={1.4} />
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No description provided.</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Schedule & Limits */}
              <Card>
                <CardHeader title="Schedule & Limits" icon={<Ico d={D.clock} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Start Date" value={formatDateTime(deal.startDate)} />
                  <InfoRow label="End Date" value={formatDateTime(deal.endDate)} />
                  <InfoRow label="Total Usage Limit" value={deal.usageLimit || "Unlimited"} mono />
                  <InfoRow label="Per User Limit" value={deal.perUserLimit || "Unlimited"} mono />
                  <InfoRow label="Min Order Value" value={deal.minOrderValue ? `Rs. ${deal.minOrderValue}` : "None"} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* OFFER RULES TAB */}
        {tab === "offer" && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Discount Configuration" icon={<Ico d={D.percent} className="w-4 h-4" />} />
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Discount Type</p>
                    <p className="text-lg font-bold capitalize">{deal.type?.replace("_", " ") || "—"}</p>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Offer Value</p>
                    <p className="text-lg font-bold" style={{ color: "#34d399" }}>{formatDealValue(deal)}</p>
                  </div>
                </div>

                {deal.type === "buy_x_get_y" && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Buy Qty</p>
                      <p className="text-xl font-bold">{deal.buyQuantity}</p>
                    </div>
                    <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Get Qty</p>
                      <p className="text-xl font-bold">{deal.getQuantity}</p>
                    </div>
                    <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Get Discount</p>
                      <p className="text-xl font-bold">{deal.getDiscountValue}%</p>
                    </div>
                  </div>
                )}

                {deal.type === "bundle" && (
                  <div className="p-4 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Bundle Fixed Price</p>
                    <p className="text-2xl font-bold" style={{ color: "#34d399" }}>Rs. {deal.bundlePrice}</p>
                  </div>
                )}

                <div className="pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                  <p className="text-[11px] font-medium mb-3" style={{ color: "var(--text-muted)" }}>Applied To</p>
                  {deal.applyTo === "all" ? (
                    <p className="text-sm">This deal applies to <span className="font-semibold">ALL PRODUCTS</span> in the store.</p>
                  ) : (
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Specific {deal.applyTo}s are selected. ({targetCount} items)
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <Card>
              <CardHeader title="Activity Timeline" icon={<Ico d={D.activity} className="w-4 h-4" />} />
              <div className="p-5 space-y-6">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,.10)", color: "var(--accent)" }}>
                      <Ico d={D.check} className="w-4 h-4" />
                    </div>
                    <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-color)" }} />
                  </div>
                  <div className="pb-2">
                    <p className="text-[13px] font-medium">Deal Created</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Created by <span className="font-semibold text-[var(--text-primary)]">{deal.createdby?.name || "System"}</span>
                    </p>
                    <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>{formatDateTime(deal.created_at)}</p>
                  </div>
                </div>
                
                {deal.updated_at && deal.updated_at !== deal.created_at && (
                  <div className="flex gap-4">
                    <div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,.10)", color: "#60a5fa" }}>
                        <Ico d={D.edit} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Deal Updated</p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Updated by <span className="font-semibold text-[var(--text-primary)]">{deal.updatedby?.name || "Unknown"}</span>
                      </p>
                      <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>{formatDateTime(deal.updated_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Creator Details" icon={<Ico d={D.users} className="w-4 h-4" />} />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {(deal.createdby?.name || "S")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{deal.createdby?.name || "System Admin"}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{deal.createdby?.email || "admin@store.com"}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,.10)", color: "#f87171" }}>
                <Ico d={D.warn} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Delete Deal?</h3>
                <p className="text-[11px] mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span style={{ color: "var(--text-primary)" }}>{deal.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button danger disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> Deleting...</> : <><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete Deal</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}