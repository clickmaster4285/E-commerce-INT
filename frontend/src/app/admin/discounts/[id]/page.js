"use client";

import React, { useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Tag, Activity, Clock, User, Percent, Layers, Target,
  Edit3, Trash2, Plus, Pencil, AlertTriangle, DollarSign, Calendar,
  TrendingUp, Hash, Box, CheckCircle2, ShoppingCart, Package, Globe,
} from "lucide-react";
import { discountApi } from "../../../../apis/admin/discountApi";
import { productApi } from "../../../../apis/admin/productApi";
import { categoryApi } from "../../../../apis/admin/categoryApi";
import { brandApi } from "../../../../apis/admin/brandApi";
import { DiscountFormModal, SelectionModal } from "../../discounts/page";
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

const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.discounts)) return response.discounts;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.categories)) return response.categories;
  if (Array.isArray(response?.brands)) return response.brands;
  return [];
};

const getId = (item) => {
  if (!item) return "";
  if (typeof item === "object") return String(item._id || item.id || "");
  return String(item);
};

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
  const [activeFormType, setActiveFormType] = useState(null);
  const [selector, setSelector] = useState({ open: false, type: null });
  const [formData, setFormData] = useState({
    name: "", code: "", description: "",
    selected_ids: [],
    value_type: "percentage", value: "",
    min_order_amount: "",
    has_min_quantity: false,
    min_quantity: "",
    usage_limit: "", usage_per_customer: "",
    start_at: "", end_at: "", status: "active",
  });
  const [formErrors, setFormErrors] = useState({});

  const { data: discount, isLoading: loading } = useQuery({
    queryKey: ["discount", discountId],
    queryFn: () => discountApi.getById(discountId),
    enabled: !!discountId,
  });
  const { data: productsResponse } = useQuery({ queryKey: ["discount-products"], queryFn: productApi.getAll, staleTime: 60000 });
  const products = useMemo(() => normalizeArrayResponse(productsResponse), [productsResponse]);
  const { data: categoriesResponse } = useQuery({ queryKey: ["discount-categories"], queryFn: categoryApi.getAll, staleTime: 60000 });
  const categories = useMemo(() => normalizeArrayResponse(categoriesResponse), [categoriesResponse]);
  const { data: brandsResponse } = useQuery({ queryKey: ["discount-brands"], queryFn: brandApi.getAll, staleTime: 60000 });
  const brands = useMemo(() => normalizeArrayResponse(brandsResponse), [brandsResponse]);


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
  
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  const resetForm = () => {
    setFormData({
      name: "", code: "", description: "",
      selected_ids: [],
      value_type: "percentage", value: "",
      min_order_amount: "",
      has_min_quantity: false,
      min_quantity: "",
      usage_limit: "", usage_per_customer: "",
      start_at: "", end_at: "", status: "active",
    });
    setSelector({ open: false, type: null });
    setActiveFormType(null);
    setFormErrors({});
  };

  // ✅ Edit modal — bilkul Add Discount jaisa form (detail page par hi, navigation nahi)
  const openEdit = () => {
    const d = discount;
    const rawTarget = d?.target_type || d?.applyTo || "all_products";
    let type = "all";
    if (rawTarget === "specific_products" || rawTarget === "product") type = "product";
    else if (rawTarget === "specific_categories" || rawTarget === "category") type = "category";
    else if (rawTarget === "specific_brands" || rawTarget === "brand") type = "brand";
    let selected_ids = [];
    if (type === "product") selected_ids = (d?.selectedProducts || d?.selected_product_ids || []).map(getId);
    else if (type === "category") selected_ids = (d?.selectedCategories || d?.selected_category_ids || []).map(getId);
    else if (type === "brand") selected_ids = (d?.selectedBrands || d?.selected_brand_ids || []).map(getId);
    const rawMinQty = d?.minQuantity;
    const hasMinQty = rawMinQty !== null && rawMinQty !== undefined && rawMinQty !== "";
    setFormData({
      name: d?.name || "", code: d?.code || "", description: d?.description || "",
      selected_ids,
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
    setActiveFormType(type);
    setShowEdit(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormErrors({});
    if (!String(formData.name || "").trim()) return toast.error("Discount name is required");
    const manualCode = String(formData.code || "").trim();
    if (!manualCode) {
      setFormErrors({ code: "Discount code is required." });
      return;
    }
    if (formData.value === "" || Number(formData.value) < 0) return toast.error("Valid discount value is required");
    if (formData.value_type === "percentage" && Number(formData.value) > 100) return toast.error("Percentage cannot exceed 100");

    let target_type = "all_products";
    let applyTo = "all";
    let payloadExtras = {};
    if (activeFormType === "product") {
      target_type = "specific_products"; applyTo = "specific_products";
      if (formData.selected_ids.length === 0) return toast.error("Select at least one product");
      payloadExtras.selected_product_ids = formData.selected_ids.map((id) => String(id?._id || id));
    } else if (activeFormType === "category") {
      target_type = "specific_categories"; applyTo = "specific_categories";
      if (formData.selected_ids.length === 0) return toast.error("Select at least one category");
      payloadExtras.selected_category_ids = formData.selected_ids.map((id) => String(id?._id || id));
    } else if (activeFormType === "brand") {
      target_type = "brand"; applyTo = "brand";
      if (formData.selected_ids.length === 0) return toast.error("Select at least one brand");
      payloadExtras.selected_brand_ids = formData.selected_ids.map((id) => String(id?._id || id));
    }

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const fallbackEnd = new Date();
    fallbackEnd.setDate(fallbackEnd.getDate() + 30);
    const endDate = formData.end_at ? dateToISO(formData.end_at) : fallbackEnd.toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

    const finalMinQuantity = formData.has_min_quantity && formData.min_quantity ? Number(formData.min_quantity) : null;

    const payload = {
      name: String(formData.name).trim(),
      code: manualCode.toUpperCase(),
      description: String(formData.description || "").trim() || undefined,
      target_type, applyTo,
      value_type: formData.value_type,
      type: formData.value_type === "fixed_amount" ? "fixed" : formData.value_type,
      value: Number(formData.value),
      min_order_amount: formData.min_order_amount !== "" ? Number(formData.min_order_amount) : undefined,
      min_quantity: finalMinQuantity,
      usage_limit: formData.usage_limit !== "" ? Number(formData.usage_limit) : undefined,
      usage_per_customer: formData.usage_per_customer !== "" ? Number(formData.usage_per_customer) : undefined,
      start_at: startDate, end_at: endDate,
      status: formData.status,
      isActive: formData.status === "active",
      ...payloadExtras,
    };
    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null || payload[key] === "") delete payload[key]; });
    saveMutation.mutate({ id: discountId, data: payload });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => {
      markSelfAction("update");
      return discountApi.update(id || discountId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount"] });
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success("Discount updated successfully");
      setShowEdit(false);
      resetForm();
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
            <DataRow icon={Hash} label="Code" value={discount.code} mono />
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

      {/* EDIT MODAL — bilkul Add Discount jaisa form */}
      {showEdit && (
        <DiscountFormModal
          formType={activeFormType}
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
          editingDiscount={discount}
          saveMutation={saveMutation}
          setShowModal={setShowEdit}
          resetForm={resetForm}
          setSelector={setSelector}
          handleSubmit={handleSubmit}
          inputStyle={inputStyle}
          products={products}
          categories={categories}
          brands={brands}
        />
      )}
      {selector.open && (
        <SelectionModal
          type={selector.type}
          items={selector.type === "product" ? products : selector.type === "category" ? categories : brands}
          selectedIds={formData.selected_ids}
          onClose={() => setSelector({ open: false, type: null })}
          onApply={(ids) => {
            setFormData((prev) => ({ ...prev, selected_ids: ids }));
            setSelector({ open: false, type: null });
          }}
          inputStyle={inputStyle}
          cardStyle={cardStyle}
        />
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