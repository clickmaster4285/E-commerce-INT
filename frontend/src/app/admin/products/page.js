"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/productApi";
import { categoryApi } from "@/apis/categoryApi";
import { brandApi } from "@/apis/brandApi";
import { variantApi } from "@/apis/variantApi";

const ITEMS_PER_PAGE = 20;
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "";

const ATTRIBUTE_PRESETS = [
  { name: "Color", values: ["Black", "White", "Gray", "Red", "Blue", "Green", "Yellow", "Brown", "Pink", "Orange", "Purple", "Gold", "Silver"] },
  { name: "Size", values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"] },
  { name: "Material", values: ["Cotton", "Polyester", "Leather", "Denim", "Wool", "Silk", "Linen", "Nylon"] },
  { name: "Fit", values: ["Regular Fit", "Slim Fit", "Loose Fit", "Relaxed Fit", "Oversized", "Skinny", "Straight", "Tapered"] },
  { name: "Pattern", values: ["Solid", "Striped", "Checked", "Plaid", "Printed", "Floral", "Camouflage"] },
  { name: "Sleeve", values: ["Full Sleeve", "Half Sleeve", "Sleeveless", "3/4 Sleeve", "Long Sleeve", "Short Sleeve", "Cap Sleeve"] },
  { name: "Collar", values: ["Round Neck", "V-Neck", "Collared", "Mandarin Collar", "Polo Collar", "Turtleneck", "Hooded", "Boat Neck"] },
  { name: "Occasion", values: ["Casual", "Formal", "Party", "Wedding", "Sports", "Gym", "Office", "Outdoor", "Daily Wear", "Festive"] },
  { name: "Gender", values: ["Men", "Women", "Unisex", "Boys", "Girls", "Kids", "Teen"] },
  { name: "Season", values: ["Summer", "Winter", "Spring", "Autumn", "All Season", "Monsoon"] },
  { name: "Care", values: ["Machine Wash", "Hand Wash", "Dry Clean Only", "Do Not Bleach", "Iron Safe", "Wash Separately"] },
  { name: "Style", values: ["Casual", "Formal", "Sporty", "Classic", "Modern", "Vintage", "Bohemian", "Streetwear", "Ethnic", "Western"] },
];

/* =========================================================
   HELPERS
========================================================= */
function createEmptyVariant(sku = "") {
  return {
    _id: null, sku, title: "", description: "", cost_price: "", selling_price: "",
    quantity: "0", min_qnt: "0", max_qnt: "0", attributes: [], images: [],
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
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
}

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useProductSocketSync();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

  // Category Modal State
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ category_code: "", name: "", description: "" });
  const [loadingCategoryCode, setLoadingCategoryCode] = useState(false);

  // Brand Modal State
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [brandFormData, setBrandFormData] = useState({ brand_code: "", name: "", description: "", country: "", is_active: true });
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const [brandLogoPreview, setBrandLogoPreview] = useState("");
  const [loadingBrandCode, setLoadingBrandCode] = useState(false);

  // Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  // ⭐ CHANGED: tag_ids -> tag_names (array of strings)
  const [formData, setFormData] = useState({
    category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [], variants: [createEmptyVariant()],
  });
  
  const [tagInput, setTagInput] = useState("");

  const allCountries = useMemo(() => Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode })), []);

  /* Queries */
  const { data: products = [], isLoading, isError: productsError, error: productsErrorMsg } = useQuery({ queryKey: ["products"], queryFn: productApi.getAll, retry: false });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll, retry: false });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll, retry: false });

  useEffect(() => {
    if (!productsError || !productsErrorMsg) return;
    const msg = String(productsErrorMsg?.message || "").toLowerCase();
    if (msg.includes("permission") || msg.includes("access denied") || msg.includes("forbidden")) {
      toast.error("You don't have permission to view products.", { duration: 6000, description: "Contact an administrator to grant you access." });
    }
  }, [productsError, productsErrorMsg]);

  /* Mutations */
  const createMutation = useMutation({ mutationFn: productApi.create, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product created successfully"); closeProductModal(); }, onError: (e) => handlePermissionError(e, "Product creation failed", "product") });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => productApi.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product updated successfully"); closeProductModal(); }, onError: (e) => handlePermissionError(e, "Product update failed", "product") });
  const deleteMutation = useMutation({ mutationFn: productApi.delete, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); setProductToDelete(null); }, onError: (e) => handlePermissionError(e, "Product delete failed", "product") });
  const toggleStatusMutation = useMutation({ mutationFn: productApi.toggleStatus, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product status updated"); }, onError: (e) => handlePermissionError(e, "Status update failed", "product") });
  const createCategoryMutation = useMutation({ mutationFn: (data) => categoryApi.create(data), onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ["categories"] }); const nc = res?.data || res; if (nc?._id) { setFormData((p) => ({ ...p, category_id: String(nc._id) })); toast.success("Category created and selected!"); } else { toast.success("Category created successfully"); } setShowNewCategoryModal(false); resetCategoryForm(); }, onError: (e) => handlePermissionError(e, "Failed to create category", "category") });
  const createBrandMutation = useMutation({ mutationFn: (data) => brandApi.create(data), onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ["brands"] }); const nb = res?.data || res; if (nb?._id) { setFormData((p) => ({ ...p, brand_id: String(nb._id) })); toast.success("Brand created and selected!"); } else { toast.success("Brand created successfully"); } setShowNewBrandModal(false); resetBrandForm(); }, onError: (e) => handlePermissionError(e, "Failed to create brand", "brand") });

  /* Handlers */
  const openProductDetails = (p) => router.push(`/admin/products/${p._id}`);
  const handleToggleStatus = (p) => { if (p?._id) toggleStatusMutation.mutate(p._id); };

  const closeProductModal = () => {
    formData.variants.forEach((v) => v.images.forEach((i) => { if (i.preview?.startsWith("blob:")) URL.revokeObjectURL(i.preview); }));
    setShowModal(false); setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0);
    setIsCategoryDropdownOpen(false); setIsBrandDropdownOpen(false);
  };

  const openNewProduct = async () => {
    try {
      const result = await variantApi.getNextSku();
      const nextSku = result?.sku || result?.data?.sku || "";
      setFormData({ category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [], variants: [createEmptyVariant(nextSku)] });
      setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0);
      setIsCategoryDropdownOpen(false); setIsBrandDropdownOpen(false);
      setShowModal(true);
    } catch { toast.error("Unable to generate next SKU"); }
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
      const copy = { ...old, _id: null, sku, attributes: old.attributes.map((a) => ({ ...a })), images: [] };
      setFormData((prev) => {
        const v = [...prev.variants]; v.splice(index + 1, 0, copy);
        return { ...prev, variants: v };
      });
      setExpandedVariant(index + 1);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) { toast.error("At least one variant is required"); return; }
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
    setExpandedVariant((curr) => curr === index ? Math.max(0, Math.min(index, formData.variants.length - 2)) : curr > index ? curr - 1 : curr);
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[index] = { ...v[index], [field]: value }; return { ...prev, variants: v }; });
  };

  /* Attributes */
  const addAttribute = (vi) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      v[vi] = { ...v[vi], attributes: [...v[vi].attributes, { name: ATTRIBUTE_PRESETS[0]?.name || "", value: "", isCustom: false }] };
      return { ...prev, variants: v };
    });
  };

  const updateAttribute = (vi, ai, field, value) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      const attrs = [...v[vi].attributes];
      attrs[ai] = { ...attrs[ai], [field]: value };
      v[vi] = { ...v[vi], attributes: attrs };
      return { ...prev, variants: v };
    });
  };

  const removeAttribute = (vi, ai) => {
    setFormData((prev) => {
      const v = [...prev.variants];
      v[vi] = { ...v[vi], attributes: v[vi].attributes.filter((_, i) => i !== ai) };
      return { ...prev, variants: v };
    });
  };

  const changeAttributeName = (vi, ai, name) => {
    updateAttribute(vi, ai, "name", name);
    updateAttribute(vi, ai, "value", "");
    updateAttribute(vi, ai, "isCustom", false);
  };

  const changeAttributeValue = (vi, ai, value) => {
    const attr = formData.variants[vi]?.attributes[ai];
    if (attr) updateAttribute(vi, ai, "value", value);
  };

  /* Images */
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

  /* Edit Product */
  const handleEdit = (product) => {
    const variants = product?.variants?.length
      ? product.variants.map((v) => ({
          _id: v._id, sku: v.sku || "", title: v.title || "", description: v.description || "",
          cost_price: String(v.cost_price ?? ""), selling_price: String(v.selling_price ?? ""),
          quantity: String(v.quantity ?? 0), min_qnt: String(v.min_qnt ?? 0), max_qnt: String(v.max_qnt ?? 0),
          attributes: Object.entries(v.attributes || {}).map(([n, val]) => ({ name: n, value: String(val ?? ""), isCustom: false })),
          images: (v.images || []).map((img) => ({ existing: true, metadata: img, preview: getImageUrl(img?.img_url) })),
        }))
      : [createEmptyVariant()];

    // ⭐ Extract tag names from populated objects
    const currentTagNames = (product.tag_ids || [])
      .map(t => typeof t === 'object' ? t.name : t)
      .filter(Boolean);

    setFormData({
      category_id: normalizeId(product?.category_id), brand_id: normalizeId(product?.brand_id),
      name: product?.name || "", description: product?.description || "", tax: String(product?.tax ?? 0),
      status: product?.status || "active", 
      tag_names: currentTagNames, // ⭐ Use names
      variants,
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
    const skuSet = new Set();
    for (const v of formData.variants) {
      const sku = v.sku.trim();
      if (!sku) { toast.error("SKU is required"); return; }
      if (skuSet.has(sku.toLowerCase())) { toast.error(`Duplicate SKU: ${sku}`); return; }
      skuSet.add(sku.toLowerCase());
      if (!v.title.trim()) { toast.error("Variant title is required"); return; }
      if (v.cost_price === "" || v.selling_price === "") { toast.error("Cost price and selling price are required"); return; }
      const cp = Number(v.cost_price); const sp = Number(v.selling_price);
      if (!Number.isFinite(cp) || !Number.isFinite(sp)) { toast.error("Please enter valid prices"); return; }
      if (sp <= cp) { toast.error(`Selling Price must be greater than Cost Price for "${v.title || v.sku}"`); return; }
      const mn = Number(v.min_qnt || 0); const mx = Number(v.max_qnt || 0);
      if (mx > 0 && mn > mx) { toast.error(`Min Qty cannot be greater than Max Qty for "${v.title}"`); return; }
    }

    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description || "");
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);
    
    // ⭐ Send tag_names (array of strings)
    data.append("tag_names", JSON.stringify(formData.tag_names || []));

    const imageVariantIndexes = [];
    const variantsPayload = formData.variants.map((v, idx) => {
      const attrs = {};
      v.attributes.forEach((a) => { if (a.name.trim()) attrs[a.name] = a.value ?? ""; });
      const existingImgs = v.images.filter((i) => i.existing).map((i) => i.metadata);
      v.images.filter((i) => !i.existing && i.file).forEach((i) => {
        if (i.file) { data.append("images", i.file); imageVariantIndexes.push(idx); }
      });
      let finalSku = v.sku.trim();
      if (editingProduct) {
        const orig = editingProduct.variants?.find((ov) => ov._id && String(ov._id) === String(v._id));
        if (orig) finalSku = orig.sku;
      }
      return {
        _id: v._id || undefined, sku: finalSku, title: v.title.trim(), description: v.description || "",
        cost_price: Number(v.cost_price || 0), selling_price: Number(v.selling_price || 0),
        quantity: Number(v.quantity || 0), min_qnt: Number(v.min_qnt || 0), max_qnt: Number(v.max_qnt || 0),
        attributes: attrs, existing_images: existingImgs,
      };
    });

    data.append("variants", JSON.stringify(variantsPayload));
    data.append("image_variant_indexes", JSON.stringify(imageVariantIndexes));

    if (editingProduct?._id) updateMutation.mutate({ id: editingProduct._id, data });
    else createMutation.mutate(data);
  };

  /* ⭐ SIMPLIFIED TAG HANDLERS */
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

  /* Category Logic */
  const resetCategoryForm = () => { setCategoryFormData({ category_code: "", name: "", description: "" }); setLoadingCategoryCode(false); };
  const fetchNextCategoryCode = async () => {
    try {
      setLoadingCategoryCode(true);
      const res = await categoryApi.getNextCode();
      const code = res?.nextCode || res?.data?.nextCode;
      if (code && typeof code === "string") { setCategoryFormData((p) => ({ ...p, category_code: code })); return; }
      throw new Error("Invalid code format");
    } catch (e) {
      const coded = categories.filter((c) => c?.category_code && /^CAT-\d+$/i.test(c.category_code));
      let next = 1;
      if (coded.length) {
        const nums = coded.map((c) => parseInt(c.category_code.split("-")[1], 10)).filter(Number.isFinite);
        if (nums.length) next = Math.max(...nums) + 1;
      }
      setCategoryFormData((p) => ({ ...p, category_code: `CAT-${String(next).padStart(3, "0")}` }));
    } finally { setLoadingCategoryCode(false); }
  };
  const handleOpenCategoryModal = () => { resetCategoryForm(); setShowNewCategoryModal(true); fetchNextCategoryCode(); };
  const handleCategorySubmit = (e) => {
    e.preventDefault();
    if (!categoryFormData.category_code.trim()) { toast.error("Category code is required"); return; }
    if (!categoryFormData.name.trim()) { toast.error("Category name is required"); return; }
    createCategoryMutation.mutate({ ...categoryFormData, category_code: categoryFormData.category_code.trim(), name: categoryFormData.name.trim(), description: categoryFormData.description.trim() });
  };

  /* Brand Logic */
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

  /* Filters & Stats */
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

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input type="text" placeholder="Search by product name or SKU..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="h-10 w-full rounded-lg pl-9 pr-3 text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        <SelectFilter value={filterCategory} onChange={(v) => { setFilterCategory(v); setCurrentPage(1); }} options={categories.map((c) => ({ value: String(c._id), label: c.name }))} placeholder="All Categories" />
        <SelectFilter value={filterBrand} onChange={(v) => { setFilterBrand(v); setCurrentPage(1); }} options={brands.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="All Brands" />
        <SelectFilter value={filterStatus} onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} placeholder="All Status" />
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-lg" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                <tr>{["Product", "Category", "Brand", "Tags", "Price", "Stock", "Status", "Actions"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider ${h === "Actions" ? "text-right" : ""}`} style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}><Package className="mx-auto mb-3 h-8 w-8 opacity-30" /> No products found</td></tr>
                ) : paginatedProducts.map((p) => {
                  const fv = p?.variants?.[0];
                  const qty = Number(fv?.quantity || 0);
                  const min = Number(fv?.min_qnt || 0);
                  const low = qty <= min;
                  const img = fv?.images?.[0]?.img_url;
                  
                  // ⭐ Get tag names directly from populated object
                  const tnames = (p.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
                  
                  return (
                    <tr key={p._id} onClick={() => openProductDetails(p)} className="cursor-pointer transition" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--bg-card)"}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {img ? <img src={getImageUrl(img)} alt={p.name} className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{p.name?.charAt(0).toUpperCase() || "P"}</div>}
                          <div className="min-w-0">
                            <p className="max-w-[140px] truncate text-[13px] font-medium">{p.name}</p>
                            <p className="max-w-[140px] truncate font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{fv?.sku || "---"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{getCategoryName(p)}</td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{getBrandName(p)}</td>
                      <td className="px-4 py-2.5"><TagList names={tnames} /></td>
                      <td className="px-4 py-2.5 text-[13px] font-semibold text-emerald-500">Rs. {Number(fv?.selling_price || 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><span className={`text-[13px] font-medium ${low ? "text-red-500" : "text-emerald-500"}`}>{qty}</span>{low && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}</div></td>
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
            const tnames = (p.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
            return (
              <div key={p._id} onClick={() => openProductDetails(p)} className="flex cursor-pointer flex-col gap-3 rounded-lg p-4 transition hover:-translate-y-0.5" style={cardStyle}>
                <div className="flex items-start justify-between">
                  {img ? <img src={getImageUrl(img)} alt={p.name} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{p.name?.charAt(0).toUpperCase() || "P"}</div>}
                  <StatusBadge status={p.status} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{p.name}</p>
                  <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{v?.sku || "---"}</p>
                  {tnames.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{tnames.slice(0, 2).map((n, i) => <span key={`${n}-${i}`} className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>{n}</span>)}{tnames.length > 2 && <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>+{tnames.length - 2}</span>}</div>}
                </div>
                <div className="mt-auto flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[13px] font-bold text-emerald-500">Rs. {Number(v?.selling_price || 0).toLocaleString()}</span>
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
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl shadow-2xl" style={cardStyle}>
            <div className="sticky top-0 z-20 flex items-center justify-between rounded-t-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-semibold">{editingProduct ? "Edit Product" : "New Product"}</h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Add product and variant information</p>
              </div>
              <button type="button" onClick={closeProductModal} className="rounded p-1 transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">{currentStep > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}</div>
                <span className="text-xs font-medium">Product Info</span>
              </div>
              <div className="h-px w-8" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${currentStep === 2 ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}>2</div>
                <span className="text-xs font-medium">Variants</span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              {currentStep === 1 && (
                <div className="space-y-4">
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
                            <button type="button" onClick={() => { setIsCategoryDropdownOpen(false); handleOpenCategoryModal(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-semibold hover:bg-black/5" style={{ borderColor: "var(--border-color)", color: "var(--accent)" }}><Plus className="h-4 w-4" /> Create New Category</button>
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
                            <button type="button" onClick={() => { setIsBrandDropdownOpen(false); handleOpenBrandModal(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-semibold hover:bg-black/5" style={{ borderColor: "var(--border-color)", color: "var(--accent)" }}><Plus className="h-4 w-4" /> Create New Brand</button>
                          </Dropdown>
                        )}
                      </div>
                    </Field>
                  </div>
                  
                  {/* ⭐ SIMPLIFIED TAG INPUT */}
                  <Field label="Tags">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        placeholder="Type tag name & press Enter"
                        className="h-9 flex-1 rounded-md px-3 text-sm outline-none"
                        style={inputStyle}
                      />
                      <button type="button" onClick={addTag} className="flex h-9 w-9 items-center justify-center rounded-md transition hover:opacity-90" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Selected Tags Display */}
                    {formData.tag_names.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {formData.tag_names.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 rounded-full p-0.5 transition hover:bg-black/10"><X className="h-2.5 w-2.5" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>

                  <Field label="Product Name *"><input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} /></Field>
                  <Field label="Description"><textarea rows={3} placeholder="Enter product description..." value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full resize-none rounded-md px-3 py-2 text-sm" style={inputStyle} /></Field>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Tax (%)">
                      <input type="number" min="0" max="100" step="0.01" placeholder="%" value={formData.tax} onChange={e => { const v = e.target.value; if (v === "") { setFormData(p => ({ ...p, tax: "" })); return; } let n = Number(v); if (!Number.isFinite(n)) n = 0; n = Math.min(100, Math.max(0, n)); setFormData(p => ({ ...p, tax: String(n) })); }} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} />
                    </Field>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={handleNextStep} className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Next: Variants <ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} /> Variants ({formData.variants.length})</h4>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
                    </div>
                    <button type="button" onClick={addVariant} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Plus className="h-3.5 w-3.5" /> Add Variant</button>
                  </div>
                  <div className="space-y-3">
                    {formData.variants.map((variant, index) => (
                      <div key={variant._id || `new-${index}`} className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
                        <div className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-black/[0.02]" style={{ backgroundColor: "var(--bg-tertiary)" }} onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                          <div>
                            <p className="text-sm font-semibold">{variant.sku || `Variant ${index + 1}`}</p>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index + 1}`}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <IconButton title="Duplicate" onClick={e => { e.stopPropagation(); duplicateVariant(index); }}><Copy className="h-3.5 w-3.5" /></IconButton>
                            <IconButton title="Delete" color="var(--danger)" background="rgba(239,68,68,.10)" onClick={e => { e.stopPropagation(); removeVariant(index); }}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                        {expandedVariant === index && (
                          <div className="space-y-4 p-4">
                            <div>
                              <SectionTitle>Identification</SectionTitle>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="SKU *"><input required type="text" placeholder="e.g. sku_4" value={variant.sku} readOnly={!!editingProduct && !!variant._id} onChange={e => updateVariant(index, "sku", e.target.value)} className={`h-9 w-full rounded-md px-3 text-sm ${editingProduct && variant._id ? "cursor-not-allowed opacity-60" : ""}`} style={inputStyle} /></Field>
                                <Field label="Variant Title *"><input required type="text" placeholder="e.g. Black - Large" value={variant.title} onChange={e => updateVariant(index, "title", e.target.value)} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} /></Field>
                              </div>
                              <div className="mt-3"><Field label="Variant Description"><textarea rows={2} placeholder="Enter variant description..." value={variant.description} onChange={e => updateVariant(index, "description", e.target.value)} className="w-full resize-none rounded-md px-3 py-2 text-sm" style={inputStyle} /></Field></div>
                            </div>
                            <div>
                              <SectionTitle>Pricing & Stock</SectionTitle>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                <NumberField label="Cost Price *" placeholder="1000" value={variant.cost_price} onChange={v => updateVariant(index, "cost_price", v)} />
                                <NumberField label="Selling Price *" placeholder="1500" value={variant.selling_price} onChange={v => updateVariant(index, "selling_price", v)} />
                                <NumberField label="Quantity" placeholder="50" value={variant.quantity} onChange={v => updateVariant(index, "quantity", v)} />
                                <NumberField label="Min Qty" placeholder="5" value={variant.min_qnt} onChange={v => updateVariant(index, "min_qnt", v)} />
                                <NumberField label="Max Qty" placeholder="100" value={variant.max_qnt} onChange={v => updateVariant(index, "max_qnt", v)} />
                              </div>
                              {variant.cost_price !== "" && variant.selling_price !== "" && Number(variant.selling_price) <= Number(variant.cost_price) && (
                                <div className="mt-2 flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                  <p className="text-xs font-medium text-red-500">Selling Price must be greater than Cost Price</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <SectionTitle>Attributes</SectionTitle>
                              <div className="space-y-2">
                                {variant.attributes.map((attribute, attrIndex) => {
                                  const preset = ATTRIBUTE_PRESETS.find(item => item.name === attribute.name);
                                  const isCustom = !!attribute.isCustom;
                                  return (
                                    <div key={attrIndex} className="flex flex-wrap items-center gap-2">
                                      <div className="relative min-w-[140px] flex-1">
                                        <select value={attribute.name} onChange={e => changeAttributeName(index, attrIndex, e.target.value)} className="h-9 w-full appearance-none rounded-md pl-3 pr-8 text-sm" style={inputStyle}>
                                          {ATTRIBUTE_PRESETS.map(pi => <option key={pi.name} value={pi.name}>{pi.name}</option>)}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                                      </div>
                                      {preset ? (
                                        <>
                                          <div className="relative min-w-[140px] flex-1">
                                            <select value={isCustom ? "__custom__" : attribute.value} onChange={e => { const val = e.target.value; if (val === "__custom__") { updateAttribute(index, attrIndex, "isCustom", true); updateAttribute(index, attrIndex, "value", preset.name === "Color" ? "#000000" : ""); } else { updateAttribute(index, attrIndex, "isCustom", false); updateAttribute(index, attrIndex, "value", val); } }} className="h-9 w-full appearance-none rounded-md pl-3 pr-8 text-sm" style={inputStyle}>
                                              <option value="">Select value</option>
                                              {preset.values.map(val => <option key={val} value={val}>{val}</option>)}
                                              <option value="__custom__">+ Custom</option>
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                                          </div>
                                          {isCustom && (preset.name === "Color" ? (
                                            <div className="flex flex-1 items-center gap-2">
                                              <input type="color" value={attribute.value || "#000000"} onChange={e => changeAttributeValue(index, attrIndex, e.target.value)} className="h-9 w-10 cursor-pointer rounded border p-1" style={{ borderColor: "var(--border-color)" }} />
                                              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{attribute.value || "#000000"}</span>
                                            </div>
                                          ) : (
                                            <input type="text" placeholder="Custom value..." value={attribute.value} onChange={e => changeAttributeValue(index, attrIndex, e.target.value)} className="h-9 flex-1 rounded-md px-3 text-sm" style={inputStyle} />
                                          ))}
                                        </>
                                      ) : (
                                        <input type="text" placeholder="Value e.g. Black" value={attribute.value} onChange={e => changeAttributeValue(index, attrIndex, e.target.value)} className="h-9 flex-1 rounded-md px-3 text-sm" style={inputStyle} />
                                      )}
                                      <IconButton title="Remove" color="var(--danger)" background="rgba(239,68,68,.10)" onClick={() => removeAttribute(index, attrIndex)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => addAttribute(index)} className="flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80" style={{ color: "var(--accent)" }}><Plus className="h-3.5 w-3.5" /> Add Attribute</button>
                              </div>
                            </div>
                            <div>
                              <SectionTitle>Product Images</SectionTitle>
                              <label className="block cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition hover:bg-black/[0.02]" style={{ borderColor: "var(--border-color)" }}>
                                <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleImageUpload(index, e)} />
                                <Upload className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--text-muted)" }} />
                                <p className="text-xs font-medium">Click to select images</p>
                                <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Auto optimized</p>
                              </label>
                              {variant.images.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {variant.images.map((image, imageIndex) => (
                                    <div key={imageIndex} className="group relative">
                                      <img src={image.preview} alt="" className="h-16 w-16 rounded border object-cover" style={{ borderColor: "var(--border-color)" }} />
                                      <button type="button" onClick={() => removeImage(index, imageIndex)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow transition group-hover:opacity-100 hover:bg-red-600"><X className="h-3 w-3" /></button>
                                      {image.existing && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[8px] text-white">Saved</span>}
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
                </div>
              )}

              <div className="flex justify-between border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}><ChevronLeft className="h-4 w-4" /> Back</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{isSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}<Check className="h-4 w-4" /></button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* CATEGORY MODAL */}
      {showNewCategoryModal && (
        <ModalOverlay zIndex="z-[60]">
          <div className="w-full max-w-lg overflow-visible rounded-xl shadow-2xl" style={cardStyle}>
            <div className="flex items-center justify-between rounded-t-xl px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">Create New Category</h3>
              <button type="button" onClick={() => { setShowNewCategoryModal(false); resetCategoryForm(); }} disabled={createCategoryMutation.isPending || loadingCategoryCode} className="rounded p-1 transition hover:opacity-70 disabled:opacity-50" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCategorySubmit} className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category Code *">
                  <div className="relative">
                    <input type="text" value={categoryFormData.category_code} onChange={e => setCategoryFormData(p => ({ ...p, category_code: e.target.value }))} required disabled={createCategoryMutation.isPending || loadingCategoryCode} className="h-9 w-full rounded-md px-3 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={loadingCategoryCode ? "Generating..." : "CAT-001"} />
                    {loadingCategoryCode && <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></span>}
                  </div>
                  {!loadingCategoryCode && categoryFormData.category_code && <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Auto-generated • You can change it</p>}
                </Field>
                <Field label="Category Name *"><input type="text" value={categoryFormData.name} onChange={e => setCategoryFormData(p => ({ ...p, name: e.target.value }))} required disabled={createCategoryMutation.isPending} className="h-9 w-full rounded-md px-3 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Electronics" /></Field>
              </div>
              <Field label="Description"><textarea value={categoryFormData.description} onChange={e => setCategoryFormData(p => ({ ...p, description: e.target.value }))} rows={3} disabled={createCategoryMutation.isPending} className="w-full resize-none rounded-md px-3 py-2 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Category details..." /></Field>
              <div className="flex gap-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={() => { setShowNewCategoryModal(false); resetCategoryForm(); }} disabled={createCategoryMutation.isPending} className="h-9 flex-1 rounded-md text-sm font-medium transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={createCategoryMutation.isPending || loadingCategoryCode} className="h-9 flex-1 rounded-md text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{createCategoryMutation.isPending ? "Creating..." : "Create & Select"}</button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

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
    </div>
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
  const isActive = product?.status === "active";
  return (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <button type="button" onClick={e => { e.stopPropagation(); onToggle(product); }} disabled={isToggling} className="flex min-h-[34px] min-w-[34px] flex-shrink-0 items-center justify-center rounded-md p-2 transition hover:bg-white/5 disabled:opacity-50" style={{ color: isActive ? "#f87171" : "#34d399" }} title={isActive ? "Deactivate" : "Activate"}><Power className="h-4 w-4" /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onView(product); }} className="flex min-h-[34px] min-w-[34px] flex-shrink-0 items-center justify-center rounded-md p-2 transition hover:bg-emerald-500/10" style={{ color: "#34d399" }} title="View Details"><Eye className="h-4 w-4" /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onEdit(product); }} className="flex min-h-[34px] min-w-[34px] flex-shrink-0 items-center justify-center rounded-md p-2 transition hover:bg-white/5" style={{ color: "var(--text-secondary)" }} title="Edit"><Pencil className="h-4 w-4" /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onDelete(product); }} disabled={isDeleting} className="flex min-h-[34px] min-w-[34px] flex-shrink-0 items-center justify-center rounded-md p-2 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
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