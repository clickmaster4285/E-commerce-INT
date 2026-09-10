"use client";

import React, { useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { discountApi } from "../../../../apis/admin/discountApi";
import useDiscountSocketSync from "../../../../hooks/useDiscountSocketSync";
// import useDiscountActivitySync from "../../../../hooks/useDiscountActivitySync";

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
  check: "M5 13l4 4L19 7",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  chevron: "M9 5l7 7-7 7",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  target: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z",
  percent: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  money: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
};

/* =========================================================
   HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatTarget(value) {
  if (!value) return "All Products";
  const map = {
    all: "All Products",
    specific_products: "Specific Products",
    product: "Specific Products",
    specific_categories: "Categories",
    category: "Categories",
    specific_brands: "Brands",
    brand: "Brands",
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
   UI COMPONENTS (Same as Brand Detail Page)
========================================================= */
function StatusPill({ active }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        backgroundColor: active ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
        color: active ? "var(--success)" : "var(--danger)",
        border: `1px solid ${active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
      }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "var(--success)" : "var(--danger)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="inline-flex min-h-[44px] h-10 md:h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: primary ? "var(--accent)" : danger ? "rgba(239,68,68,.08)" : "var(--bg-tertiary)",
        color: primary ? "var(--accent-text)" : danger ? "var(--danger)" : "var(--text-primary)",
        border: primary ? "none" : danger ? "1px solid rgba(239,68,68,.25)" : "1px solid var(--border-color)",
      }}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, action }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
      {action}
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
export default function DiscountDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();
  const { markSelfAction } = useDiscountSocketSync();

  
  const discountId = params.id;
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/discounts";

  // useDiscountActivitySync(discountId);

  const [tab, setTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);

  // Fetch Single Discount
  const { data: discount, isLoading: loading } = useQuery({
    queryKey: ["discount", discountId],
    queryFn: () => discountApi.getById(discountId),
    enabled: !!discountId,
  });

  // Delete Mutation
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

  // Derived Data
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

  // Loading State
  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading discount details...</span>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!discount) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Discount Not Found</h2>
          <p className="text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>This discount does not exist or has been deleted.</p>
          <Button primary onClick={() => router.push(backPath)}>Back to Discounts</Button>
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
            <button onClick={() => router.push(backPath)} className="transition hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>Discounts</button>
            <Ico d={D.chevron} className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-primary)" }}>Discount Details</span>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                  <span className="text-xl font-semibold" style={{ color: "var(--accent)" }}>
                    <Ico d={D.percent} className="w-7 h-7" sw={1.5} />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{discount.name || "Untitled Discount"}</h1>
                    <StatusPill active={isActive} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {discount.code && <span className="font-mono">{discount.code}</span>}
                    {discount.code && <span>•</span>}
                    <span>{formatDiscountValue(discount)}</span>
                    <span>•</span>
                    <span>{formatTarget(discount.applyTo || discount.target_type)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => router.push(backPath)}><Ico d={D.back} className="h-3.5 w-3.5" /> Back</Button>
                <Button danger disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete</Button>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)" }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "rules", label: "Offer Rules" },
            { id: "activity", label: "Activity", badge: hasUpdates ? 2 : 1 },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)}
                className="relative flex items-center gap-2 py-3 text-[12px] font-medium whitespace-nowrap"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                {item.label}
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px]" style={{ backgroundColor: active ? "rgba(16,185,129,.10)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                    {item.badge}
                  </span>
                )}
                {active && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
            {/* Left column */}
            <div className="space-y-4 min-w-0">
              {/* Discount Information */}
              <Card>
                <CardHeader title="Discount Information" icon={<Ico d={D.tag} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Discount Name" value={discount.name} />
                  <InfoRow label="Coupon Code" value={discount.code} mono />
                  <InfoRow label="Discount Type" value={discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
                  <InfoRow label="Discount Value" value={formatDiscountValue(discount)} green />
                  <InfoRow label="Status" value={isActive ? "Active" : "Inactive"} green={isActive} />

                  {/* Created By */}
                  <div className="py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created By</span>
                      <span className="text-[12px] font-medium">{discount.createdBy?.name || "System"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created At</span>
                      <span className="text-[12px]">{formatDateTime(discount.created_at || discount.createdAt)}</span>
                    </div>
                  </div>

                  {/* Updated By */}
                  <div className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated By</span>
                      <span className="text-[12px] font-medium">{discount.updatedBy?.name || (hasUpdates ? "System Admin" : "—")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated At</span>
                      <span className="text-[12px]">{hasUpdates ? formatDateTime(discount.updated_at || discount.updatedAt) : "Never"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader title="Description" icon={<Ico d={D.activity} className="w-4 h-4" />} />
                <div className="p-5">
                  {discount.description ? (
                    <p className="text-[12px] leading-6 whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>{discount.description}</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-8">
                      <Ico d={D.activity} className="w-7 h-7 mb-3" sw={1.4} />
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No description provided.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right column — Quick Summary */}
            <Card>
              <CardHeader title="Quick Summary" icon={<Ico d={D.layers} className="w-4 h-4" />} />
              <div className="px-4">
                <InfoRow label="Apply To" value={formatTarget(discount.applyTo || discount.target_type)} />
                <InfoRow label="Min Order Value" value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} />
                <InfoRow label="Usage Limit" value={discount.usageLimit ? `${discount.usageCount || 0} / ${discount.usageLimit}` : "Unlimited"} />
                <InfoRow label="Per User Limit" value={discount.perUserLimit ? `${discount.perUserLimit}` : "1"} />
                <InfoRow label="Priority" value={discount.priority || "1"} />
                <InfoRow label="Stackable" value={discount.isStackable ? "Yes" : "No"} />
                <InfoRow label="Start Date" value={formatDateTime(discount.startDate || discount.start_at)} />
                <InfoRow label="End Date" value={formatDateTime(discount.endDate || discount.end_at)} />
              </div>
            </Card>
          </div>
        )}

        {/* OFFER RULES TAB */}
        {tab === "rules" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Discount Rules */}
              <Card>
                <CardHeader title="Discount Rules" icon={<Ico d={D.percent} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Discount Type" value={discount.type === "percentage" ? "Percentage (%)" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
                  <InfoRow label="Discount Value" value={formatDiscountValue(discount)} green />
                  {discount.maxDiscountAmount && (
                    <InfoRow label="Max Discount Cap" value={`Rs. ${discount.maxDiscountAmount}`} />
                  )}
                  <InfoRow label="Min Order Value" value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} />
                  <InfoRow label="Min Quantity" value={discount.minQuantity || "No minimum"} />
                  <InfoRow label="Priority" value={discount.priority || "1"} />
                  <InfoRow label="Stackable" value={discount.isStackable ? "Yes" : "No"} />
                </div>
              </Card>

              {/* Usage Limits */}
              <Card>
                <CardHeader title="Usage Limits" icon={<Ico d={D.clock} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Total Usage Limit" value={discount.usageLimit ? String(discount.usageLimit) : "Unlimited"} />
                  <InfoRow label="Usage Count" value={String(discount.usageCount || 0)} />
                  <InfoRow label="Per User Limit" value={discount.perUserLimit ? String(discount.perUserLimit) : "1"} />
                  <InfoRow label="Status" value={discount.status || "draft"} green={isActive} />
                  <InfoRow label="Is Active" value={discount.isActive ? "Yes" : "No"} green={discount.isActive} />
                </div>
              </Card>

              {/* Applied Targets */}
              <Card className="lg:col-span-2">
                <CardHeader title="Applied Targets" icon={<Ico d={D.target} className="w-4 h-4" />} />
                <div className="p-4">
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Applies To</p>
                    <p className="text-[13px] font-semibold">{formatTarget(discount.applyTo || discount.target_type)}</p>
                  </div>

                  {/* Products List */}
                  {discount.selectedProducts?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Selected Products ({discount.selectedProducts.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {discount.selectedProducts.map((product) => (
                          <span key={product._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            {product.name || "Product"}
                            {product.sku && <span className="text-[9px] opacity-60">({product.sku})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Categories List */}
                  {discount.selectedCategories?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Selected Categories ({discount.selectedCategories.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {discount.selectedCategories.map((cat) => (
                          <span key={cat._id} className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            {cat.name || "Category"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brands List */}
                  {discount.selectedBrands?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Selected Brands ({discount.selectedBrands.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {discount.selectedBrands.map((brand) => (
                          <span key={brand._id} className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            {brand.name || "Brand"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Targets */}
                  {!discount.selectedProducts?.length && !discount.selectedCategories?.length && !discount.selectedBrands?.length && (
                    <div className="mt-3 text-center py-4">
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>This discount applies to all products.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <Card>
              <CardHeader title="Activity Timeline" icon={<Ico d={D.activity} className="w-4 h-4" />} />
              <div className="p-5 space-y-6">

                {/* Created Event */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,.10)", color: "var(--accent)" }}>
                      <Ico d={D.plus} className="w-4 h-4" />
                    </div>
                    {hasUpdates && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-color)" }} />}
                  </div>
                  <div className="pb-2">
                    <p className="text-[13px] font-medium">Discount Created</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Created by <span className="font-semibold text-[var(--text-primary)]">{discount.createdBy?.name || "System"}</span>
                      {discount.createdBy?.email && <span className="block text-[10px] opacity-70">{discount.createdBy.email}</span>}
                    </p>
                    <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(discount.created_at || discount.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Updated Event */}
                {hasUpdates ? (
                  <div className="flex gap-4">
                    <div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,.10)", color: "#60a5fa" }}>
                        <Ico d={D.pencil} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Discount Updated</p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Updated by <span className="font-semibold text-[var(--text-primary)]">{discount.updatedBy?.name || "System Admin"}</span>
                        {discount.updatedBy?.email && <span className="block text-[10px] opacity-70">{discount.updatedBy.email}</span>}
                      </p>
                      <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                        {formatDateTime(discount.updated_at || discount.updatedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ml-11 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No updates recorded yet.</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Activity Info Side Panel */}
            <Card>
              <CardHeader title="User Details" icon={<Ico d={D.user} className="w-4 h-4" />} />
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Creator</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                      {ini(discount.createdBy?.name)}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{discount.createdBy?.name || "System Admin"}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{discount.createdBy?.email || "—"}</p>
                    </div>
                  </div>
                </div>

                {hasUpdates && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Last Editor</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                        {ini(discount.updatedBy?.name)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium">{discount.updatedBy?.name || "System Admin"}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{discount.updatedBy?.email || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5 max-h-[90vh] overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,.10)", color: "#f87171" }}>
                <Ico d={D.warn} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Delete Discount?</h3>
                <p className="text-[11px] mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span style={{ color: "var(--text-primary)" }}>{discount.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-5">
              <Button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button danger disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> Deleting...</> : <><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete Discount</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
