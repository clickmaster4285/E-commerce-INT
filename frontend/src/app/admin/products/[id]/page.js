"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useProductSocketSync } from "@/hooks/useProductSocketSync";
import { useSocket } from "@/hooks/useSocket";
import {
  Package, Layers3, Box, TrendingUp, Clock, Pencil, Check,
  ChevronDown, ChevronRight, Copy, Plus, Trash2, Upload, X,
  Sparkles, AlertTriangle, DollarSign, FolderOpen, Store, Hash, Tag as TagIcon,
  Edit3, Save, Calendar, User, Activity, Eye, ArrowLeft, Image as ImageIcon, FileText
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { brandApi } from "@/apis/admin/brandApi";
import { variantApi } from "@/apis/admin/variantApi";
import { tagApi } from "@/apis/admin/tagApi";
import { attributeApi } from "@/apis/admin/attributeApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

const createEmptyVariant = (sku = "") => ({
  _id: null, sku, title: "", description: "",
  cost_price: "", selling_price: "", quantity: "0", min_qnt: "0", max_qnt: "0",
  attributes: [{ name: "Color", value: "Black", isCustom: false }],
  images: [],
  tags: [],
});

function fd(d) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function tago(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return dy < 30 ? `${dy}d ago` : fd(d);
}

function ini(n) {
  return n ? n.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "??";
}

// ==================== MODERN COMPONENTS ====================

function StatusBadge({ active, size = "sm" }) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ${sizeClasses}`}
      style={{
        backgroundColor: active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        color: active ? "#10b981" : "#ef4444",
        border: `1px solid ${active ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "#10b981" : "#ef4444" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, subValue, color = "emerald", trend }) {
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
        {trend && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: trend > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: trend > 0 ? "#10b981" : "#ef4444" }}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
      {subValue && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{subValue}</p>}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
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
      <div className="p-5">{children}</div>
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

// ==================== MAIN COMPONENT ====================

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  useProductSocketSync();
  const { socket, isConnected } = useSocket();
  const id = params?.id;
  const [liveEvents, setLiveEvents] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["overview", "variants", "tags", "category", "brand", "activity"];
    return validTabs.includes(tabParam) ? tabParam : "overview";
  });
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagModalValue, setNewTagModalValue] = useState("");
  const [editingVariantForTags, setEditingVariantForTags] = useState(null);
  const [showVariantTagsModal, setShowVariantTagsModal] = useState(false);
  const [variantTagInput, setVariantTagInput] = useState("");
  const [newGlobalTag, setNewGlobalTag] = useState("");
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [attributeTargetVariant, setAttributeTargetVariant] = useState(null);
  const [newAttributeData, setNewAttributeData] = useState({
    name: "", code: "", data_type: "text",
    values: [{ label: "", value: "" }], variant_allowed: true,
  });

  const [formData, setFormData] = useState({
    category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [],
    variants: [createEmptyVariant()],
  });
  const [tagInput, setTagInput] = useState("");

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !id) return;
    const handleDeleted = (data) => {
      if (data?.id === id) { toast.info("This product was deleted from another session."); router.push("/admin/products"); }
    };
    const handleCreated = (data) => {
      if (String(data?._id) !== String(id)) return;
      setLiveEvents((prev) => [...prev, { key: `live-c-${Date.now()}`, type: "created", user: data?.createdby || null, date: data?.created_at || new Date().toISOString() }]);
    };
    const handleUpdated = (data) => {
      if (String(data?._id) !== String(id)) return;
      setLiveEvents((prev) => [...prev, { key: `live-u-${Date.now()}`, type: "updated", user: data?.updatedby || null, date: data?.updated_at || new Date().toISOString() }]);
    };
    socket.on("productDeleted", handleDeleted);
    socket.on("productCreated", handleCreated);
    socket.on("productUpdated", handleUpdated);
    return () => { socket.off("productDeleted", handleDeleted); socket.off("productCreated", handleCreated); socket.off("productUpdated", handleUpdated); };
  }, [socket, isConnected, id, router]);

  const { data: product, isLoading, isError, refetch: refetchProduct } = useQuery({
    queryKey: ["product", id], queryFn: () => productApi.getById(id), enabled: !!id,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll });
  const { data: rawAttributes = [] } = useQuery({ queryKey: ["attributes"], queryFn: () => attributeApi.getAll(), retry: false });

  const productCategoryId = product?.category_id?._id || product?.category_id;
  const { data: categoryAttributes = [] } = useQuery({
    queryKey: ["category-attributes", productCategoryId],
    queryFn: () => attributeApi.getByCategory(productCategoryId),
    enabled: !!productCategoryId, retry: false,
  });

  const ATTRIBUTE_PRESETS = useMemo(() => {
    const source = (categoryAttributes && categoryAttributes.length) ? categoryAttributes : rawAttributes;
    if (!source.length) return [];
    return source
      .filter((a) => a.is_active && a.values?.length)
      .map((a) => ({
        name: a.name, code: a.code, data_type: a.data_type,
        values: (a.data_type === "multi_select" && Array.isArray(a.category_config?.value) && a.category_config.value.length)
          ? a.category_config.value : (a.values || []).map((v) => v.label || v.value),
      }));
  }, [rawAttributes, categoryAttributes]);

  const { data: globalTags = [], refetch: refetchTags } = useQuery({ queryKey: ["globalTags"], queryFn: tagApi.getAll });

  // Mutations
  const createTagMutation = useMutation({
    mutationFn: tagApi.create,
    onSuccess: () => { refetchTags(); setNewGlobalTag(""); setNewTagModalValue(""); toast.success("Tag created successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create tag"),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }) => tagApi.update(id, data),
    onSuccess: () => { refetchTags(); setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); toast.success("Tag updated successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: tagApi.delete,
    onSuccess: () => { refetchTags(); toast.success("Tag deleted successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete tag"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: async () => {
      toast.success("Product updated successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      if (showVariantTagsModal && editingVariantForTags) {
        setTimeout(() => {
          const freshProduct = queryClient.getQueryData(["product", id]);
          if (freshProduct) {
            const updatedVariant = freshProduct.variants?.find(v => String(v._id) === String(editingVariantForTags._id));
            if (updatedVariant) setEditingVariantForTags({ ...updatedVariant, tags: updatedVariant.tags || [] });
          }
        }, 300);
      }
      if (showModal) closeProductModal();
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Product update failed"); },
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); router.push("/admin/products"); },
    onError: (error) => { toast.error(error.response?.data?.message || "Product delete failed"); },
  });

  const createAttributeMutation = useMutation({
    mutationFn: ({ payload }) => attributeApi.create(payload),
    onSuccess: async (res, variables) => {
      const { tempKey, targetIndex, attributeName } = variables || {};
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", productCategoryId] });
      const created = res?.data || res;
      const createdId = created?._id || created?.id;
      setFormData((prev) => {
        const v = [...prev.variants];
        if (v[targetIndex]) {
          v[targetIndex] = {
            ...v[targetIndex],
            attributes: (v[targetIndex]?.attributes || []).map((a) =>
              tempKey && a._localKey === tempKey ? { ...a, name: attributeName, _creating: false, _creatingId: createdId ? String(createdId) : undefined } : a
            ),
          };
        }
        return { ...prev, variants: v };
      });
      await refetchProduct();
      toast.success("Attribute created successfully!");
      setShowAttributeModal(false);
      setAttributeTargetVariant(null);
      resetAttributeForm();
    },
    onError: (err, variables) => {
      const { tempKey, targetIndex } = variables || {};
      setFormData((prev) => {
        const v = [...prev.variants];
        if (v[targetIndex]) {
          v[targetIndex] = {
            ...v[targetIndex],
            attributes: (v[targetIndex]?.attributes || []).map((a) =>
              tempKey && a._localKey === tempKey ? { ...a, _creating: false, _createError: true } : a
            ),
          };
        }
        return { ...prev, variants: v };
      });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", productCategoryId] });
      refetchProduct();
      toast.error(err?.response?.data?.message || err?.message || "Failed to create attribute");
    },
  });

  // Handlers
  const handleDelete = () => setShowDeleteModal(true);
  const confirmDelete = () => { if (product) deleteMutation.mutate(product._id); };

  const prepareEditData = (prod) => {
    const variants = prod.variants?.length
      ? prod.variants.map((v) => ({
          _id: v._id, sku: v.sku || "", title: v.title || "", description: v.description || "",
          cost_price: String(v.cost_price ?? ""), selling_price: String(v.selling_price ?? ""),
          quantity: String(v.quantity ?? 0), min_qnt: String(v.min_qnt ?? 0), max_qnt: String(v.max_qnt ?? 0),
          attributes: Object.entries(v.attributes || {}).map(([name, value]) => {
            const strValue = String(value ?? "");
            const preset = rawAttributes.find((a) => a.name === name);
            const isMulti = preset?.data_type === "multi_select";
            return { name, value: isMulti ? strValue.split(",").map((s) => s.trim()).filter(Boolean)[0] || "" : strValue, isCustom: false };
          }),
          images: (v.images || []).map((img) => ({ existing: true, metadata: img, preview: getImageUrl(img.img_url) })),
          tags: v.tags || [],
        }))
      : [createEmptyVariant()];

    const currentTagNames = (prod.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
    return {
      category_id: prod.category_id?._id || prod.category_id || "",
      brand_id: prod.brand_id?._id || prod.brand_id || "",
      name: prod.name || "", description: prod.description || "",
      tax: String(prod.tax ?? 0), status: prod.status || "active",
      tag_names: currentTagNames, variants,
    };
  };

  const handleEdit = () => {
    if (!product) return;
    setFormData(prepareEditData(product));
    setEditingProduct(product);
    setCurrentStep(1);
    setExpandedVariant(0);
    setTagInput("");
    setShowModal(true);
  };

  const handleAddVariantFromTab = () => { if (!product) return; router.push(`/admin/products/${id}/add-variant?tab=${activeTab}`); };

  const closeProductModal = () => {
    formData.variants.forEach((v) => { v.images.forEach((img) => { if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); }); });
    setShowModal(false); setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0); setTagInput("");
  };

  const addVariant = async () => {
    try {
      const result = await variantApi.getNextSku();
      const newIndex = formData.variants.length;
      setFormData((prev) => ({ ...prev, variants: [...prev.variants, createEmptyVariant(result.sku)] }));
      setExpandedVariant(newIndex);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const duplicateVariant = async (index) => {
    try {
      const result = await variantApi.getNextSku();
      const old = formData.variants[index];
      const copy = { ...old, _id: null, sku: result.sku, attributes: old.attributes.map(i => ({...i})), images: [], tags: [...old.tags] };
      setFormData((prev) => { const v = [...prev.variants]; v.splice(index+1, 0, copy); return {...prev, variants: v}; });
      setExpandedVariant(index + 1);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) { toast.error("At least one variant is required"); return; }
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[index] = {...v[index], [field]: value}; return {...prev, variants: v}; });
  };

  const resetAttributeForm = () => {
    setNewAttributeData({ name: "", code: "", data_type: "text", values: [{ label: "", value: "" }], variant_allowed: true });
  };

  const handleOpenAttributeModal = (vi) => { setAttributeTargetVariant(vi); resetAttributeForm(); setShowAttributeModal(true); };

  const handleAddAttributeValue = () => setNewAttributeData((prev) => ({ ...prev, values: [...prev.values, { label: "", value: "" }] }));
  const handleRemoveAttributeValue = (index) => setNewAttributeData((prev) => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }));
  const handleAttributeValueChange = (index, field, val) => {
    setNewAttributeData((prev) => { const newValues = [...prev.values]; newValues[index] = { ...newValues[index], [field]: val }; return { ...prev, values: newValues }; });
  };

  const addAttribute = (vi) => handleOpenAttributeModal(vi);

  const handleAttributeSubmit = () => {
    if (!newAttributeData.name.trim()) { toast.error("Attribute name is required"); return; }
    const finalCode = newAttributeData.code.trim() || newAttributeData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const payload = {
      name: newAttributeData.name.trim(), code: finalCode, data_type: newAttributeData.data_type, variant_allowed: true,
      values: (newAttributeData.data_type === "select" || newAttributeData.data_type === "multi_select") ? newAttributeData.values.filter((v) => v.label.trim() && v.value.trim()) : [],
    };
    const tempKey = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newAttrConfig = { _localKey: tempKey, name: newAttributeData.name, value: "", isCustom: false, _creating: true };
    const targetIndex = attributeTargetVariant ?? 0;
    setFormData((prev) => {
      const v = [...prev.variants];
      if (v[targetIndex]) v[targetIndex] = { ...v[targetIndex], attributes: [...(v[targetIndex]?.attributes || []), newAttrConfig] };
      return { ...prev, variants: v };
    });
    setShowAttributeModal(false);
    createAttributeMutation.mutate({ payload, tempKey, targetIndex, attributeName: newAttributeData.name });
  };

  const updateAttribute = (vi, ai, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; const a = [...v[vi].attributes]; a[ai] = {...a[ai], [field]: value}; v[vi] = {...v[vi], attributes: a}; return {...prev, variants: v}; });
  };

  const removeAttribute = (vi, ai) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = {...v[vi], attributes: v[vi].attributes.filter((_,i) => i !== ai)}; return {...prev, variants: v}; });
  };

  const addVariantTag = (vi, e) => {
    e?.preventDefault();
    const val = formData.variants[vi].tagInput?.trim().toLowerCase();
    if (!val) return;
    if (formData.variants[vi].tags.includes(val)) { toast.info("Tag already added to this variant"); return; }
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tags: [...v[vi].tags, val], tagInput: "" }; return { ...prev, variants: v }; });
  };

  const removeVariantTag = (vi, tagName) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tags: v[vi].tags.filter(t => t !== tagName) }; return { ...prev, variants: v }; });
  };

  const updateVariantTagInput = (vi, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tagInput: value }; return { ...prev, variants: v }; });
  };

  const handleCreateGlobalTag = () => { if (!newGlobalTag.trim()) return; createTagMutation.mutate({ name: newGlobalTag.trim() }); };

  const handleCreateTagFromModal = () => {
    if (!newTagModalValue.trim()) return;
    createTagMutation.mutate({ name: newTagModalValue.trim() }, { onSuccess: () => { setShowCreateTagModal(false); setNewTagModalValue(""); } });
  };

  const startEditGlobalTag = (tag) => { setEditingTagId(tag._id); setEditingTagName(tag.name); setShowEditTagModal(true); };
  const saveEditGlobalTag = () => { if (!editingTagName.trim() || !editingTagId) return; updateTagMutation.mutate({ id: editingTagId, data: { name: editingTagName } }); };
  const cancelEditTag = () => { setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); };
  const deleteGlobalTag = (tagId) => deleteTagMutation.mutate(tagId);

  const compressProductImage = (file) => new Promise((resolve) => {
    const image = new Image(); const imageUrl = URL.createObjectURL(file);
    image.onload = () => {
      const MAX = 1400; let w = image.width, h = image.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
      canvas.toBlob((blob) => { URL.revokeObjectURL(imageUrl); if (!blob) { resolve(file); return; } resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "")+".webp", { type: "image/webp", lastModified: Date.now() })); }, "image/webp", 0.82);
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(file); };
    image.src = imageUrl;
  });

  const handleImageUpload = async (vi, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => ["image/jpeg","image/png","image/webp"].includes(f.type));
    if (valid.length !== files.length) { toast.error("Only JPG, PNG and WebP images are allowed"); return; }
    try {
      const compressed = await Promise.all(valid.map(f => compressProductImage(f)));
      const imgs = compressed.map(f => ({ file: f, existing: false, preview: URL.createObjectURL(f) }));
      setFormData((prev) => { const v = [...prev.variants]; v[vi] = {...v[vi], images: [...v[vi].images, ...imgs]}; return {...prev, variants: v}; });
      toast.success("Image optimized successfully");
    } catch { toast.error("Image processing failed"); }
    e.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => { const v = [...prev.variants]; const img = v[vi].images[ii]; if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); v[vi] = {...v[vi], images: v[vi].images.filter((_,i) => i !== ii)}; return {...prev, variants: v}; });
  };

  const handleNextStep = () => {
    if (!formData.category_id) { toast.error("Please select category"); return; }
    if (!formData.brand_id) { toast.error("Please select brand"); return; }
    if (!formData.name.trim()) { toast.error("Product name is required"); return; }
    setCurrentStep(2);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const skuSet = new Set();
    for (const v of formData.variants) {
      const sku = v.sku.trim();
      if (!sku) { toast.error("SKU is required"); return; }
      if (skuSet.has(sku)) { toast.error(`Duplicate SKU: ${sku}`); return; }
      skuSet.add(sku);
      if (!v.title.trim()) { toast.error("Variant title is required"); return; }
      if (v.cost_price === "" || v.selling_price === "") { toast.error("Cost price and selling price are required"); return; }
      if (Number(v.selling_price) <= Number(v.cost_price)) { toast.error(`Selling Price must be greater than Cost Price for "${v.title || v.sku}"`); return; }
    }
    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description);
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);
    data.append("tag_names", JSON.stringify(formData.tag_names || []));
    const imageVariantIndexes = [];
    const variants = formData.variants.map((v, idx) => {
      const attributes = {};
      v.attributes.forEach((a) => {
        const key = a.name.trim();
        if (!key) return;
        const preset = rawAttributes.find((p) => p.name === key);
        const isMulti = preset?.data_type === "multi_select";
        if (isMulti) { const singleVal = String(a.value || "").trim(); if (!singleVal) return; attributes[key] = singleVal; }
        else if (Array.isArray(a.value)) { if (a.value.length === 0) return; attributes[key] = a.value.join(","); }
        else { if (a.value === "" || a.value == null) return; attributes[key] = a.value; }
      });
      const existingImages = v.images.filter(i => i.existing).map(i => i.metadata);
      v.images.filter(i => !i.existing && i.file).forEach(i => { data.append("images", i.file); imageVariantIndexes.push(idx); });
      let finalSku = v.sku.trim();
      if (editingProduct) { const orig = editingProduct.variants?.find(ov => ov._id && String(ov._id) === String(v._id)); if (orig) finalSku = orig.sku; }
      return {
        _id: v._id || undefined, sku: finalSku, title: v.title.trim(), description: v.description,
        cost_price: Number(v.cost_price||0), selling_price: Number(v.selling_price||0),
        quantity: Number(v.quantity||0), min_qnt: Number(v.min_qnt||0), max_qnt: Number(v.max_qnt||0),
        attributes, existing_images: existingImages, tags: v.tags || [],
      };
    });
    data.append("variants", JSON.stringify(variants));
    data.append("image_variant_indexes", JSON.stringify(imageVariantIndexes));
    if (editingProduct) updateMutation.mutate({ id: editingProduct._id, data });
  };

  const addTag = (e) => {
    e?.preventDefault();
    const val = tagInput.trim().toLowerCase();
    if (!val) return;
    if (formData.tag_names.includes(val)) { toast.info("Tag already added"); setTagInput(""); return; }
    setFormData(prev => ({ ...prev, tag_names: [...prev.tag_names, val] }));
    setTagInput("");
  };

  const removeTag = (tagName) => setFormData(prev => ({ ...prev, tag_names: prev.tag_names.filter(t => t !== tagName) }));

  const handleAddVariantTag = () => {
    const val = variantTagInput.trim().toLowerCase();
    if (!val) return;
    const currentTags = editingVariantForTags?.tags || [];
    if (currentTags.includes(val)) { toast.info("Tag already added"); setVariantTagInput(""); return; }
    const newTags = [...currentTags, val];
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    const updatedVariants = product.variants.map(v => String(v._id) === String(editingVariantForTags._id) ? { ...v, tags: newTags } : v);
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
    setVariantTagInput("");
  };

  const handleRemoveVariantTag = (tagToRemove) => {
    const newTags = (editingVariantForTags?.tags || []).filter(t => t !== tagToRemove);
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    const updatedVariants = product.variants.map(v => String(v._id) === String(editingVariantForTags._id) ? { ...v, tags: newTags } : v);
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
  };

  // Loading/Error states
  if (isLoading) return (
    <div className="w-full flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Loading product details...</p>
      </div>
    </div>
  );

  if (isError || !product) return (
    <div className="w-full flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
          <AlertTriangle className="w-7 h-7" style={{ color: "#ef4444" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Product Not Found</h2>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>This product does not exist or has been removed.</p>
        <button onClick={() => router.push("/admin/products")} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </button>
      </div>
    </div>
  );

  const variants = product.variants || [];
  const totalStock = variants.reduce((t, v) => t + Number(v.quantity||0), 0);
  const totalVariants = variants.length;
  const totalValue = variants.reduce((t, v) => t + (Number(v.selling_price||0) * Number(v.quantity||0)), 0);
  const lowestPrice = variants.length > 0 ? Math.min(...variants.map(v => Number(v.selling_price||0))) : 0;
  const highestPrice = variants.length > 0 ? Math.max(...variants.map(v => Number(v.selling_price||0))) : 0;
  const priceRange = lowestPrice === highestPrice ? `Rs. ${lowestPrice.toLocaleString()}` : `Rs. ${lowestPrice.toLocaleString()} - Rs. ${highestPrice.toLocaleString()}`;
  const wasUp = !!(product.created_at && product.updated_at && product.created_at !== product.updated_at);
  const displayTagNames = (product.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
  const firstVariant = variants[0];
  const productImage = firstVariant?.images?.[0] ? getImageUrl(firstVariant.images[0].img_url) : null;

  const tabList = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "variants", label: "Variants", icon: Layers3, badge: totalVariants > 0 ? String(totalVariants) : null },
    { id: "tags", label: "Tags", icon: TagIcon, badge: displayTagNames.length > 0 ? String(displayTagNames.length) : null },
    { id: "category", label: "Category", icon: FolderOpen },
    { id: "brand", label: "Brand", icon: Store },
    { id: "activity", label: "Activity", icon: Activity, badge: wasUp ? "2" : "1" },
  ];

  return (
    <div className="w-full space-y-5 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/admin/products")}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight leading-tight" style={{ color: "var(--text-primary)" }}>
                {product.name}
              </h1>
              <StatusBadge active={product.status === "active"} size="md" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5 font-mono text-[11px]">{product.product_code || product.sku || "N/A"}</span>
              <span className="opacity-40">|</span>
              <span>{totalVariants} Variants</span>
              <span className="opacity-40">|</span>
              <span>{totalStock} Units</span>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Created {fd(product.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleEdit}
            className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            <Pencil className="w-4 h-4" /> Edit Product
          </button>
          <button
            onClick={handleDelete}
            className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition-all hover:opacity-90"
            style={{ backgroundColor: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 border-b" style={{ borderColor: "var(--border-color)" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "variants", label: "Variants", count: totalVariants > 0 ? totalVariants : null },
          { id: "tags", label: "Tags", count: displayTagNames.length > 0 ? displayTagNames.length : null },
          { id: "category", label: "Category" },
          { id: "brand", label: "Brand" },
          { id: "activity", label: "History", count: wasUp ? 2 : 1 },
        ].map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className="relative py-3 text-[13px] font-medium transition-colors outline-none whitespace-nowrap"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              {t.label}
              {t.count !== null && (
                <span className="ml-1.5 text-[11px] font-medium" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  ({t.count})
                </span>
              )}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--accent)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div className="space-y-6">
             {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Product Details + Description - 2 column */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
              <div className="lg:col-span-3 self-start">
                {/* Product Details */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">Product Details</h3>
                      <p className="text-[10px] text-[var(--text-muted)]">Basic information and configuration</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                      <div>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Product Name</p>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Product Code</p>
                        <p className="text-[14px] font-mono text-[var(--text-secondary)]">{product.product_code || product.sku || "N/A"}</p>
                      </div>
                      <div className="py-4 border-t border-[var(--border-color)] md:border-t-0 md:py-4">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Category</p>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.category_id?.name || "—"}</p>
                      </div>
                      <div className="py-4 border-t border-[var(--border-color)] md:border-t-0 md:py-4">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Brand</p>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.brand_id?.name || "—"}</p>
                      </div>
                      <div className="py-4 border-t border-[var(--border-color)]">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Status</p>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.status === "active" ? "Active" : "Inactive"}</p>
                      </div>
                      <div className="py-4 border-t border-[var(--border-color)]">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Tax Rate</p>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.tax || 0}%</p>
                      </div>
                      <div className="py-4 border-t border-[var(--border-color)]">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Price Range</p>
                        <p className="text-[14px] font-semibold text-[var(--accent)]">{priceRange}</p>
                      </div>
                      <div className="py-4 border-t border-[var(--border-color)]">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Stock</p>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{totalStock} units</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 flex flex-col gap-3 self-start">
                {/* Description */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Description</h3>
                  </div>
                  <div className="p-3">
                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
                      {product.description || "No description provided for this product."}
                    </p>
                  </div>
                </div>

                {/* Created By */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Created By</h3>
                  </div>
                  <div className="p-3">
                    {product.createdby ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <Avatar user={product.createdby} size="md" color="emerald" />
                          <div>
                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{product.createdby.name || product.createdby.email}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{product.createdby.email || "—"}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">Created At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.created_at)}</span></p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">System</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Created At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.created_at)}</span></p>
                      </div>
                    )}
                  </div>
                </div>

                {wasUp && (
                  <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">Updated By</h3>
                    </div>
                  <div className="p-3">
                    {product.updatedby ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <Avatar user={product.updatedby} size="md" color="blue" />
                            <div>
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{product.updatedby.name || product.updatedby.email}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">{product.updatedby.email || "—"}</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">Updated At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.updated_at)}</span></p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)]">—</p>
                          <p className="text-[11px] text-[var(--text-muted)]">Updated At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.updated_at)}</span></p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* VARIANTS TAB */}
        {activeTab === "variants" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Variants</h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{totalVariants} {totalVariants === 1 ? "variant" : "variants"} · {totalStock} units total</p>
              </div>
              <button onClick={handleAddVariantFromTab} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                <Plus className="w-4 h-4" /> Add Variant
              </button>
            </div>

            {variants.length === 0 ? (
              <div className="rounded-xl py-14 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <Layers3 className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">No variants yet</p>
                <p className="text-[12px] text-[var(--text-muted)]">This product doesn't have any variants yet.</p>
                <button onClick={handleAddVariantFromTab} className="mt-2 h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> Create First Variant
                </button>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <table className="w-full text-[12px]">
                  <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">SKU</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Variant</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Price</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Stock</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Status</th>
                      <th className="text-right px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant, index) => {
                      const isLowStock = Number(variant.quantity) <= Number(variant.min_qnt);
                      return (
                        <tr key={variant._id || index} style={{ borderBottom: index < variants.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                          <td className="px-5 py-4 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[160px]">{variant.sku}</td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate max-w-[200px]">{variant.title || `Variant ${index + 1}`}</p>
                            {variant.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {variant.tags.slice(0, 2).map((tag, idx) => (
                                  <span key={`${tag}-${idx}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]">
                                    {tag}
                                  </span>
                                ))}
                                {variant.tags.length > 2 && (
                                  <span className="text-[9px] text-[var(--text-muted)]">+{variant.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 font-semibold text-[13px]" style={{ color: "#10b981" }}>Rs. {Number(variant.selling_price || 0).toLocaleString()}</td>
                          <td className="px-5 py-4 font-semibold text-[13px]" style={{ color: isLowStock ? "#ef4444" : "var(--text-primary)" }}>{variant.quantity || 0}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                              style={{
                                backgroundColor: variant.status === "active" || !variant.status ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                                color: variant.status === "active" || !variant.status ? "#10b981" : "#ef4444",
                                border: `1px solid ${variant.status === "active" || !variant.status ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                              }}>
                              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: variant.status === "active" || !variant.status ? "#10b981" : "#ef4444" }} />
                              {variant.status === "active" || !variant.status ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => router.push(`/admin/products/${id}/add-variant?edit=${variant._id}&tab=${activeTab}`)}
                                className="h-8 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition border hover:opacity-80"
                                style={{ backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => { setEditingVariantForTags({ ...variant, tags: variant.tags || [] }); setShowVariantTagsModal(true); setVariantTagInput(""); }}
                                className="h-8 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition border hover:opacity-80"
                                style={{ backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                              >
                                <TagIcon className="w-3.5 h-3.5" /> Tags
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAGS TAB */}
        {activeTab === "tags" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Tags</h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{globalTags.length} {globalTags.length === 1 ? "tag" : "tags"} available</p>
              </div>
              <button
                onClick={() => setShowCreateTagModal(true)}
                className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
              >
                <Plus className="w-4 h-4" /> Add Tag
              </button>
            </div>

            {globalTags.length === 0 ? (
              <div className="rounded-xl py-14 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <TagIcon className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">No tags yet</p>
                <p className="text-[12px] text-[var(--text-muted)]">Create tags to organize and categorize your products.</p>
                <button
                  onClick={() => setShowCreateTagModal(true)}
                  className="mt-2 h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  <Plus className="w-4 h-4" /> Create First Tag
                </button>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <table className="w-full text-[12px]">
                  <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Tag Name</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Created By</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Created At</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Updated By</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Updated At</th>
                      <th className="text-right px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalTags.map((tag, index) => (
                      <tr key={tag._id} style={{ borderBottom: index < globalTags.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-[13px] capitalize" style={{ color: "var(--text-primary)" }}>{tag.name}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-[var(--text-secondary)]">
                          {tag.createdby ? (typeof tag.createdby === "object" ? (tag.createdby.name || tag.createdby.email || "—") : tag.createdby) : "System"}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-[var(--text-muted)] font-mono">{fd(tag.created_at || tag.createdAt)}</td>
                        <td className="px-5 py-3.5 text-[12px] text-[var(--text-secondary)]">
                          {tag.updatedby ? (typeof tag.updatedby === "object" ? (tag.updatedby.name || tag.updatedby.email || "—") : tag.updatedby) : (tag.updated_at ? "—" : "")}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-[var(--text-muted)] font-mono">
                          {tag.updated_at ? fd(tag.updated_at || tag.updatedAt) : ""}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEditGlobalTag(tag)}
                              className="h-8 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition border hover:opacity-80"
                              style={{ backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => deleteGlobalTag(tag._id)}
                              disabled={deleteTagMutation.isPending}
                              className="h-8 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition border hover:opacity-80"
                              style={{ backgroundColor: "transparent", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CATEGORY TAB */}
        {activeTab === "category" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {product.category_id ? (
              <>
                <InfoCard icon={FolderOpen} title="Category Details">
                  <div className="space-y-1">
                    <DataRow icon={Hash} label="Name" value={product.category_id.name} />
                    <DataRow icon={Hash} label="Code" value={product.category_id.category_code || "—"} mono />
                    <DataRow icon={Activity} label="Status" value="Active" highlight />
                    <DataRow icon={Package} label="Assigned Product" value={product.name} />
                  </div>
                </InfoCard>
                <InfoCard icon={FileText} title="Description">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {product.category_id.description || "No description available for this category."}
                  </p>
                </InfoCard>
              </>
            ) : (
              <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <EmptyState icon={FolderOpen} title="No Category Assigned" description="This product is not assigned to any category yet." />
              </div>
            )}
          </div>
        )}

        {/* BRAND TAB */}
        {activeTab === "brand" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {product.brand_id ? (
              <>
                <InfoCard icon={Store} title="Brand Details">
                  <div className="space-y-1">
                    <DataRow icon={Hash} label="Name" value={product.brand_id.name} />
                    <DataRow icon={Hash} label="Code" value={product.brand_id.brand_code || "—"} mono />
                    <DataRow icon={FolderOpen} label="Country" value={product.brand_id.country || "—"} />
                    <DataRow icon={Activity} label="Status" value={product.brand_id.is_active ? "Active" : "Inactive"} highlight={product.brand_id.is_active} />
                  </div>
                </InfoCard>
                <InfoCard icon={FileText} title="Description">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {product.brand_id.description || "No description available for this brand."}
                  </p>
                </InfoCard>
              </>
            ) : (
              <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <EmptyState icon={Store} title="No Brand Assigned" description="This product is not assigned to any brand yet." />
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <InfoCard icon={Activity} title="Activity Timeline" action={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
              style={{ backgroundColor: isConnected ? "rgba(16,185,129,0.12)" : "var(--bg-tertiary)", color: isConnected ? "#10b981" : "var(--text-muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isConnected ? "#10b981" : "var(--text-muted)" }} />
              {isConnected ? "Live" : "Offline"}
            </span>
          }>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16,185,129,0.12)" }}>
                    <Plus className="w-5 h-5" style={{ color: "#10b981" }} />
                  </div>
                  <div className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border-color)" }} />
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Product Created</h4>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Added to the system</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{fd(product.created_at)}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tago(product.created_at)}</p>
                    </div>
                  </div>
                  {product.createdby && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <Avatar user={product.createdby} size="sm" color="emerald" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{product.createdby.name || product.createdby.email}</p>
                        <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{product.createdby.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {wasUp && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(59,130,246,0.12)" }}>
                      <Pencil className="w-5 h-5" style={{ color: "#3b82f6" }} />
                    </div>
                    <div className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border-color)" }} />
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Product Updated</h4>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Details were modified</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{fd(product.updated_at)}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tago(product.updated_at)}</p>
                      </div>
                    </div>
                    {product.updatedby && (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <Avatar user={product.updatedby} size="sm" color="blue" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{product.updatedby.name || product.updatedby.email}</p>
                          <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{product.updatedby.email}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {liveEvents.map((ev, i) => (
                <div key={ev.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ev.type === "created" ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)" }}>
                      {ev.type === "created" ? <Plus className="w-5 h-5" style={{ color: "#10b981" }} /> : <Pencil className="w-5 h-5" style={{ color: "#3b82f6" }} />}
                    </div>
                    {i < liveEvents.length - 1 && <div className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border-color)" }} />}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                          {ev.type === "created" ? "Product Created" : "Product Updated"} <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981" }}>LIVE</span>
                        </h4>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {ev.type === "created" ? "Added to the system" : "Details were modified"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{fd(ev.date)}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tago(ev.date)}</p>
                      </div>
                    </div>
                    {ev.user && (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <Avatar user={ev.user} size="sm" color={ev.type === "created" ? "emerald" : "blue"} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{ev.user.name || ev.user.email}</p>
                          <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{ev.user.email}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {!wasUp && liveEvents.length === 0 && (
                <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                  <Clock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No updates yet. Product has not been modified since creation.</span>
                </div>
              )}
            </div>
          </InfoCard>
        )}
      </div>

      {/* EDIT MODAL - Kept same as original but with better styling */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[92vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Product</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Update product and variant information</p>
              </div>
              <button onClick={closeProductModal} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-4 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: currentStep > 1 ? "#10b981" : "var(--bg-card)", color: currentStep > 1 ? "#fff" : "var(--text-muted)" }}>
                  {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                </div>
                <span className="text-[12px] font-semibold" style={{ color: currentStep === 1 ? "var(--text-primary)" : "var(--text-muted)" }}>Product Info</span>
              </div>
              <div className="h-px w-8" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: currentStep === 2 ? "#10b981" : "var(--bg-card)", color: currentStep === 2 ? "#fff" : "var(--text-muted)" }}>2</div>
                <span className="text-[12px] font-semibold" style={{ color: currentStep === 2 ? "var(--text-primary)" : "var(--text-muted)" }}>Variants</span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
              {currentStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Category *</label>
                      <select required value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                        <option value="">Select category</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Brand *</label>
                      <select required value={formData.brand_id} onChange={(e) => setFormData({...formData, brand_id: e.target.value})}
                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                        <option value="">Select brand</option>
                        {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Product Name *</label>
                    <input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tags</label>
                    <div className="flex gap-2">
                      <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        placeholder="Type tag name & press Enter" className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                      <button type="button" onClick={addTag} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {formData.tag_names.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.tag_names.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Description</label>
                    <textarea rows={3} placeholder="Enter product description..." value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tax (%)</label>
                      <input type="number" min="0" placeholder="e.g. 18" value={formData.tax}
                        onChange={(e) => setFormData({...formData, tax: e.target.value})}
                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                        <option value="active">Active</option><option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button type="button" onClick={handleNextStep} className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      Next: Variants <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              {currentStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-base font-bold">
                        <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
                        Variants ({formData.variants.length})
                      </h4>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
                    </div>
                    <button type="button" onClick={addVariant} className="h-9 px-4 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      <Plus className="w-3.5 h-3.5" /> Add Variant
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.variants.map((variant, index) => (
                      <div key={variant._id || index} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border-color)" }}>
                        <div className="flex cursor-pointer items-center justify-between px-4 py-3"
                          style={{ backgroundColor: "var(--bg-tertiary)" }}
                          onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                          <div>
                            <p className="text-[13px] font-bold">{variant.sku || `Variant ${index+1}`}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index+1}`}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateVariant(index); }}
                              className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: "var(--text-muted)" }}>
                              <Copy className="w-4 h-4" />
                            </button>
                            <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); removeVariant(index); }}
                              className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "#ef4444" }}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronDown className={`w-5 h-5 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                          </div>
                        </div>
                        {expandedVariant === index && (
                          <div className="space-y-3 p-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Identification</p>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <div>
                                  <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>SKU *</label>
                                  <input required type="text" placeholder="e.g. sku_4" value={variant.sku}
                                    readOnly={!!editingProduct && !!variant._id}
                                    onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                    className={`h-9 px-3 rounded-lg text-[12px] w-full outline-none ${editingProduct && variant._id ? "opacity-60 cursor-not-allowed" : ""}`}
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Variant Title *</label>
                                  <input required type="text" placeholder="e.g. Black - Large" value={variant.title}
                                    onChange={(e) => updateVariant(index, "title", e.target.value)}
                                    className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                </div>
                              </div>
                              <div className="mt-2">
                                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Variant Description</label>
                                <textarea rows={2} placeholder="Enter variant description..." value={variant.description}
                                  onChange={(e) => updateVariant(index, "description", e.target.value)}
                                  className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Pricing & Stock</p>
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                                {[{l:"Cost Price *",f:"cost_price",p:"1000"},{l:"Selling Price *",f:"selling_price",p:"1500"},
                                  {l:"Quantity",f:"quantity",p:"50"},{l:"Min Qty",f:"min_qnt",p:"5"},{l:"Max Qty",f:"max_qnt",p:"100"}
                                ].map(({l,f,p}) => (
                                  <div key={f}>
                                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>{l}</label>
                                    <input type="number" min="0" placeholder={p} value={variant[f]}
                                      onChange={(e) => updateVariant(index, f, e.target.value)}
                                      className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  </div>
                                ))}
                              </div>
                              {variant.cost_price !== "" && variant.selling_price !== "" && Number(variant.selling_price) <= Number(variant.cost_price) && (
                                <div className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-3" style={{ borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)" }}>
                                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                                  <p className="text-[11px] font-semibold" style={{ color: "#ef4444" }}>Selling Price must be greater than Cost Price</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Variant Tags</p>
                              <div className="flex gap-2 mb-3">
                                <input type="text" value={variant.tagInput || ""} onChange={(e) => updateVariantTagInput(index, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && addVariantTag(index, e)} placeholder="Add specific tag for this variant..."
                                  className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                <button type="button" onClick={(e) => addVariantTag(index, e)} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              {variant.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {variant.tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                      {tag}
                                      <button type="button" onClick={() => removeVariantTag(index, tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Attributes</p>
                              <div className="space-y-2">
                                {variant.attributes.map((attr, ai) => {
                                  const preset = ATTRIBUTE_PRESETS.find(p => p.name === attr.name);
                                  const isMulti = preset?.data_type === "multi_select";
                                  const isNumber = preset?.data_type === "number";
                                  const selectedSingle = typeof attr.value === "string" ? attr.value : "";
                                  const setSingleValue = (val) => {
                                    const v = [...formData.variants];
                                    const a = [...v[index].attributes];
                                    a[ai] = { ...a[ai], value: val, isCustom: false };
                                    v[index] = { ...v[index], attributes: a };
                                    setFormData({ ...formData, variants: v });
                                  };
                                  return (
                                    <div key={ai} className="flex flex-wrap items-center gap-2">
                                      <div className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 flex items-center gap-2 font-semibold truncate"
                                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                                        <span className="truncate">{attr.name || "—"}</span>
                                        {attr._creating && <span className="text-[10px] font-normal italic" style={{ color: "var(--text-muted)" }}>creating…</span>}
                                        {attr._createError && <span className="text-[10px] font-normal italic" style={{ color: "#ef4444" }}>failed</span>}
                                      </div>
                                      {preset ? (
                                        isMulti ? (
                                          <div className="flex-1 min-w-[180px] flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg min-h-[42px]"
                                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                            {!selectedSingle && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Select an option...</span>}
                                            {selectedSingle && (
                                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                                                style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                                                {selectedSingle}
                                                <button type="button" onClick={() => setSingleValue("")} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10">
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </span>
                                            )}
                                            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                                              {preset.values.filter((val) => val !== selectedSingle).map((val) => (
                                                <button key={val} type="button" onClick={() => setSingleValue(val)}
                                                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                                                  style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                                  {val}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <input type={isNumber ? "number" : "text"} value={attr.value || ""} onChange={(e) => setSingleValue(e.target.value)}
                                            placeholder={`Enter ${preset.name.toLowerCase()} value...`}
                                            className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 outline-none"
                                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                        )
                                      ) : (
                                        <input type="text" placeholder="Value e.g. Black" value={attr.value || ""} onChange={(e) => setSingleValue(e.target.value)}
                                          className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                      )}
                                      <button type="button" onClick={() => removeAttribute(index,ai)} className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "#ef4444" }}>
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => addAttribute(index)} className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                                  <Plus className="w-4 h-4" /> Add Attribute
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Product Images</p>
                              <label className="block cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition hover:border-[var(--accent)]" style={{ borderColor: "var(--border-color)" }}>
                                <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(index,e)} />
                                <Upload className="mx-auto mb-2 w-6 h-6" style={{ color: "var(--text-muted)" }} />
                                <p className="text-[12px] font-semibold">Click to select images</p>
                                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Auto-optimized</p>
                              </label>
                              {variant.images.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {variant.images.map((img, ii) => (
                                    <div key={ii} className="relative group">
                                      <img src={img.preview} alt="" className="h-14 w-14 rounded-lg object-cover" style={{ border: "1px solid var(--border-color)" }} />
                                      <button type="button" onClick={() => removeImage(index,ii)}
                                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <button type="button" onClick={() => setCurrentStep(1)} className="h-9 px-5 rounded-lg text-[12px] font-semibold"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>← Back</button>
                    <button type="submit" disabled={updateMutation.isPending}
                      className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      {updateMutation.isPending ? "Saving..." : "Update Product"} <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Create New Tag</h3>
              <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input type="text" value={newTagModalValue} onChange={(e) => setNewTagModalValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTagFromModal()} placeholder="Enter tag name..." autoFocus
                  className="h-10 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} className="h-10 px-5 rounded-lg text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={handleCreateTagFromModal} disabled={createTagMutation.isPending || !newTagModalValue.trim()}
                  className="h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Tag</h3>
              <button onClick={cancelEditTag} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input type="text" value={editingTagName} onChange={(e) => setEditingTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEditGlobalTag()} placeholder="Enter tag name..." autoFocus
                  className="h-10 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={cancelEditTag} className="h-10 px-5 rounded-lg text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={saveEditGlobalTag} disabled={updateTagMutation.isPending || !editingTagName.trim()}
                  className="h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Save className="w-4 h-4" /> {updateTagMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variant Tags Modal */}
      {showVariantTagsModal && editingVariantForTags && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Manage Variant Tags</h3>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{editingVariantForTags.title || editingVariantForTags.sku}</p>
              </div>
              <button onClick={() => { setShowVariantTagsModal(false); setEditingVariantForTags(null); setVariantTagInput(""); }}
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={variantTagInput} onChange={(e) => setVariantTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariantTag(); } }}
                  placeholder="Type tag & press Enter..." autoFocus className="h-10 px-3 rounded-lg text-[12px] flex-1 outline-none"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                <button onClick={handleAddVariantTag} disabled={!variantTagInput.trim()}
                  className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Current Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {(editingVariantForTags.tags || []).length > 0 ? (
                    (editingVariantForTags.tags || []).map((tag, idx) => (
                      <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <TagIcon className="w-3 h-3" />
                        {tag}
                        <button onClick={() => handleRemoveVariantTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/20">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>No tags yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && product && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "#ef4444" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete "{product.name}"?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The product and all its variants will be permanently removed.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button disabled={deleteMutation.isPending} onClick={confirmDelete}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: "var(--danger)" }}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ATTRIBUTE MODAL */}
      {showAttributeModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-visible rounded-2xl shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between rounded-t-2xl px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Create New Attribute</h3>
              <button type="button" onClick={() => { setShowAttributeModal(false); setAttributeTargetVariant(null); resetAttributeForm(); }} disabled={createAttributeMutation.isPending}
                className="rounded-lg p-2 transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Attribute Name *</label>
                  <input type="text" value={newAttributeData.name} onChange={e => setNewAttributeData(p => ({ ...p, name: e.target.value }))} required disabled={createAttributeMutation.isPending}
                    className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. Color, RAM, Size" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Attribute Code</label>
                  <input type="text" value={newAttributeData.code} onChange={e => setNewAttributeData(p => ({ ...p, code: e.target.value.toLowerCase() }))} disabled={createAttributeMutation.isPending}
                    className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. color, ram_size" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Data Type *</label>
                <select value={newAttributeData.data_type} onChange={e => setNewAttributeData(p => ({ ...p, data_type: e.target.value }))} disabled={createAttributeMutation.isPending}
                  className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="multi_select">Multi Select</option>
                  <option value="decimal">Decimal</option>
                </select>
              </div>
              {newAttributeData.data_type === "select" && (
                <div className="space-y-3 rounded-xl p-4" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Allowed Values</label>
                    <button type="button" onClick={handleAddAttributeValue} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                      <Plus className="w-3.5 h-3.5" /> Add Value
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newAttributeData.values.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="text" placeholder="Label (e.g. Red)" value={val.label} onChange={e => handleAttributeValueChange(idx, "label", e.target.value)}
                          className="h-9 flex-1 rounded-lg px-3 text-[12px] outline-none"
                          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <input type="text" placeholder="Value (e.g. #FF0000)" value={val.value} onChange={e => handleAttributeValueChange(idx, "value", e.target.value)}
                          className="h-9 flex-1 rounded-lg px-3 text-[12px] outline-none"
                          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <button type="button" onClick={() => handleRemoveAttributeValue(idx)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setShowAttributeModal(false); setAttributeTargetVariant(null); resetAttributeForm(); }} disabled={createAttributeMutation.isPending}
                  className="h-10 flex-1 rounded-lg text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="button" onClick={handleAttributeSubmit} disabled={createAttributeMutation.isPending}
                  className="h-10 flex-1 rounded-lg text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {createAttributeMutation.isPending ? "Creating..." : "Create Attribute"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}