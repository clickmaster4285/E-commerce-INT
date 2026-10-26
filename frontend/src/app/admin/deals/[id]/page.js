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
import { DealFormModal, SelectionModal } from "../_components/dealModals";
import { useTranslation } from "@/i18n/LanguageProvider";
import useDealSocketSync from "../../../../hooks/admin/useDealSocketSync";
import { useLocalized } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";

/* =========================================================
   HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function intlLocale(locale) {
  return locale === "ur" ? "ur-PK" : locale === "en" ? "en-US" : locale;
}

function fd(date, locale = "en") {
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(date));
}

function fdt(date, locale = "en") {
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

function getDealStatus(deal) {
  // ✅ Sirf Active/Inactive model — off (isActive false) ya expired sab "inactive"
  if (!deal?.isActive) return "inactive";
  const end = deal?.endDate ? new Date(deal.endDate) : null;
  if (end && end < new Date()) return "inactive";
  return "active";
}

function formatDealValue(deal, t) {
  const type = deal?.type || "";
  const value = Number(deal?.discountValue ?? 0);
  const off = t("admin.shipping.page.off");
  switch (type) {
    case "percentage": return `${value}% ${off}`;
    case "fixed_amount": case "fixed": return `Rs. ${value} ${off}`;
    case "buy_x_get_y": {
      const buy = deal?.buyQuantity ?? 1;
      const get = deal?.getQuantity ?? 1;
      const disc = deal?.getDiscountValue ?? 100;
      return `Buy ${buy} Get ${get} (${disc === 100 ? t("admin.deals.detail.freeGift") : `${disc}% ${off}`})`;
    }
    case "free_shipping": return t("admin.promotions.ui.generated.36abd54d7de4");
    case "bundle": return `Bundle @ Rs. ${deal?.bundlePrice ?? 0}`;
    default: return value > 0 ? `${value}` : "-";
  }
}

function formatTarget(target, t) {
  if (!target) return t("admin.discounts.page.allProducts");
  const map = {
    all: "admin.discounts.page.allProducts",
    product: "admin.discounts.page.specificProducts",
    category: "admin.discounts.page.categories",
    brand: "admin.discounts.page.brands",
    collection: "common.collection",
  };
  return map[target] ? t(map[target]) : target;
}

const getId = (item) => {
  if (!item) return "";
  if (typeof item === "object") return String(item._id || item.id || "");
  return String(item);
};

// Resolve product thumbnail (variant images, same as deals list page)
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ;
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

// Display label for a user — real name first, fallback email, then role.
function getUserLabel(user, t) {
  if (!user) return t("admin.shared.label.notAvailable");
  if (user.name || user.email) return user.name || user.email;
  if (user.role) return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  return t("admin.shared.label.notAvailable");
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
  const { t } = useTranslation();
  // ✅ Sirf Active/Inactive — purani values bhi inactive
  const config = {
    active: { bg: "var(--success-soft)", color: "var(--success)", border: "color-mix(in srgb, var(--success) 28%, transparent)", label: t("admin.banners.page.active") },
    inactive: { bg: "var(--danger-soft)", color: "var(--danger)", border: "color-mix(in srgb, var(--danger) 28%, transparent)", label: t("common.inactive") },
    scheduled: { bg: "var(--danger-soft)", color: "var(--danger)", border: "color-mix(in srgb, var(--danger) 28%, transparent)", label: t("common.inactive") },
    expired: { bg: "var(--danger-soft)", color: "var(--danger)", border: "color-mix(in srgb, var(--danger) 28%, transparent)", label: t("common.inactive") },
    disabled: { bg: "var(--danger-soft)", color: "var(--danger)", border: "color-mix(in srgb, var(--danger) 28%, transparent)", label: t("common.inactive") },
  };
  const c = config[status] || config.inactive;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide shrink-0"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const { t } = useTranslation();
  const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-[10px]", lg: "w-10 h-10 text-[12px]" };
  const colors = {
    emerald: { bg: "var(--success-soft)", text: t("admin.promotions.ui.generated.f41e0cb8441d") },
    blue: { bg: "var(--info-soft)", text: t("admin.promotions.ui.generated.8e18505083bf") },
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

/* =========================================================
   SKELETON LOADING UI — existing `.skeleton` shimmer utility (globals.css) reuse
   ✅ Real page ka same shell (header card + overview cards) render hota hai, sirf
      values shimmer karti hain — is liye data aane par layout shift nahi hota.
   ✅ Sirf loading state ke liye — real page design me koi change nahi.
========================================================= */
const SKELETON_ROUND = { borderRadius: "9999px" };

function SkeletonDataRows({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`dl-row-${i}`} className="flex items-center justify-between gap-3 py-1.5">
          <span className="skeleton inline-block h-2.5 w-[76px] rounded align-middle" />
          <span className="skeleton inline-block h-2.5 rounded align-middle" style={{ width: `${40 + ((i * 19) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

function DealDetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="w-full pb-8 space-y-3" aria-busy="true" aria-label={t("admin.promotions.ui.generated.9345e7b88fd8")}>
      {/* HEADER CARD */}
      <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <span className="skeleton mb-4 block h-3 w-28 rounded" />
        <div className="flex flex-col lg:flex-row gap-5">
          <span className="skeleton h-16 w-16 lg:h-20 lg:w-20 shrink-0 rounded-xl" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <span className="skeleton block h-5 w-[220px] rounded" />
              <span className="skeleton inline-block h-5 w-[70px]" style={SKELETON_ROUND} />
            </div>
            <span className="skeleton mb-3 block h-3 w-[60%] rounded" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={`dl-meta-${i}`} className="skeleton inline-block h-2.5 w-[110px] rounded align-middle" />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 shrink-0">
            <span className="skeleton block h-9 w-[70px] rounded-lg" />
            <span className="skeleton block h-9 w-[100px] rounded-lg" />
            <span className="skeleton block h-9 w-[76px] rounded-lg" />
          </div>
        </div>
      </div>

      {/* OVERVIEW — left: Deal Information card, right: Quick Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <InfoCard icon={Tag} title={t("admin.promotions.ui.generated.a1aba9dcd635")}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              {[0, 1, 2].map((col) => (
                <div key={`dl-col-${col}`} className="space-y-4">
                  {Array.from({ length: 4 }).map((_, r) => (
                    <div key={`dl-field-${col}-${r}`} className="min-w-0">
                      <span className="skeleton block h-2.5 w-[70px] rounded" />
                      <span className="skeleton mt-2 block h-3 rounded" style={{ width: `${55 + ((col * 13 + r * 17) % 40)}%` }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </InfoCard>
        </div>
        <InfoCard icon={Activity} title={t("admin.promotions.ui.generated.220a5be56a5d")}><SkeletonDataRows rows={7} /></InfoCard>
      </div>

      {/* HISTORY */}
      <InfoCard icon={Activity} title={t("admin.promotions.ui.generated.d2f941596b92")}><SkeletonDataRows rows={4} /></InfoCard>
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
  const { t, locale, dir } = useTranslation();
  const { nameOf, productNameOf, descriptionOf } = useLocalized();
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
      toast.success(variables.id ? t("admin.deals.toast.updated") : t("admin.deals.toast.created"));
      setShowModal(false);
      resetForm();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || t("admin.deals.toast.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => dealApi.delete(dealId),
    onMutate: () => markSelfAction("delete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success(t("admin.deals.toast.deleted"));
      router.push(backPath);
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || t("admin.deals.toast.deleteFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: () => {
      const currentlyOn = getDealStatus(deal) === "active";
      return dealApi.update(dealId, { isActive: !currentlyOn });
    },
    onMutate: () => markSelfAction("update"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      const wasOn = deal ? getDealStatus(deal) === "active" : true;
      toast.success(wasOn ? t("admin.deals.toast.deactivated") : t("admin.deals.toast.activated"));
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || t("admin.deals.toast.statusFailed")),
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
      status: d?.isActive ? "active" : "inactive",
      is_featured: Boolean(d?.isFeatured),
    });
    setEditingDeal(d);
    setActiveFormType(d?.applyTo || "all");
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(formData.name || "").trim()) return toast.error(t("admin.deals.validation.nameRequired"));
    if (formData.has_min_quantity) {
      const minQuantity = Number(formData.min_quantity);
      if (!Number.isInteger(minQuantity) || minQuantity < 1) {
        return toast.error(t("admin.deals.validation.minQty"));
      }
    }

    const dealValue = formData.value === "" ? NaN : Number(formData.value);
    if (["percentage", "fixed_amount"].includes(formData.value_type)) {
      if (Number.isNaN(dealValue) || dealValue < 0) return toast.error(t("admin.deals.validation.value"));
      if (formData.value_type === "percentage" && dealValue > 100) return toast.error(t("admin.deals.validation.percentage"));
    }

    if (formData.value_type === "buy_x_get_y") {
      if (!formData.buy_quantity || Number(formData.buy_quantity) <= 0) return toast.error(t("admin.deals.validation.buyQty"));
      if (!formData.get_quantity || Number(formData.get_quantity) <= 0) return toast.error(t("admin.deals.validation.getQty"));
    }

    if (formData.target_type === "product" && formData.selected_product_ids.length === 0) return toast.error(t("admin.deals.validation.selectProduct"));
    if (formData.target_type === "category" && formData.selected_category_ids.length === 0) return toast.error(t("admin.deals.validation.selectCategory"));
    if (formData.target_type === "brand" && formData.selected_brand_ids.length === 0) return toast.error(t("admin.deals.validation.selectBrand"));

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const endDate = formData.end_at ? dateToISO(formData.end_at) : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error(t("admin.deals.validation.dateOrder"));

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
  const isActive = status === "active";
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
  usePageTranslations({ model: "Deal", records: deal ? [deal] : [], locale, ready: !!deal && !loading, queryKey: ["deal", dealId], queryClient });
  usePageTranslations({ model: "Product", records: selectedProducts, locale, ready: !!deal && !loading, queryKey: ["deal-products"], queryClient });
  usePageTranslations({ model: "Category", records: selectedCategories, locale, ready: !!deal && !loading, queryKey: ["deal-categories"], queryClient });
  usePageTranslations({ model: "Brand", records: selectedBrands, locale, ready: !!deal && !loading, queryKey: ["deal-brands"], queryClient });

  // ✅ Loading — spinner ki jagah skeleton (real shell: header card + overview cards),
  //    is liye data aane par layout shift nahi hota.
  if (loading) {
    return <DealDetailSkeleton />;
  }

  if (!deal) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-soft)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "var(--danger)" }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.deals.detail.dealNotFound")}</h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.cb7004fb5393")}</p>
          <button onClick={() => router.push(backPath)} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <ArrowLeft className="w-4 h-4" />{" "}{t("admin.deals.detail.backToDeals")}</button>
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
          <ArrowLeft className="w-4 h-4" />{" "}{t("admin.deals.detail.backToDeals")}</button>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft)", border: "1px solid var(--border-color)" }}>
            <Tag className="w-10 h-10" style={{ color: "var(--accent)" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-[22px] md:text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{nameOf(deal)}</h1>
              <StatusBadge status={status} />
            </div>
            {deal.description ? (
              <p className="text-[13px] mb-3" style={{ color: "var(--text-muted)" }}>{descriptionOf(deal)}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />{" "}{t("admin.brands.detail.createdBy")}<b className="font-semibold" style={{ color: "var(--text-primary)" }}>{creator ? getUserLabel(creator, t) : t("admin.shared.label.notAvailable")}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />{" "}{t("admin.brands.detail.createdAt")}<b className="font-semibold" style={{ color: "var(--text-primary)" }}>{fdt(deal.created_at || deal.createdAt, locale)}</b>
              </span>
              {hasUpdates && editor ? (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />{" "}{t("admin.brands.detail.updatedBy")}<b className="font-semibold" style={{ color: "var(--text-primary)" }}>{editor.name || editor.email}</b>
                </span>
              ) : null}
              {hasUpdates ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />{" "}{t("admin.brands.detail.updatedAt")}<b className="font-semibold" style={{ color: "var(--text-primary)" }}>{fdt(deal.updated_at || deal.updatedAt, locale)}</b>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2 shrink-0">
            <button type="button" onClick={() => openEdit(deal)}
              className="h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <Edit3 className="w-3.5 h-3.5" />{" "}{t("admin.promotions.ui.generated.9ead47a82a0d")}</button>
            <button type="button" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate()}
              className="h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: isActive ? "var(--bg-card)" : "var(--success-soft)", border: `1px solid ${isActive ? "var(--border-color)" : "color-mix(in srgb, var(--success) 28%, transparent)"}`, color: isActive ? "var(--text-primary)" : "var(--success)" }}>
              <Ban className="w-3.5 h-3.5" /> {isActive ? t("admin.shared.action.deactivate") : t("admin.shared.action.activate")}
            </button>
            <button type="button" disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}
              className="h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)", color: "var(--danger)" }}>
              <Trash2 className="w-3.5 h-3.5" />{" "}{t("admin.promotions.ui.generated.9485989ff514")}</button>
          </div>
        </div>
      </div>

      {/* ✅ Section tabs hata diye gaye — saare sections (Overview / Products|Categories|
          Brands / Usage & Limits / History) ab ek hi page par continuously render hote hain */}

      {/* OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <InfoCard icon={Tag} title={t("admin.promotions.ui.generated.a1aba9dcd635")} id="d-overview"
            action={
              <button type="button" onClick={() => openEdit(deal)} className="text-[10px] font-bold flex items-center gap-1 transition hover:opacity-80" style={{ color: "var(--accent)" }}>
                <Edit3 className="w-3 h-3" />{" "}{t("admin.promotions.ui.generated.9ead47a82a0d")}</button>
            }>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              {/* COLUMN 1 — basic info */}
              <div className="space-y-4">
                <Field label={t("admin.deals.form.dealName")}>{nameOf(deal)}</Field>
                <Field label={t("common.description")}>
                  <span className="font-normal whitespace-pre-wrap break-words block">{descriptionOf(deal) || "—"}</span>
                </Field>
                <Field label={t("admin.promotions.ui.generated.687fe75d1223")}>
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold capitalize" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                    {deal.type?.replace(/_/g, " ") || "—"}
                  </span>
                </Field>
                <Field label={t("admin.discounts.form.discountValue")}>
                  <span style={{ color: "var(--success)" }}>{formatDealValue(deal, t)}</span>
                </Field>
              </div>

              {/* COLUMN 2 — targeting & schedule */}
              <div className="space-y-4">
                <Field label={t("admin.discounts.detail.applyTo")}>
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--info-soft)", color: "var(--info)" }}>
                    {formatTarget(deal.applyTo, t)}
                  </span>
                </Field>
                <Field label={deal.applyTo === "product" ? "Target Products" : deal.applyTo === "category" ? "Target Categories" : deal.applyTo === "brand" ? "Target Brands" : "Target"}>
                  {deal.applyTo === "product" && selectedProducts.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>{productNameOf(selectedProducts[0]) || t("common.product")}</span>
                      {selectedProducts.length > 1 && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>+{selectedProducts.length - 1}</span>
                      )}
                    </span>
                  ) : deal.applyTo === "category" && selectedCategories.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>{nameOf(selectedCategories[0]) || t("common.category")}</span>
                      {selectedCategories.length > 1 && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>+{selectedCategories.length - 1}</span>
                      )}
                    </span>
                  ) : deal.applyTo === "brand" && selectedBrands.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>{nameOf(selectedBrands[0]) || t("common.brand")}</span>
                      {selectedBrands.length > 1 && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>+{selectedBrands.length - 1}</span>
                      )}
                    </span>
                  ) : deal.applyTo === "all" ? "All Products" : "—"}
                </Field>
                <Field label={t("admin.discounts.form.startDate")}>{fdt(deal.startDate, locale)}</Field>
                <Field label={t("admin.promotions.ui.generated.269c8b374312")}>{fdt(deal.endDate, locale)}</Field>
              </div>

              {/* COLUMN 3 — usage & flags (form fields only) */}
              <div className="space-y-4">
                <Field label={t("admin.discounts.detail.usageLimit")}>{deal.usageLimit ? String(deal.usageLimit) : t("admin.shared.label.unlimited")}</Field>
                <Field label={t("admin.promotions.ui.generated.fdbbcd998612")}>{deal.perUserLimit ? String(deal.perUserLimit) : t("admin.shared.label.unlimited")}</Field>
                <Field label={t("admin.promotions.ui.generated.19a010ebee80")}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: isActive ? "var(--success-soft)" : "var(--danger-soft)", color: isActive ? "var(--success)" : "var(--danger)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? "var(--success)" : "var(--danger)" }} />
                    {isActive ? t("admin.discounts.page.active") : t("admin.discounts.page.inactive")}
                  </span>
                </Field>
                <Field label={t("admin.discounts.form.minQuantity")}>{deal.minQuantity ? String(deal.minQuantity) : "—"}</Field>
                <Field label={t("admin.promotions.ui.generated.fdb7fbfecdd5")}>
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
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.4ee9bbdde227")}</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.buyQuantity ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <Gift className="w-4 h-4 mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.42218e32a31f")}</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.getQuantity ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <Percent className="w-4 h-4 mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.1c1b9e4d6f8f")}</p>
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
                    <h4 className="text-[14px] font-black" style={{ color: "var(--text-primary)", letterSpacing: "0.02em" }}>{t("admin.promotions.ui.generated.9a058ded11dd")}</h4>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.dc2db543ecbc")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.15320ae28eb8")}</p>
                    <p className="text-[15px] font-black" style={{ color: "var(--text-primary)" }}>
                      {deal.bundleRule ? (
                        deal.bundleRule.mode === "limit"
                          ? `Buy ${deal.bundleRule.buyQuantity || 1} bundle${Number(deal.bundleRule.buyQuantity || 1) > 1 ? "s" : ""}`
                          : `Buy all selected bundle products`
                      ) : "Buy bundles to unlock offer"}
                    </p>
                  </div>
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.a4402e79a5b6")}</p>
                    <p className="text-[15px] font-black" style={{ color: "var(--success)" }}>
                      {!deal.bundleRule ? (
                        "—"
                      ) : deal.bundleRule.rewardType === "free_product" ? (
                        <>{t("admin.deals.detail.freeGift")}: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{productNameOf(deal.bundleRule.freeProduct) || t("common.product")}</span> ({deal.bundleRule.freeQuantity || 1})</>
                      ) : deal.bundleRule.rewardType === "percentage" ? (
                        <>{deal.bundleRule.value || 0}{t("admin.promotions.ui.generated.1d3e61873633")}</>
                      ) : (
                        <>{t("admin.promotions.ui.generated.3a724f5b35f0")}{" "}{deal.bundleRule.value || 0}{" "}{t("admin.promotions.ui.generated.da7a68734367")}</>
                      )}
                    </p>
                  </div>
                </div>

                {deal.bundleRule?.mode === "limit" && deal.bundleRule?.buyQuantity > 0 && (
                  <div className="rounded-lg px-3.5 py-2.5 text-[11px] font-semibold text-center" style={{ backgroundColor: "var(--info-soft)", color: "var(--info)", border: "1px solid color-mix(in srgb, var(--info) 25%, transparent)" }}>{t("admin.promotions.ui.generated.445e18de72ed")}{" "}{deal.bundleRule.buyQuantity}{" "}{t("admin.promotions.ui.generated.3a7d9767b123")}{Number(deal.bundleRule.buyQuantity) > 1 ? "s" : ""}{" "}{t("admin.promotions.ui.generated.2523c3480a89")}</div>
                )}
              </div>
            )}
            {deal.type === "free_shipping" && (
              <div className="p-4 rounded-lg mt-5 flex items-center gap-2.5" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <Truck className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-[12px] font-bold" style={{ color: "var(--success)" }}>{t("admin.promotions.ui.generated.36abd54d7de4")}</span>
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
                <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.brands.detail.allProducts")}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.3bfceeedcbba")}</p>
              </div>
            </div>
          ) : deal.applyTo === "product" ? (
            <div id="d-products" className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.promotions.ui.generated.07966f2a36ac")}</span>
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
                              {img ? <img src={img} alt=                              {productNameOf(p) || t("common.product")} className="w-full h-full object-cover" /> : <Box className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                            </div>
                            <p className="text-[9px] font-semibold mt-1 truncate text-center" style={{ color: "var(--text-primary)" }}>{productNameOf(p) || t("common.product")}</p>
                          </div>
                        );
                      })}
                    </div>
                    {selectedProducts.length > 8 && (
                      <p className="text-[10px] font-semibold mt-2" style={{ color: "var(--accent)" }}>+{selectedProducts.length - 8}{" "}{t("admin.promotions.ui.generated.e7c95b4c2824")}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.70ada614a1b6")}</p>
                )}
              </div>
            </div>
          ) : deal.applyTo === "category" ? (
            <div id="d-categories" className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.promotions.ui.generated.8798c94d30b6")}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{selectedCategories.length}</span>
                </div>
              </div>
              <div className="p-5 space-y-2">
                {selectedCategories.length > 0 ? (
                  <>
                    {selectedCategories.slice(0, 8).map((c) => (
                      <div key={c._id || c.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                        <span className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{nameOf(c) || t("common.category")}</span>
                      </div>
                    ))}
                    {selectedCategories.length > 8 && (
                      <p className="text-[10px] font-semibold pt-1" style={{ color: "var(--accent)" }}>+{selectedCategories.length - 8}{" "}{t("admin.promotions.ui.generated.e7c95b4c2824")}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.6218eb48312a")}</p>
                )}
              </div>
            </div>
          ) : deal.applyTo === "brand" ? (
            <div id="d-brands" className="rounded-2xl scroll-mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.promotions.ui.generated.00347db82ed6")}</span>
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
                          <span className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{nameOf(b) || t("common.brand")}</span>
                        </div>
                      );
                    })}
                    {selectedBrands.length > 8 && (
                      <p className="text-[10px] font-semibold pt-1" style={{ color: "var(--accent)" }}>+{selectedBrands.length - 8}{" "}{t("admin.promotions.ui.generated.e7c95b4c2824")}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.818a8e89ab5f")}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 flex items-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--warning-soft)" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning)" }} />
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.f3975a2d6b9c")}</p>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-3">
          <InfoCard icon={Activity} title={t("admin.promotions.ui.generated.220a5be56a5d")}>
            <div className="space-y-0.5">
              <DataRow icon={Percent} label={t("admin.promotions.ui.generated.687fe75d1223")} value={deal.type?.replace(/_/g, " ") || "—"} />
              <DataRow icon={DollarSign} label={t("admin.discounts.form.discountValue")} value={formatDealValue(deal, t)} highlight />
              <DataRow icon={Target} label={t("admin.discounts.detail.applyTo")} value={formatTarget(deal.applyTo, t)} />
              <DataRow icon={Calendar} label={t("admin.discounts.form.startDate")} value={fdt(deal.startDate, locale)} />
              <DataRow icon={Calendar} label={t("admin.promotions.ui.generated.269c8b374312")} value={fdt(deal.endDate, locale)} />
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Activity className="w-3.5 h-3.5" />{" "}{t("admin.brands.detail.productTableStatus")}</span>
                <StatusBadge status={status} />
              </div>
            </div>
          </InfoCard>

          <div id="d-usage" className="scroll-mt-4 space-y-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.discounts.detail.usageLimit")}</p>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.usageLimit ? String(deal.usageLimit) : t("admin.shared.label.unlimited")}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <User className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.fdbbcd998612")}</p>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{deal.perUserLimit ? String(deal.perUserLimit) : t("admin.shared.label.unlimited")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORY */}
      <InfoCard icon={Activity} title={t("admin.promotions.ui.generated.d2f941596b92")} id="d-history">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                {[
                  { id: "when", label: t("common.date") },
                  { id: "action", label: t("admin.deals.detail.dealDetails") },
                  { id: "by", label: t("admin.discounts.detail.createdBy") },
                  { id: "details", label: t("admin.discounts.detail.detailsModified") },
                ].map((h) => (
                  <th key={h.id} className="py-2 pr-4 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: hasUpdates ? "1px solid var(--border-color)" : "none" }}>
                <td className="py-2.5 pr-4 text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{fdt(deal.created_at || deal.createdAt, locale)}</td>
                <td className="py-2.5 pr-4">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>{t("admin.categories.detail.createdAt")}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {creator ? <Avatar user={creator} size="sm" color="emerald" /> : null}
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{getUserLabel(creator, t)}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-[11px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.0a9dcb3cf2ea")}</td>
              </tr>
              {hasUpdates && (
                <tr>
                  <td className="py-2.5 pr-4 text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{fdt(deal.updated_at || deal.updatedAt, locale)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--info-soft)", color: "var(--info)" }}>{t("admin.discounts.detail.updated")}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {editor ? <Avatar user={editor} size="sm" color="blue" /> : null}
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{editor ? getUserLabel(editor, t) : t("admin.shared.label.notAvailable")}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-[11px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.44238ab8b809")}</td>
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
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.deals.page.deleteOne", { name: nameOf(deal) })}</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.2a00f73b3398")}</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("admin.discounts.delete.cancel")}</button>
              <button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? "Deleting..." : <><Trash2 className="w-4 h-4" />{" "}{t("admin.promotions.ui.generated.ac2530a3152d")}</>}
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
