"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Plus, Trash2, Upload, X, AlertTriangle,
  Check, Copy, ChevronDown, ArrowLeft, Package,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/productApi";
import { variantApi } from "@/apis/variantApi";

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
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

const createEmptyVariant = (sku = "") => ({
  _id: null,
  sku,
  title: "",
  description: "",
  cost_price: "",
  selling_price: "",
  quantity: "0",
  min_qnt: "0",
  max_qnt: "0",
  attributes: [{ name: "Color", value: "Black", isCustom: false }],
  images: [],
});

const is_ = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "8px",
};

export default function AddVariantPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = params?.id;
  const editVariantId = searchParams.get("edit");
  const isEditMode = !!editVariantId;

  const [formData, setFormData] = useState(null);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(isEditMode ? "Variant updated successfully!" : "Variant added successfully!");
      router.push(`/admin/products/${id}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Operation failed"),
  });

  /* -------- Init Form -------- */
  useEffect(() => {
    if (!product || initialized) return;

    const existingVariants = (product.variants || []).map((v) => ({
      _id: v._id,
      sku: v.sku || "",
      title: v.title || "",
      description: v.description || "",
      cost_price: String(v.cost_price ?? ""),
      selling_price: String(v.selling_price ?? ""),
      quantity: String(v.quantity ?? 0),
      min_qnt: String(v.min_qnt ?? 0),
      max_qnt: String(v.max_qnt ?? 0),
      attributes: Object.entries(v.attributes || {}).map(([name, value]) => ({
        name, value: String(value), isCustom: false,
      })),
      images: (v.images || []).map((img) => ({
        existing: true, metadata: img, preview: getImageUrl(img.img_url),
      })),
    }));

    let finalVariants;
    let expandIndex;

    if (isEditMode) {
      finalVariants = existingVariants;
      expandIndex = existingVariants.findIndex((v) => String(v._id) === String(editVariantId));
      if (expandIndex === -1) expandIndex = 0;
    } else {
      const newVariant = createEmptyVariant("");
      finalVariants = [...existingVariants, newVariant];
      expandIndex = existingVariants.length;
    }

    setFormData({
      category_id: product.category_id?._id || product.category_id || "",
      brand_id: product.brand_id?._id || product.brand_id || "",
      name: product.name || "",
      description: product.description || "",
      tax: String(product.tax ?? 0),
      status: product.status || "active",
      variants: finalVariants,
    });
    setExpandedVariant(expandIndex);
    setInitialized(true);

    if (!isEditMode) {
      variantApi.getNextSku().then((res) => {
        setFormData((prev) => {
          if (!prev) return prev;
          const variants = [...prev.variants];
          variants[variants.length - 1] = { ...variants[variants.length - 1], sku: res.sku };
          return { ...prev, variants };
        });
      }).catch(() => toast.error("SKU auto-generate failed, enter manually"));
    }
  }, [product, initialized, isEditMode, editVariantId]);

  /* -------- Variant Actions -------- */
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
      const copy = { ...old, _id: null, sku: result.sku, attributes: old.attributes.map((i) => ({ ...i })), images: [] };
      setFormData((prev) => { const v = [...prev.variants]; v.splice(index + 1, 0, copy); return { ...prev, variants: v }; });
      setExpandedVariant(index + 1);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) { toast.error("At least one variant is required"); return; }
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
    if (expandedVariant === index) setExpandedVariant(-1);
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[index] = { ...v[index], [field]: value }; return { ...prev, variants: v }; });
  };

  const addAttribute = (vi) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], attributes: [...v[vi].attributes, { name: "", value: "", isCustom: false }] }; return { ...prev, variants: v }; });
  };

  const updateAttribute = (vi, ai, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; const a = [...v[vi].attributes]; a[ai] = { ...a[ai], [field]: value }; v[vi] = { ...v[vi], attributes: a }; return { ...prev, variants: v }; });
  };

  const removeAttribute = (vi, ai) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], attributes: v[vi].attributes.filter((_, i) => i !== ai) }; return { ...prev, variants: v }; });
  };

  /* -------- Image Helpers -------- */
  const compressProductImage = (file) => new Promise((resolve) => {
    const image = new Image();
    const imageUrl = URL.createObjectURL(file);
    image.onload = () => {
      const MAX = 1400;
      let w = image.width, h = image.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(imageUrl);
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp", lastModified: Date.now() }));
      }, "image/webp", 0.82);
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(file); };
    image.src = imageUrl;
  });

  const handleImageUpload = async (vi, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (valid.length !== files.length) toast.error("Only JPG, PNG and WebP allowed");
    try {
      const compressed = await Promise.all(valid.map((f) => compressProductImage(f)));
      const imgs = compressed.map((f) => ({ file: f, existing: false, preview: URL.createObjectURL(f) }));
      setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], images: [...v[vi].images, ...imgs] }; return { ...prev, variants: v }; });
      toast.success("Image optimized");
    } catch { toast.error("Image processing failed"); }
    e.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      const img = v[vi].images[ii];
      if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      v[vi] = { ...v[vi], images: v[vi].images.filter((_, i) => i !== ii) };
      return { ...prev, variants: v };
    });
  };

  /* -------- Submit -------- */
  const handleSubmit = (e) => {
    e.preventDefault();
    const skuSet = new Set();
    for (const v of formData.variants) {
      const sku = v.sku.trim();
      if (!sku) { toast.error("SKU is required"); return; }
      if (skuSet.has(sku)) { toast.error(`Duplicate SKU: ${sku}`); return; }
      skuSet.add(sku);
      if (!v.title.trim()) { toast.error("Variant title is required"); return; }
      if (v.cost_price === "" || v.selling_price === "") { toast.error("Cost & Selling price required"); return; }
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

    const imgIndexes = [];
    const variants = formData.variants.map((v, idx) => {
      const attrs = {};
      v.attributes.forEach((a) => { if (a.name.trim()) attrs[a.name.trim()] = a.value; });
      const existingImgs = v.images.filter((i) => i.existing).map((i) => i.metadata);
      v.images.filter((i) => !i.existing && i.file).forEach((i) => { data.append("images", i.file); imgIndexes.push(idx); });
      let finalSku = v.sku.trim();
      if (product) {
        const orig = product.variants?.find((ov) => ov._id && String(ov._id) === String(v._id));
        if (orig) finalSku = orig.sku;
      }
      return {
        _id: v._id || undefined, sku: finalSku, title: v.title.trim(), description: v.description,
        cost_price: Number(v.cost_price || 0), selling_price: Number(v.selling_price || 0),
        quantity: Number(v.quantity || 0), min_qnt: Number(v.min_qnt || 0), max_qnt: Number(v.max_qnt || 0),
        attributes: attrs, existing_images: existingImgs,
      };
    });

    data.append("variants", JSON.stringify(variants));
    data.append("image_variant_indexes", JSON.stringify(imgIndexes));
    updateMutation.mutate({ id: product._id, data });
  };

  /* -------- Loading -------- */
  if (isLoading || !formData) {
    return (
      <div className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="rounded-xl py-12 px-16 flex flex-col items-center gap-3"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Loading...</span>
        </div>
      </div>
    );
  }

  const existingCount = product?.variants?.length || 0;
  const newCount = formData.variants.length - existingCount;

  return (
    <>
      {/* ✅ Dark overlay background */}
      <div className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={() => router.push(`/admin/products/${id}`)} />

      {/* ✅ Main Card */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
        <div className="w-full max-w-3xl"
          style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: "14px",
            border: "1px solid var(--border-color)",
          }}>

          {/* ===== HEADER ===== */}
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => router.push(`/admin/products/${id}`)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition hover:opacity-70"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", cursor: "pointer", color: "var(--text-muted)" }}>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <div>
                <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {isEditMode ? "Edit Variant" : "Add New Variant"}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {product?.name}
                  {!isEditMode && newCount > 0 && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                      +{newCount} new
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button type="button"
              onClick={() => router.push(`/admin/products/${id}`)}
              className="w-7 h-7 rounded-md flex items-center justify-center transition hover:opacity-70"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", cursor: "pointer", color: "var(--text-muted)" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ===== VARIANTS HEADER ===== */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div>
              <h4 className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                <Package className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                Variants ({formData.variants.length})
              </h4>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
            </div>
            <button type="button" onClick={addVariant}
              className="h-7 px-3 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition hover:opacity-80"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer" }}>
              <Plus className="w-3 h-3" /> Add Variant
            </button>
          </div>

          {/* ===== FORM BODY ===== */}
          <form onSubmit={handleSubmit}>
            <div className="px-5 py-4 space-y-3 max-h-[62vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>

              {formData.variants.map((variant, index) => {
                const isNew = !variant._id;
                const isEditing = isEditMode && String(variant._id) === String(editVariantId);

                return (
                  <div key={variant._id || index} className="overflow-hidden rounded-lg"
                    style={{
                      border: isNew
                        ? "1px solid var(--border-color)"
                        : isEditing
                        ? "1px solid var(--border-color)"
                        : "1px solid var(--border-color)",
                    }}>

                    {/* Variant Header */}
                    <div className="flex cursor-pointer items-center justify-between px-3.5 py-2.5"
                      style={{ backgroundColor: "var(--bg-tertiary)" }}
                      onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                      <div className="flex items-center gap-2">
                        {isNew && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                            New
                          </span>
                        )}
                        {isEditing && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                            Editing
                          </span>
                        )}
                        <div>
                          <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                            {variant.sku || `Variant ${index + 1}`}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {variant.title || `Variant #${index + 1}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" title="Duplicate"
                          onClick={(ev) => { ev.stopPropagation(); duplicateVariant(index); }}
                          className="w-6 h-6 rounded flex items-center justify-center transition hover:opacity-70"
                          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                          <Copy className="w-3 h-3" />
                        </button>
                        <button type="button" title="Delete"
                          onClick={(ev) => { ev.stopPropagation(); removeVariant(index); }}
                          className="w-6 h-6 rounded flex items-center justify-center transition hover:opacity-70"
                          style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedVariant === index ? "rotate-180" : ""}`}
                          style={{ color: "var(--text-muted)" }} />
                      </div>
                    </div>

                    {/* Expanded Form */}
                    {expandedVariant === index && (
                      <div className="space-y-4 p-3.5" style={{ borderTop: "1px solid var(--border-color)" }}>

                        {/* IDENTIFICATION */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                            Identification
                          </p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                                SKU <span style={{ color: "#f87171" }}>*</span>
                              </label>
                              <input required type="text" placeholder="e.g. sku_4"
                                value={variant.sku} readOnly={!!variant._id}
                                onChange={(ev) => updateVariant(index, "sku", ev.target.value)}
                                className={`h-8 px-2.5 rounded-lg text-[12px] w-full outline-none ${variant._id ? "opacity-50 cursor-not-allowed" : ""}`}
                                style={is_}
                                title={variant._id ? "SKU cannot be changed" : ""} />
                            </div>
                            <div>
                              <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                                Variant Title <span style={{ color: "#f87171" }}>*</span>
                              </label>
                              <input required type="text" placeholder="e.g. Black - Large"
                                value={variant.title}
                                onChange={(ev) => updateVariant(index, "title", ev.target.value)}
                                className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_} />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Variant Description</label>
                            <textarea rows={2} placeholder="Enter variant description..."
                              value={variant.description}
                              onChange={(ev) => updateVariant(index, "description", ev.target.value)}
                              className="px-2.5 py-2 rounded-lg text-[12px] w-full outline-none resize-none" style={is_} />
                          </div>
                        </div>

                        {/* PRICING & STOCK */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                            Pricing & Stock
                          </p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            {[
                              { l: "Cost Price", f: "cost_price", p: "e.g. 1000", req: true },
                              { l: "Selling Price", f: "selling_price", p: "e.g. 1500", req: true },
                              { l: "Quantity", f: "quantity", p: "e.g. 50", req: false },
                              { l: "Min Qty", f: "min_qnt", p: "e.g. 5", req: false },
                              { l: "Max Qty", f: "max_qnt", p: "e.g. 100", req: false },
                            ].map(({ l, f, p, req }) => (
                              <div key={f}>
                                <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                                  {l}{req && <span style={{ color: "#f87171" }}> *</span>}
                                </label>
                                <input type="number" min="0" placeholder={p} value={variant[f]}
                                  onChange={(ev) => updateVariant(index, f, ev.target.value)}
                                  className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none" style={is_} />
                              </div>
                            ))}
                          </div>
                          {variant.cost_price !== "" && variant.selling_price !== "" && Number(variant.selling_price) <= Number(variant.cost_price) && (
                            <div className="mt-2.5 flex items-center gap-2 rounded-lg px-3 py-2"
                              style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                              <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "#f87171" }} />
                              <p className="text-[11px] font-medium" style={{ color: "#f87171" }}>
                                Selling Price must be greater than Cost Price
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ATTRIBUTES */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                            Attributes
                          </p>
                          <div className="space-y-2">
                            {variant.attributes.map((attr, ai) => {
                              const preset = ATTRIBUTE_PRESETS.find((p) => p.name === attr.name);
                              const isCustom = !!attr.isCustom;
                              return (
                                <div key={ai} className="flex flex-wrap items-center gap-2">
                                  <select value={attr.name}
                                    onChange={(ev) => {
                                      setFormData((prev) => {
                                        const v = [...prev.variants]; const a = [...v[index].attributes];
                                        a[ai] = { ...a[ai], name: ev.target.value, value: "", isCustom: false };
                                        v[index] = { ...v[index], attributes: a }; return { ...prev, variants: v };
                                      });
                                    }}
                                    className="h-8 px-2.5 rounded-lg text-[12px] min-w-[130px] flex-1 outline-none" style={is_}>
                                    <option value="">Select attribute</option>
                                    {ATTRIBUTE_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                                  </select>
                                  {preset ? (
                                    <>
                                      <select value={isCustom ? "__custom__" : attr.value}
                                        onChange={(ev) => {
                                          const val = ev.target.value;
                                          setFormData((prev) => {
                                            const v = [...prev.variants]; const a = [...v[index].attributes];
                                            a[ai] = { ...a[ai], isCustom: val === "__custom__", value: val === "__custom__" ? (preset.name === "Color" ? "#000000" : "") : val };
                                            v[index] = { ...v[index], attributes: a }; return { ...prev, variants: v };
                                          });
                                        }}
                                        className="h-8 px-2.5 rounded-lg text-[12px] min-w-[130px] flex-1 outline-none" style={is_}>
                                        {preset.values.map((v) => <option key={v} value={v}>{v}</option>)}
                                        <option value="__custom__">+ Custom</option>
                                      </select>
                                      {isCustom && preset.name === "Color" ? (
                                        <div className="flex items-center gap-2 flex-1">
                                          <input type="color" value={attr.value || "#000000"}
                                            onChange={(ev) => updateAttribute(index, ai, "value", ev.target.value)}
                                            className="w-8 h-8 cursor-pointer rounded" style={{ border: "1px solid var(--border-color)" }} />
                                          <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.value || "#000000"}</span>
                                        </div>
                                      ) : isCustom ? (
                                        <input type="text" placeholder="Custom value..." value={attr.value}
                                          onChange={(ev) => updateAttribute(index, ai, "value", ev.target.value)}
                                          className="h-8 px-2.5 rounded-lg text-[12px] flex-1 outline-none" style={is_} />
                                      ) : null}
                                    </>
                                  ) : (
                                    <input type="text" placeholder="Value e.g. Black" value={attr.value}
                                      onChange={(ev) => updateAttribute(index, ai, "value", ev.target.value)}
                                      className="h-8 px-2.5 rounded-lg text-[12px] flex-1 outline-none" style={is_} />
                                  )}
                                  <button type="button" title="Remove"
                                    onClick={() => removeAttribute(index, ai)}
                                    className="w-6 h-6 rounded flex items-center justify-center transition hover:opacity-70"
                                    style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                            <button type="button" onClick={() => addAttribute(index)}
                              className="flex items-center gap-1 text-[11px] font-medium"
                              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                              <Plus className="w-3 h-3" /> Add Attribute
                            </button>
                          </div>
                        </div>

                        {/* PRODUCT IMAGES */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                            Product Images
                          </p>
                          <label className="block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition hover:opacity-80"
                            style={{ borderColor: "var(--border-color)" }}>
                            <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp"
                              onChange={(ev) => handleImageUpload(index, ev)} />
                            <Upload className="mx-auto mb-1.5 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                            <p className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Click to select images</p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Auto-optimized</p>
                          </label>
                          {variant.images.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {variant.images.map((img, ii) => (
                                <div key={ii} className="relative group">
                                  <img src={img.preview} alt=""
                                    className="h-16 w-16 rounded-lg object-cover" style={{ border: "1px solid var(--border-color)" }} />
                                  <button type="button" onClick={() => removeImage(index, ii)}
                                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition"
                                    style={{ backgroundColor: "#ef4444", color: "#fff" }}>
                                    <X className="w-2 h-2" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ===== FOOTER ===== */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid var(--border-color)" }}>
              <button type="button"
                onClick={() => router.push(`/admin/products/${id}`)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium inline-flex items-center gap-1 transition hover:opacity-70"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" }}>
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <button type="submit" disabled={updateMutation.isPending}
                className="h-8 px-4 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40 transition hover:opacity-80"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: updateMutation.isPending ? "not-allowed" : "pointer" }}>
                {updateMutation.isPending ? (
                  <>
                    <div className="w-3 h-3 animate-spin rounded-full border-2 border-t-transparent"
                      style={{ borderColor: "var(--accent-text)", borderTopColor: "transparent" }} />
                    Saving...
                  </>
                ) : (
                  <>
                    {isEditMode ? "Update Variant" : "Update Product"}
                    <Check className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}