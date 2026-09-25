"use client";
import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Tag, Activity, Clock, User, Percent, Layers, Target,
  Edit3, Trash2, AlertTriangle, DollarSign, Calendar, TrendingUp,
  Box, Package, Gift, Truck, Sparkles, Award, Ban, Globe
} from "lucide-react";
import { toast } from "sonner";
import { dealApi } from "../../../../apis/admin/dealApi";
import { productApi } from "../../../../apis/admin/productApi";
import { categoryApi } from "../../../../apis/admin/categoryApi";
import { brandApi } from "../../../../apis/admin/brandApi";
import { DealFormModal, SelectionModal } from "../page";
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
    case "fixed_amount": case "fixed": return `Rs. ${value} OFF`;
    case "buy_x_get_y": {
      const buy = deal?.buyQuantity ?? 1;
      const get = deal?.getQuantity ?? 1;
      const disc = deal?.getDiscountValue ?? 100;
      return `Buy ${buy} Get ${get} (${disc === 100 ? "Free" : `${disc}% Off`})`;
    }
    case "free_shipping": return "Free Shipping";
    case "bundle": return `Bundle @ Rs. ${deal?.bundlePrice ?? 0}`;
    default: return value > 0 ? `${value}` : "-";
  }
}

function formatTarget(target) {
  if (!target) return "All Products";
  const map = { all: "All Products", product: "Specific Products", category: "Categories", brand: "Brands", collection: "Collections" };
  return map[target] || target;
}

const getId = (item) => {
  if (!item) return "";
  if (typeof item === "object") return String(item._id || item.id || "");
  return String(item);
};

// Resolve product thumbnail (variant images, same as deals list page)
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "";
const getProductImage = (product) => {
  if (!product) return null;
  const raw = product?.variants?.[0]?.images?.[0]?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  return raw.startsWith("/") ? `${API_ORIGIN}${raw}` : `${API_ORIGIN}/${raw}`;
};

// Resolve brand logo URL
const getBrandLogo = (brand) => {
  if (!brand) return null;
  if (typeof brand.logo === "string") return brand.logo || null;
  return brand.logo?.img_url || null;
};

// Display label for a user — real name first, fallback email, then role, then "Admin"
function getUserLabel(user) {
  if (!user) return "Admin";
  if (user.name || user.email) return user.name || user.email;
  if (user.role) return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  return "Admin";
}

const toDateInput = (value) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  } catch { return ""; }
};

const dateToISO = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusBadge({ status }) {
  const config = {
    active: { bg: "var(--success-soft)", color: "var(--success)", border: "color-mix(in srgb, var(--success) 28%, transparent)", label: "ACTIVE" },
    scheduled: { bg: "var(--info-soft)", color: "var(--info)", border: "color-mix(in srgb, var(--info) 28%, transparent)", label: "SCHEDULED" },
    expired: { bg: "var(--warning-soft)", color: "var(--warning)", border: "color-mix(in srgb, var(--warning) 28%, transparent)", label: "EXPIRED" },
    disabled: { bg: "var(--danger-soft)", color: "var(--danger)", border: "color-mix(in srgb, var(--danger) 28%, transparent)", label: "DISABLED" },
  };
  const c = config[status] || config.disabled;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide shrink-0"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-[10px]", lg: "w-10 h-10 text-[12px]" };
  const colors = {
    emerald: { bg: "var(--success-soft)", text: "var(--success)" },
    blue: { bg: "var(--info-soft)", text: "var(--info)" },
  };
  const c = colors[color] || colors.emerald;
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ backgroundColor: c.bg, color: c.text }}>
      {ini(user?.name || user?.email || "?")}
    </div>
  );
}

function InfoCard({ icon: Icon, title, action, id, children, bodyClassName = "" }) {
  return (
    <div id={id} className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon ? (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft)" }}>
              <Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />
            </div>
          ) : null}
          <h3 className="text-[13px] font-bold truncate" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function DataRow({ icon: Icon, label, value, highlight = false, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2 text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}{label}
      </span>
      <span className={`text-[12px] font-semibold text-right truncate ${mono ? "font-mono" : ""}`}
        style={{ color: highlight ? "var(--success)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="text-[12px] font-semibold break-words" style={{ color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function DealDetailPage() {
  const { markSelfAction } = useDealSocketSync();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const dealId = params.id;
  const backPath = "/admin/deals";

  const [showDelete, setShowDelete] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "", code: "", description: "",
    target_type: "all",
    selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
    value_type: "percentage", value: "", min_order_value: "",
    buy_quantity: "", get_quantity: "", get_discount_value: "",
    has_min_quantity: false,
    min_quantity: "",
    start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
    status: "active", is_featured: false,
  });
  const [editingDeal, setEditingDeal] = useState(null);
  const [selector, setSelector] = useState({ open: false, type: null });
  const [activeFormType, setActiveFormType] = useState(null);

  const { data: deal, isLoading: loading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => dealApi.getById(dealId),
    enabled: !!dealId,
    retry: false,
  });

  const { data: allProducts = [] } = useQuery({ queryKey: ["deal-products"], queryFn: productApi.getAll, staleTime: 60000, enabled: !!dealId });
  const { data: allCategories = [] } = useQuery({ queryKey: ["deal-categories"], queryFn: categoryApi.getAll, staleTime: 60000, enabled: !!dealId });
  const { data: allBrands = [] } = useQuery({ queryKey: ["deal-brands"], queryFn: brandApi.getAll, staleTime: 60000, enabled: !!dealId });

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? dealApi.update(id, data) : dealApi.create(data)),
    onMutate: (_, variables) => markSelfAction(variables.id ? "update" : "create"),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      toast.success(variables.id ? "Deal updated successfully" : "Deal created successfully");
      setShowModal(false);
      resetForm();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to save deal"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => dealApi.delete(dealId),
    onMutate: () => markSelfAction("delete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal deleted successfully");
      router.push(backPath);
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to delete deal"),
  });

  const toggleMutation = useMutation({
    mutationFn: () => {
      const st = getDealStatus(deal);
      const currentlyOn = st === "active" || st === "scheduled";
      return dealApi.update(dealId, { isActive: !currentlyOn });
    },
    onMutate: () => markSelfAction("update"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      const st = deal ? getDealStatus(deal) : "active";
      const wasOn = st === "active" || st === "scheduled";
      toast.success(wasOn ? "Deal deactivated" : "Deal activated");
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to update status"),
  });

  const resetForm = () => {
    setFormData({
      name: "", code: "", description: "", target_type: "all",
      selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
      value_type: "percentage", value: "", min_order_value: "",
      buy_quantity: "", get_quantity: "", get_discount_value: "",
      has_min_quantity: false,
      min_quantity: "",
      start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
      status: "active", is_featured: false,
    });
    setEditingDeal(null);
    setSelector({ open: false, type: null });
    setActiveFormType(null);
  };

  const openEdit = (d) => {
    const rawMinQty = d?.minQuantity ?? d?.min_quantity;
    const hasMinQty = rawMinQty !== null && rawMinQty !== undefined && rawMinQty !== "";
    setFormData({
      name: d?.name || "", code: d?.code || "", description: d?.description || "",
      target_type: d?.applyTo || "all",
      selected_product_ids: Array.isArray(d?.productIds) ? d.productIds.map(getId) : [],
      selected_category_ids: Array.isArray(d?.categoryIds) ? d.categoryIds.map(getId) : [],
      selected_brand_ids: Array.isArray(d?.brandIds) ? d.brandIds.map(getId) : [],
      value_type: d?.type || "percentage",
      value: d?.discountValue ?? "",
      min_order_value: d?.minOrderValue ?? "",
      buy_quantity: d?.buyQuantity ?? "",
      get_quantity: d?.getQuantity ?? "",
      get_discount_value: d?.getDiscountValue ?? "",
      has_min_quantity: hasMinQty,
      min_quantity: hasMinQty ? rawMinQty : "",
      start_at: toDateInput(d?.startDate),
      end_at: toDateInput(d?.endDate),
      usage_limit: d?.usageLimit ?? "",
      per_user_limit: d?.perUserLimit ?? "",
      status: d?.isActive ? "active" : "disabled",
      is_featured: Boolean(d?.isFeatured),
    });
    setEditingDeal(d);
    setActiveFormType(d?.applyTo || "all");
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(formData.name || "").trim()) return toast.error("Deal name is required");

    const dealValue = formData.value === "" ? NaN : Number(formData.value);
    if (["percentage", "fixed_amount"].includes(formData.value_type)) {
      if (Number.isNaN(dealValue) || dealValue < 0) return toast.error("Please enter a valid deal value");
      if (formData.value_type === "percentage" && dealValue > 100) return toast.error("Percentage cannot be greater than 100");
    }

    if (formData.value_type === "buy_x_get_y") {
      if (!formData.buy_quantity || Number(formData.buy_quantity) <= 0) return toast.error("Please enter a valid Buy Quantity");
      if (!formData.get_quantity || Number(formData.get_quantity) <= 0) return toast.error("Please enter a valid Get Quantity");
    }

    if (formData.target_type === "product" && formData.selected_product_ids.length === 0) return toast.error("Select at least one product");
    if (formData.target_type === "category" && formData.selected_category_ids.length === 0) return toast.error("Select at least one category");
    if (formData.target_type === "brand" && formData.selected_brand_ids.length === 0) return toast.error("Select at least one brand");

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const endDate = formData.end_at ? dateToISO(formData.end_at) : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

    const cleanProductIds = formData.selected_product_ids.map((id) => String(id?._id || id));
    const cleanCategoryIds = formData.selected_category_ids.map((id) => String(id?._id || id));
    const cleanBrandIds = formData.selected_brand_ids.map((id) => String(id?._id || id));

    const finalMinQuantity = formData.has_min_quantity && formData.min_quantity ? Number(formData.min_quantity) : null;

    const payload = {
      name: String(formData.name).trim(),
      description: String(formData.description || "").trim() || undefined,
      applyTo: formData.target_type,
      productIds: formData.target_type === "product" ? cleanProductIds : [],
      categoryIds: formData.target_type === "category" ? cleanCategoryIds : [],
      brandIds: formData.target_type === "brand" ? cleanBrandIds : [],
      type: formData.value_type,
      discountValue: ["percentage", "fixed_amount"].includes(formData.value_type) ? dealValue : 0,
      minOrderValue: formData.min_order_value ? Number(formData.min_order_value) : 0,
      buyQuantity: formData.buy_quantity ? Number(formData.buy_quantity) : 1,
      getQuantity: formData.get_quantity ? Number(formData.get_quantity) : 1,
      getDiscountValue: formData.get_discount_value ? Number(formData.get_discount_value) : 100,
      minQuantity: finalMinQuantity,
      startDate, endDate,
      usageLimit: formData.usage_limit !== "" ? Number(formData.usage_limit) : null,
      perUserLimit: formData.per_user_limit !== "" ? Number(formData.per_user_limit) : null,
      isActive: formData.status === "active",
      isFeatured: Boolean(formData.is_featured),
    };

    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null) delete payload[key]; });
    saveMutation.mutate({ id: editingDeal?._id || editingDeal?.id || null, data: payload });
  };

  const getSelectedItems = (type) => {
    let items = [], ids = [];
    if (type === "product") { items = allProducts; ids = formData.selected_product_ids; }
    if (type === "category") { items = allCategories; ids = formData.selected_category_ids; }
    if (type === "brand") { items = allBrands; ids = formData.selected_brand_ids; }
    return items.filter((item) => ids.includes(getId(item)));
  };

  const status = deal ? getDealStatus(deal) : "unknown";
  const isActive = status === "active" || status === "scheduled";
  const hasUpdates = Boolean(
    deal && (deal.updated_at || deal.updatedAt) &&
    (deal.created_at || deal.createdAt) &&
    (deal.updated_at || deal.updatedAt) !== (deal.created_at || deal.createdAt)
  );

  const selectedProducts = useMemo(() => {
    if (deal?.applyTo !== "product" || !deal?.productIds?.length) return [];
    return allProducts.filter((p) => deal.productIds.some((id) => getId(id) === getId(p)));
  }, [allProducts, deal]);

  const selectedCategories = useMemo(() => {
    if (deal?.applyTo !== "category" || !deal?.categoryIds?.length) return [];
    return allCategories.filter((c) => deal.categoryIds.some((id) => getId(id) === getId(c)));
  }, [allCategories, deal]);

  const selectedBrands = useMemo(() => {
    if (deal?.applyTo !== "brand" || !deal?.brandIds?.length) return [];
    return allBrands.filter((b) => deal.brandIds.some((id) => getId(id) === getId(b)));
  }, [allBrands, deal]);

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
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-soft)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "var(--danger)" }} />
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

  return (
    <div className="w-full pb-8 space-y-3">
      {/* HEADER */}
      <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <button onClick={() => router.push(backPath)} className="flex items-center gap-2 text-[12px] font-medium mb-4 hover:opacity-80 transition" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Deals
        </button>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft)", border: "1px solid var(--border-color)" }}>
            <Tag className="w-10 h-10" style={{ color: "var(--accent)" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-[22px] md:text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{deal.name}</h1>
              <StatusBadge status={status} />
            </div>
            {deal.description ? (
              <p className="text-[13px] mb-3" style={{ color: "var(--text-muted)" }}>{deal.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Created by
                <b className="font-semibold" style={{ color: "var(--text-primary)" }}>{creator ? getUserLabel(creator) : "Admin"}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Created at
                <b className="font-semibold" style={{ color: "var(--text-primary)" }}>{fdt(deal.created_at || deal.createdAt)}</b>
              </span>
              {hasUpdates && editor ? (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Updated by
                  <b className="font-semibold" style={{ color: "var(--text-primary)" }}>{editor.name || editor.email}</b>
                </span>
              ) : null}
              {hasUpdates ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Updated at
                  <b className="font-semibold" style={{ color: "var(--text-primary)" }}>{fdt(deal.updated_at || deal.updatedAt)}</b>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2 shrink-0">
            <button type="button" onClick={() => openEdit(deal)}
              className="h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
            <button type="button" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate()}
              className="h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: isActive ? "var(--bg-card)" : "var(--success-soft)", border: `1px solid ${isActive ? "var(--border-color)" : "color-mix(in srgb, var(--success) 28%, transparent)"}`, color: isActive ? "var(--text-primary)" : "var(--success)" }}>
              <Ban className="w-3.5 h-3.5" /> {isActive ? "Deactivate" : "Activate"}
            </button>
            <button type="button" disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}
              className="h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)", color: "var(--danger)" }}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* SECTION TABS */}
      <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)", scrollbarWidth: "none" }}>
        {[
          ["d-overview", "Overview"],
          ...(deal.applyTo === "product" ? [["d-products", "Products"]] : []),
          ...(deal.applyTo === "category" ? [["d-categories", "Categories"]] : []),
          ...(deal.applyTo === "brand" ? [["d-brands", "Brands"]] : []),
          ["d-usage", "Usage & Limits"],
          ["d-history", "History"],
        ].map(([sectionId, label]) => (
          <button key={sectionId} type="button"
            onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="relative pb-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors hover:opacity-80"
            style={{ color: "var(--text-muted)" }}>
            {label}
            <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--border-color)" }} />
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <InfoCard icon={Tag} title="Deal Information" id="d-overview"
            action={
              <button type="button" onClick={() => openEdit(deal)} className="text-[10px] font-bold flex items-center gap-1 transition hover:opacity-80" style={{ color: "var(--accent)" }}>
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            }>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              {/* COLUMN 1 — basic info */}
              <div className="space-y-4">
                <Field label="Deal Name">{deal.name}</Field>
                <Field label="Description">
                  <span className="font-normal whitespace-pre-wrap break-words block">{deal.description || "—"}</span>
                </Field>
                <Field label="Deal Type">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold capitalize" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                    {deal.type?.replace(/_/g, " ") || "—"}
                  </span>
                </Field>
                <Field label="Discount Value">
                  <span style={{ color: "var(--success)" }}>{formatDealValue(deal)}</span>
                </Field>
              </div>

              {/* COLUMN 2 — targeting & schedule */}
              <div className="space-y-4">
                <Field label="Apply To">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--info-soft)", color: "var(--info)" }}>
                    {formatTarget(deal.applyTo)}
                  </span>
                </Field>
                <Field label={deal.applyTo === "product" ? "Target Products" : deal.applyTo === "category" ? "Target Categories" : deal.applyTo === "brand" ? "Target Brands" : "Target"}>
                  {deal.applyTo === "product" && selectedProducts.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>{selectedProducts[0]?.name || "Product"}</span>
                      {selectedProducts.length > 1 && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>+{selectedProducts.length - 1}</span>
                      )}
                    </span>
                  ) : deal.applyTo === "category" && selectedCategories.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>{selectedCategories[0]?.name || "Category"}</span>
                      {selectedCategories.length > 1 && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>+{selectedCategories.length - 1}</span>
                      )}
                    </span>
                  ) : deal.applyTo === "brand" && selectedBrands.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>{selectedBrands[0]?.name || "Brand"}</span>
                      {selectedBrands.length > 1 && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>+{selectedBrands.length - 1}</span>
                      )}
                    </span>
                  ) : deal.applyTo === "all" ? "All Products" : "—"}
                </Field>
                <Field label="Start Date">{fdt(deal.startDate)}</Field>
                <Field label="End Date">{fdt(deal.endDate)}</Field>
              </div>

              {/* COLUMN 3 — usage & flags (form fields only) */}
              <div className="space-y-4">
                <Field label="Usage Limit">{deal.usageLimit ? String(deal.usageLimit) : "No limit"}</Field>
                <Field label="Per User Limit">{deal.perUserLimit ? String(deal.perUserLimit) : "No limit"}</Field>
                <Field label="Is Active">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: isActive ? "var(--success-soft)" : "var(--danger-soft)", color: isActive ? "var(--success)" : "var(--danger)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? "var(--success)" : "var(--danger)" }} />
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </Field>
                <Field label="Min Quantity">{deal.minQuantity ? String(deal.minQuantity) : "—"}</Field>
                <Field label="Is Featured">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: deal.isFeatured ? "var(--warning-soft)" : "var(--bg-tertiary)", color: deal.isFeatured ? "var(--warning)" : "var(--text-muted)" }}>
                    <Sparkles className="w-3 h-3" /> {deal.isFeatured ? "Yes" : "No"}
                  </span>
                </Field>
              </div>
            </div>

            {/* TYPE-SPECIFIC (form fields only) */}
            {deal.type === "buy_x_get_y" && (
              <div className="grid grid-cols-3 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <Box className="w-4 h-4 mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Buy Quantity</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.buyQuantity ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <Gift className="w-4 h-4 mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Get Quantity</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.getQuantity ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <Percent className="w-4 h-4 mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Get Discount</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--success)" }}>{deal.getDiscountValue ?? 100}%</p>
                </div>
              </div>
            )}
            {deal.type === "bundle" && (
              <div className="p-5 rounded-2xl mt-5 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "2px solid var(--accent-soft)", boxShadow: "0 4px 20px rgba(16,185,129,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft)", border: "1px solid var(--accent-soft)" }}>
                    <Package className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-black" style={{ color: "var(--text-primary)", letterSpacing: "0.02em" }}>Bundle Offer Condition</h4>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Single offer rule — applies when quantity is met</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Requirement</p>
                    <p className="text-[15px] font-black" style={{ color: "var(--text-primary)" }}>
                      {deal.bundleRule ? (
                        deal.bundleRule.mode === "limit"
                          ? `Buy ${deal.bundleRule.buyQuantity || 1} bundle${Number(deal.bundleRule.buyQuantity || 1) > 1 ? "s" : ""}`
                          : `Buy all selected bundle products`
                      ) : "Buy bundles to unlock offer"}
                    </p>
                  </div>
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Reward</p>
                    <p className="text-[15px] font-black" style={{ color: "var(--success)" }}>
                      {!deal.bundleRule ? (
                        "—"
                      ) : deal.bundleRule.rewardType === "free_product" ? (
                        <>Free Gift: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{deal.bundleRule.freeProduct?.name || "Gift"}</span> ({deal.bundleRule.freeQuantity || 1})</>
                      ) : deal.bundleRule.rewardType === "percentage" ? (
                        <>{deal.bundleRule.value || 0}% OFF</>
                      ) : (
                        <>Rs. {deal.bundleRule.value || 0} OFF</>
                      )}
                    </p>
                  </div>
                </div>

                {deal.bundleRule?.mode === "limit" && deal.bundleRule?.buyQuantity > 0 && (
                  <div className="rounded-lg px-3.5 py-2.5 text-[11px] font-semibold text-center" style={{ backgroundColor: "var(--info-soft)", color: "var(--info)", border: "1px solid color-mix(in srgb, var(--info) 25%, transparent)" }}>
                    Customer must add at least {deal.bundleRule.buyQuantity} item{Number(deal.bundleRule.buyQuantity) > 1 ? "s" : ""} to unlock this offer
                  </div>
                )}
              </div>
            )}
            {deal.type === "free_shipping" && (
              <div className="p-4 rounded-lg mt-5 flex items-center gap-2.5" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <Truck className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-[12px] font-bold" style={{ color: "var(--success)" }}>Free Shipping</span>
              </div>
            )}
          </InfoCard>

          {/* TARGETED — only the selected target type is shown */}
          {deal.applyTo === "all" ? (
            <div className="rounded-2xl p-5 flex items-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft)" }}>
                <Globe className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>All Products</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>This deal applies to every product in the store.</p>
              </div>
            </div>
          ) : deal.applyTo === "product" ? (
            <div id="d-products" className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>Targeted Products</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{selectedProducts.length}</span>
                </div>
              </div>
              <div className="p-5">
                {selectedProducts.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-3">
                      {selectedProducts.slice(0, 8).map((p) => {
                        const img = getProductImage(p);
                        return (
                          <div key={p._id || p.id} className="w-[68px]">
                            <div className="w-[68px] h-[68px] rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                              {img ? <img src={img} alt={p.name || "Product"} className="w-full h-full object-cover" /> : <Box className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                            </div>
                            <p className="text-[9px] font-semibold mt-1 truncate text-center" style={{ color: "var(--text-primary)" }}>{p.name || "Product"}</p>
                          </div>
                        );
                      })}
                    </div>
                    {selectedProducts.length > 8 && (
                      <p className="text-[10px] font-semibold mt-2" style={{ color: "var(--accent)" }}>+{selectedProducts.length - 8} more</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>No products selected yet.</p>
                )}
              </div>
            </div>
          ) : deal.applyTo === "category" ? (
            <div id="d-categories" className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>Targeted Categories</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{selectedCategories.length}</span>
                </div>
              </div>
              <div className="p-5 space-y-2">
                {selectedCategories.length > 0 ? (
                  <>
                    {selectedCategories.slice(0, 8).map((c) => (
                      <div key={c._id || c.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                        <span className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{c.name || "Category"}</span>
                      </div>
                    ))}
                    {selectedCategories.length > 8 && (
                      <p className="text-[10px] font-semibold pt-1" style={{ color: "var(--accent)" }}>+{selectedCategories.length - 8} more</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>No categories selected yet.</p>
                )}
              </div>
            </div>
          ) : deal.applyTo === "brand" ? (
            <div id="d-brands" className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>Targeted Brands</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{selectedBrands.length}</span>
                </div>
              </div>
              <div className="p-5 space-y-2">
                {selectedBrands.length > 0 ? (
                  <>
                    {selectedBrands.slice(0, 8).map((b) => {
                      const logo = getBrandLogo(b);
                      return (
                        <div key={b._id || b.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          {logo ? <img src={logo} alt={b.name || "Brand"} className="w-6 h-6 rounded object-contain shrink-0" /> : <Award className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />}
                          <span className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{b.name || "Brand"}</span>
                        </div>
                      );
                    })}
                    {selectedBrands.length > 8 && (
                      <p className="text-[10px] font-semibold pt-1" style={{ color: "var(--accent)" }}>+{selectedBrands.length - 8} more</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>No brands selected yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 flex items-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--warning-soft)" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning)" }} />
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Target is not set. Edit the deal to choose products, categories or brands.</p>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-3">
          <InfoCard icon={Activity} title="Quick Summary">
            <div className="space-y-0.5">
              <DataRow icon={Percent} label="Deal Type" value={deal.type?.replace(/_/g, " ") || "—"} />
              <DataRow icon={DollarSign} label="Discount Value" value={formatDealValue(deal)} highlight />
              <DataRow icon={Target} label="Apply To" value={formatTarget(deal.applyTo)} />
              <DataRow icon={Calendar} label="Start Date" value={fdt(deal.startDate)} />
              <DataRow icon={Calendar} label="End Date" value={fdt(deal.endDate)} />
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Activity className="w-3.5 h-3.5" /> Status
                </span>
                <StatusBadge status={status} />
              </div>
            </div>
          </InfoCard>

          <div id="d-usage" className="scroll-mt-4 space-y-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Usage Limit</p>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.usageLimit ? String(deal.usageLimit) : "Unlimited"}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <User className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Per User Limit</p>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.perUserLimit ? String(deal.perUserLimit) : "No limit"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORY */}
      <InfoCard icon={Activity} title="Recently Updated History" id="d-history">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                {["Date & Time", "Action", "By", "Details"].map((h) => (
                  <th key={h} className="py-2 pr-4 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: hasUpdates ? "1px solid var(--border-color)" : "none" }}>
                <td className="py-2.5 pr-4 text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{fdt(deal.created_at || deal.createdAt)}</td>
                <td className="py-2.5 pr-4">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>Created</span>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {creator ? <Avatar user={creator} size="sm" color="emerald" /> : null}
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{getUserLabel(creator)}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-[11px]" style={{ color: "var(--text-muted)" }}>Deal created</td>
              </tr>
              {hasUpdates && (
                <tr>
                  <td className="py-2.5 pr-4 text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{fdt(deal.updated_at || deal.updatedAt)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--info-soft)", color: "var(--info)" }}>Updated</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {editor ? <Avatar user={editor} size="sm" color="blue" /> : null}
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{editor ? getUserLabel(editor) : "—"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-[11px]" style={{ color: "var(--text-muted)" }}>Deal details were modified</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </InfoCard>

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete &quot;{deal.name}&quot;?</h3>
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
                {deleteMutation.isPending ? "Deleting..." : <><Trash2 className="w-4 h-4" /> Delete Deal</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / ADD DEAL FORM (same form as list page) */}
      {showModal && (
        <DealFormModal
          formType={activeFormType}
          formData={formData}
          setFormData={setFormData}
          editingDeal={editingDeal}
          saveMutation={saveMutation}
          setShowModal={setShowModal}
          resetForm={resetForm}
          setSelector={setSelector}
          getSelectedItems={getSelectedItems}
          handleSubmit={handleSubmit}
          inputStyle={inputStyle}
          products={allProducts}
          categories={allCategories}
          brands={allBrands}
        />
      )}
      {selector.open && (
        <SelectionModal
          type={selector.type}
          items={selector.type === "product" ? allProducts : selector.type === "category" ? allCategories : allBrands}
          selectedIds={selector.type === "product" ? formData.selected_product_ids : selector.type === "category" ? formData.selected_category_ids : formData.selected_brand_ids}
          onClose={() => setSelector({ open: false, type: null })}
          onApply={(ids) => {
            if (selector.type === "product") setFormData((prev) => ({ ...prev, selected_product_ids: ids }));
            if (selector.type === "category") setFormData((prev) => ({ ...prev, selected_category_ids: ids }));
            if (selector.type === "brand") setFormData((prev) => ({ ...prev, selected_brand_ids: ids }));
            setSelector({ open: false, type: null });
          }}
          inputStyle={inputStyle}
          cardStyle={cardStyle}
        />
      )}
    </div>
  );
}
