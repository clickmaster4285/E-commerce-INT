"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Country } from "country-state-city";
import { useProductSocketSync } from "@/hooks/useProductSocketSync";
import {
  AlertTriangle,
  Check,
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
  Trash2,
  Upload,
  X,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { brandApi } from "@/apis/admin/brandApi";
import { variantApi } from "@/apis/admin/variantApi";
import { attributeApi } from "@/apis/admin/attributeApi";

const ITEMS_PER_PAGE = 20;
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "";

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
function CategoryFormModal({ open, onClose, onCreated }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    category_code: "",
    name: "",
    description: "",
    parent_category_id: "",
    status: "active",
    attributes: [],
  });
  const [autoCode, setAutoCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);

  const [showAttrSelectModal, setShowAttrSelectModal] = useState(false);
  const [attrSearch, setAttrSearch] = useState("");
  const [tempSelectedAttrIds, setTempSelectedAttrIds] = useState([]);
  const [showCreateAttrModal, setShowCreateAttrModal] = useState(false);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("multi_select");
  const [newAttrValues, setNewAttrValues] = useState([]);
  const [newAttrValueInput, setNewAttrValueInput] = useState("");
  const [newAttrDefaultValue, setNewAttrDefaultValue] = useState("yes");
  const [creatingAttribute, setCreatingAttribute] = useState(false);

  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const parentDropdownRef = useRef(null);
  const [parentDropdownPos, setParentDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: categoryApi.getAllAdmin,
    retry: false,
    staleTime: 0,
  });

  const { data: allAttributes = [] } = useQuery({
    queryKey: ["all-attributes"],
    queryFn: () => attributeApi.getAll(),
    enabled: showAttrSelectModal,
  });

  const resetForm = () => {
    setFormData({ category_code: "", name: "", description: "", parent_category_id: "", status: "active", attributes: [] });
    setAutoCode("");
    setShowParentDropdown(false);
    setShowAttrSelectModal(false);
    setShowCreateAttrModal(false);
  };

  const fetchNextCode = async () => {
    try {
      setLoadingCode(true);
      const res = await categoryApi.getNextCode();
      const nextCode = res?.nextCode || res?.data?.nextCode || res;
      if (nextCode) {
        setAutoCode(nextCode);
        setFormData((p) => ({ ...p, category_code: nextCode }));
      }
    } catch { setAutoCode(""); } finally { setLoadingCode(false); }
  };

  useEffect(() => {
    if (open) {
      resetForm();
      fetchNextCode();
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (data) => categoryApi.create(data),
    onSuccess: async (savedRes) => {
      try {
        const savedCategory = savedRes?.data?.data || savedRes?.data || savedRes;
        const catId = savedCategory?._id;
        const attrs = formData.attributes || [];
        const properAttrs = attrs
          .filter((a) => a && (a.attribute_id || a.seed_code))
          .map((a) => {
            const raw = a.attribute_id || a._id;
            let aid;
            if (!raw) aid = undefined;
            else if (typeof raw === "string") aid = raw;
            else if (typeof raw === "object" && raw._id) aid = String(raw._id);
            else aid = String(raw);
            return {
              attribute_id: aid || undefined,
              is_visible: a.is_visible !== false,
              is_searchable: Boolean(a.is_searchable),
              is_variant_option: a.is_variant_option !== false,
              sort_order: typeof a.sort_order === "number" ? a.sort_order : 0,
              value: Array.isArray(a.value) ? a.value : (a.value != null ? String(a.value) : ""),
            };
          })
          .filter((a) => !!a.attribute_id);
        if (catId && properAttrs.length > 0) {
          try { await categoryApi.updateAttributes(String(catId), properAttrs); } catch (err) { console.error("Attribute sync failed:", err); }
        }
      } catch (syncErr) { console.error("Attribute sync step failed:", syncErr); }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      toast.success("Category created successfully");
      const savedCategory = savedRes?.data?.data || savedRes?.data || savedRes;
      if (onCreated && savedCategory?._id) onCreated(savedCategory);
      onClose();
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Create failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    const payload = { ...formData, parent_category_id: formData.parent_category_id || null };
    createMutation.mutate(payload);
  };

  const isSaving = createMutation.isPending;

  const getId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      if (value._id) return getId(value._id);
      if (value.$oid) return String(value.$oid);
    }
    return "";
  };

  const getAttributeId = (attribute) => {
    const aid = attribute?.attribute_id;
    if (!aid) return String(attribute?._id || "");
    if (typeof aid === "string") return aid;
    if (typeof aid === "object" && aid._id) return String(aid._id);
    return String(aid);
  };

  const buildHierarchy = (cats, parentId = null, depth = 0) => {
    const result = [];
    const normalizedParent = parentId === null ? "" : getId(parentId);
    const children = cats.filter((c) => {
      const cParentId = getId(c.parent_category_id);
      return cParentId === normalizedParent;
    });
    for (const cat of children) {
      result.push({ ...cat, depth });
      result.push(...buildHierarchy(cats, cat._id, depth + 1));
    }
    return result;
  };
  const hierarchicalCategories = buildHierarchy(categories);
  const selectedParentName = formData.parent_category_id
    ? categories.find((c) => String(c._id) === String(formData.parent_category_id))?.name || "Root Category"
    : "Root Category";

  const filteredAllAttributes = useMemo(() => {
    if (!attrSearch.trim()) return allAttributes;
    const q = attrSearch.toLowerCase();
    return allAttributes.filter((a) => a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q));
  }, [allAttributes, attrSearch]);

  const toggleTempAttribute = (attrId) => {
    setTempSelectedAttrIds((prev) => prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId]);
  };

  const applyAttributeSelection = () => {
    const existingAttrs = [...formData.attributes];
    const newAttrs = [];
    tempSelectedAttrIds.forEach((attrId, index) => {
      const existing = existingAttrs.find((a) => String(getAttributeId(a)) === String(attrId));
      if (existing) {
        newAttrs.push({ ...existing, sort_order: index });
      } else {
        const attr = allAttributes.find((a) => String(a._id) === String(attrId));
        if (attr) {
          const mappedSeedType = attr.data_type === "select" || attr.data_type === "color" ? "multi_select" : attr.data_type;
          const options = (attr.values || []).map(v => v.label || v.value || v);
          newAttrs.push({
            ui_key: `sel-${attrId}-${Date.now()}`,
            attribute_id: attr._id,
            seed_code: attr.code,
            seed_name: attr.name,
            seed_type: mappedSeedType,
            seed_options: options,
            is_visible: true,
            is_searchable: true,
            sort_order: index,
            value: mappedSeedType === "multi_select" ? [] : "",
          });
        }
      }
    });
    setFormData((p) => ({ ...p, attributes: newAttrs }));
    setShowAttrSelectModal(false);
  };

  const openAttrSelectModal = () => {
    const currentIds = formData.attributes.map((a) => getAttributeId(a)).filter(Boolean);
    setTempSelectedAttrIds([...currentIds]);
    setAttrSearch("");
    setShowAttrSelectModal(true);
    setShowCreateAttrModal(false);
  };

  const removeAttributeFromForm = (attrId) => {
    setFormData((p) => ({ ...p, attributes: p.attributes.filter((a) => String(getAttributeId(a)) !== String(attrId)) }));
  };

  const handleCreateAttribute = async () => {
    if (!newAttrName.trim() || creatingAttribute) return;
    if (newAttrType === "multi_select" && newAttrValues.length === 0) {
      toast.error("At least one option is required for Multi Options type");
      return;
    }
    setCreatingAttribute(true);
    try {
      const code = newAttrName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const payload = {
        name: newAttrName.trim(), code, data_type: newAttrType, description: "",
        values: newAttrType === "multi_select"
          ? newAttrValues.map((v) => ({ label: v, value: v }))
          : [{ label: newAttrDefaultValue === "yes" ? "Yes" : "No", value: newAttrDefaultValue }],
      };
      const created = await attributeApi.create(payload);
      queryClient.invalidateQueries({ queryKey: ["all-attributes"] });
      if (created && created._id) {
        const mappedType = created.data_type === "select" || created.data_type === "color" ? "multi_select" : created.data_type;
        const options = (created.values || []).map(v => v.label || v.value || v);
        const newAttrEntry = {
          ui_key: `sel-${created._id}-${Date.now()}`,
          attribute_id: created._id,
          seed_code: created.code,
          seed_name: created.name,
          seed_type: mappedType,
          seed_options: options,
          is_visible: true,
          is_searchable: true,
          sort_order: formData.attributes.length,
          value: mappedType === "multi_select" ? [] : (newAttrDefaultValue === "yes" ? true : false),
        };
        setFormData((p) => ({ ...p, attributes: [...p.attributes, newAttrEntry] }));
        setTempSelectedAttrIds((prev) => [...prev, created._id]);
      }
      setShowCreateAttrModal(false);
      setNewAttrName("");
      setNewAttrType("multi_select");
      setNewAttrValues([]);
      setNewAttrValueInput("");
      setNewAttrDefaultValue("yes");
      setAttrSearch("");
      toast.success(`Attribute "${created?.name}" created`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create attribute");
    } finally {
      setCreatingAttribute(false);
    }
  };

  if (!open) return null;

  const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
  const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
  const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
  const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
  const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
  const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
  const FolderIcon = ({ className = "w-6 h-6" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
  const LayersIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>);

  const renderParentDropdown = () => {
    if (!showParentDropdown) return null;
    return createPortal(
      <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setShowParentDropdown(false)} />
        <div
          className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl overflow-hidden"
          style={{ top: parentDropdownPos.top, left: parentDropdownPos.left, width: parentDropdownPos.width, maxHeight: "240px" }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
            <button type="button"
              onClick={() => { setFormData({ ...formData, parent_category_id: "" }); setShowParentDropdown(false); }}
              className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${!formData.parent_category_id ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
              <span>Root Category</span>
              {!formData.parent_category_id && <CheckIcon className="w-3.5 h-3.5 text-[var(--accent)]" />}
            </button>
            {categoriesLoading ? (
              <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">Loading categories...</div>
            ) : hierarchicalCategories.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">No categories available</div>
            ) : (
              hierarchicalCategories.map((cat) => (
                <button key={cat._id} type="button"
                  onClick={() => { setFormData({ ...formData, parent_category_id: cat._id }); setShowParentDropdown(false); }}
                  className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${String(formData.parent_category_id) === String(cat._id) ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
                  style={{ paddingLeft: `${12 + cat.depth * 16}px` }}>
                  <span className="truncate">{cat.name}</span>
                  {String(formData.parent_category_id) === String(cat._id) && <CheckIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      </>,
      document.body
    );
  };

  const renderAttributeSelectModal = () => {
    if (!showAttrSelectModal) return null;
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 80vh)" }}>
          <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Select Attributes</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Select attributes for products in this category.</p>
            </div>
            <button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0">
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-5 py-2.5 border-b border-[var(--border-color)] shrink-0">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><SearchIcon className="w-3.5 h-3.5" /></span>
              <input type="text" placeholder="Search attributes..." value={attrSearch}
                onChange={(e) => setAttrSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-lg text-[12px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                autoFocus />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {allAttributes.length > 0 ? (
              filteredAllAttributes.length > 0 ? (
                filteredAllAttributes.map((attr) => {
                  const isChecked = tempSelectedAttrIds.includes(attr._id);
                  return (
                    <button key={attr._id} type="button" onClick={() => toggleTempAttribute(attr._id)}
                      className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors border-b border-[var(--border-color)] last:border-b-0 ${isChecked ? "bg-[var(--accent-soft)]/30" : "hover:bg-[var(--bg-tertiary)]"}`}>
                      <div className={`w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded border-[1.5px] transition-colors ${isChecked ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-input)]"}`}>
                        {isChecked && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{attr.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{attr.code} &middot; {attr.data_type || "text"}</p>
                      </div>
                      {attr.values && attr.values.length > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">{attr.values.length} values</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-[12px] text-[var(--text-muted)] mb-1">No matching attributes found</p>
                  <p className="text-[11px] text-[var(--text-muted)]">No attribute matches &quot;{attrSearch}&quot;</p>
                </div>
              )
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-[var(--text-muted)] mb-1">No attributes available yet</p>
                <p className="text-[11px] text-[var(--text-muted)] mb-3">Create an attribute to start defining product specifications.</p>
              </div>
            )}
          </div>
          {!showCreateAttrModal && (
            <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
              {attrSearch.trim() && filteredAllAttributes.length === 0 ? (
                <div className="px-5 py-2.5">
                  <button type="button" onClick={() => { setShowCreateAttrModal(true); setNewAttrName(attrSearch.trim()); }}
                    className="w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-[var(--accent)]">
                    <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[12px] font-medium">Create &quot;{attrSearch.trim()}&quot;</span>
                  </button>
                </div>
              ) : !attrSearch.trim() ? (
                <div className="px-5 py-2.5">
                  <button type="button" onClick={() => { setShowCreateAttrModal(true); setNewAttrName(""); }}
                    className="w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-[var(--accent)]">
                    <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[12px] font-medium">Create new attribute</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0">
            <button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }}
              className="h-8 px-3 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
              Cancel
            </button>
            <button type="button" onClick={applyAttributeSelection}
              className="h-8 px-4 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm">
              Apply{tempSelectedAttrIds.length > 0 ? ` (${tempSelectedAttrIds.length})` : ""}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderCreateAttrInline = () => {
    if (!showCreateAttrModal) return null;
    return createPortal(
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Create Attribute</h3>
            <button type="button" onClick={() => setShowCreateAttrModal(false)} className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Name <span className="text-red-500">*</span></label>
              <input type="text" value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} autoFocus
                className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                placeholder="e.g. Color" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Type</label>
              <select value={newAttrType} onChange={(e) => setNewAttrType(e.target.value)}
                className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]">
                <option value="multi_select">Multi Select</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
            {newAttrType === "multi_select" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Options</label>
                <div className="flex gap-2">
                  <input type="text" value={newAttrValueInput} onChange={(e) => setNewAttrValueInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newAttrValueInput.trim()) { setNewAttrValues((p) => [...p, newAttrValueInput.trim()]); setNewAttrValueInput(""); } } }}
                    className="flex-1 h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                    placeholder="Type and press Enter" />
                  <button type="button" onClick={() => { if (newAttrValueInput.trim()) { setNewAttrValues((p) => [...p, newAttrValueInput.trim()]); setNewAttrValueInput(""); } }}
                    className="h-[38px] px-3 text-[12px] font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90">Add</button>
                </div>
                {newAttrValues.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {newAttrValues.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {v}
                        <button type="button" onClick={() => setNewAttrValues((p) => p.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-red-500">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-[var(--border-color)] flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowCreateAttrModal(false)}
              className="h-8 px-3 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleCreateAttribute} disabled={creatingAttribute || !newAttrName.trim()}
              className="h-8 px-4 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 disabled:opacity-50">
              {creatingAttribute && <Spinner className="w-3 h-3" />}
              Create
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[580px] max-h-[85vh] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
              <FolderIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Create Category</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Define category details, attributes, and hierarchy.</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
            aria-label="Close modal">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form id="category-shared-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Code</label>
                  <div className="relative">
                    <input type="text" value={formData.category_code} onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                      className="w-full h-[38px] px-3 text-[12px] font-mono outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                      placeholder="AUTO-GENERATED" />
                    {loadingCode && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--accent)]" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus
                    className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                    placeholder="e.g. Smartphones" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-[12px] outline-none resize-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="Briefly describe what products belong in this category..." />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Category Hierarchy</p>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Parent Category</label>
                <div className="relative">
                  <button ref={parentDropdownRef} type="button"
                    onClick={() => {
                      if (!showParentDropdown && parentDropdownRef.current) {
                        const rect = parentDropdownRef.current.getBoundingClientRect();
                        setParentDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                      }
                      setShowParentDropdown(!showParentDropdown);
                    }}
                    className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors cursor-pointer flex items-center justify-between gap-2">
                    <span className="truncate text-left">{selectedParentName}</span>
                    <ChevronDownIcon className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${showParentDropdown ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Product Attributes</p>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Attributes</label>
                <button type="button" onClick={openAttrSelectModal}
                  className="w-full min-h-[38px] px-3 py-2 text-[12px] text-left outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <LayersIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    {formData.attributes.length === 0 ? (
                      <span className="text-[var(--text-muted)]">Select Attributes</span>
                    ) : (
                      <span className="text-[var(--text-secondary)]">{formData.attributes.length} attribute{formData.attributes.length !== 1 ? "s" : ""} selected</span>
                    )}
                  </span>
                  <span className="text-[var(--text-muted)] text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] shrink-0">
                    Browse
                  </span>
                </button>
                {formData.attributes.length > 0 && (
                  <div className="flex flex-wrap gap-[6px] pt-1.5">
                    {formData.attributes.map((attr, i) => (
                      <span key={attr.ui_key || i} className="inline-flex items-center gap-1.5 pl-[10px] pr-[8px] py-[3px] text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-[5px] border border-[var(--border-color)] h-[28px]">
                        {attr.seed_name || `Attribute ${i + 1}`}
                        <button type="button" onClick={() => removeAttributeFromForm(getAttributeId(attr))}
                          className="w-[22px] h-[22px] flex items-center justify-center rounded-[4px] hover:bg-[var(--bg-card)] transition-colors ml-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                          <CloseIcon className="w-[10px] h-[10px]" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Status</p>
              <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-0.5 h-[38px] max-w-xs">
                {[{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }].map((opt) => {
                  const isActive = formData.status === opt.id;
                  return (
                    <button key={opt.id} type="button" onClick={() => setFormData({ ...formData, status: opt.id })}
                      className={`flex-1 text-[11px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? (opt.id === "active" ? "bg-emerald-500" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </form>

        <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(false); setEditingCategory(null); resetForm(); }}
            className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
            Cancel
          </button>
          <button type="submit" form="category-shared-form" disabled={isSaving}
            className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />}
            Create Category
          </button>
        </div>
      </div>

      {renderParentDropdown()}
      {renderAttributeSelectModal()}
      {renderCreateAttrInline()}
    </div>,
    document.body
  );
}

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
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  
  // Category Modal State (shared component handles its own form)
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);

  // Brand Modal States
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [brandFormData, setBrandFormData] = useState({ brand_code: "", name: "", description: "", country: "", is_active: true });
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const [brandLogoPreview, setBrandLogoPreview] = useState("");
  const [loadingBrandCode, setLoadingBrandCode] = useState(false);

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

  const allCountries = useMemo(() => Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode })), []);

  /* Queries */
  const { data: products = [], isLoading, isError: productsError, error: productsErrorMsg } = useQuery({ queryKey: ["products"], queryFn: productApi.getAll, retry: false });
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

  const createMutation = useMutation({ mutationFn: productApi.create, onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["products"] }); const newId = data?.product?._id || data?.data?._id || data?._id; closeProductModal(); if (newId) { setCreateLoading(true); setTimeout(() => { router.push(`/admin/products/${newId}/add-variant`); setCreateLoading(false); }, 800); } else { toast.success("Product created successfully"); } }, onError: (e) => { setCreateLoading(false); handlePermissionError(e, "Product creation failed", "product"); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => productApi.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product updated successfully"); closeProductModal(); }, onError: (e) => handlePermissionError(e, "Product update failed", "product") });
  const deleteMutation = useMutation({ mutationFn: productApi.delete, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); setProductToDelete(null); }, onError: (e) => handlePermissionError(e, "Product delete failed", "product") });
  const toggleStatusMutation = useMutation({ mutationFn: productApi.toggleStatus, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product status updated"); }, onError: (e) => handlePermissionError(e, "Status update failed", "product") });
  
  const createBrandMutation = useMutation({ mutationFn: (data) => brandApi.create(data), onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ["brands"] }); const nb = res?.data || res; if (nb?._id) { setFormData((p) => ({ ...p, brand_id: String(nb._id) })); toast.success("Brand created and selected!"); } else { toast.success("Brand created successfully"); } setShowNewBrandModal(false); resetBrandForm(); }, onError: (e) => handlePermissionError(e, "Failed to create brand", "brand") });
  
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
  
  const closeProductModal = () => {
    formData.variants.forEach((v) => v.images.forEach((i) => { if (i.preview?.startsWith("blob:")) URL.revokeObjectURL(i.preview); }));
    setShowModal(false); setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0);
    setIsCategoryDropdownOpen(false); setIsBrandDropdownOpen(false);
  };

  const openNewProduct = async () => {
    setFormData({ category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [], variants: [] });
    setCategoryAttributes([]);
    setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0);
    setIsCategoryDropdownOpen(false); setIsBrandDropdownOpen(false);
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
    setIsCategoryDropdownOpen(false); setIsBrandDropdownOpen(false);
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

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formData.name.trim()) { toast.error("Product name is required"); return; }

    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description || "");
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);
    data.append("tag_names", JSON.stringify(formData.tag_names || []));

    if (editingProduct?._id) updateMutation.mutate({ id: editingProduct._id, data });
    else createMutation.mutate(data);
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

  const handleOpenCategoryModal = () => { setShowNewCategoryModal(true); };

  const resetBrandForm = () => {
    if (brandLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(brandLogoPreview);
    setBrandFormData({ brand_code: "", name: "", description: "", country: "", is_active: true });
    setBrandLogoFile(null); setBrandLogoPreview("");
  };
  const fetchNextBrandCode = async () => {
    try {
      setLoadingBrandCode(true);
      const res = await brandApi.getNextCode();
      const code = res?.nextCode || res?.data?.nextCode || res;
      if (typeof code === "string" && code.trim()) { setBrandFormData((p) => ({ ...p, brand_code: code })); return; }
      throw new Error("Invalid brand code");
    } catch (e) {
      const nums = brands.filter((b) => b?.brand_code && /^BRD-\d+$/i.test(b.brand_code)).map((b) => parseInt(b.brand_code.split("-")[1], 10)).filter(Number.isFinite);
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      setBrandFormData((p) => ({ ...p, brand_code: `BRD-${String(next).padStart(3, "0")}` }));
    } finally { setLoadingBrandCode(false); }
  };
  const handleOpenBrandModal = () => { resetBrandForm(); setShowNewBrandModal(true); fetchNextBrandCode(); };
  const handleBrandLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Logo must be less than 10MB"); e.target.value = ""; return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Only PNG, JPG and WebP logos are allowed"); e.target.value = ""; return; }
    if (brandLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(brandLogoPreview);
    setBrandLogoFile(file); setBrandLogoPreview(URL.createObjectURL(file));
  };
  const handleBrandSubmit = (e) => {
    e.preventDefault();
    if (!brandFormData.brand_code.trim()) { toast.error("Brand code is required"); return; }
    if (!brandFormData.name.trim()) { toast.error("Brand name is required"); return; }
    const fd = new FormData();
    fd.append("brand_code", brandFormData.brand_code.trim());
    fd.append("name", brandFormData.name.trim());
    fd.append("description", brandFormData.description.trim());
    fd.append("country", brandFormData.country || "");
    fd.append("is_active", String(brandFormData.is_active));
    if (brandLogoFile) fd.append("logo", brandLogoFile);
    createBrandMutation.mutate(fd);
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

  const filteredProducts = products.filter((p) => {
    const kw = search.trim().toLowerCase();
    const skuMatch = (p?.variants || []).some((v) => String(v?.sku || "").toLowerCase().includes(kw));
    const nameMatch = String(p?.name || "").toLowerCase().includes(kw);
    const matchSearch = !kw || nameMatch || skuMatch;
    const cid = normalizeId(p?.category_id);
    const bid = normalizeId(p?.brand_id);
    return matchSearch && (filterCategory === "all" || cid === String(filterCategory)) && (filterBrand === "all" || bid === String(filterBrand)) && (filterStatus === "all" || p?.status === filterStatus);
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const activeProducts = products.filter((p) => p?.status === "active").length;
  const totalVariants = products.reduce((t, p) => t + (p?.variants?.length || 0), 0);
  const totalStock = products.reduce((t, p) => t + (p?.variants || []).reduce((vt, v) => vt + Number(v?.quantity || 0), 0), 0);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isToggling = toggleStatusMutation.isPending;

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div>;

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

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ l: "Total Products", v: products.length }, { l: "Active", v: activeProducts, c: "text-emerald-500" }, { l: "Total Variants", v: totalVariants, c: "text-blue-500" }, { l: "Units in Stock", v: totalStock }].map((s, i) => (
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
          <SelectFilter value={filterCategory} onChange={(v) => { setFilterCategory(v); setCurrentPage(1); }} options={categories.map((c) => ({ value: String(c._id), label: c.name }))} placeholder="All Categories" />
          <SelectFilter value={filterBrand} onChange={(v) => { setFilterBrand(v); setCurrentPage(1); }} options={brands.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="All Brands" />
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
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}><Package className="mx-auto mb-3 h-8 w-8 opacity-30" /> No products found</td></tr>
                ) : paginatedProducts.map((p) => {
                  const img = p?.variants?.[0]?.images?.[0]?.img_url;
                  const firstVariantSku = p?.variants?.[0]?.sku || "";
                  return (
                    <tr key={p._id} onClick={() => openProductDetails(p)} className="cursor-pointer transition" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--bg-card)"}>
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
                      <td className="w-1 whitespace-nowrap px-4 py-2.5" onClick={(e) => e.stopPropagation()}><ActionButtons product={p} onView={openProductDetails} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggleStatus} isDeleting={isDeleting} isToggling={isToggling} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === "grid" && (
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
                  <div onClick={(e) => e.stopPropagation()}><ActionButtons product={p} onView={openProductDetails} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggleStatus} isDeleting={isDeleting} isToggling={isToggling} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {filteredProducts.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-lg p-4 sm:flex-row" style={cardStyle}>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((pg) => Math.max(1, pg - 1))} className="flex h-8 w-8 items-center justify-center rounded-md transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Page {currentPage} of {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((pg) => Math.min(totalPages, pg + 1))} className="flex h-8 w-8 items-center justify-center rounded-md transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && productToDelete && (
        <ModalOverlay zIndex="z-[100]">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}><AlertTriangle className="h-5 w-5 text-red-500" /></div>
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

      {/* PRODUCT MODAL */}
      {showModal && (
        <ModalOverlay zIndex="z-50">
          <div className="max-h-[95vh] w-full max-w-[720px] overflow-y-auto rounded-xl shadow-2xl" style={cardStyle}>
            <div className="sticky top-0 z-20 flex items-center justify-between rounded-t-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-semibold">{editingProduct ? "Edit Product" : "New Product"}</h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Create or edit basic product information</p>
              </div>
              <button type="button" onClick={closeProductModal} className="rounded p-1 transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Category *">
                      <div className="relative">
                        <button type="button" onClick={() => { setIsCategoryDropdownOpen(o => !o); setIsBrandDropdownOpen(false); }} className="flex h-9 w-full items-center justify-between rounded-md px-3 text-left text-sm" style={inputStyle}>
                          <span className="truncate">{formData.category_id ? categories.find(c => String(c._id) === String(formData.category_id))?.name || "Selected category" : "Select product category"}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {isCategoryDropdownOpen && (
                          <Dropdown>
                            {categories.map(c => <button type="button" key={c._id} onClick={() => { setFormData(p => ({ ...p, category_id: String(c._id) })); setIsCategoryDropdownOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5" style={{ color: String(formData.category_id) === String(c._id) ? "var(--accent)" : "var(--text-primary)" }}>{c.name}</button>)}
                            <button type="button" onClick={() => { setIsCategoryDropdownOpen(false); handleOpenCategoryModal(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-semibold hover:bg-black/5 sticky bottom-0" style={{ borderColor: "var(--border-color)", color: "var(--accent)", backgroundColor: "var(--bg-card)" }}><Plus className="h-4 w-4" /> Create New Category</button>
                          </Dropdown>
                        )}
                      </div>
                    </Field>
                    <Field label="Brand *">
                      <div className="relative">
                        <button type="button" onClick={() => { setIsBrandDropdownOpen(o => !o); setIsCategoryDropdownOpen(false); }} className="flex h-9 w-full items-center justify-between rounded-md px-3 text-left text-sm" style={inputStyle}>
                          <span className="truncate">{formData.brand_id ? brands.find(b => String(b._id) === String(formData.brand_id))?.name || "Selected brand" : "Select product brand"}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {isBrandDropdownOpen && (
                          <Dropdown>
                            {brands.map(b => <button type="button" key={b._id} onClick={() => { setFormData(p => ({ ...p, brand_id: String(b._id) })); setIsBrandDropdownOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5" style={{ color: String(formData.brand_id) === String(b._id) ? "var(--accent)" : "var(--text-primary)" }}>{b.name}</button>)}
                            <button type="button" onClick={() => { setIsBrandDropdownOpen(false); handleOpenBrandModal(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-semibold hover:bg-black/5 sticky bottom-0" style={{ borderColor: "var(--border-color)", color: "var(--accent)", backgroundColor: "var(--bg-card)" }}><Plus className="h-4 w-4" /> Create New Brand</button>
                          </Dropdown>
                        )}
                      </div>
                    </Field>
                  </div>
                  <Field label="Product Name *"><input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} /></Field>
                  <Field label="Description"><textarea rows={3} placeholder="Enter product description..." value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full resize-none rounded-md px-3 py-2 text-sm" style={inputStyle} /></Field>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Tax (%)">
                      <input type="number" min="0" max="100" step="0.01" placeholder="%" value={formData.tax} onChange={e => { const v = e.target.value; if (v === "") { setFormData(p => ({ ...p, tax: "" })); return; } let n = Number(v); if (!Number.isFinite(n)) n = 0; n = Math.min(100, Math.max(0, n)); setFormData(p => ({ ...p, tax: String(n) })); }} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} />
                    </Field>
                    <Field label="Status">
                      <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="h-9 w-full appearance-none rounded-md px-3 text-sm outline-none" style={inputStyle}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                   </div>
                </div>
              <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{isSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}<Check className="h-4 w-4" /></button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* CATEGORY MODAL — uses shared CategoryFormModal component */}
      <CategoryFormModal
        open={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        onCreated={(newCategory) => {
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          if (newCategory?._id) {
            setFormData((p) => ({ ...p, category_id: String(newCategory._id) }));
            toast.success("Category created and selected!");
          }
        }}
      />

      {/* BRAND MODAL */}
      {showNewBrandModal && (
        <ModalOverlay zIndex="z-[60]">
          <div className="w-full max-w-lg overflow-visible rounded-xl shadow-2xl" style={cardStyle}>
            <div className="flex items-center justify-between rounded-t-xl px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">Create New Brand</h3>
              <button type="button" onClick={() => { setShowNewBrandModal(false); resetBrandForm(); }} disabled={createBrandMutation.isPending} className="rounded p-1 transition hover:opacity-70 disabled:opacity-50" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleBrandSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand Code *">
                  <div className="relative">
                    <input type="text" value={brandFormData.brand_code} onChange={e => setBrandFormData(p => ({ ...p, brand_code: e.target.value }))} required disabled={createBrandMutation.isPending || loadingBrandCode} className="h-9 w-full rounded-md px-3 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={loadingBrandCode ? "Generating..." : "BRD-001"} />
                    {loadingBrandCode && <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></span>}
                  </div>
                </Field>
                <Field label="Brand Name *"><input type="text" value={brandFormData.name} onChange={e => setBrandFormData(p => ({ ...p, name: e.target.value }))} required disabled={createBrandMutation.isPending} className="h-9 w-full rounded-md px-3 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Nike" /></Field>
              </div>
              <Field label="Description"><textarea value={brandFormData.description} onChange={e => setBrandFormData(p => ({ ...p, description: e.target.value }))} rows={2} disabled={createBrandMutation.isPending} className="w-full resize-none rounded-md px-3 py-2 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Brand details..." /></Field>
              <Field label="Brand Logo">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                    {brandLogoPreview ? <img src={brandLogoPreview} alt="Preview" className="h-full w-full object-cover" /> : <Upload className="h-6 w-6" style={{ color: "var(--text-muted)" }} />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="brand-logo-upload" className="flex h-8 w-fit cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}><Upload className="h-3.5 w-3.5" />{brandLogoPreview ? "Change Image" : "Upload Image"}</label>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>PNG, JPG, WEBP up to 10MB</p>
                  </div>
                  <input id="brand-logo-upload" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleBrandLogoChange} disabled={createBrandMutation.isPending} />
                </div>
              </Field>
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Country">
                  <div className="relative">
                    <select value={brandFormData.country} onChange={e => setBrandFormData(p => ({ ...p, country: e.target.value }))} disabled={createBrandMutation.isPending} className="h-9 w-full appearance-none rounded-md pl-3 pr-8 text-sm outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <option value="">Select Country</option>
                      {allCountries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  </div>
                </Field>
                <label className="flex h-9 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={brandFormData.is_active} onChange={e => setBrandFormData(p => ({ ...p, is_active: e.target.checked }))} disabled={createBrandMutation.isPending} className="h-4 w-4 rounded" style={{ accentColor: "var(--accent)" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
                </label>
              </div>
              <div className="flex gap-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={() => { setShowNewBrandModal(false); resetBrandForm(); }} disabled={createBrandMutation.isPending} className="h-9 flex-1 rounded-md text-sm font-medium transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={createBrandMutation.isPending || loadingBrandCode} className="h-9 flex-1 rounded-md text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{createBrandMutation.isPending ? "Creating..." : "Create & Select"}</button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

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
  return <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={active ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>{active ? "Active" : "Inactive"}</span>;
}
function IconButton({ children, onClick, title, color = "var(--text-muted)", background = "transparent" }) {
  return <button type="button" title={title} onClick={onClick} className="flex items-center justify-center rounded p-1.5 transition hover:bg-black/5" style={{ color, backgroundColor: background }}>{children}</button>;
}
function ActionButtons({ product, onView, onEdit, onDelete, onToggle, isDeleting, isToggling }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const isActive = product?.status === "active";

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
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Eye className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} /> View Details
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(product); }}
            className={menuItemClass}
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Pencil className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} /> Edit
          </button>
          <button
            type="button"
            disabled={isToggling}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onToggle(product); }}
            className={menuItemClass + " disabled:opacity-50"}
            style={{ color: isActive ? "#f87171" : "#34d399" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Power className="w-4 h-4 shrink-0" /> {isActive ? "Deactivate" : "Activate"}
          </button>
          <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
          <button
            type="button"
            disabled={isDeleting}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(product); }}
            className={menuItemClass + " disabled:opacity-50"}
            style={{ color: "#f87171" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")}
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
function SelectFilter({ value, onChange, options, placeholder }) {
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
      <button type="button" onClick={() => setOpen(true)} className="h-9 shrink-0 rounded-md px-2.5 text-xs font-semibold inline-flex items-center gap-1 transition hover:opacity-90" style={{ backgroundColor: "rgba(16,185,129,0.10)", color: "#34d399", border: "1px dashed rgba(16,185,129,0.45)", cursor: "pointer" }} title={`Add a new value to ${attr.name}`}>
        <Plus className="h-3 w-3" /> Add Value
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input type="text" autoFocus value={value} onChange={(ev) => setValue(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleSave(); } else if (ev.key === "Escape") { ev.preventDefault(); setOpen(false); setValue(""); } }} placeholder="New value..." disabled={adding} className="h-9 px-2.5 rounded-md text-sm outline-none disabled:opacity-50" style={inputStyle} />
      <button type="button" onClick={handleSave} disabled={adding || !String(value || "").trim()} className="h-9 px-2.5 rounded-md text-xs font-bold inline-flex items-center gap-1 text-white transition disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: "#10b981", cursor: adding || !String(value || "").trim() ? "not-allowed" : "pointer", border: "none" }}>{adding ? "..." : "Add"}</button>
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
          <option value="__add_new__" style={{ color: "#34d399", fontWeight: 600 }}>+ Add {attr.name}</option>
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
        <button type="button" onClick={handleSave} disabled={saving || !String(newValue || "").trim()} className="h-9 px-2.5 rounded-md text-xs font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: "#10b981", cursor: saving || !String(newValue || "").trim() ? "not-allowed" : "pointer", border: "none" }}>{saving ? "..." : "Add"}</button>
        <button type="button" onClick={() => { setAdding(false); setNewValue(""); }} disabled={saving} className="h-9 w-9 rounded-md inline-flex items-center justify-center hover:opacity-70 disabled:opacity-50" style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: saving ? "not-allowed" : "pointer" }} title="Cancel"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <select value={value || ""} onChange={(e) => { const v = e.target.value; if (v === "__add_new__") { setAdding(true); return; } onChange(v); }} className="h-9 w-full rounded-md px-3 text-sm outline-none" style={inputStyle}>
      <option value="">Select {attr.name}</option>
      {assignedOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      <option value="__add_new__" style={{ color: "#34d399", fontWeight: 600 }}>+ Add new value...</option>
    </select>
  );
}