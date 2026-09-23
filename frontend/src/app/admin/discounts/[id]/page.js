"use client";

import React, { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Tag, Activity, Clock, User, Percent, Layers, Target,
  Edit3, Trash2, Plus, Pencil, AlertTriangle, DollarSign, Calendar,
  TrendingUp, Hash, Box, CheckCircle2, ShoppingCart, Package, Globe,
  Copy, X
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
  // ✅ Sirf Active/Inactive model — scheduled/expired/disabled/draft sab "inactive"
  const end = discount?.endDate || discount?.end_at;
  const isExpired = end && new Date(end) < new Date();
  if (discount?.isActive === false) return "inactive";
  if (["inactive", "disabled", "draft", "scheduled", "expired"].includes(discount?.status)) return "inactive";
  if (isExpired) return "inactive";
  return "active";
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const toDateInput = (value) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  } catch { return ""; }
}

const dateToISO = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusBadge({ active, label }) {
  const displayLabel = label || (active ? "Active" : "Inactive");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: active ? "var(--success-soft)" : "var(--danger-soft)",
        color: active ? "var(--success)" : "var(--danger)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--success) 28%, transparent)" : "color-mix(in srgb, var(--danger) 28%, transparent)"}`,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "var(--success)" : "var(--danger)" }} />
      {displayLabel}
    </span>
  );
}

function InfoCard({ icon: Icon, title, children, action, bodyClassName = "" }) {
  return (
    <div className="rounded-md overflow-hidden h-full flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-3 py-2.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-3">
          {Icon && (
            <Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />
          )}
          <h3 className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className={`p-3 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function DataRow({ label, value, mono, highlight, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
        <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span className={`text-[10px] font-semibold text-right break-words max-w-[62%] ${mono ? "font-mono" : ""}`}
        style={{ color: highlight ? "var(--success)" : "var(--text-primary)" }}>{value || "—"}</span>
      {action}
    </div>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-[10px]", lg: "w-11 h-11 text-xs" };
  const colors = {
    emerald: { bg: "var(--success-soft)", text: "var(--success)" },
    blue: { bg: "var(--info-soft)", text: "var(--info)" },
    purple: { bg: "var(--purple-soft)", text: "var(--purple)" },
  };
  const c = colors[color] || colors.emerald;

  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ backgroundColor: c.bg, color: c.text }}>
      {ini(user?.name || user?.email || "?")}
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

  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);

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

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const isActive = getDiscountStatus(discount) === "active";
  // "Updated" entry sirf tab jab discount really edit/save hua ho:
  // updateDiscount updatedBy set karta hai; create par wo null rehta hai.
  // (created_at/updated_at snake_case model par exist nahi karte — createdAt/updatedAt use karo)
  const hasUpdates = Boolean(
    discount?.updatedBy ||
    ((discount?.created_at ?? discount?.createdAt) !== undefined &&
      (discount?.updated_at ?? discount?.updatedAt) !== undefined &&
      (discount?.updated_at ?? discount?.updatedAt) !== (discount?.created_at ?? discount?.createdAt))
  );
  
  const editInputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  // ✅ Edit modal — detail page par hi khulta hai (navigation nahi)
  const openEdit = () => {
    const d = discount;
    const rawMinQty = d?.minQuantity;
    const hasMinQty = rawMinQty !== null && rawMinQty !== undefined && rawMinQty !== "";
    setEditForm({
      name: d?.name || "",
      code: d?.code || "",
      description: d?.description || "",
      value_type: d?.type === "fixed" ? "fixed_amount" : (d?.type === "fixed_price" ? "fixed_price" : "percentage"),
      value: d?.value ?? "",
      min_order_amount: d?.minOrderValue ?? "",
      has_min_quantity: hasMinQty,
      min_quantity: hasMinQty ? rawMinQty : "",
      usage_limit: d?.usageLimit ?? "",
      usage_per_customer: d?.perUserLimit ?? "",
      start_at: toDateInput(d?.startDate),
      end_at: toDateInput(d?.endDate),
      status: isActive ? "active" : "disabled",
    });
    setShowEdit(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm) return;
    if (!String(editForm.name || "").trim()) return toast.error("Discount name is required");
    const manualCode = String(editForm.code || "").trim();
    if (!manualCode) return toast.error("Discount code is required");
    if (editForm.value === "" || Number(editForm.value) < 0) return toast.error("Valid discount value is required");
    if (editForm.value_type === "percentage" && Number(editForm.value) > 100) return toast.error("Percentage cannot exceed 100");

    const startDate = editForm.start_at ? dateToISO(editForm.start_at) : new Date().toISOString();
    const endDate = editForm.end_at ? dateToISO(editForm.end_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

    // Existing target preserve karo — selected arrays mat bhejo (backend untouched rakhta hai)
    const applyTo = discount?.applyTo || "all";
    let target_type = "all_products";
    if (applyTo === "specific_products" || applyTo === "product") target_type = "specific_products";
    else if (applyTo === "specific_categories" || applyTo === "category") target_type = "specific_categories";
    else if (applyTo === "specific_brands" || applyTo === "brand") target_type = "brand";

    const payload = {
      name: String(editForm.name).trim(),
      code: manualCode.toUpperCase(),
      description: String(editForm.description || "").trim(),
      target_type,
      value_type: editForm.value_type,
      value: Number(editForm.value),
      min_order_amount: editForm.min_order_amount !== "" ? Number(editForm.min_order_amount) : "",
      min_quantity: editForm.has_min_quantity && editForm.min_quantity ? Number(editForm.min_quantity) : null,
      usage_limit: editForm.usage_limit !== "" ? Number(editForm.usage_limit) : "",
      start_at: startDate,
      end_at: endDate,
      status: editForm.status,
    };
    if (editForm.usage_per_customer !== "") payload.usage_per_customer = Number(editForm.usage_per_customer);

    editMutation.mutate(payload);
  };

  const editMutation = useMutation({
    mutationFn: (payload) => {
      markSelfAction("update");
      return discountApi.update(discountId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount"] });
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success("Discount updated successfully");
      setShowEdit(false);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || "Failed to update discount");
    },
  });

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
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-soft)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "var(--danger)" }} />
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

  return (
    <div className="w-full pb-8 space-y-3">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
          <button onClick={() => router.push(backPath)} className="hover:underline">Discounts</button>
          <span>›</span><span style={{ color: "var(--text-primary)" }}>Discount Details</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>{discount.name || "Untitled Discount"}</h1>
            <div className="flex items-center gap-1.5 mt-1 text-[10px]" style={{ color: "var(--accent)" }}><Tag className="w-3 h-3" /> {discount.code || "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge active={isActive} label={isActive ? "Active" : "Inactive"} />
            <button type="button" onClick={openEdit} className="h-8 px-3 rounded-md text-[10px] font-semibold flex items-center gap-1.5" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Edit3 className="w-3.5 h-3.5" /> Edit</button>
            <button type="button" disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)} className="h-8 px-3 rounded-md text-[10px] font-semibold flex items-center gap-1.5" style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)", color: "var(--danger)" }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 rounded-md overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        {[{ icon: Percent, label: "Discount Type", value: discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed" : "Fixed Price" }, { icon: Calendar, label: "Valid Period", value: `${fd(discount.startDate)} - ${fd(discount.endDate)}` }, { icon: TrendingUp, label: "Usage Limit", value: discount.usageLimit ? String(discount.usageLimit) : "Unlimited" }, { icon: ShoppingCart, label: "Minimum Order Value", value: discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum" }].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2.5 px-3 py-3 border-b md:border-b-0 md:border-r last:border-0" style={{ borderColor: "var(--border-color)" }}><Icon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /><div className="min-w-0"><p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</p><p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{value}</p></div></div>
        ))}
      </div>

      {/* WORKING SECTION TABS */}
      <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)" }}>
        {[["d-overview", "Basic Information"], ["d-target", "Targeting"], ["d-rules", "Conditions"], ["d-usage", "Usage & Limits"], ["d-activity", "History"]].map(([sectionId, label]) => (
          <button key={sectionId} type="button"
            onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="pb-2 text-[10px] font-semibold whitespace-nowrap transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--text-muted)" }}>
            {label}
          </button>
        ))}
      </div>

      <div id="d-overview" className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr_0.9fr] gap-3 items-start scroll-mt-4">
        <div className="space-y-3">
          <InfoCard icon={Tag} title="Basic Information" action={<button type="button" onClick={openEdit} className="text-[9px] font-semibold" style={{ color: "var(--accent)" }}><Edit3 className="w-3 h-3 inline mr-1" /> Edit</button>}>
            <DataRow icon={Hash} label="Code" value={discount.code} mono action={<button type="button" title="Copy code" onClick={() => handleCopy(discount.code)} className="p-1 rounded transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><Copy className="w-3 h-3" /></button>} />
            <DataRow icon={Tag} label="Name" value={discount.name} />
            <DataRow icon={Activity} label="Description" value={discount.description || "—"} />
            <DataRow icon={Percent} label="Type" value={discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
            <DataRow icon={DollarSign} label="Value" value={formatDiscountValue(discount)} highlight />
            <DataRow icon={Target} label="Apply To" value={formatTarget(discount.applyTo)} />
            <DataRow icon={Activity} label="Status" value={isActive ? "Active" : "Inactive"} highlight={isActive} />
          </InfoCard>
          <InfoCard icon={Package} title="Applicable Products" action={<span className="text-[9px]" style={{ color: "var(--accent)" }}>{discount.selectedProducts?.length ? `View All (${discount.selectedProducts.length})` : "Preview"}</span>}>
            {discount.selectedProducts?.length ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{discount.selectedProducts.slice(0, 4).map((product) => <div key={product._id} className="min-w-0"><div className="h-14 rounded-md flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}><Package className="w-6 h-6" style={{ color: "var(--text-muted)" }} /></div><p className="text-[9px] font-semibold truncate mt-1" style={{ color: "var(--text-primary)" }}>{product.name}</p><p className="text-[8px]" style={{ color: "var(--text-muted)" }}>{product.sku || "—"}</p></div>)}</div> : <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>All products</p>}
          </InfoCard>
        </div>

        <div className="space-y-3">
          <InfoCard icon={Calendar} title="Validity Period"><DataRow label="Start Date" value={formatDateTime(discount.startDate)} /><DataRow label="End Date" value={formatDateTime(discount.endDate)} /><p className="text-[8px] text-right mt-2" style={{ color: "var(--text-muted)" }}>{Math.max(0, Math.ceil((new Date(discount.endDate) - new Date(discount.startDate)) / 86400000))} days</p></InfoCard>
          <InfoCard icon={TrendingUp} title="Usage Limits"><DataRow label="Total Usage Limit" value={discount.usageLimit || "Unlimited"} /><DataRow label="Per User Limit" value={discount.perUserLimit || 1} /><DataRow label="Minimum Order Value" value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} /><DataRow label="Minimum Quantity" value={discount.minQuantity || "Not set"} /></InfoCard>
        </div>

        <div className="space-y-3">
          <div id="d-target" className="scroll-mt-4"><InfoCard icon={Target} title="Targeting"><DataRow icon={Globe} label="Apply To" value={formatTarget(discount.applyTo)} /><DataRow icon={Package} label="Selected Products" value={`${discount.selectedProducts?.length || 0} products`} /><DataRow icon={Layers} label="Selected Categories" value={`${discount.selectedCategories?.length || 0} categories`} /><DataRow icon={Tag} label="Selected Brands" value={`${discount.selectedBrands?.length || 0} brands`} /></InfoCard></div>
          <InfoCard icon={User} title="Created By"><div className="flex items-center gap-2"><Avatar user={discount.createdBy} size="md" /><div className="min-w-0"><p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{discount.createdBy?.name || discount.createdBy?.email || "System"}</p><p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Created {formatDateTime(discount.createdAt)}</p></div></div></InfoCard>
          {hasUpdates && <InfoCard icon={User} title="Updated By"><div className="flex items-center gap-2"><Avatar user={discount.updatedBy} size="md" color="blue" /><div className="min-w-0"><p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{discount.updatedBy?.name || discount.updatedBy?.email || "System"}</p><p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Updated {formatDateTime(discount.updatedAt)}</p></div></div></InfoCard>}
        </div>
      </div>


      {/* TARGETING & CONDITIONS */}
      <div id="d-targeting" className="scroll-mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div id="d-rules" className="scroll-mt-4 h-full"><InfoCard icon={Percent} title="Discount Rules">
              <div className="space-y-1">
                <DataRow icon={Percent} label="Discount Type" value={discount.type === "percentage" ? "Percentage (%)" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
                <DataRow icon={DollarSign} label="Discount Value" value={formatDiscountValue(discount)} highlight />
                <DataRow icon={DollarSign} label="Min Order Value" value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} />
                <DataRow icon={Box} label="Min Quantity" value={discount.minQuantity ? String(discount.minQuantity) : "No minimum"} />
              </div>
            </InfoCard></div>

            <div id="d-usage" className="scroll-mt-4 h-full"><InfoCard icon={Clock} title="Usage Limits">
              <div className="space-y-1">
                <DataRow icon={TrendingUp} label="Total Usage Limit" value={discount.usageLimit ? String(discount.usageLimit) : "Unlimited"} />
                <DataRow icon={User} label="Per User Limit" value={discount.perUserLimit ? String(discount.perUserLimit) : "1"} />
              </div>
            </InfoCard></div>
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
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--success)" }} />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>This discount applies to all products automatically.</span>
              </div>
            )}
          </InfoCard>
        </div>

      {/* ACTIVITY */}
      <div id="d-activity" className="scroll-mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <InfoCard icon={Activity} title="Activity Timeline">
            <div className="space-y-6">
              {/* Created Event */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)" }}>
                    <Plus className="w-5 h-5" style={{ color: "var(--success)" }} />
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--info-soft)" }}>
                      <Pencil className="w-5 h-5" style={{ color: "var(--info)" }} />
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

      {/* EDIT MODAL — detail page par hi khulta hai */}
      {showEdit && editForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleEditSubmit} className="w-full max-w-xl rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Discount</h3>
              <button type="button" onClick={() => setShowEdit(false)} className="p-1 rounded transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} placeholder="Discount name" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Code *</label>
                <input type="text" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] font-mono outline-none uppercase" style={editInputStyle} placeholder="SAVE20" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Discount Type</label>
                <select value={editForm.value_type} onChange={(e) => setEditForm({ ...editForm, value_type: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none cursor-pointer" style={editInputStyle}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed Amount</option>
                  <option value="fixed_price">Fixed Price</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Value *</label>
                <input type="number" min="0" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} placeholder="0" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none cursor-pointer" style={editInputStyle}>
                  <option value="active">Active</option>
                  <option value="disabled">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Start Date</label>
                <input type="datetime-local" value={editForm.start_at} onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>End Date</label>
                <input type="datetime-local" value={editForm.end_at} onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Min Order Amount (Rs.)</label>
                <input type="number" min="0" value={editForm.min_order_amount} onChange={(e) => setEditForm({ ...editForm, min_order_amount: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} placeholder="No minimum" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Min Quantity</label>
                <input type="number" min="1" disabled={!editForm.has_min_quantity} value={editForm.min_quantity} onChange={(e) => setEditForm({ ...editForm, min_quantity: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none disabled:opacity-50" style={editInputStyle} placeholder="—" />
                <label className="flex items-center gap-2 mt-2 text-[10px] cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  <input type="checkbox" checked={editForm.has_min_quantity} onChange={(e) => setEditForm({ ...editForm, has_min_quantity: e.target.checked })} className="accent-[var(--accent)]" />
                  Limit minimum quantity
                </label>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Usage Limit</label>
                <input type="number" min="1" value={editForm.usage_limit} onChange={(e) => setEditForm({ ...editForm, usage_limit: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} placeholder="Unlimited" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Per User Limit</label>
                <input type="number" min="1" value={editForm.usage_per_customer} onChange={(e) => setEditForm({ ...editForm, usage_per_customer: e.target.value })} className="w-full h-9 px-3 rounded-md text-[12px] outline-none" style={editInputStyle} placeholder="1" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Description</label>
                <textarea rows="2" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full px-3 py-2 rounded-md text-[12px] outline-none resize-none" style={editInputStyle} placeholder="Optional description" />
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button type="button" onClick={() => setShowEdit(false)} disabled={editMutation.isPending} className="h-9 px-4 rounded-md text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button type="submit" disabled={editMutation.isPending} className="h-9 px-4 rounded-md text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete &quot;{discount.name}&quot;?</h3>
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