"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useProductSocketSync } from "@/hooks/useProductSocketSync";
import { useSocket } from "@/hooks/useSocket";
import {
  Package, Layers3, Box, TrendingUp, Clock, Pencil, Check,
  ChevronDown, ChevronRight, Copy, Plus, Trash2, Upload, X,
  Sparkles, AlertTriangle, DollarSign, FolderOpen, Store, Hash, Tag as TagIcon,
  Edit3, Save
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/productApi";
import { categoryApi } from "@/apis/categoryApi";
import { brandApi } from "@/apis/brandApi";
import { variantApi } from "@/apis/variantApi";
import { tagApi } from "@/apis/tagApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const ATTRIBUTE_PRESETS = [
  { name: "Color", values: ["Black","White","Gray","Red","Blue","Green","Yellow","Brown","Pink","Orange","Purple","Gold","Silver"] },
  { name: "Size", values: ["XS","S","M","L","XL","XXL","XXXL","Free Size"] },
  { name: "Material", values: ["Cotton","Polyester","Leather","Denim","Wool","Silk","Linen","Nylon"] },
  { name: "Fit", values: ["Regular Fit","Slim Fit","Loose Fit","Relaxed Fit","Oversized","Skinny","Straight","Tapered"] },
  { name: "Pattern", values: ["Solid","Striped","Checked","Plaid","Printed","Floral","Camouflage"] },
  { name: "Sleeve", values: ["Full Sleeve","Half Sleeve","Sleeveless","3/4 Sleeve","Long Sleeve","Short Sleeve","Cap Sleeve"] },
  { name: "Collar", values: ["Round Neck","V-Neck","Collared","Mandarin Collar","Polo Collar","Turtleneck","Hooded","Boat Neck"] },
  { name: "Occasion", values: ["Casual","Formal","Party","Wedding","Sports","Gym","Office","Outdoor","Daily Wear","Festive"] },
  { name: "Gender", values: ["Men","Women","Unisex","Boys","Girls","Kids","Teen"] },
  { name: "Season", values: ["Summer","Winter","Spring","Autumn","All Season","Monsoon"] },
  { name: "Care", values: ["Machine Wash","Hand Wash","Dry Clean Only","Do Not Bleach","Iron Safe","Wash Separately"] },
  { name: "Style", values: ["Casual","Formal","Sporty","Classic","Modern","Vintage","Bohemian","Streetwear","Ethnic","Western"] },
];

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

function Ico(props) {
  return (
    <svg className={props.className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={props.sw || 2} d={props.d} />
    </svg>
  );
}
const D = { chevron: "M9 5l7 7-7 7" };

function fd(d) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function tago(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const dy = Math.floor(h / 24);
  return dy < 30 ? dy + "d ago" : fd(d);
}
function ini(n) {
  return n ? n.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "??";
}

function InfoRow({ label, value, mono, green }) {
  return (
    <div className="flex justify-between items-center py-2.5">
      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`text-[12px] text-right truncate max-w-[55%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}>{value || "—"}</span>
    </div>
  );
}

function SecTitle({ children }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide mb-3 pb-2.5 flex items-center justify-between"
      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>
      {children}
    </div>
  );
}

function InnerCard({ children, className = "" }) {
  return (
    <div className={`rounded-xl p-4 ${className}`}
      style={{ backgroundColor: "transparent", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
      {children}
    </div>
  );
}

function SBtn({ onClick, disabled, danger, primary, children, type = "button", className = "" }) {
  const [hov, setHov] = useState(false);
  let bg, cl;
  if (danger) { bg = hov ? "rgba(239,68,68,0.1)" : "transparent"; cl = "#f87171"; }
  else if (primary) { bg = "var(--accent)"; cl = "var(--accent-text)"; }
  else { bg = hov ? "rgba(255,255,255,0.06)" : "transparent"; cl = "var(--text-secondary)"; }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className={`h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center justify-center gap-1 transition-all duration-150 disabled:opacity-40 cursor-pointer ${className}`}
      style={{ backgroundColor: bg, color: cl, border: "none" }}>{children}</button>
  );
}

function Person({ user, label, date, color = "#34d399", fallback = "Unknown" }) {
  const bg = color === "#60a5fa" ? "rgba(96,165,250,0.1)" : "rgba(52,211,153,0.1)";
  if (!user) return (
    <div className="py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color }}>{label}</p>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fallback}</p>
    </div>
  );
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color }}>{label}</p>
        {date && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fd(date)} · {tago(date)}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
          style={{ backgroundColor: bg, color }}>{ini(user.name || user.email)}</div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.name || user.email || "Unknown"}</p>
          {user.email && user.name && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>}
        </div>
      </div>
    </div>
  );
}

function TItem({ icon, title, sub, user, date, color = "#34d399", last }) {
  const bg = color === "#60a5fa" ? "rgba(96,165,250,0.1)" : "rgba(52,211,153,0.1)";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color }}>{icon}</div>
        {!last && <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-color)" }} />}
      </div>
      <div className={`flex-1 min-w-0 ${last ? "" : "pb-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{title}</p>
            {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{fd(date)}</p>
            <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{tago(date)}</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg"
            style={{ border: "1px solid var(--border-color)", borderRadius: "8px" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
              style={{ backgroundColor: bg, color }}>{ini(user.name || user.email)}</div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.name || user.email || "?"}</p>
              {user.email && user.name && <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ active }) {
  const c = active ? "#34d399" : "#f87171";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shrink-0"
      style={{ backgroundColor: active ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: c }}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  useProductSocketSync();
  const { socket, isConnected } = useSocket();
  const id = params?.id;

  useEffect(() => {
    if (!socket || !isConnected || !id) return;
    const handleDeleted = (data) => {
      if (data?.id === id) { toast.info("This product was deleted from another session."); router.push("/admin/products"); }
    };
    socket.on("productDeleted", handleDeleted);
    return () => { socket.off("productDeleted", handleDeleted); };
  }, [socket, isConnected, id, router]);

  const [activeTab, setActiveTab] = useState("overview");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  
  const [formData, setFormData] = useState({
    category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [],
    variants: [createEmptyVariant()],
  });
  const [tagInput, setTagInput] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagModalValue, setNewTagModalValue] = useState("");
  const [editingVariantForTags, setEditingVariantForTags] = useState(null);
  const [showVariantTagsModal, setShowVariantTagsModal] = useState(false);
  const [variantTagInput, setVariantTagInput] = useState("");

  const [newGlobalTag, setNewGlobalTag] = useState("");
  const [editingGlobalTagId, setEditingGlobalTagId] = useState(null);
  const [editingGlobalTagName, setEditingGlobalTagName] = useState("");

  const { data: product, isLoading, isError, refetch: refetchProduct } = useQuery({
    queryKey: ["product", id], queryFn: () => productApi.getById(id), enabled: !!id,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll });

  const { data: globalTags = [], refetch: refetchTags } = useQuery({
    queryKey: ["globalTags"],
    queryFn: tagApi.getAll,
  });

  const createTagMutation = useMutation({
    mutationFn: tagApi.create,
    onSuccess: () => { refetchTags(); setNewGlobalTag(""); setNewTagModalValue(""); toast.success("Tag created successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create tag"),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }) => tagApi.update(id, data),
    onSuccess: () => { refetchTags(); setEditingGlobalTagId(null); toast.success("Tag updated successfully"); },
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
      
      // Refresh modal data with fresh product data
      if (showVariantTagsModal && editingVariantForTags) {
        setTimeout(() => {
          const freshProduct = queryClient.getQueryData(["product", id]);
          if (freshProduct) {
            const updatedVariant = freshProduct.variants?.find(v => String(v._id) === String(editingVariantForTags._id));
            if (updatedVariant) {
              setEditingVariantForTags({ ...updatedVariant, tags: updatedVariant.tags || [] });
            }
          }
        }, 300);
      }
      
      if (showModal) {
        closeProductModal();
      }
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Product update failed"); },
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); router.push("/admin/products"); },
    onError: (error) => { toast.error(error.response?.data?.message || "Product delete failed"); },
  });

  const handleDelete = () => setShowDeleteModal(true);
  const confirmDelete = () => { if (product) deleteMutation.mutate(product._id); };

  const prepareEditData = (prod) => {
    const variants = prod.variants?.length
      ? prod.variants.map((v) => ({
          _id: v._id, sku: v.sku || "", title: v.title || "", description: v.description || "",
          cost_price: String(v.cost_price ?? ""), selling_price: String(v.selling_price ?? ""),
          quantity: String(v.quantity ?? 0), min_qnt: String(v.min_qnt ?? 0), max_qnt: String(v.max_qnt ?? 0),
          attributes: Object.entries(v.attributes || {}).map(([name, value]) => ({ name, value: String(value), isCustom: false })),
          images: (v.images || []).map((img) => ({ existing: true, metadata: img, preview: getImageUrl(img.img_url) })),
          tags: v.tags || [],
        }))
      : [createEmptyVariant()];
      
    const currentTagNames = (prod.tag_ids || [])
      .map(t => typeof t === 'object' ? t.name : t)
      .filter(Boolean);

    return {
      category_id: prod.category_id?._id || prod.category_id || "",
      brand_id: prod.brand_id?._id || prod.brand_id || "",
      name: prod.name || "", description: prod.description || "",
      tax: String(prod.tax ?? 0), status: prod.status || "active", 
      tag_names: currentTagNames,
      variants,
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

  const handleAddVariantFromTab = () => {
    if (!product) return;
    router.push(`/admin/products/${id}/add-variant`);
  };

  const closeProductModal = () => {
    formData.variants.forEach((v) => {
      v.images.forEach((img) => { if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); });
    });
    setShowModal(false); setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0);
    setTagInput("");
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

  const addAttribute = (vi) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = {...v[vi], attributes: [...v[vi].attributes, {name:"",value:"",isCustom:false}]}; return {...prev, variants: v}; });
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
    if (formData.variants[vi].tags.includes(val)) {
      toast.info("Tag already added to this variant");
      return;
    }
    setFormData((prev) => {
      const v = [...prev.variants];
      v[vi] = { ...v[vi], tags: [...v[vi].tags, val], tagInput: "" };
      return { ...prev, variants: v };
    });
  };

  const removeVariantTag = (vi, tagName) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      v[vi] = { ...v[vi], tags: v[vi].tags.filter(t => t !== tagName) };
      return { ...prev, variants: v };
    });
  };

  const updateVariantTagInput = (vi, value) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      v[vi] = { ...v[vi], tagInput: value };
      return { ...prev, variants: v };
    });
  };

  const handleCreateGlobalTag = () => {
    if (!newGlobalTag.trim()) return;
    createTagMutation.mutate({ name: newGlobalTag.trim() });
  };

  const handleCreateTagFromModal = () => {
    if (!newTagModalValue.trim()) return;
    createTagMutation.mutate({ name: newTagModalValue.trim() }, {
      onSuccess: () => {
        setShowCreateTagModal(false);
        setNewTagModalValue("");
      }
    });
  };

  const startEditGlobalTag = (tag) => {
    setEditingGlobalTagId(tag._id);
    setEditingGlobalTagName(tag.name);
  };

  const saveEditGlobalTag = (tagId) => {
    if (!editingGlobalTagName.trim()) return;
    updateTagMutation.mutate({ id: tagId, data: { name: editingGlobalTagName } });
  };

  const deleteGlobalTag = (tagId) => {
    deleteTagMutation.mutate(tagId);
  };

  const compressProductImage = (file) => new Promise((resolve) => {
    const image = new Image(); const imageUrl = URL.createObjectURL(file);
    image.onload = () => {
      const MAX = 1400; let w = image.width, h = image.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(imageUrl);
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "")+".webp", { type: "image/webp", lastModified: Date.now() }));
      }, "image/webp", 0.82);
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(file); };
    image.src = imageUrl;
  });

  const handleImageUpload = async (vi, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => ["image/jpeg","image/png","image/webp"].includes(f.type));
    if (valid.length !== files.length) toast.error("Only JPG, PNG and WebP images are allowed");
    try {
      const compressed = await Promise.all(valid.map(f => compressProductImage(f)));
      const imgs = compressed.map(f => ({ file: f, existing: false, preview: URL.createObjectURL(f) }));
      setFormData((prev) => { const v = [...prev.variants]; v[vi] = {...v[vi], images: [...v[vi].images, ...imgs]}; return {...prev, variants: v}; });
      toast.success("Image optimized successfully");
    } catch { toast.error("Image processing failed"); }
    e.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => {
      const v = [...prev.variants]; const img = v[vi].images[ii];
      if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      v[vi] = {...v[vi], images: v[vi].images.filter((_,i) => i !== ii)};
      return {...prev, variants: v};
    });
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
      if (Number(v.selling_price) <= Number(v.cost_price)) {
        toast.error(`Selling Price must be greater than Cost Price for "${v.title || v.sku}"`); return;
      }
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
      v.attributes.forEach(a => { if (a.name.trim()) attributes[a.name.trim()] = a.value; });
      const existingImages = v.images.filter(i => i.existing).map(i => i.metadata);
      v.images.filter(i => !i.existing && i.file).forEach(i => { data.append("images", i.file); imageVariantIndexes.push(idx); });
      let finalSku = v.sku.trim();
      if (editingProduct) {
        const orig = editingProduct.variants?.find(ov => ov._id && String(ov._id) === String(v._id));
        if (orig) finalSku = orig.sku;
      }
      return {
        _id: v._id || undefined, sku: finalSku, title: v.title.trim(), description: v.description,
        cost_price: Number(v.cost_price||0), selling_price: Number(v.selling_price||0),
        quantity: Number(v.quantity||0), min_qnt: Number(v.min_qnt||0), max_qnt: Number(v.max_qnt||0),
        attributes, existing_images: existingImages,
        tags: v.tags || [],
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
    if (formData.tag_names.includes(val)) {
      toast.info("Tag already added");
      setTagInput("");
      return;
    }
    setFormData(prev => ({ ...prev, tag_names: [...prev.tag_names, val] }));
    setTagInput("");
  };

  const removeTag = (tagName) => {
    setFormData(prev => ({ ...prev, tag_names: prev.tag_names.filter(t => t !== tagName) }));
  };

  // ✅ FIXED: Update local state immediately so modal shows tags right away
  const handleAddVariantTag = () => {
    const val = variantTagInput.trim().toLowerCase();
    if (!val) return;
    const currentTags = editingVariantForTags?.tags || [];
    if (currentTags.includes(val)) {
      toast.info("Tag already added");
      setVariantTagInput("");
      return;
    }
    
    // ✅ Update local state immediately
    const newTags = [...currentTags, val];
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    
    const updatedVariants = product.variants.map(v => 
      String(v._id) === String(editingVariantForTags._id)
        ? { ...v, tags: newTags }
        : v
    );
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
    setVariantTagInput("");
  };

  // ✅ FIXED: Update local state immediately when removing tag
  const handleRemoveVariantTag = (tagToRemove) => {
    const newTags = (editingVariantForTags?.tags || []).filter(t => t !== tagToRemove);
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    
    const updatedVariants = product.variants.map(v => 
      String(v._id) === String(editingVariantForTags._id)
        ? { ...v, tags: newTags }
        : v
    );
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
  };

  if (isLoading) return (
    <div className="w-full flex items-center justify-center py-24" style={{ color: "var(--text-primary)" }}>
      <div className="rounded-xl py-14 px-20 flex items-center gap-2" style={{ backgroundColor: "var(--bg-card)", borderRadius: "12px" }}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading...</span>
      </div>
    </div>
  );

  if (isError || !product) return (
    <div className="w-full flex items-center justify-center py-24" style={{ color: "var(--text-primary)" }}>
      <div className="rounded-xl py-14 px-8 flex flex-col items-center gap-3 text-center" style={{ backgroundColor: "var(--bg-card)", borderRadius: "12px" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
          <AlertTriangle className="w-4 h-4" style={{ color: "#f87171" }} />
        </div>
        <p className="text-base font-semibold">Product Not Found</p>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>This product does not exist.</p>
        <SBtn primary onClick={() => router.push("/admin/products")}>Back to Products</SBtn>
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
  const cs = { backgroundColor: "var(--bg-card)", borderRadius: "12px" };
  const is_ = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "8px" };

  const displayTagNames = (product.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);

  const tabList = [
    { id: "overview", label: "Overview" },
    { id: "variants", label: "Variants", badge: totalVariants > 0 ? String(totalVariants) : null },
    { id: "tags", label: "Tags", badge: displayTagNames.length > 0 ? String(displayTagNames.length) : null },
    { id: "category", label: "Category" },
    { id: "brand", label: "Brand" },
    { id: "activity", label: "Activity", badge: wasUp ? "2" : "1" },
  ];

  return (
    <div className="w-full" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-4">
        {/* HEADER */}
        <div className="px-1">
          <div className="flex items-center gap-1.5 mb-3">
            <button onClick={() => router.push("/admin/products")}
              className="text-[12px] font-medium transition hover:opacity-70"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Products</button>
            <Ico d={D.chevron} className="w-3 h-3" sw={1.5} />
            <span className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{product.name}</span>
          </div>
          <div className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(52,211,153,0.1)" }}>
                <Package className="w-5 h-5" style={{ color: "#34d399" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[16px] sm:text-[18px] font-semibold truncate leading-tight">{product.name}</h1>
                  <StatusPill active={product.status === "active"} />
                </div>
                <div className="flex items-center gap-2 text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  <span className="font-mono flex items-center gap-1"><Hash className="w-3 h-3" />{product.product_code || product.sku || "N/A"}</span>
                  <span>·</span><span>{totalVariants} Variants</span><span>·</span><span>{totalStock} Units</span><span>·</span><span>Created {fd(product.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SBtn onClick={handleEdit} primary><Pencil className="w-3.5 h-3.5" />Edit</SBtn>
              <SBtn onClick={handleDelete} danger><Trash2 className="w-3.5 h-3.5" />Delete</SBtn>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="rounded-xl overflow-hidden" style={cs}>
          <div className="px-5 flex items-center gap-5 overflow-x-auto"
            style={{ borderBottom: "1px solid var(--border-color)", scrollbarWidth: "none" }}>
            {tabList.map((tb) => {
              const active = activeTab === tb.id;
              return (
                <button key={tb.id} type="button" onClick={() => setActiveTab(tb.id)}
                  className="flex items-center gap-1.5 text-[12px] font-medium transition-colors duration-150 whitespace-nowrap"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 0 9px 0",
                    color: active ? "#34d399" : "var(--text-muted)",
                    borderBottom: active ? "2px solid #34d399" : "2px solid transparent", marginBottom: "-1px" }}>
                  {tb.label}
                  {tb.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                      style={{ backgroundColor: active ? "rgba(16,185,129,0.15)" : "var(--bg-tertiary)", color: active ? "#34d399" : "var(--text-muted)" }}>
                      {tb.badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5">
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <InnerCard className="flex flex-col">
                  <SecTitle>Product Details</SecTitle>
                  <div className="divide-y flex-1" style={{ borderColor: "var(--border-color)" }}>
                    <InfoRow label="Name" value={product.name} />
                    <InfoRow label="Category" value={product.category_id?.name || "—"} />
                    <InfoRow label="Brand" value={product.brand_id?.name || "—"} />
                    <InfoRow label="Status" value={product.status === "active" ? "Active" : "Inactive"} green={product.status === "active"} />
                    <InfoRow label="Tax Rate" value={`${product.tax || 0}%`} />
                    <InfoRow label="Price Range" value={priceRange} />
                    
                    <div className="py-2.5">
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Tags</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 justify-end">
                        {displayTagNames.length > 0 ? (
                          displayTagNames.map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium" 
                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No tags</span>
                        )}
                      </div>
                    </div>
                  </div>
                </InnerCard>
                <InnerCard className="flex flex-col">
                  <SecTitle>Description</SecTitle>
                  <div className="flex-1">
                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>
                      {product.description || "No description provided."}</p>
                  </div>
                </InnerCard>
                <InnerCard className="flex flex-col">
                  <SecTitle>Inventory Summary</SecTitle>
                  <div className="space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Total Stock</p>
                        <p className="text-[18px] font-semibold" style={{ color: totalStock === 0 ? "#f87171" : "#34d399" }}>{totalStock}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Variants</p>
                        <p className="text-[18px] font-semibold">{totalVariants}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Lowest Price</p>
                        <p className="text-[14px] font-semibold">Rs. {lowestPrice.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Highest Price</p>
                        <p className="text-[14px] font-semibold">Rs. {highestPrice.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </InnerCard>
              </div>
            )}

            {/* TAGS TAB */}
            {activeTab === "tags" && (
              <div className="space-y-4">
                <InnerCard>
                  <SecTitle>Global Tags</SecTitle>
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => setShowCreateTagModal(true)}
                      className="h-9 px-4 rounded-lg text-[12px] font-medium inline-flex items-center gap-1"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}>
                      <Plus className="w-3.5 h-3.5" /> Create Tag
                    </button>
                  </div>
                </InnerCard>

                <InnerCard>
                  <SecTitle>Assigned Tags ({globalTags.length})</SecTitle>
                  {globalTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {globalTags.map((tag) => (
                        <div key={tag._id} className="flex items-center gap-2 px-3 py-2 rounded-lg group" 
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          
                          {editingGlobalTagId === tag._id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={editingGlobalTagName}
                                onChange={(e) => setEditingGlobalTagName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEditGlobalTag(tag._id)}
                                autoFocus
                                className="h-6 px-2 rounded text-[11px] w-32 outline-none"
                                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
                              />
                              <button onClick={() => saveEditGlobalTag(tag._id)} disabled={updateTagMutation.isPending} className="p-1 rounded hover:bg-green-500/20 text-green-500">
                                <Save className="w-3 h-3" />
                              </button>
                              <button onClick={() => setEditingGlobalTagId(null)} className="p-1 rounded hover:bg-red-500/20 text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <TagIcon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                              <span className="text-[12px] font-medium capitalize">{tag.name}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button onClick={() => startEditGlobalTag(tag)} 
                                  className="p-1 rounded hover:bg-blue-500/20 text-blue-400 transition-colors" title="Edit">
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteGlobalTag(tag._id)} disabled={deleteTagMutation.isPending}
                                  className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors" title="Delete">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ border: "1px dashed var(--border-color)" }}>
                        <TagIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>No tags assigned yet</p>
                    </div>
                  )}
                </InnerCard>
              </div>
            )}

            {/* VARIANTS TAB */}
            {activeTab === "variants" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <InnerCard>
                    <div className="flex items-center gap-2 mb-1">
                      <Layers3 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total Variants</span>
                    </div>
                    <p className="text-[20px] font-semibold">{totalVariants}</p>
                  </InnerCard>
                  <InnerCard>
                    <div className="flex items-center gap-2 mb-1">
                      <Box className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total Stock</span>
                    </div>
                    <p className="text-[20px] font-semibold" style={{ color: totalStock === 0 ? "#f87171" : "#34d399" }}>{totalStock}</p>
                  </InnerCard>
                  <InnerCard>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Price Range</span>
                    </div>
                    <p className="text-[16px] font-semibold">{priceRange}</p>
                  </InnerCard>
                  <InnerCard>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total Value</span>
                    </div>
                    <p className="text-[16px] font-semibold">Rs. {totalValue.toLocaleString()}</p>
                  </InnerCard>
                </div>
                <div className="flex justify-end">
                  <SBtn primary onClick={handleAddVariantFromTab}><Plus className="w-3.5 h-3.5" />Add Variant</SBtn>
                </div>
                {variants.length === 0 ? (
                  <InnerCard>
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ border: "1px dashed var(--border-color)" }}>
                        <Package className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>No variants available</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Click "Add Variant" above to create one.</p>
                    </div>
                  </InnerCard>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {variants.map((variant, index) => (
                      <div key={variant._id || index} className="rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg"
                        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
                        
                        {/* Variant Header */}
                        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(52,211,153,0.1)" }}>
                              <Package className="w-4 h-4" style={{ color: "#34d399" }} />
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                                {variant.title || `Variant ${index + 1}`}
                              </p>
                              <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{variant.sku}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-bold" style={{ color: "#34d399" }}>
                              Rs. {Number(variant.selling_price || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{variant.quantity || 0} units</p>
                          </div>
                        </div>

                        {/* Variant Body */}
                        <div className="p-4 space-y-3">
                           {/* Cost & Stock */}
                           <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                                <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Cost Price</p>
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Rs. {Number(variant.cost_price || 0).toLocaleString()}</p>
                              </div>
                              <div className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                                <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Stock</p>
                                <p className="text-[13px] font-bold" style={{ color: Number(variant.quantity) <= Number(variant.min_qnt) ? "#f87171" : "var(--text-primary)" }}>
                                  {variant.quantity || 0} {Number(variant.quantity) <= Number(variant.min_qnt) && <span className="text-[9px] ml-1 font-normal text-red-500">(Low)</span>}
                                </p>
                              </div>
                           </div>

                           {/* ✅ VARIANT TAGS DISPLAY */}
                           {variant.tags && variant.tags.length > 0 && (
                             <div>
                               <p className="text-[9px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Tags</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {variant.tags.map((tag, idx) => (
                                   <span key={`${tag}-${idx}`} 
                                     className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                                     style={{ backgroundColor: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                                     <TagIcon className="w-2.5 h-2.5" />
                                     {tag}
                                   </span>
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* Action Buttons - Tags & Edit */}
                           <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
                              <button 
                                onClick={() => {
                                  router.push(`/admin/products/${id}/add-variant?edit=${variant._id}`);
                                }}
                                className="flex-1 h-7 px-2 rounded text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors"
                                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingVariantForTags({ ...variant, tags: variant.tags || [] });
                                  setShowVariantTagsModal(true);
                                  setVariantTagInput("");
                                }}
                                className="flex-1 h-7 px-2 rounded text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors"
                                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                              >
                                <TagIcon className="w-3 h-3" /> Tags
                              </button>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY & BRAND TABS */}
            {activeTab === "category" && (
              <div>
                {product.category_id ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InnerCard className="flex flex-col">
                      <SecTitle>Category Details</SecTitle>
                      <div className="divide-y flex-1" style={{ borderColor: "var(--border-color)" }}>
                        <InfoRow label="Name" value={product.category_id.name} />
                        <InfoRow label="Code" value={product.category_id.category_code || "—"} mono />
                        <InfoRow label="Status" value="Active" green />
                        <InfoRow label="Assigned Product" value={product.name} />
                      </div>
                    </InnerCard>
                    <InnerCard className="flex flex-col">
                      <SecTitle>Description</SecTitle>
                      <div className="flex-1">
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>
                          {product.category_id.description || "No description available."}</p>
                      </div>
                    </InnerCard>
                    <InnerCard className="flex flex-col">
                      <SecTitle>Metadata</SecTitle>
                      <div className="space-y-3 flex-1">
                        <Person user={product.category_id.createdby} label="Created By" date={product.category_id.created_at} color="#34d399" fallback="Unknown user" />
                        {product.category_id.updatedby && <Person user={product.category_id.updatedby} label="Updated By" date={product.category_id.updated_at} color="#60a5fa" />}
                      </div>
                    </InnerCard>
                  </div>
                ) : (
                  <InnerCard>
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ border: "1px dashed var(--border-color)" }}>
                        <FolderOpen className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>No category assigned</p>
                    </div>
                  </InnerCard>
                )}
              </div>
            )}

            {activeTab === "brand" && (
              <div>
                {product.brand_id ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InnerCard className="flex flex-col">
                      <SecTitle>Brand Details</SecTitle>
                      <div className="divide-y flex-1" style={{ borderColor: "var(--border-color)" }}>
                        <InfoRow label="Name" value={product.brand_id.name} />
                        <InfoRow label="Code" value={product.brand_id.brand_code || "—"} mono />
                        <InfoRow label="Country" value={product.brand_id.country || "—"} />
                        <InfoRow label="Status" value={product.brand_id.is_active ? "Active" : "Inactive"} green={product.brand_id.is_active} />
                      </div>
                    </InnerCard>
                    <InnerCard className="flex flex-col">
                      <SecTitle>Description</SecTitle>
                      <div className="flex-1">
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>
                          {product.brand_id.description || "No description available."}</p>
                      </div>
                    </InnerCard>
                    <InnerCard className="flex flex-col">
                      <SecTitle>Metadata</SecTitle>
                      <div className="space-y-3 flex-1">
                        <Person user={product.brand_id.createdby} label="Created By" date={product.brand_id.created_at} color="#34d399" fallback="Unknown user" />
                        {product.brand_id.updatedby && <Person user={product.brand_id.updatedby} label="Updated By" date={product.brand_id.updated_at} color="#60a5fa" />}
                      </div>
                    </InnerCard>
                  </div>
                ) : (
                  <InnerCard>
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ border: "1px dashed var(--border-color)" }}>
                        <Store className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>No brand assigned</p>
                    </div>
                  </InnerCard>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <InnerCard>
                  <SecTitle>Timeline</SecTitle>
                  <TItem icon={<Plus className="w-3.5 h-3.5" />} title="Product Created" sub="Added to the system"
                    user={product.createdby} date={product.created_at} color="#34d399" last={!wasUp} />
                  {wasUp && <TItem icon={<Pencil className="w-3.5 h-3.5" />} title="Product Updated" sub="Details were modified"
                    user={product.updatedby} date={product.updated_at} color="#60a5fa" last={true} />}
                  {!wasUp && (
                    <div className="mt-3 px-3 py-2.5 rounded-lg flex items-center gap-2"
                      style={{ border: "1px dashed var(--border-color)", borderRadius: "8px" }}>
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No updates yet.</span>
                    </div>
                  )}
                </InnerCard>
                <InnerCard>
                  <SecTitle>People</SecTitle>
                  <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                    <Person user={product.createdby} label="Created By" date={product.created_at} color="#34d399" fallback="Unknown user" />
                    {wasUp && product.updatedby
                      ? <Person user={product.updatedby} label="Updated By" date={product.updated_at} color="#60a5fa" />
                      : <Person user={null} label="Updated By" color="#60a5fa" fallback="No updates yet" />}
                  </div>
                </InnerCard>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ ...cs, border: "1px solid var(--border-color)" }}>
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-[13px] font-medium">Edit Product</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Update product and variant information</p>
              </div>
              <button onClick={closeProductModal} className="p-0.5 rounded hover:opacity-70"
                style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-4 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: currentStep > 1 ? "#34d399" : "var(--bg-tertiary)", color: currentStep > 1 ? "#fff" : "var(--text-muted)" }}>
                  {currentStep > 1 ? <Check className="w-3 h-3" /> : "1"}</div>
                <span className="text-[11px] font-medium" style={{ color: currentStep === 1 ? "var(--text-primary)" : "var(--text-muted)" }}>Product Info</span>
              </div>
              <div className="h-px w-8" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: currentStep === 2 ? "#34d399" : "var(--bg-tertiary)", color: currentStep === 2 ? "#fff" : "var(--text-muted)" }}>2</div>
                <span className="text-[11px] font-medium" style={{ color: currentStep === 2 ? "var(--text-primary)" : "var(--text-muted)" }}>Variants</span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
              {currentStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Category *</label>
                      <select required value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                        className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_}>
                        <option value="">Select category</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Brand *</label>
                      <select required value={formData.brand_id} onChange={(e) => setFormData({...formData, brand_id: e.target.value})}
                        className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_}>
                        <option value="">Select brand</option>
                        {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Product Name *</label>
                    <input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_} />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Tags</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        placeholder="Type tag name & press Enter"
                        className="h-8 px-2.5 rounded-lg text-[12px] flex-1 outline-none"
                        style={is_}
                      />
                      <button type="button" onClick={addTag} 
                        className="h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center justify-center gap-1"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" }}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {formData.tag_names.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {formData.tag_names.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium" 
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 rounded-full p-0.5 transition hover:bg-black/10">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
                    <textarea rows={3} placeholder="Enter product description..." value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="px-2.5 py-2 rounded-lg text-[12px] w-full outline-none resize-none" style={is_} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Tax (%)</label>
                      <input type="number" min="0" placeholder="e.g. 18" value={formData.tax}
                        onChange={(e) => setFormData({...formData, tax: e.target.value})}
                        className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_} />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_}>
                        <option value="active">Active</option><option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={handleNextStep}
                      className="h-8 px-4 rounded-lg text-[12px] font-medium inline-flex items-center gap-1"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}>
                      Next: Variants <ChevronRight className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-[13px] font-medium">
                        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />Variants ({formData.variants.length})</h4>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
                    </div>
                    <button type="button" onClick={addVariant}
                      className="h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}>
                      <Plus className="w-3 h-3" /> Add Variant</button>
                  </div>
                  <div className="space-y-3">
                    {formData.variants.map((variant, index) => (
                      <div key={variant._id || index} className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-color)" }}>
                        <div className="flex cursor-pointer items-center justify-between px-3 py-2.5"
                          style={{ backgroundColor: "var(--bg-tertiary)" }}
                          onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                          <div>
                            <p className="text-[12px] font-medium">{variant.sku || `Variant ${index+1}`}</p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index+1}`}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateVariant(index); }}
                              className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                              <Copy className="w-3 h-3" /></button>
                            <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); removeVariant(index); }}
                              className="p-1 rounded hover:opacity-70" style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                              <Trash2 className="w-3 h-3" /></button>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                          </div>
                        </div>
                        {expandedVariant === index && (
                          <div className="space-y-4 p-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Identification</p>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>SKU *</label>
                                  <input required type="text" placeholder="e.g. sku_4" value={variant.sku}
                                    readOnly={!!editingProduct && !!variant._id}
                                    onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                    className={`h-8 px-2.5 rounded-lg text-[12px] w-full outline-none ${editingProduct && variant._id ? "opacity-60 cursor-not-allowed" : ""}`}
                                    style={is_} />
                                </div>
                                <div>
                                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Variant Title *</label>
                                  <input required type="text" placeholder="e.g. Black - Large" value={variant.title}
                                    onChange={(e) => updateVariant(index, "title", e.target.value)}
                                    className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_} />
                                </div>
                              </div>
                              <div className="mt-3">
                                <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Variant Description</label>
                                <textarea rows={2} placeholder="Enter variant description..." value={variant.description}
                                  onChange={(e) => updateVariant(index, "description", e.target.value)}
                                  className="px-2.5 py-2 rounded-lg text-[12px] w-full outline-none resize-none" style={is_} />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Pricing & Stock</p>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                {[{l:"Cost Price *",f:"cost_price",p:"e.g. 1000"},{l:"Selling Price *",f:"selling_price",p:"e.g. 1500"},
                                  {l:"Quantity",f:"quantity",p:"e.g. 50"},{l:"Min Qty",f:"min_qnt",p:"e.g. 5"},{l:"Max Qty",f:"max_qnt",p:"e.g. 100"}
                                ].map(({l,f,p}) => (
                                  <div key={f}>
                                    <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{l}</label>
                                    <input type="number" min="0" placeholder={p} value={variant[f]}
                                      onChange={(e) => updateVariant(index, f, e.target.value)}
                                      className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_} />
                                  </div>
                                ))}
                              </div>
                              {variant.cost_price !== "" && variant.selling_price !== "" && Number(variant.selling_price) <= Number(variant.cost_price) && (
                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                                  <AlertTriangle className="w-3 h-3 shrink-0 text-red-500" />
                                  <p className="text-[11px] font-medium text-red-500">Selling Price must be greater than Cost Price</p>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Variant Tags</p>
                              <div className="flex gap-2 mb-2">
                                <input 
                                  type="text" 
                                  value={variant.tagInput || ""}
                                  onChange={(e) => updateVariantTagInput(index, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && addVariantTag(index, e)}
                                  placeholder="Add specific tag for this variant..."
                                  className="h-8 px-2.5 rounded-lg text-[12px] flex-1 outline-none"
                                  style={is_}
                                />
                                <button type="button" onClick={(e) => addVariantTag(index, e)} 
                                  className="h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center justify-center gap-1"
                                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" }}>
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              {variant.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {variant.tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium" 
                                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                      {tag}
                                      <button type="button" onClick={() => removeVariantTag(index, tag)} className="ml-0.5 rounded-full p-0.5 transition hover:bg-black/10">
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Attributes</p>
                              <div className="space-y-2">
                                {variant.attributes.map((attr, ai) => {
                                  const preset = ATTRIBUTE_PRESETS.find(p => p.name === attr.name);
                                  const isCustom = !!attr.isCustom;
                                  return (
                                    <div key={ai} className="flex flex-wrap items-center gap-2">
                                      <select value={attr.name}
                                        onChange={(e) => { const v=[...formData.variants]; const a=[...v[index].attributes]; a[ai]={...a[ai],name:e.target.value,value:"",isCustom:false}; v[index]={...v[index],attributes:a}; setFormData({...formData,variants:v}); }}
                                        className="h-8 px-2.5 rounded-lg text-[12px] min-w-[140px] flex-1 outline-none" style={is_}>
                                        {ATTRIBUTE_PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                      </select>
                                      {preset ? (
                                        <>
                                          <select value={isCustom ? "__custom__" : attr.value}
                                            onChange={(e) => { const val=e.target.value; const v=[...formData.variants]; const a=[...v[index].attributes]; a[ai]={...a[ai],isCustom:val==="__custom__",value:val==="__custom__"?(preset.name==="Color"?"#000000":""):val}; v[index]={...v[index],attributes:a}; setFormData({...formData,variants:v}); }}
                                            className="h-8 px-2.5 rounded-lg text-[12px] min-w-[140px] flex-1 outline-none" style={is_}>
                                            {preset.values.map(v => <option key={v} value={v}>{v}</option>)}
                                            <option value="__custom__">+ Custom</option>
                                          </select>
                                          {isCustom && preset.name === "Color" ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              <input type="color" value={attr.value||"#000000"} onChange={(e) => updateAttribute(index,ai,"value",e.target.value)}
                                                className="w-8 h-8 cursor-pointer rounded border" style={{ borderColor: "var(--border-color)" }} />
                                              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.value||"#000000"}</span>
                                            </div>
                                          ) : isCustom ? (
                                            <input type="text" placeholder="Custom value..." value={attr.value} onChange={(e) => updateAttribute(index,ai,"value",e.target.value)}
                                              className="h-8 px-2.5 rounded-lg text-[12px] flex-1 outline-none" style={is_} />
                                          ) : null}
                                        </>
                                      ) : (
                                        <input type="text" placeholder="Value e.g. Black" value={attr.value} onChange={(e) => updateAttribute(index,ai,"value",e.target.value)}
                                          className="h-8 px-2.5 rounded-lg text-[12px] flex-1 outline-none" style={is_} />
                                      )}
                                      <button type="button" onClick={() => removeAttribute(index,ai)}
                                        className="p-1 rounded hover:opacity-70" style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                                        <Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => addAttribute(index)}
                                  className="flex items-center gap-1 text-[11px] font-medium"
                                  style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                                  <Plus className="w-3 h-3" /> Add Attribute</button>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Product Images</p>
                              <label className="block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center" style={{ borderColor: "var(--border-color)" }}>
                                <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(index,e)} />
                                <Upload className="mx-auto mb-2 w-5 h-5" style={{ color: "var(--text-muted)" }} />
                                <p className="text-[11px] font-medium">Click to select images</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Auto-optimized</p>
                              </label>
                              {variant.images.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {variant.images.map((img, ii) => (
                                    <div key={ii} className="relative group">
                                      <img src={img.preview} alt="" className="h-16 w-16 rounded-lg object-cover border" style={{ borderColor: "var(--border-color)" }} />
                                      <button type="button" onClick={() => removeImage(index,ii)}
                                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                                        <X className="w-3 h-3" /></button>
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
                  <div className="flex justify-between border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                    <button type="button" onClick={() => setCurrentStep(1)}
                      className="h-8 px-3 rounded-lg text-[12px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" }}>← Back</button>
                    <button type="submit" disabled={updateMutation.isPending}
                      className="h-8 px-4 rounded-lg text-[12px] font-medium inline-flex items-center gap-1 disabled:opacity-40"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}>
                      {updateMutation.isPending ? "Saving..." : "Update Product"} <Check className="w-3 h-3" /></button>
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
          <div className="w-full max-w-md rounded-xl p-5" style={{ ...cs, border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium">Create New Tag</h3>
              <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} 
                className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input 
                  type="text" 
                  value={newTagModalValue}
                  onChange={(e) => setNewTagModalValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTagFromModal()}
                  placeholder="Enter tag name..."
                  autoFocus
                  className="h-9 px-3 rounded-lg text-[12px] w-full outline-none"
                  style={is_}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleCreateTagFromModal} disabled={createTagMutation.isPending || !newTagModalValue.trim()}
                  className="h-8 px-4 rounded-lg text-[12px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}>
                  <Plus className="w-3.5 h-3.5" /> {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variant Tags Modal */}
      {showVariantTagsModal && editingVariantForTags && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl p-5" style={{ ...cs, border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[13px] font-medium">Manage Variant Tags</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {editingVariantForTags.title || editingVariantForTags.sku}
                </p>
              </div>
              <button onClick={() => { setShowVariantTagsModal(false); setEditingVariantForTags(null); setVariantTagInput(""); }} 
                className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={variantTagInput}
                  onChange={(e) => setVariantTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVariantTag();
                    }
                  }}
                  placeholder="Type tag & press Enter..."
                  autoFocus
                  className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                  style={is_}
                />
                <button 
                  onClick={handleAddVariantTag}
                  disabled={!variantTagInput.trim()}
                  className="h-9 px-3 rounded-lg text-[12px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              
              <div>
                <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>Current Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {(editingVariantForTags.tags || []).length > 0 ? (
                    (editingVariantForTags.tags || []).map((tag, idx) => (
                      <span key={`${tag}-${idx}`} 
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
                        style={{ backgroundColor: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                        <TagIcon className="w-2.5 h-2.5" />
                        {tag}
                        <button 
                          onClick={() => handleRemoveVariantTag(tag)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-black/20"
                        >
                          <X className="w-2.5 h-2.5" />
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
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cs, animation: "modalScaleIn 0.2s ease-out" }}>
            <style>{`@keyframes modalScaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }`}</style>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Delete "{product.name}"?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 h-9 rounded-md text-sm font-medium transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button disabled={deleteMutation.isPending} onClick={confirmDelete}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: "var(--danger)" }}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}