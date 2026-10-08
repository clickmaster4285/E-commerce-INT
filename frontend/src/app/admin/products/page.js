"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProductSocketSync, patchProductStatusInCaches } from "@/hooks/useProductSocketSync";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Grid3x3,
  List,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  X,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { brandApi } from "@/apis/admin/brandApi";
import { variantApi } from "@/apis/admin/variantApi";
import { attributeApi } from "@/apis/admin/attributeApi";
import CategoryFormModal from "@/components/admin/CategoryFormModal";
import ProductFormModal from "@/components/admin/ProductFormModal";

// ✅ Ek hi page size — footer me "rows per page" selector nahi (simple + predictable list)
const PRODUCTS_PER_PAGE = 20;

/**
 * ✅ Pagination ka page-number list — simple + predictable:
 *   • hamesha First (1) aur Last page
 *   • beech me 5 consecutive page numbers (current page beech me, edges par chipke
 *     hue — is liye list "ek taraf khaali" kabhi nahi lagti)
 *   • skip marker "…" page-button ke barabar wide hai — is liye pagination
 *     "1 – 3" jaisa toota/broken nahi lagta, sirf saaf saaf "beech ke pages chhupay gaye".
 * Pure function hai (testable), component se bahar rakhi gayi hai.
 */
function buildPageList(currentPage, totalPages, MID = 5) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);
  if (total <= MID + 2) return Array.from({ length: total }, (_, i) => i + 1);

  // 5 consecutive middle numbers, current page unke beech me (edges par chipke hue)
  const start = Math.max(2, Math.min(current - Math.floor((MID - 1) / 2), total - MID));
  const end = start + MID - 1;

  const pages = [1];
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ;


/* =========================================================
HELPERS & ICONS
========================================================= */

// Custom Icons for the Professional Modal (matching Category Form style)
const Icons = {
  FileText: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Text: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 4h7" />
    </svg>
  ),
  Hash: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  Filter: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1.994 1.994 0 013 6.586V4z" />
    </svg>
  ),
};

function createEmptyVariant(sku = "") {
  return {
    _id: null, sku, title: "", description: "", cost_price: "", selling_price: "",
    quantity: "0",
    option_values: {},
    images: [],
  };
}

function getSkuNumber(sku = "") {
  const match = String(sku).match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function getImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url}`;
}

async function compressProductImage(file) {
  const MAX_SIZE = 1600;
  const QUALITY = 0.82;
  if (!file.type.startsWith("image/")) throw new Error("Invalid image file");
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width >= height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Unable to process image")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Image compression failed")); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp", lastModified: Date.now() }));
        },
        "image/webp",
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Unable to read image")); };
    img.src = objectUrl;
  });
}

function handlePermissionError(error, defaultMessage, resource = "resource") {
  const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
  const normalized = String(message).toLowerCase();
  if (normalized.includes("permission") || normalized.includes("access denied") || normalized.includes("forbidden") || error?.response?.status === 403) {
    toast.error(`You don't have permission to modify this ${resource}.`, { duration: 6000, description: "Contact an administrator to grant you access." });
    return;
  }
  toast.error(message || defaultMessage);
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid);
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    return "";
  }
  return String(value);
}

function normalizeOptionToken(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    if (v.$oid) return String(v.$oid);
    const label = v.label || v.value || v.name || "";
    return typeof label === "string" ? label.trim() : "";
  }
  return String(v).trim();
}

function getAssignedOptionList(attr) {
  if (!attr) return [];
  const seen = new Set();
  const out = [];
  const push = (v) => {
    const token = normalizeOptionToken(v);
    if (!token) return;
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(token);
  };
  const configVal = attr?.category_config?.value;
  if (Array.isArray(configVal)) {
    configVal.forEach(push);
  } else if (typeof configVal === "string" && configVal.trim()) {
    configVal.split(",").map((s) => s.trim()).filter(Boolean).forEach(push);
  }
  const directValues = attr?.values;
  if (Array.isArray(directValues)) {
    directValues.forEach(push);
  } else if (typeof directValues === "string" && directValues.trim()) {
    directValues.split(",").map((s) => s.trim()).filter(Boolean).forEach(push);
  }
  return out;
}


/* =========================================================
MAIN COMPONENT
======================================================== */

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useProductSocketSync();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
const [viewMode, setViewMode] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768 ? "grid" : "list";
  }
  return "list";
});
  const [currentPage, setCurrentPage] = useState(1);


  // Attribute Modal States
  const [showNewAttributeModal, setShowNewAttributeModal] = useState(false);
  const [attributeFormData, setAttributeFormData] = useState({ 
    name: "", 
    code: "", 
    data_type: "multi_select", 
    values: [], 
    variant_allowed: true,
    value: false,
  });

  // Product Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  const [formData, setFormData] = useState({
    category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [], variants: [],
  });
  const [tagInput, setTagInput] = useState("");


  /* Queries */
  // ✅ SERVER-SIDE PAGINATION — search/filter/page sab backend par (DB-level).
  // Backend response: { products, stats, pagination } — sirf current page ke products aate hain.
  const {
    data: productsData,
    isLoading,
    isFetching,
    isError: productsError,
    error: productsErrorMsg,
    refetch: refetchProducts,
  } = useQuery({
    // ⚠️ Page size key ke END me hai — status filter index 6 par hi rahe, warna
    //    patchProductStatusInCaches ka status-filter detection toot jayega.
    queryKey: ["products", "paginated", currentPage, search, filterCategory, filterBrand, filterStatus, PRODUCTS_PER_PAGE],
    queryFn: () => productApi.getPaginated({ page: currentPage, limit: PRODUCTS_PER_PAGE, search: search || "", category_id: filterCategory, brand_id: filterBrand, status: filterStatus }),
    retry: false,
  });
  const products = productsData?.products || [];

  // ✅ NAVIGATION FIX (footer stable rehna chahiye):
  //    Page number click karne par naye page ki query ka apna key hota hai, is liye
  //    request chalte waqt `productsData` undefined ho jata hai → total 0 → pagination
  //    bar ghayab ho jati thi (layout jump + "navigation tooti hui" feel).
  //    Ab same filters ke liye last known pagination yaad rakhi jati hai, is liye
  //    "Showing 21–40 of 1,099" aur buttons turant update hote hain.
  const paginationSignature = `${search}|${filterCategory}|${filterBrand}|${filterStatus}|${PRODUCTS_PER_PAGE}`;
  const [paginationMemory, setPaginationMemory] = useState(null);
  useEffect(() => {
    if (productsData?.pagination) {
      setPaginationMemory({ signature: paginationSignature, pagination: productsData.pagination });
    }
  }, [productsData, paginationSignature]);
  const rememberedPagination =
    paginationMemory?.signature === paginationSignature ? paginationMemory.pagination : null;

  const pagination = productsData?.pagination || rememberedPagination || { total: 0, page: currentPage, limit: PRODUCTS_PER_PAGE, pages: 1, hasNext: false, hasPrev: false };

  // ✅ SUMMARY CARDS ki API — products list se bilkul ALAG query.
  //    Backend optimization: stats ab list response ka hissa nahi (dedicated /products/stats endpoint),
  //    is liye cards load hote waqt table block nahi hota — aur table load hote waqt cards block nahi hote.
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["products", "stats", search, filterCategory, filterBrand, filterStatus],
    queryFn: () => productApi.getStats({ search: search || "", category_id: filterCategory, brand_id: filterBrand, status: filterStatus }),
    retry: false,
  });
  // Dedicated stats → fallback: agar stats API fail ho jaye to list ke (legacy) stats ya current page se values.
  const productStats = summaryData || productsData?.stats || null;
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll, retry: false });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll, retry: false });

  useEffect(() => {
    if (formData.category_id) {
      fetchCategoryAttributes(formData.category_id, editingProduct);
    } else {
      setCategoryAttributes([]);
    }
  }, [formData.category_id]);

  const fetchCategoryAttributes = async (catId, productForMerge = null) => {
    try {
      setLoadingAttributes(true);
      const [catRes, allRes] = await Promise.all([
        attributeApi.getByCategory(catId).catch(() => []),
        productForMerge ? attributeApi.getAll().catch(() => []) : Promise.resolve([]),
      ]);
      const catList = Array.isArray(catRes) ? catRes : [];
      const allList = Array.isArray(allRes) ? allRes : [];

      if (!productForMerge) {
        setCategoryAttributes(catList);
        return;
      }

      const codesInVariants = new Set();
      (productForMerge?.variants || []).forEach((v) => {
        if (v && v.attributes && typeof v.attributes === "object") {
          Object.keys(v.attributes).forEach((k) => codesInVariants.add(String(k)));
        }
      });

      const byCode = new Map();
      catList.forEach((a) => { if (a?.code) byCode.set(String(a.code), a); });
      allList.forEach((a) => { if (a?.code && !byCode.has(String(a.code))) byCode.set(String(a.code), a); });

      const ensureCategoryConfig = (attr) => {
        if (!attr) return attr;
        if (attr.category_config && attr.category_config.attribute_id) return attr;
        return {
          ...attr,
          category_config: {
            attribute_id: attr._id,
            is_required: false,
            is_visible: true,
            is_filterable: true,
            is_searchable: true,
            is_variant_option: true,
            sort_order: 0,
            value: "",
          },
        };
      };

      const merged = [];
      const seenIds = new Set();
      catList.forEach((a) => { const id = String(a?._id || ""); if (id && !seenIds.has(id)) { seenIds.add(id); merged.push(ensureCategoryConfig(a)); } });
      codesInVariants.forEach((code) => {
        const found = byCode.get(code);
        if (found) {
          const id = String(found._id || "");
          if (id && !seenIds.has(id)) { seenIds.add(id); merged.push(ensureCategoryConfig(found)); }
        }
      });
      setCategoryAttributes(merged);
    } catch (error) {
      console.error("Failed to fetch attributes", error);
    } finally {
      setLoadingAttributes(false);
    }
  };

  const handleAddVariantAttributeValue = async (attr, optionLabel, variantIndex) => {
    const trimmed = String(optionLabel || "").trim();
    if (!trimmed || !attr) return;
    const existingLabels = getAssignedOptionList(attr);
    if (existingLabels.some((opt) => String(opt).toLowerCase() === trimmed.toLowerCase())) {
      toast.info(`"${trimmed}" already exists in ${attr.name}`);
      if (variantIndex !== undefined) {
        updateVariantOption(variantIndex, attr.code, trimmed);
      }
      return;
    }
    const attributeId = attr?._id;
    if (!attributeId) {
      toast.error("Cannot add value: attribute id not found");
      return;
    }
    const previousValues = Array.isArray(attr.values) ? attr.values : [];
    const updatedValues = [
      ...previousValues.map((v) => ({
        label: v?.label || v?.value || String(v),
        value: v?.value || v?.label || String(v),
      })),
      { label: trimmed, value: trimmed },
    ];
    try {
      await attributeApi.update(String(attributeId), { values: updatedValues });
      if (formData.category_id) {
        const updatedCategoryAttrs = categoryAttributes.map((a) => {
          const aid = a?.category_config?.attribute_id || a?._id;
          if (String(aid) === String(attributeId)) {
            const currentVal = a?.category_config?.value;
            const valArray = Array.isArray(currentVal) ? currentVal : (currentVal ? [currentVal] : []);
            return {
              attribute_id: aid,
              is_required: Boolean(a?.category_config?.is_required),
              is_visible: a?.category_config?.is_visible !== false,
              is_filterable: Boolean(a?.category_config?.is_filterable),
              is_searchable: Boolean(a?.category_config?.is_searchable),
              is_variant_option: a?.category_config?.is_variant_option !== false,
              sort_order: a?.category_config?.sort_order ?? 0,
              value: [...valArray, trimmed],
            };
          }
          return {
            attribute_id: a?.category_config?.attribute_id || a?._id,
            is_required: Boolean(a?.category_config?.is_required),
            is_visible: a?.category_config?.is_visible !== false,
            is_filterable: Boolean(a?.category_config?.is_filterable),
            is_searchable: Boolean(a?.category_config?.is_searchable),
            is_variant_option: a?.category_config?.is_variant_option !== false,
            sort_order: a?.category_config?.sort_order ?? 0,
            value: a?.category_config?.value ?? "",
          };
        });
        await categoryApi.updateAttributes(formData.category_id, updatedCategoryAttrs);
        setCategoryAttributes((prev) =>
          prev.map((a) => {
            const aid = a?.category_config?.attribute_id || a?._id;
            if (String(aid) === String(attributeId)) {
              const currentVal = a?.category_config?.value;
              const valArray = Array.isArray(currentVal) ? currentVal : (currentVal ? [currentVal] : []);
              return {
                ...a,
                values: updatedValues,
                category_config: { ...a.category_config, value: [...valArray, trimmed] },
              };
            }
            return a;
          })
        );
      }
      toast.success(`Added "${trimmed}" to ${attr.name}`);
      if (variantIndex !== undefined) {
        updateVariantOption(variantIndex, attr.code, trimmed);
      }
    } catch (err) {
      console.error("Add value error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to add value");
      throw err;
    }
  };

  const variantAllowedAttributes = useMemo(() => {
    return categoryAttributes.filter((attr) => {
      if (!attr) return false;
      const code = String(attr.code || "").trim();
      const id = normalizeId(attr._id);
      if (!code && !id) return false;
      const config = attr.category_config;
      if (config) {
        const visible = config?.is_visible !== false;
        const variantOk = config?.is_variant_option !== false;
        return Boolean(config.attribute_id) && visible && variantOk;
      }
      return true;
    });
  }, [categoryAttributes]);

  useEffect(() => {
    if (!productsError || !productsErrorMsg) return;
    const msg = String(productsErrorMsg?.message || "").toLowerCase();
    if (msg.includes("permission") || msg.includes("access denied") || msg.includes("forbidden")) {
      toast.error("You don't have permission to view products.", { duration: 6000, description: "Contact an administrator to grant you access." });
    }
  }, [productsError, productsErrorMsg]);

  /* Mutations */
  const [createLoading, setCreateLoading] = useState(false);

  const deleteMutation = useMutation({ mutationFn: productApi.delete, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); setProductToDelete(null); }, onError: (e) => handlePermissionError(e, "Product delete failed", "product") });
  // ✅ Activate/deactivate OPTIMISTIC: click karte hi row + summary cards foran
  //    update ho jaate hain. Purana flow har click par PATCH + poori list/stats
  //    ka refetch (+ usi browser me socket echo ka dobara refetch) ka wait karta
  //    tha — is liye toggle "slow" lagta tha. Ab koi list refetch nahi.
  const toggleStatusMutation = useMutation({
    mutationFn: (id) => productApi.toggleStatus(id),
    onMutate: async (productId) => {
      const pid = String(productId);
      const product = products.find((p) => String(p?._id) === pid);
      const previousStatus = product?.status === "inactive" ? "inactive" : "active";
      const nextStatus = previousStatus === "active" ? "inactive" : "active";

      await queryClient.cancelQueries({ queryKey: ["products"] });
      // Rollback ke liye snapshot
      const listSnapshot = queryClient.getQueriesData({ queryKey: ["products", "paginated"] });
      const statsSnapshot = queryClient.getQueriesData({ queryKey: ["products", "stats"] });
      const detailSnapshot = queryClient.getQueriesData({ queryKey: ["product", pid] });

      patchProductStatusInCaches(queryClient, { productId: pid, status: nextStatus, previousStatus });

      return { listSnapshot, statsSnapshot, detailSnapshot, previousStatus, nextStatus };
    },
    onSuccess: (res, productId, ctx) => {
      // Server ki authority se reconcile (rapid double-click jaisi race safe)
      const confirmed = res?.product?.status;
      if (confirmed && ctx?.previousStatus && confirmed !== ctx.previousStatus) {
        patchProductStatusInCaches(queryClient, {
          productId: String(productId),
          status: confirmed,
          previousStatus: ctx.previousStatus,
        });
      }
      toast.success("Product status updated");
    },
    onError: (e, _productId, ctx) => {
      // Ulta revert — UI wapas purani state par
      ctx?.listSnapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      ctx?.statsSnapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      ctx?.detailSnapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      handlePermissionError(e, "Status update failed", "product");
    },
  });
  
  
  const assignAttributeToCategoryMutation = useMutation({
    mutationFn: ({ categoryId, attributes }) => categoryApi.updateAttributes(categoryId, attributes),
  });

  const createAttributeMutation = useMutation({
    mutationFn: (data) => attributeApi.create(data),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      const created = res?.data || res;
      const categoryId = formData.category_id;
      if (created?._id && categoryId) {
        const alreadyAssigned = categoryAttributes.some(
          (a) => String(a?.category_config?.attribute_id || a?._id) === String(created._id)
        );
        if (!alreadyAssigned) {
          const nextAttributes = categoryAttributes.map((a) => {
            const aid = a?.category_config?.attribute_id || a?._id;
            return {
              attribute_id: aid,
              is_required: Boolean(a?.category_config?.is_required),
              is_visible: a?.category_config?.is_visible !== false,
              is_filterable: Boolean(a?.category_config?.is_filterable),
              is_searchable: Boolean(a?.category_config?.is_searchable),
              is_variant_option: a?.category_config?.is_variant_option !== false,
              sort_order: a?.category_config?.sort_order ?? 0,
              value: a?.category_config?.value ?? "",
            };
          });
          nextAttributes.push({
            attribute_id: created._id,
            is_required: false,
            is_visible: true,
            is_filterable: false,
            is_searchable: false,
            is_variant_option: true,
            sort_order: nextAttributes.length,
            value: "",
          });
          try {
            await assignAttributeToCategoryMutation.mutateAsync({ categoryId, attributes: nextAttributes });
          } catch (e) {
            handlePermissionError(e, "Attribute created but failed to assign to category", "category");
          }
        }
      }
      toast.success("Attribute created successfully!");
      setShowNewAttributeModal(false);
      resetAttributeForm();
      if (formData.category_id) fetchCategoryAttributes(formData.category_id);
    },
    onError: (e) => handlePermissionError(e, "Failed to create attribute", "attribute")
  });

  /* Handlers */
  const openProductDetails = (p) => router.push(`/admin/products/${p._id}`);
  const handleToggleStatus = (p) => { if (p?._id) toggleStatusMutation.mutate(p._id); };

  const openNewProduct = async () => {
    setFormData({ category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [], variants: [] });
    setCategoryAttributes([]);
    setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0);
    setShowModal(true);
  };

  const getNextLocalSku = async () => {
    const result = await variantApi.getNextSku();
    const databaseSku = getSkuNumber(result?.sku || result?.data?.sku || "");
    const localSku = Math.max(0, ...formData.variants.map((v) => getSkuNumber(v.sku)));
    return `sku_${Math.max(databaseSku, localSku + 1)}`;
  };

  const addVariant = async () => {
    try {
      const sku = await getNextLocalSku();
      setFormData((prev) => {
        const newIndex = prev.variants.length;
        setExpandedVariant(newIndex);
        return { ...prev, variants: [...prev.variants, createEmptyVariant(sku)] };
      });
    } catch { toast.error("Unable to generate SKU"); }
  };

  const duplicateVariant = async (index) => {
    try {
      const sku = await getNextLocalSku();
      const old = formData.variants[index];
      if (!old) return;
      const copy = { ...old, _id: null, sku, option_values: { ...old.option_values }, images: [] };
      setFormData((prev) => {
        const v = [...prev.variants]; v.splice(index + 1, 0, copy);
        return { ...prev, variants: v };
      });
      setExpandedVariant(index + 1);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const removeVariant = (index) => {
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
    setExpandedVariant((curr) => {
      const nextLength = formData.variants.length - 1;
      if (nextLength <= 0) return 0;
      if (curr === index) return Math.max(0, Math.min(index, nextLength - 1));
      return curr > index ? curr - 1 : curr;
    });
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[index] = { ...v[index], [field]: value }; return { ...prev, variants: v }; });
  };

  const updateVariantOption = (vi, attrCode, value) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      v[vi] = { ...v[vi], option_values: { ...v[vi].option_values, [attrCode]: value } };
      return { ...prev, variants: v };
    });
  };

  const handleImageUpload = async (vi, event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const valid = files.filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (valid.length !== files.length) { toast.error("Only JPG, PNG and WebP images are allowed"); event.target.value = ""; return; }
    try {
      const compressed = await Promise.all(valid.map(compressProductImage));
      const images = compressed.map((f) => ({ file: f, existing: false, preview: URL.createObjectURL(f) }));
      setFormData((prev) => {
        const v = [...prev.variants];
        v[vi] = { ...v[vi], images: [...v[vi].images, ...images] };
        return { ...prev, variants: v };
      });
      toast.success(`${images.length} image${images.length > 1 ? "s" : ""} uploaded`);
    } catch (e) { toast.error(e?.message || "Image processing failed"); }
    event.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      const img = v[vi].images[ii];
      if (img?.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      v[vi] = { ...v[vi], images: v[vi].images.filter((_, i) => i !== ii) };
      return { ...prev, variants: v };
    });
  };

  const handleEdit = (product) => {
    const currentTagNames = (product.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
    
    setFormData({
      category_id: normalizeId(product?.category_id), brand_id: normalizeId(product?.brand_id),
      name: product?.name || "", description: product?.description || "", tax: String(product?.tax ?? 0),
      status: product?.status || "active", tag_names: currentTagNames, variants: [],
    });
    setTagInput("");
    setEditingProduct(product); setCurrentStep(1); setExpandedVariant(0);
    setShowModal(true);
  };

  const handleDelete = (p) => { setProductToDelete(p); setShowDeleteModal(true); };
  const confirmDelete = () => { if (productToDelete?._id) deleteMutation.mutate(productToDelete._id); };

  const handleNextStep = () => {
    if (!formData.category_id) { toast.error("Please select category"); return; }
    if (!formData.brand_id) { toast.error("Please select brand"); return; }
    if (!formData.name.trim()) { toast.error("Product name is required"); return; }
    setCurrentStep(2);
  };


  const addTag = (e) => {
    e?.preventDefault();
    const val = tagInput.trim().toLowerCase();
    if (!val) return;
    if (formData.tag_names.includes(val)) { toast.info("Tag already added"); setTagInput(""); return; }
    setFormData(prev => ({ ...prev, tag_names: [...prev.tag_names, val] }));
    setTagInput("");
  };

  const removeTag = (tagName) => {
    setFormData(prev => ({ ...prev, tag_names: prev.tag_names.filter(t => t !== tagName) }));
  };



  const resetAttributeForm = () => {
    setAttributeFormData({ name: "", code: "", data_type: "multi_select", values: [], variant_allowed: true, value: false });
  };
  const handleOpenAttributeModal = () => {
    resetAttributeForm();
    setShowNewAttributeModal(true);
  };
  const handleAddAttributeValue = () => {
    setAttributeFormData(prev => ({ ...prev, values: [...prev.values, { label: "", value: "" }] }));
  };
  const handleRemoveAttributeValue = (index) => {
    setAttributeFormData(prev => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }));
  };
  const handleAttributeValueChange = (index, field, val) => {
    setAttributeFormData(prev => {
      const newValues = [...prev.values];
      newValues[index] = { ...newValues[index], [field]: val };
      return { ...prev, values: newValues };
    });
  };
  const handleAttributeSubmit = (e) => {
    e.preventDefault();
    if (!attributeFormData.name.trim()) { toast.error("Attribute name is required"); return; }
    const finalCode = attributeFormData.code.trim() || attributeFormData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const dt = attributeFormData.data_type;
    let normalizedValues;
    if (dt === "boolean") {
      const boolVal = attributeFormData.value === true ? "true" : "false";
      normalizedValues = [{ label: boolVal === "true" ? "True" : "False", value: boolVal }];
    } else {
      normalizedValues = (attributeFormData.values || [])
        .map((v) => {
          const raw = (v?.value ?? v?.label ?? "").toString().trim();
          if (!raw) return null;
          return { label: raw, value: raw.toLowerCase() };
        })
        .filter(Boolean);
    }
    const payload = {
      name: attributeFormData.name.trim(),
      code: finalCode,
      data_type: dt,
      variant_allowed: true,
      values: normalizedValues,
    };
    createAttributeMutation.mutate(payload);
  };

  const getCategoryName = (p) => {
    const cid = normalizeId(p?.category_id);
    return p?.category_id?.name || categories.find((c) => String(c._id) === cid)?.name || "Unknown";
  };
  const getBrandName = (p) => {
    const bid = normalizeId(p?.brand_id);
    return p?.brand_id?.name || brands.find((b) => String(b._id) === bid)?.name || "Unknown";
  };

  // ✅ SERVER-SIDE PAGINATION — search/filter DB par apply ho chuke hain (backend),
  // is liye yahan koi client-side filtering/slicing nahi. Jo data aaya wohi current page hai.
  const paginatedProducts = products;
  const totalPages = Math.max(1, Number(pagination.pages) || 1);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  // ✅ Stats ab server se aate hain (poori filtered dataset par, sirf current page par nahi).
  // Agar stats missing hon (legacy response) to current page data se fallback.
  const activeProducts = productStats ? Number(productStats.activeProducts) || 0 : products.filter((p) => p?.status === "active").length;
  // ✅ Summary card: Inactive count (backend se, warna Total - Active)
  const inactiveProducts = productStats
    ? Number(productStats.inactiveProducts) || Math.max(0, (Number(productStats.totalProducts) || 0) - activeProducts)
    : products.filter((p) => p && p.status !== "active").length;
  const totalVariants = productStats ? Number(productStats.totalVariants) || 0 : products.reduce((t, p) => t + (p?.variants?.length || 0), 0);

  // ✅ Backend `limit` ko clamp karta hai (max 100) — is liye effective size wahi
  //    maante hain jo API ne maangi, warna "Showing 1-100" ho jab tak rows 20 hi aayein.
  const effectivePageSize = Number(pagination.limit) || PRODUCTS_PER_PAGE;
  const totalRecords = Number(pagination.total) || 0;
  const firstRow = totalRecords === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const lastRow = Math.min(currentPage * effectivePageSize, totalRecords);
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");

  const goToPage = (pg) => {
    setCurrentPage(Math.min(Math.max(1, pg), totalPages));
  };

  // ✅ Simple, predictable page list (module-level helper — buildPageList)
  const renderPageNumbers = () => buildPageList(currentPage, totalPages);
  const isDeleting = deleteMutation.isPending;
  const isToggling = toggleStatusMutation.isPending;

  // ✅ Featured Products page — mark / unmark (same optimistic pattern as status toggle)
  const featuredMutation = useMutation({
    mutationFn: (id) => productApi.toggleFeatured(id),
    onMutate: async (productId) => {
      const pid = String(productId);
      const nextFeatured = !(products.find((p) => String(p?._id) === pid)?.is_featured === true);
      await queryClient.cancelQueries({ queryKey: ["products"] });
      // Optimistic: star turant toggle ho jaye
      queryClient.setQueriesData({ queryKey: ["products", "paginated"] }, (old) =>
        old && Array.isArray(old.products)
          ? { ...old, products: old.products.map((p) => (String(p?._id) === pid ? { ...p, is_featured: nextFeatured } : p)) }
          : old
      );
      return { pid, nextFeatured };
    },
    onError: (e, _id, ctx) => {
      // Rollback
      if (ctx?.pid) {
        queryClient.setQueriesData({ queryKey: ["products", "paginated"] }, (old) =>
          old && Array.isArray(old.products)
            ? { ...old, products: old.products.map((p) => (String(p?._id) === ctx.pid ? { ...p, is_featured: !ctx.nextFeatured } : p)) }
            : old
        );
      }
      toast.error(e?.response?.data?.message || "Failed to update featured status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
    },
  });
  const isTogglingFeatured = featuredMutation.isPending;
  const handleToggleFeatured = (product) => {
    const wasFeatured = product?.is_featured === true;
    // ✅ Client guard: inactive product ko featured mark nahi kar sakte. Backend par
    //    bhi yehi rule hai (400), magar guard yahan hai taake user ko foran English
    //    toast mile — bina request bhejte hue. Pehle yahan koi check nahi tha, is liye
    //    API chup-chaap "removed from featured" bhej deti thi par green toast
    //    "Marked as featured" dikhta tha aur product featured list me nahi aata tha.
    if (!wasFeatured && product?.status !== "active") {
      toast.error("This product is inactive. Please activate it before marking it as featured.", {
        description: `${product?.name || "Product"} is currently inactive, so it can't be featured.`,
        duration: 5000,
      });
      return;
    }
    featuredMutation.mutate(product?._id, {
      onSuccess: (res) => {
        toast.success(res?.message || (wasFeatured ? "Removed from featured products" : "Marked as featured"));
      },
    });
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  // ✅ LOADING UX: poori page ko spinner se block nahi karte — header/toolbar turant render hote hain,
  //    Summary cards apna skeleton dikhate hain aur Product table apne skeleton rows (dono independent).

  return (
    <>
      {createLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}>
          <div className="rounded-xl px-8 py-6 flex flex-col items-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--text-muted)", borderTopColor: "transparent" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Redirecting...</span>
          </div>
        </div>
      )}
      <div className="w-full min-h-screen space-y-5" style={{ color: "var(--text-primary)" }}>
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-7 tracking-tight">Product Management</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Manage products, variants, stock and pricing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setViewMode("list")} className="flex h-9 w-9 items-center justify-center rounded-lg transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><List className="h-4 w-4" /></button>
            <button type="button" onClick={() => setViewMode("grid")} className="flex h-9 w-9 items-center justify-center rounded-lg transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><Grid3x3 className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={openNewProduct} className="flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Plus className="h-4 w-4" /> Add Product</button>
        </div>
      </div>

      {/* STATS — ✅ Summary API load hote waqt card-level skeleton (table ko block nahi karta) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isSummaryLoading
          ? Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={`summary-skeleton-${i}`} />)
          : [{ l: "Total Products", v: productStats ? Number(productStats.totalProducts) || 0 : pagination.total }, { l: "Active", v: activeProducts, c: "text-emerald-500" }, { l: "Inactive", v: inactiveProducts, c: "text-red-400" }, { l: "Total Variants", v: totalVariants, c: "text-blue-500" }].map((s, i) => (
            <div key={i} className="rounded-lg p-4" style={cardStyle}>
              <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{s.l}</p>
              <p className={`mt-1 text-[20px] font-bold ${s.c || ""}`}>{s.v}</p>
            </div>
          ))}
      </div>

      {/* ===== Professional Toolbar: Search Left, Filters Right ===== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Wider Search Bar (Left Side) */}
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input 
            type="text" 
            placeholder="Search by product name or SKU..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} 
            className="h-9 w-full pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" 
            style={inputStyle} 
          />
        </div>

        {/* Filters (Right Side) */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category & Brand dropdowns ke andar search bar hai (lambi lists ke liye) */}
          <SelectFilter
            value={filterCategory}
            onChange={(v) => { setFilterCategory(v); setCurrentPage(1); }}
            options={categories.map((c) => ({ value: String(c._id), label: c.name }))}
            placeholder="All Categories"
            searchable
            searchPlaceholder="Search category..."
            clearLabel="All Categories"
          />
          <SelectFilter
            value={filterBrand}
            onChange={(v) => { setFilterBrand(v); setCurrentPage(1); }}
            options={brands.map((b) => ({ value: String(b._id), label: b.name }))}
            placeholder="All Brands"
            searchable
            searchPlaceholder="Search brand..."
            clearLabel="All Brands"
          />
          <SelectFilter value={filterStatus} onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} placeholder="All Status" />
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-lg" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                <tr>{["Product", "Category", "Brand", "Description", "Tax", "Status", "Actions"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider ${h === "Actions" ? "text-right" : ""}`} style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}</tr>
              </thead>
              {/* ✅ Table loading = skeleton rows (blank table / spinner nahi).
                  Skeleton → error state → empty state → real rows (smooth fade-in). */}
              {isLoading ? (
                <ProductTableSkeleton rows={PRODUCTS_PER_PAGE} />
              ) : (
              <tbody style={{ animation: "fadeIn 0.22s ease" }}>
                {productsError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
                      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500 opacity-70" />
                      <p className="text-[13px]">Failed to load products. Please check your connection.</p>
                      <button type="button" onClick={() => refetchProducts()} className="mx-auto mt-4 flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Retry</button>
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}><Package className="mx-auto mb-3 h-8 w-8 opacity-30" /> No products found</td></tr>
                ) : paginatedProducts.map((p) => {
                  const img = p?.variants?.[0]?.images?.[0]?.img_url;
                  const firstVariantSku = p?.variants?.[0]?.sku || "";
                  return (
                    <tr key={p._id} onClick={() => openProductDetails(p)} className="cursor-pointer transition" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--bg-card)"}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {img ? <img src={getImageUrl(img)} alt={p.name} className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{p.name?.charAt(0).toUpperCase() || "P"}</div>}
                          <div className="min-w-0">
                            <p className="max-w-[160px] truncate text-[13px] font-medium">{p.name}</p>
                            {firstVariantSku && <p className="max-w-[160px] truncate font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{firstVariantSku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{getCategoryName(p)}</td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{getBrandName(p)}</td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        <span className="inline-block max-w-[220px] truncate align-middle">{p.description ? p.description : <span style={{ color: "var(--text-muted)" }}>—</span>}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-medium">{p.tax !== undefined && p.tax !== null ? `${Number(p.tax)}%` : "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                      <td className="w-1 whitespace-nowrap px-4 py-2.5" onClick={(e) => e.stopPropagation()}><ActionButtons product={p} onView={openProductDetails} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggleStatus} onToggleFeatured={handleToggleFeatured} isDeleting={isDeleting} isToggling={isToggling} isTogglingFeatured={isTogglingFeatured} /></td>
                    </tr>
                  );
                })}
              </tbody>
              )}
            </table>
          </div>
        </div>
      )}

      {/* GRID VIEW — ✅ same independent loading state: skeleton cards replace blank grid */}
      {viewMode === "grid" && (
        isLoading ? (
          <ProductGridSkeleton cards={8} />
        ) : productsError ? (
          <div className="rounded-lg px-4 py-14 text-center" style={cardStyle}>
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500 opacity-70" />
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Failed to load products. Please check your connection.</p>
            <button type="button" onClick={() => refetchProducts()} className="mx-auto mt-4 flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Retry</button>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedProducts.map((p) => {
            const v = p?.variants?.[0];
            const img = v?.images?.[0]?.img_url;
            const firstSku = v?.sku || "";
            return (
              <div key={p._id} onClick={() => openProductDetails(p)} className="flex cursor-pointer flex-col gap-3 rounded-lg p-4 transition hover:-translate-y-0.5" style={cardStyle}>
                <div className="flex items-start justify-between">
                  {img ? <img src={getImageUrl(img)} alt={p.name} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{p.name?.charAt(0).toUpperCase() || "P"}</div>}
                  <StatusBadge status={p.status} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{p.name}</p>
                  {firstSku && <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{firstSku}</p>}
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{p.description ? (p.description.length > 60 ? p.description.slice(0, 60) + "..." : p.description) : "—"}</p>
                  <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Tax: {p.tax !== undefined && p.tax !== null ? `${Number(p.tax)}%` : "—"}</p>
                </div>
                <div className="mt-auto flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
                  <div onClick={(e) => e.stopPropagation()}><ActionButtons product={p} onView={openProductDetails} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggleStatus} onToggleFeatured={handleToggleFeatured} isDeleting={isDeleting} isToggling={isToggling} isTogglingFeatured={isTogglingFeatured} /></div>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* PAGINATION — simple & professional:
          Left  : "Showing X–Y of Z products"
          Right : Prev/Next + page numbers.
          Koi "rows per page" selector nahi — list hamesha 20 rows/page.
          ✅ Page switch ke doran bar MOUNTED rehti hai (sirf buttons disable hote hain). */}
      {!productsError && totalRecords > 0 && (
        <div className="flex flex-col gap-3 rounded-lg px-4 py-3 lg:flex-row lg:items-center lg:justify-between" style={cardStyle}>
          {/* Left: record range + position */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <span>
              Showing <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(firstRow)}–{fmt(lastRow)}</span> of{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(totalRecords)}</span> products
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Page <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{currentPage}</span> of{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(totalPages)}</span>
            </span>
          </div>

          {/* Right: controls */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
              {/* Previous */}
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || isFetching}
                aria-label="Previous page"
                className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>

              {/* Page numbers */}
              {renderPageNumbers().map((pg, i) =>
                pg === "…" ? (
                  <span key={`skip-${i}`} aria-hidden="true" className="flex h-8 w-8 items-center justify-center text-[13px]" style={{ color: "var(--text-muted)" }}>…</span>
                ) : (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => goToPage(pg)}
                    disabled={isFetching}
                    aria-current={pg === currentPage ? "page" : undefined}
                    aria-label={`Page ${pg}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-semibold tabular-nums transition hover:opacity-80"
                    style={pg === currentPage
                      ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" }
                      : { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                  >{pg}</button>
                )
              )}

              {/* Next */}
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isFetching}
                aria-label="Next page"
                className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && productToDelete && (
        <ModalOverlay zIndex="z-[100]">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--danger-soft)" }}><AlertTriangle className="h-5 w-5 text-red-500" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Delete "{productToDelete.name}"?</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }} className="h-9 flex-1 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button type="button" disabled={deleteMutation.isPending} onClick={confirmDelete} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "var(--danger)" }}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* PRODUCT MODAL — shared top-up form (also used on PO create page) */}
      <ProductFormModal
        open={showModal}
        initialProduct={editingProduct}
        onClose={() => { setShowModal(false); setEditingProduct(null); }}
        onCreated={(data) => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          const newId = data?.product?._id || data?.data?._id || data?._id;
          setShowModal(false); setEditingProduct(null);
          if (newId) { setCreateLoading(true); setTimeout(() => { router.push(`/admin/products/${newId}/add-variant`); setCreateLoading(false); }, 800); }
          else { toast.success("Product created successfully"); }
        }}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          toast.success("Product updated successfully");
          setShowModal(false); setEditingProduct(null);
        }}
      />

      {/* ================= ADD ATTRIBUTE MODAL (PROFESSIONAL DARK STYLE) ================= */}
      {showNewAttributeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-card)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-card)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <Icons.FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Create New Attribute</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Configure properties for products in this category.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowNewAttributeModal(false); resetAttributeForm(); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-[var(--danger)]">*</span></label>
                <input
                  type="text"
                  value={attributeFormData.name}
                  onChange={(e) => setAttributeFormData({ ...attributeFormData, name: e.target.value })}
                  autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                  placeholder="e.g. Color, Size, RAM"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Data Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "multi_select", label: "Multi Select", icon: <Icons.Filter className="w-4 h-4" /> },
                    { id: "boolean", label: "Yes / No", icon: <Icons.Text className="w-4 h-4" /> },
                  ].map((type) => {
                    const isActive = attributeFormData.data_type === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setAttributeFormData({ ...attributeFormData, data_type: type.id })}
                        className={`h-12 text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 rounded-lg border transition-colors ${isActive ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)]"}`}
                      >
                        {type.icon}
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {attributeFormData.data_type === "boolean" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Default State</label>
                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                    {[{ id: true, label: "True" }, { id: false, label: "False" }].map((opt) => {
                      const isActive = attributeFormData.value === opt.id;
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => setAttributeFormData({ ...attributeFormData, value: opt.id, values: [{ label: opt.label, value: String(opt.id) }] })}
                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                        >
                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-emerald-500" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">This will be the default True/False state for this attribute.</p>
                </div>
              )}

              {attributeFormData.data_type === "multi_select" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Pre-defined Options</label>
                  <div className="space-y-1.5">
                    {(attributeFormData.values || []).map((opt, idx) => (
                      <div
                        key={`opt-${idx}`}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg"
                      >
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/20">
                          {idx + 1}
                        </span>
                        <input 
                          type="text"
                          value={opt.label || opt.value || ""}
                          onChange={(e) => {
                            const newValues = [...attributeFormData.values];
                            newValues[idx] = { ...newValues[idx], label: e.target.value, value: e.target.value.toLowerCase() };
                            setAttributeFormData({ ...attributeFormData, values: newValues });
                          }}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 min-w-0 text-xs text-[var(--text-primary)] bg-transparent outline-none truncate"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (attributeFormData.values || []).filter((_, i) => i !== idx);
                            setAttributeFormData({ ...attributeFormData, values: next });
                          }}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          aria-label="Remove option"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="new-attr-option-input"
                      placeholder="Add an option (e.g. 8 GB)"
                      className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (!val) return;
                          const exists = (attributeFormData.values || []).some((v) => (v.label || v.value || "").toLowerCase() === val.toLowerCase());
                          if (exists) return;
                          setAttributeFormData({ ...attributeFormData, values: [...(attributeFormData.values || []), { label: val, value: val.toLowerCase() }] });
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("new-attr-option-input");
                        if (!input) return;
                        const val = input.value.trim();
                        if (!val) return;
                        const exists = (attributeFormData.values || []).some((v) => (v.label || v.value || "").toLowerCase() === val.toLowerCase());
                        if (exists) { input.value = ""; return; }
                        setAttributeFormData({ ...attributeFormData, values: [...(attributeFormData.values || []), { label: val, value: val.toLowerCase() }] });
                        input.value = "";
                      }}
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Option
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Add one or more options. You can also add more after creating the attribute.</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-card)] flex items-center justify-end gap-3 bg-[var(--bg-primary)]/30">
              <button
                type="button"
                onClick={() => { setShowNewAttributeModal(false); resetAttributeForm(); }}
                className="h-9 px-4 text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleAttributeSubmit(e)}
                disabled={createAttributeMutation.isPending}
                className="h-9 px-5 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {createAttributeMutation.isPending ? "Creating..." : "Create Attribute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

/* =========================================================
SUB-COMPONENTS
========================================================= */
function Field({ label, children }) {
  return <div className="space-y-1"><label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
function NumberField({ label, value, placeholder, onChange }) {
  return <Field label={label}><input type="number" min="0" step="0.01" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="h-9 w-full rounded-md px-3 text-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} /></Field>;
}
function SectionTitle({ children }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
function StatusBadge({ status }) {
  const active = status === "active";
  return <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={active ? { backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" } : { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>{active ? "Active" : "Inactive"}</span>;
}
function IconButton({ children, onClick, title, color = "var(--text-muted)", background = "transparent" }) {
  return <button type="button" title={title} onClick={onClick} className="flex items-center justify-center rounded p-1.5 transition hover:bg-black/5" style={{ color, backgroundColor: background }}>{children}</button>;
}
function ActionButtons({ product, onView, onEdit, onDelete, onToggle, onToggleFeatured, isDeleting, isToggling, isTogglingFeatured }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const isActive = product?.status === "active";
  const isFeatured = product?.is_featured === true;

  const openMenu = () => {
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 170;
    const menuH = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < menuH;
    const left = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8));
    setMenuPos({ top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const handleClose = () => setOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  const menuItemClass = "w-full px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors duration-150";

  return (
    <div className="flex items-center justify-end">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md p-2 transition hover:bg-white/5"
        style={{ color: "var(--text-secondary)" }}
        aria-label="More actions"
        title="More actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[170px] rounded-lg border shadow-lg py-1"
          style={{ top: menuPos.top, left: menuPos.left, backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onView(product); }}
            className={menuItemClass}
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Eye className="w-4 h-4 shrink-0" style={{ color: "var(--success-text)" }} /> View Details
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(product); }}
            className={menuItemClass}
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Pencil className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} /> Edit
          </button>
          <button
            type="button"
            disabled={isToggling}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onToggle(product); }}
            className={menuItemClass + " disabled:opacity-50"}
            style={{ color: isActive ? "var(--danger-text)" : "var(--success-text)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Power className="w-4 h-4 shrink-0" /> {isActive ? "Deactivate" : "Activate"}
          </button>
          {/* ✅ Featured Products page — mark / unmark */}
          {onToggleFeatured && (
            <button
              type="button"
              disabled={isTogglingFeatured}
              title={
                !isFeatured && !isActive
                  ? "This product is inactive. Please activate it before marking it as featured."
                  : isFeatured
                    ? "Remove from featured products"
                    : "Mark as featured"
              }
              onClick={(e) => { e.stopPropagation(); setOpen(false); onToggleFeatured(product); }}
              className={menuItemClass + " disabled:opacity-50"}
              // ✅ Inactive product muted dikhta hai (error-red nahi) + "Inactive" tag,
              //    click karne par upar wala guard English error toast dikhata hai.
              style={{ color: isFeatured ? "var(--text-secondary)" : isActive ? "var(--warning-text)" : "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {isFeatured ? (
                <StarOff className="w-4 h-4 shrink-0" />
              ) : (
                <Star className="w-4 h-4 shrink-0 fill-amber-400 text-amber-400" />
              )}
              {isFeatured ? "Remove from Featured" : "Mark as Featured"}
              {!isFeatured && !isActive && (
                <span
                  className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                >
                  Inactive
                </span>
              )}
            </button>
          )}
          <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
          <button
            type="button"
            disabled={isDeleting}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(product); }}
            className={menuItemClass + " disabled:opacity-50"}
            style={{ color: "var(--danger-text)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--danger-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Trash2 className="w-4 h-4 shrink-0" /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
function SelectFilter({ value, onChange, options, placeholder, searchable = false, searchPlaceholder = "Search...", clearLabel = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = options.find((o) => String(o.value) === String(value)) || null;

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => String(o.label ?? "").toLowerCase().includes(term));
  }, [options, search]);

  // Searchable mode: bahar click / Escape se band, open hone par search focus
  useEffect(() => {
    if (!searchable) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchable]);

  useEffect(() => {
    if (!searchable || !isOpen) return undefined;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [searchable, isOpen]);

  // Purana native select (searchable na ho to) — Status filter isi ko use karta hai
  if (!searchable) {
    return (
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className="h-9 w-full appearance-none rounded-lg pl-3 pr-8 text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:w-[160px]" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
          <option value="all">{placeholder}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setIsOpen((open) => { if (open) setSearch(""); return !open; }); }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg pl-3 pr-8 text-left text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:w-[160px]"
        style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${isOpen ? "var(--accent)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
      </button>
      <ChevronDown className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />

      {isOpen && (
        <div className="absolute right-0 z-[100] mt-1 w-full min-w-[220px] overflow-hidden rounded-lg shadow-lg" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md pl-8 pr-2 text-[16px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:h-8 sm:text-[12px]"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {clearLabel && !search.trim() && (
              <button type="button" onClick={() => handleSelect("all")} className="block w-full px-3 py-2 text-left text-[13px] transition hover:bg-[var(--bg-row-hover)]" style={{ color: String(value) === "all" ? "var(--accent)" : "var(--text-primary)", fontWeight: String(value) === "all" ? 600 : 400 }}>{clearLabel}</button>
            )}
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No match for &quot;{search.trim()}&quot;</p>
            ) : filteredOptions.map((o) => (
              <button type="button" key={o.value} onClick={() => handleSelect(o.value)} className="block w-full px-3 py-2 text-left text-[13px] transition hover:bg-[var(--bg-row-hover)]" style={{ color: String(value) === String(o.value) ? "var(--accent)" : "var(--text-primary)", fontWeight: String(value) === String(o.value) ? 600 : 400 }}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Dropdown({ children, maxHeight = "max-h-48" }) {
  return <div className={`absolute z-[100] mt-1 w-full overflow-y-auto rounded-lg border shadow-lg ${maxHeight}`} style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>{children}</div>;
}
function ModalOverlay({ children, zIndex }) {
  return <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm`}>{children}</div>;
}
function TagList({ names }) {
  return (
    <div className="flex flex-wrap gap-1">
      {names.length > 0 ? (
        <>
          {names.slice(0, 2).map((name, index) => <span key={`${name}-${index}`} className="inline-flex rounded px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>{name}</span>)}
          {names.length > 2 && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{names.length - 2}</span>}
        </>
      ) : <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>}
    </div>
  );
}
function AddAttributeValueControl({ attr, onAdd }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
  if (!attr || !onAdd) return null;
  const handleSave = async () => {
    const trimmed = String(value || "").trim();
    if (!trimmed || adding) return;
    try {
      setAdding(true);
      await onAdd(attr, trimmed);
      setValue("");
      setOpen(false);
    } catch { } finally { setAdding(false); }
  };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 shrink-0 rounded-md px-2.5 text-xs font-semibold inline-flex items-center gap-1 transition hover:opacity-90" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px dashed rgba(16,185,129,0.45)", cursor: "pointer" }} title={`Add a new value to ${attr.name}`}>
        <Plus className="h-3 w-3" /> Add Value
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input type="text" autoFocus value={value} onChange={(ev) => setValue(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleSave(); } else if (ev.key === "Escape") { ev.preventDefault(); setOpen(false); setValue(""); } }} placeholder="New value..." disabled={adding} className="h-9 px-2.5 rounded-md text-sm outline-none disabled:opacity-50" style={inputStyle} />
      <button type="button" onClick={handleSave} disabled={adding || !String(value || "").trim()} className="h-9 px-2.5 rounded-md text-xs font-bold inline-flex items-center gap-1 text-white transition disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: "var(--success)", cursor: adding || !String(value || "").trim() ? "not-allowed" : "pointer", border: "none" }}>{adding ? "..." : "Add"}</button>
      <button type="button" onClick={() => { setOpen(false); setValue(""); }} disabled={adding} className="h-9 w-9 rounded-md inline-flex items-center justify-center hover:opacity-70 disabled:opacity-50" style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: adding ? "not-allowed" : "pointer" }} title="Cancel"><X className="h-4 w-4" /></button>
    </div>
  );
}
function VariantAttributeSelect({ attr, options, value, onChange, onAddValue, inputStyle, multiple = false }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const handleAdd = async () => {
    const trimmed = String(draft || "").trim();
    if (!trimmed) return;
    try {
      await onAddValue(attr, trimmed);
      setDraft("");
      setAdding(false);
    } catch {}
  };
  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
            else if (e.key === "Escape") { e.preventDefault(); setAdding(false); setDraft(""); }
          }}
          placeholder={`New ${attr.name} value...`}
          className="h-9 flex-1 rounded-md px-3 text-sm outline-none"
          style={inputStyle}
        />
        <button type="button" onClick={handleAdd} className="h-9 px-2.5 rounded-md text-xs font-bold text-white transition" style={{ backgroundColor: "var(--accent)", border: "none" }}>Add</button>
        <button type="button" onClick={() => { setAdding(false); setDraft(""); }} className="h-9 w-9 rounded-md inline-flex items-center justify-center hover:opacity-70" style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-muted)" }} title="Cancel"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  const selectedArr = Array.isArray(value) ? value.map(String) : (value != null && value !== "" ? [String(value)] : []);
  const selectedSet = new Set(selectedArr.map((s) => s.toLowerCase()));
  const toggle = (opt) => {
    const optStr = String(opt);
    if (!multiple) {
      onChange(optStr);
      return;
    }
    const exists = selectedSet.has(optStr.toLowerCase());
    const next = exists ? selectedArr.filter((s) => s.toLowerCase() !== optStr.toLowerCase()) : [...selectedArr, optStr];
    onChange(next);
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <select
          value={multiple ? "" : (selectedArr[0] || "")}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return;
            if (v === "__add_new__") { setAdding(true); return; }
            if (!multiple) {
              onChange(v);
            } else {
              if (!selectedSet.has(v.toLowerCase())) toggle(v);
            }
          }}
          className="h-9 w-full appearance-none rounded-md pl-3 pr-8 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">{multiple ? `Select ${attr.name}...` : `Select ${attr.name}`}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          <option value="__add_new__" style={{ color: "var(--success-text)", fontWeight: 600 }}>+ Add {attr.name}</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
      </div>
      {multiple && selectedArr.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[140px]">
          {selectedArr.slice(0, 2).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
              {s}
              <button type="button" onClick={() => toggle(s)} className="opacity-70 hover:opacity-100" aria-label={`Remove ${s}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          {selectedArr.length > 2 && (
            <span className="text-[10px] self-center" style={{ color: "var(--text-muted)" }}>+{selectedArr.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}
function DropdownWithAddValue({ attr, assignedOptions, value, onChange, onAddValue, inputStyle }) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  if (!attr) return null;
  const handleSave = async () => {
    const trimmed = String(newValue || "").trim();
    if (!trimmed || saving) return;
    try {
      setSaving(true);
      await onAddValue(attr, trimmed);
      setNewValue("");
      setAdding(false);
    } catch { } finally { setSaving(false); }
  };
  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <input type="text" autoFocus value={newValue} onChange={(ev) => setNewValue(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleSave(); } else if (ev.key === "Escape") { ev.preventDefault(); setAdding(false); setNewValue(""); } }} placeholder={`New ${attr.name} value...`} disabled={saving} className="h-9 flex-1 rounded-md px-3 text-sm outline-none disabled:opacity-50" style={inputStyle} />
        <button type="button" onClick={handleSave} disabled={saving || !String(newValue || "").trim()} className="h-9 px-2.5 rounded-md text-xs font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: "var(--success)", cursor: saving || !String(newValue || "").trim() ? "not-allowed" : "pointer", border: "none" }}>{saving ? "..." : "Add"}</button>
        <button type="button" onClick={() => { setAdding(false); setNewValue(""); }} disabled={saving} className="h-9 w-9 rounded-md inline-flex items-center justify-center hover:opacity-70 disabled:opacity-50" style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: saving ? "not-allowed" : "pointer" }} title="Cancel"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <select value={value || ""} onChange={(e) => { const v = e.target.value; if (v === "__add_new__") { setAdding(true); return; } onChange(v); }} className="h-9 w-full rounded-md px-3 text-sm outline-none" style={inputStyle}>
      <option value="">Select {attr.name}</option>
      {assignedOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      <option value="__add_new__" style={{ color: "var(--success-text)", fontWeight: 600 }}>+ Add new value...</option>
    </select>
  );
}

/* ========================================================
   SKELETON LOADING UI (existing `.skeleton` shimmer utility reuse)
   ✅ Structure / paddings / column widths real table + cards jaise hi hain,
      is liye loading ke waqt table ka height ya layout shift nahi hota.
   ✅ Sirf loading state ke liye — real table/grid design mein koi change nahi.
======================================================== */
// `.skeleton` (globals.css) apna border-radius deta hai, is liye round shapes ke liye inline radius.
const SKELETON_ROUND = { borderRadius: "9999px" };

function SummaryCardSkeleton() {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }} aria-hidden="true">
      <p className="text-[12px] font-medium"><span className="skeleton inline-block h-3 w-24 rounded align-middle" /></p>
      <p className="mt-1 text-[20px] font-bold"><span className="skeleton inline-block h-5 w-12 rounded align-middle" /></p>
    </div>
  );
}

function ProductTableSkeleton({ rows = PRODUCTS_PER_PAGE }) {
  return (
    <tbody aria-busy="true" aria-label="Loading products">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`product-skeleton-${i}`} style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
          {/* Product — image + name + SKU */}
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 shrink-0" style={SKELETON_ROUND} />
              <div className="min-w-0">
                <p className="max-w-[160px] truncate text-[13px] font-medium"><span className="skeleton inline-block h-3 w-[110px] rounded align-middle" /></p>
                <p className="max-w-[160px] truncate font-mono text-[11px]"><span className="skeleton inline-block h-2.5 w-[70px] rounded align-middle" /></p>
              </div>
            </div>
          </td>
          {/* Category */}
          <td className="px-4 py-2.5 text-[13px]"><span className="skeleton inline-block h-3 w-[80px] rounded align-middle" /></td>
          {/* Brand */}
          <td className="px-4 py-2.5 text-[13px]"><span className="skeleton inline-block h-3 w-[70px] rounded align-middle" /></td>
          {/* Description */}
          <td className="px-4 py-2.5 text-[13px]"><span className="skeleton inline-block h-3 w-[180px] max-w-[220px] rounded align-middle" /></td>
          {/* Tax */}
          <td className="px-4 py-2.5 text-[13px] font-medium"><span className="skeleton inline-block h-3 w-[34px] rounded align-middle" /></td>
          {/* Status badge */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-5 w-[66px] align-middle" style={SKELETON_ROUND} /></td>
          {/* Actions menu */}
          <td className="w-1 whitespace-nowrap px-4 py-2.5">
            <div className="flex items-center justify-end"><div className="skeleton h-[34px] w-[34px] rounded-md" /></div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function ProductGridSkeleton({ cards = 8 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={`product-grid-skeleton-${i}`} className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="flex items-start justify-between">
            <div className="skeleton h-10 w-10 shrink-0" style={SKELETON_ROUND} />
            <span className="skeleton inline-block h-5 w-[66px]" style={SKELETON_ROUND} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold"><span className="skeleton inline-block h-3 w-[140px] rounded align-middle" /></p>
            <p className="mt-0.5 font-mono text-[11px]"><span className="skeleton inline-block h-2.5 w-[70px] rounded align-middle" /></p>
            <p className="mt-0.5 text-[11px]"><span className="skeleton inline-block h-2.5 w-[160px] rounded align-middle" /></p>
            <p className="mt-1 text-[11px] font-medium"><span className="skeleton inline-block h-2.5 w-[60px] rounded align-middle" /></p>
          </div>
          <div className="mt-auto flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
            <div className="skeleton h-[34px] w-[34px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}