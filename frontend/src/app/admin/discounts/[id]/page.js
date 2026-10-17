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
import { DiscountFormModal, SelectionModal } from "../_components/discountModals";
import { validateNonNegative } from "../_components/discountUtils";
import useDiscountSocketSync from "../../../../hooks/admin/useDiscountSocketSync";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

/* =========================================================
   HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function fd(date, locale = "en") {
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : "en-US", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(date));
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

function formatDateTime(date, locale = "en") {
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
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

/* =========================================================
   SKELETON LOADING UI — existing `.skeleton` shimmer utility (globals.css) reuse
   ✅ Real page ka same shell (header + meta strip + section cards) render hota hai,
      sirf values shimmer karti hain — is liye data aane par layout shift nahi hota.
   ✅ Sirf loading state ke liye — real page design me koi change nahi.
========================================================= */
const SKELETON_ROUND = { borderRadius: "9999px" };

function SkeletonDataRows({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`dk-row-${i}`} className="flex items-center justify-between gap-4 py-1.5">
          <span className="skeleton inline-block h-2.5 w-[70px] rounded align-middle" />
          <span className="skeleton inline-block h-2.5 rounded align-middle" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

function DiscountDetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="w-full pb-8 space-y-3" aria-busy="true" aria-label={t("admin.promotions.ui.generated.a50f7dc65c01")}>
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] mb-2">
          <span className="skeleton inline-block h-2.5 w-14 rounded align-middle" />
          <span style={{ color: "var(--text-muted)" }}>›</span>
          <span className="skeleton inline-block h-2.5 w-24 rounded align-middle" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="skeleton block h-4 w-[180px] rounded" />
            <span className="skeleton mt-2 block h-2.5 w-[90px] rounded" />
          </div>
          <div className="flex items-center gap-2">
            <span className="skeleton inline-block h-6 w-[70px]" style={SKELETON_ROUND} />
            <span className="skeleton inline-block h-8 w-[62px] rounded-md" />
            <span className="skeleton inline-block h-8 w-[74px] rounded-md" />
          </div>
        </div>
      </div>

      {/* META STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-md overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`dk-meta-${i}`} className="flex items-center gap-2.5 px-3 py-3 border-b md:border-b-0 md:border-r last:border-0" style={{ borderColor: "var(--border-color)" }}>
            <span className="skeleton h-4 w-4 shrink-0 rounded" />
            <div className="min-w-0 flex-1">
              <span className="skeleton block h-2.5 w-[70px] rounded" />
              <span className="skeleton mt-1.5 block h-2.5 w-[90px] rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* SECTIONS — real page jaise titles, sirf values shimmer */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr_0.9fr] gap-3 items-start">
        <div className="space-y-3">
          <InfoCard icon={Tag} title={t("admin.categories.form.basicInfo")}><SkeletonDataRows rows={7} /></InfoCard>
          <InfoCard icon={Package} title={t("admin.discounts.detail.applicableProducts")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`dk-product-${i}`} className="min-w-0">
                  <span className="skeleton block h-14 rounded-md" />
                  <span className="skeleton mt-1.5 block h-2.5 w-[80%] rounded" />
                  <span className="skeleton mt-1 block h-2 w-[50%] rounded" />
                </div>
              ))}
            </div>
          </InfoCard>
        </div>
        <div className="space-y-3">
          <InfoCard icon={Calendar} title={t("admin.discounts.detail.validityPeriod")}><SkeletonDataRows rows={3} /></InfoCard>
          <InfoCard icon={TrendingUp} title={t("admin.discounts.detail.usageLimits")}><SkeletonDataRows rows={4} /></InfoCard>
        </div>
        <div className="space-y-3">
          <InfoCard icon={Target} title={t("admin.promotions.ui.generated.08d79bb915ec")}><SkeletonDataRows rows={4} /></InfoCard>
          <InfoCard icon={User} title={t("admin.brands.detail.createdBy")}>
            <div className="flex items-center gap-2">
              <span className="skeleton h-9 w-9 shrink-0" style={SKELETON_ROUND} />
              <div className="min-w-0 flex-1">
                <span className="skeleton block h-2.5 w-[70%] rounded" />
                <span className="skeleton mt-1.5 block h-2.5 w-[45%] rounded" />
              </div>
            </div>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const { t } = useTranslation();
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-[10px]", lg: "w-11 h-11 text-xs" };
  const colors = {
    emerald: { bg: "var(--success-soft)", text: t("admin.promotions.ui.generated.f41e0cb8441d") },
    blue: { bg: "var(--info-soft)", text: t("admin.promotions.ui.generated.8e18505083bf") },
    purple: { bg: "var(--purple-soft)", text: t("admin.promotions.ui.generated.8173ec56882e") },
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
  const { t, locale, dir } = useTranslation();
  const { nameOf, productNameOf, descriptionOf } = useLocalized();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();

  const discountId = params.id;
  // ✅ discountId hook ko pass karo — socket update event par sirf isi discount ka
  // detail cache invalidate hota hai, isliye "Updated By" bina refresh ke
  // update ho jata hai.
  const { markSelfAction } = useDiscountSocketSync(discountId);

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
      toast.success(t("admin.discounts.toast.deleted"));
      router.push(backPath);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || t("admin.discounts.toast.deleteFailed"));
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
  
  // ✅ Sirf wahi targets render hote hain jo is discount par ASSIGN hain.
  //    Target type ke hisab se filter — purane stale ids (DB me maujood) detail par
  //    "assigned" jaise dikhna band ho jaata hai.
  const applyToKey = discount?.applyTo || discount?.target_type || "all";
  const targetsProducts = applyToKey === "specific_products" || applyToKey === "product";
  const targetsCategories = applyToKey === "specific_categories" || applyToKey === "category";
  const targetsBrands = applyToKey === "specific_brands" || applyToKey === "brand";
  const assignedProducts = targetsProducts ? (discount?.selectedProducts || []) : [];
  const assignedCategories = targetsCategories ? (discount?.selectedCategories || []) : [];
  const assignedBrands = targetsBrands ? (discount?.selectedBrands || []) : [];
  const targetsEverything = !targetsProducts && !targetsCategories && !targetsBrands;

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
    if (!String(formData.name || "").trim()) return toast.error(t("admin.discounts.validation.nameRequired"));
    const manualCode = String(formData.code || "").trim();
    if (!manualCode) {
      setFormErrors({ code: t("admin.discounts.validation.codeRequired") });
      return;
    }
    if (formData.value === "" || !Number.isFinite(Number(formData.value))) return toast.error(t("admin.discounts.validation.valueRequired"));
    if (Number(formData.value) < 0) return toast.error(t("admin.discounts.validation.valueNegative"));
    if (formData.value_type === "percentage" && Number(formData.value) > 100) return toast.error(t("admin.discounts.validation.percentageMax"));

    // ✅ Discount value aur limits 0 se kam kabhi nahi (negative values block)
    const nonNegativeError = validateNonNegative([
      [t("admin.discounts.form.discountValue"), formData.value],
      [t("admin.discounts.form.minOrderAmount"), formData.min_order_amount],
      [t("admin.discounts.form.minQuantity"), formData.has_min_quantity ? formData.min_quantity : ""],
      [t("admin.discounts.form.totalUsageLimit"), formData.usage_limit],
      [t("admin.discounts.form.perCustomerLimit"), formData.usage_per_customer],
    ], t);
    if (nonNegativeError) return toast.error(nonNegativeError);

    let target_type = "all_products";
    let applyTo = "all";
    let payloadExtras = {};
    if (activeFormType === "product") {
      target_type = "specific_products"; applyTo = "specific_products";
      if (formData.selected_ids.length === 0) return toast.error(t("admin.discounts.validation.selectProduct"));
      payloadExtras.selected_product_ids = formData.selected_ids.map((id) => String(id?._id || id));
    } else if (activeFormType === "category") {
      target_type = "specific_categories"; applyTo = "specific_categories";
      if (formData.selected_ids.length === 0) return toast.error(t("admin.discounts.validation.selectCategory"));
      payloadExtras.selected_category_ids = formData.selected_ids.map((id) => String(id?._id || id));
    } else if (activeFormType === "brand") {
      target_type = "brand"; applyTo = "brand";
      if (formData.selected_ids.length === 0) return toast.error(t("admin.discounts.validation.selectBrand"));
      payloadExtras.selected_brand_ids = formData.selected_ids.map((id) => String(id?._id || id));
    }

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const fallbackEnd = new Date();
    fallbackEnd.setDate(fallbackEnd.getDate() + 30);
    const endDate = formData.end_at ? dateToISO(formData.end_at) : fallbackEnd.toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error(t("admin.discounts.validation.dateOrder"));

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
      toast.success(t("admin.discounts.toast.updated"));
      setShowEdit(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || t("admin.discounts.toast.saveFailed"));
    },
  });

  // ✅ Loading — spinner ki jagah skeleton (real shell: header + meta strip + section
  //    cards), is liye data aane par layout shift nahi hota.
  if (loading) {
    return <DiscountDetailSkeleton />;
  }

  // Not Found
  if (!discount) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-soft)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "var(--danger)" }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.discounts.detail.discountNotFound")}</h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.discountNotFoundBody")}</p>
          <button onClick={() => router.push(backPath)} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <ArrowLeft className="w-4 h-4" />{" "}{t("admin.discounts.detail.backToDiscounts")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-8 space-y-3">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
          <button onClick={() => router.push(backPath)} className="hover:underline">{t("admin.nav.item.discounts")}</button>
          <span>›</span><span style={{ color: "var(--text-primary)" }}>{t("admin.promotions.ui.generated.7b989f1f6be4")}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>{nameOf(discount) || "Untitled Discount"}</h1>
            <div className="flex items-center gap-1.5 mt-1 text-[10px]" style={{ color: "var(--accent)" }}><Tag className="w-3 h-3" /> {discount.code || "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge active={isActive} label={isActive ? t("common.active") : t("common.inactive")} />
            <button type="button" onClick={openEdit} className="h-8 px-3 rounded-md text-[10px] font-semibold flex items-center gap-1.5" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Edit3 className="w-3.5 h-3.5" />{" "}{t("admin.promotions.ui.generated.9ead47a82a0d")}</button>
            <button type="button" disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)} className="h-8 px-3 rounded-md text-[10px] font-semibold flex items-center gap-1.5" style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)", color: "var(--danger)" }}><Trash2 className="w-3.5 h-3.5" />{" "}{t("admin.promotions.ui.generated.9485989ff514")}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 rounded-md overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        {[{ icon: Percent, label: t("admin.discounts.detail.discountType"), value: discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed" : "Fixed Price" }, { icon: Calendar, label: t("admin.discounts.detail.validPeriod"), value: `${fd(discount.startDate, locale)} - ${fd(discount.endDate, locale)}` }, { icon: TrendingUp, label: t("admin.discounts.detail.usageLimit"), value: discount.usageLimit ? new Intl.NumberFormat(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : "en").format(discount.usageLimit) : "Unlimited" }, { icon: ShoppingCart, label: t("admin.discounts.detail.minimumOrderValue"), value: discount.minOrderValue ? new Intl.NumberFormat(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : "en", { style: "currency", currency: "PKR" }).format(discount.minOrderValue) : "No minimum" }].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2.5 px-3 py-3 border-b md:border-b-0 md:border-r last:border-0" style={{ borderColor: "var(--border-color)" }}><Icon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /><div className="min-w-0"><p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</p><p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{value}</p></div></div>
        ))}
      </div>

      {/* ✅ Section tabs hata diye gaye — saare sections (Basic Information / Targeting /
          Conditions / Usage & Limits / History) ab ek hi page par continuously render hote hain */}

      <div id="d-overview" className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr_0.9fr] gap-3 items-start scroll-mt-4">
        <div className="space-y-3">
          <InfoCard icon={Tag} title={t("admin.categories.form.basicInfo")} action={<button type="button" onClick={openEdit} className="text-[9px] font-semibold" style={{ color: "var(--accent)" }}><Edit3 className="w-3 h-3 inline mr-1" />{" "}{t("admin.promotions.ui.generated.9ead47a82a0d")}</button>}>
            <DataRow icon={Hash} label={t("admin.promotions.ui.generated.e6fb06210faf")} value={discount.code} mono />
            <DataRow icon={Tag} label={t("admin.discounts.detail.name")} value={nameOf(discount)} />
            <DataRow icon={Activity} label={t("admin.discounts.detail.description")} value={descriptionOf(discount) || "—"} />
            <DataRow icon={Percent} label={t("admin.promotions.ui.generated.d0a3e7f81a98")} value={discount.type === "percentage" ? "Percentage" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
            <DataRow icon={DollarSign} label={t("admin.discounts.detail.value")} value={formatDiscountValue(discount)} highlight />
            <DataRow icon={Target} label={t("admin.discounts.detail.applyTo")} value={formatTarget(discount.applyTo)} />
            <DataRow icon={Activity} label={t("admin.brands.detail.productTableStatus")} value={isActive ? "Active" : "Inactive"} highlight={isActive} />
          </InfoCard>
          <InfoCard icon={Package} title={t("admin.discounts.detail.applicableProducts")} action={<span className="text-[9px]" style={{ color: "var(--accent)" }}>{assignedProducts.length ? `View All (${assignedProducts.length})` : targetsEverything ? "Preview" : "Not targeted"}</span>}>
            {assignedProducts.length ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{assignedProducts.slice(0, 4).map((product) => <div key={product._id} className="min-w-0"><div className="h-14 rounded-md flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}><Package className="w-6 h-6" style={{ color: "var(--text-muted)" }} /></div><p className="text-[9px] font-semibold truncate mt-1" style={{ color: "var(--text-primary)" }}>{product.name}</p><p className="text-[8px]" style={{ color: "var(--text-muted)" }}>{product.sku || "—"}</p></div>)}</div>
              : targetsCategories ? <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.ad3231d362ff")}{" "}{assignedCategories.length}{" "}{t("admin.promotions.ui.generated.c1c9bccd8a9c")}{assignedCategories.length === 1 ? "y" : "ies"}.</p>
              : targetsBrands ? <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.ad3231d362ff")}{" "}{assignedBrands.length}{" "}{t("admin.promotions.ui.generated.064e2f5eddac")}{assignedBrands.length === 1 ? "" : "s"}.</p>
              : <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("admin.brands.detail.allProducts")}</p>}
          </InfoCard>
        </div>

        <div className="space-y-3">
          <InfoCard icon={Calendar} title={t("admin.discounts.detail.validityPeriod")}><DataRow label={t("admin.discounts.form.startDate")} value={formatDateTime(discount.startDate)} /><DataRow label={t("admin.promotions.ui.generated.269c8b374312")} value={formatDateTime(discount.endDate)} /><p className="text-[8px] text-right mt-2" style={{ color: "var(--text-muted)" }}>{Math.max(0, Math.ceil((new Date(discount.endDate) - new Date(discount.startDate)) / 86400000))}{" "}{t("admin.promotions.ui.generated.5548ae4f34cb")}</p></InfoCard>
          <InfoCard icon={TrendingUp} title={t("admin.discounts.detail.usageLimits")}><DataRow label={t("admin.discounts.form.totalUsageLimit")} value={discount.usageLimit || "Unlimited"} /><DataRow label={t("admin.promotions.ui.generated.fdbbcd998612")} value={discount.perUserLimit || 1} /><DataRow label={t("admin.discounts.detail.minimumOrderValue")} value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} /><DataRow label={t("admin.promotions.ui.generated.e3f2be9ede5c")} value={discount.minQuantity || "Not set"} /></InfoCard>
        </div>

        <div className="space-y-3">
          <div id="d-target" className="scroll-mt-4"><InfoCard icon={Target} title={t("admin.promotions.ui.generated.08d79bb915ec")}><DataRow icon={Globe} label={t("admin.discounts.detail.applyTo")} value={formatTarget(discount.applyTo)} />{targetsProducts && <DataRow icon={Package} label={t("admin.promotions.ui.generated.73402e32460b")} value={`${assignedProducts.length} products`} />}{targetsCategories && <DataRow icon={Layers} label={t("admin.promotions.ui.generated.c107fd7d0b1c")} value={`${assignedCategories.length} categories`} />}{targetsBrands && <DataRow icon={Tag} label={t("admin.promotions.ui.generated.796088a7739e")} value={`${assignedBrands.length} brands`} />}</InfoCard></div>
          <InfoCard icon={User} title={t("admin.brands.detail.createdBy")}><div className="flex items-center gap-2"><Avatar user={discount.createdBy} size="md" /><div className="min-w-0"><p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{discount.createdBy?.name || discount.createdBy?.email || "System"}</p><p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{t("admin.categories.detail.createdAt")}{" "}{formatDateTime(discount.createdAt)}</p></div></div></InfoCard>
          {hasUpdates && <InfoCard icon={User} title={t("admin.brands.detail.updatedBy")}><div className="flex items-center gap-2"><Avatar user={discount.updatedBy} size="md" color="blue" /><div className="min-w-0"><p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{discount.updatedBy?.name || discount.updatedBy?.email || "System"}</p><p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.updated")}{" "}{formatDateTime(discount.updatedAt)}</p></div></div></InfoCard>}
        </div>
      </div>


      {/* TARGETING & CONDITIONS */}
      <div id="d-targeting" className="scroll-mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div id="d-rules" className="scroll-mt-4 h-full"><InfoCard icon={Percent} title={t("admin.discounts.detail.discountRules")}>
              <div className="space-y-1">
                <DataRow icon={Percent} label={t("admin.discounts.detail.discountType")} value={discount.type === "percentage" ? "Percentage (%)" : discount.type === "fixed" ? "Fixed Amount" : "Fixed Price"} />
                <DataRow icon={DollarSign} label={t("admin.discounts.form.discountValue")} value={formatDiscountValue(discount)} highlight />
                <DataRow icon={DollarSign} label={t("admin.promotions.ui.generated.7e9c655b729a")} value={discount.minOrderValue ? `Rs. ${discount.minOrderValue}` : "No minimum"} />
                <DataRow icon={Box} label={t("admin.discounts.form.minQuantity")} value={discount.minQuantity ? String(discount.minQuantity) : "No minimum"} />
              </div>
            </InfoCard></div>

            <div id="d-usage" className="scroll-mt-4 h-full"><InfoCard icon={Clock} title={t("admin.discounts.detail.usageLimits")}>
              <div className="space-y-1">
                <DataRow icon={TrendingUp} label={t("admin.discounts.form.totalUsageLimit")} value={discount.usageLimit ? String(discount.usageLimit) : "Unlimited"} />
                <DataRow icon={User} label={t("admin.promotions.ui.generated.fdbbcd998612")} value={discount.perUserLimit ? String(discount.perUserLimit) : "1"} />
              </div>
            </InfoCard></div>
          </div>

          <InfoCard icon={Target} title={t("admin.discounts.detail.appliedTargets")}>
            <div className="p-4 rounded-lg mb-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.page.appliesToHeading")}</p>
              <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                {formatTarget(discount.applyTo || discount.target_type)}
              </p>
            </div>

            {assignedProducts.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.a953deb1b78a")}{assignedProducts.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignedProducts.map((product) => (
                    <span key={product._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Box className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {productNameOf(product) || t("common.product")}
                      {product.sku && <span className="text-[9px] font-mono opacity-60">({product.sku})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {assignedCategories.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.214773db1630")}{assignedCategories.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignedCategories.map((cat) => (
                    <span key={cat._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Layers className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {nameOf(cat) || t("common.category")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {assignedBrands.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.a48f90037d50")}{assignedBrands.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignedBrands.map((brand) => (
                    <span key={brand._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Tag className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      {nameOf(brand) || t("common.brand")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {targetsEverything && (
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--success)" }} />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.appliesToAll")}</span>
              </div>
            )}

            {!targetsEverything && assignedProducts.length + assignedCategories.length + assignedBrands.length === 0 && (
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "var(--warning)" }} />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.noTargetAssigned")}</span>
              </div>
            )}
          </InfoCard>
        </div>

      {/* ACTIVITY */}
      <div id="d-activity" className="scroll-mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <InfoCard icon={Activity} title={t("admin.discounts.detail.activityTimeline")}>
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
                      <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.discounts.detail.discountCreated")}</h4>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.addedToSystem")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {fd(discount.created_at || discount.createdAt, locale)}
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
                        <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.discounts.detail.discountUpdated")}</h4>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.detailsModified")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                          {fd(discount.updated_at || discount.updatedAt, locale)}
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
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.noUpdates")}</span>
                </div>
              )}
            </div>
          </InfoCard>

          <InfoCard icon={User} title={t("admin.promotions.ui.generated.c91a5c878ea6")}>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>{t("admin.brands.detail.creator")}</p>
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
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.317f1e761f2f")}</p>
                )}
              </div>

              {hasUpdates && (
                <div className="pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.2a507530b84e")}</p>
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
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.cb0e0390da9a")}</p>
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
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.discounts.page.deleteOne", { name: nameOf(discount) })}</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.delete.body")}</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("admin.discounts.delete.cancel")}</button>
              <button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>{t("admin.promotions.ui.generated.30f6237868a6")}</>
                ) : (
                  <><Trash2 className="w-4 h-4" />{" "}{t("admin.discounts.delete.confirm")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
