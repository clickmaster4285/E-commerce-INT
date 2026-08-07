"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  ArrowLeft,
  Package,
  Tag,
  Layers3,
  CircleDollarSign,
  Box,
  TrendingUp,
  User,
  Clock,
  Activity,
  Pencil,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  Upload,
  X,
  Sparkles,
  Building2,
  Percent,
  AlertTriangle,
  DollarSign,
  CalendarDays,
  Database,
  FolderOpen,
  Store,
  FileText,
  Shield,
  Hash,
  MapPin,
  Phone,
  Mail,
  Globe,
  Info,
} from "lucide-react";

import { toast } from "sonner";

import { productApi } from "@/apis/productApi";
import { categoryApi } from "@/apis/categoryApi";
import { brandApi } from "@/apis/brandApi";
import { variantApi } from "@/apis/variantApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "http://localhost:5000";

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

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;
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

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const id = params?.id;

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [formData, setFormData] = useState({
    category_id: "",
    brand_id: "",
    name: "",
    description: "",
    tax: "0",
    status: "active",
    variants: [createEmptyVariant()],
  });

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Product updated successfully");
      closeProductModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Product update failed");
    },
  });

  const handleEdit = () => {
    if (!product) return;
    const variants = product.variants?.length
      ? product.variants.map((variant) => ({
          _id: variant._id,
          sku: variant.sku || "",
          title: variant.title || "",
          description: variant.description || "",
          cost_price: String(variant.cost_price ?? ""),
          selling_price: String(variant.selling_price ?? ""),
          quantity: String(variant.quantity ?? 0),
          min_qnt: String(variant.min_qnt ?? 0),
          max_qnt: String(variant.max_qnt ?? 0),
          attributes: Object.entries(variant.attributes || {}).map(([name, value]) => ({
            name,
            value: String(value),
            isCustom: false,
          })),
          images: (variant.images || []).map((image) => ({
            existing: true,
            metadata: image,
            preview: getImageUrl(image.img_url),
          })),
        }))
      : [createEmptyVariant()];

    setFormData({
      category_id: product.category_id?._id || product.category_id || "",
      brand_id: product.brand_id?._id || product.brand_id || "",
      name: product.name || "",
      description: product.description || "",
      tax: String(product.tax ?? 0),
      status: product.status || "active",
      variants,
    });

    setEditingProduct(product);
    setCurrentStep(1);
    setExpandedVariant(0);
    setShowModal(true);
  };

  const closeProductModal = () => {
    formData.variants.forEach((variant) => {
      variant.images.forEach((image) => {
        if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
      });
    });
    setShowModal(false);
    setEditingProduct(null);
    setCurrentStep(1);
    setExpandedVariant(0);
  };

  const addVariant = async () => {
    try {
      const result = await variantApi.getNextSku();
      const newIndex = formData.variants.length;
      setFormData((prev) => ({
        ...prev,
        variants: [...prev.variants, createEmptyVariant(result.sku)],
      }));
      setExpandedVariant(newIndex);
    } catch {
      toast.error("Unable to generate SKU");
    }
  };

  const duplicateVariant = async (index) => {
    try {
      const result = await variantApi.getNextSku();
      const oldVariant = formData.variants[index];
      const copiedVariant = {
        ...oldVariant,
        _id: null,
        sku: result.sku,
        attributes: oldVariant.attributes.map((item) => ({ ...item })),
        images: [],
      };
      setFormData((prev) => {
        const variants = [...prev.variants];
        variants.splice(index + 1, 0, copiedVariant);
        return { ...prev, variants };
      });
      setExpandedVariant(index + 1);
    } catch {
      toast.error("Unable to generate SKU");
    }
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) {
      toast.error("At least one variant is required");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[index] = { ...variants[index], [field]: value };
      return { ...prev, variants };
    });
  };

  const addAttribute = (variantIndex) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[variantIndex] = {
        ...variants[variantIndex],
        attributes: [...variants[variantIndex].attributes, { name: "", value: "", isCustom: false }],
      };
      return { ...prev, variants };
    });
  };

  const updateAttribute = (variantIndex, attrIndex, field, value) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      const attributes = [...variants[variantIndex].attributes];
      attributes[attrIndex] = { ...attributes[attrIndex], [field]: value };
      variants[variantIndex] = { ...variants[variantIndex], attributes };
      return { ...prev, variants };
    });
  };

  const removeAttribute = (variantIndex, attrIndex) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[variantIndex] = {
        ...variants[variantIndex],
        attributes: variants[variantIndex].attributes.filter((_, i) => i !== attrIndex),
      };
      return { ...prev, variants };
    });
  };

  const compressProductImage = (file) => {
    return new Promise((resolve) => {
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);
      image.onload = () => {
        const MAX_SIDE = 1400;
        let width = image.width;
        let height = image.height;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(imageUrl);
            if (!blob) { resolve(file); return; }
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            resolve(new File([blob], newName, { type: "image/webp", lastModified: Date.now() }));
          },
          "image/webp",
          0.82
        );
      };
      image.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(file); };
      image.src = imageUrl;
    });
  };

  const handleImageUpload = async (variantIndex, event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const validFiles = selectedFiles.filter((file) => validTypes.includes(file.type));
    if (validFiles.length !== selectedFiles.length) toast.error("Only JPG, PNG and WebP images are allowed");
    try {
      const compressedFiles = await Promise.all(validFiles.map((file) => compressProductImage(file)));
      const images = compressedFiles.map((file) => ({ file, existing: false, preview: URL.createObjectURL(file) }));
      setFormData((prev) => {
        const variants = [...prev.variants];
        variants[variantIndex] = { ...variants[variantIndex], images: [...variants[variantIndex].images, ...images] };
        return { ...prev, variants };
      });
      toast.success("Image optimized successfully");
    } catch {
      toast.error("Image processing failed");
    }
    event.target.value = "";
  };

  const removeImage = (variantIndex, imageIndex) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      const image = variants[variantIndex].images[imageIndex];
      if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
      variants[variantIndex] = { ...variants[variantIndex], images: variants[variantIndex].images.filter((_, i) => i !== imageIndex) };
      return { ...prev, variants };
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
    for (const variant of formData.variants) {
      const sku = variant.sku.trim();
      if (!sku) { toast.error("SKU is required"); return; }
      if (skuSet.has(sku)) { toast.error(`Duplicate SKU: ${sku}`); return; }
      skuSet.add(sku);
      if (!variant.title.trim()) { toast.error("Variant title is required"); return; }
      if (variant.cost_price === "" || variant.selling_price === "") { toast.error("Cost price and selling price are required"); return; }
    }

    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description);
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);

    const imageVariantIndexes = [];
    const variants = formData.variants.map((variant, index) => {
      const attributes = {};
      variant.attributes.forEach((attribute) => {
        const name = attribute.name.trim();
        if (name) attributes[name] = attribute.value;
      });
      const existingImages = variant.images.filter((image) => image.existing).map((image) => image.metadata);
      variant.images.filter((image) => !image.existing && image.file).forEach((image) => {
        data.append("images", image.file);
        imageVariantIndexes.push(index);
      });
      return {
        _id: variant._id || undefined,
        sku: variant.sku.trim(),
        title: variant.title.trim(),
        description: variant.description,
        cost_price: Number(variant.cost_price || 0),
        selling_price: Number(variant.selling_price || 0),
        quantity: Number(variant.quantity || 0),
        min_qnt: Number(variant.min_qnt || 0),
        max_qnt: Number(variant.max_qnt || 0),
        attributes,
        existing_images: existingImages,
      };
    });

    data.append("variants", JSON.stringify(variants));
    data.append("image_variant_indexes", JSON.stringify(imageVariantIndexes));

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, data });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <p style={{ color: "var(--danger)" }}>Product not found</p>
        <button type="button" onClick={() => router.push("/admin/products")} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Back to Products</button>
      </div>
    );
  }

  const variants = product.variants || [];
  const totalStock = variants.reduce((total, v) => total + Number(v.quantity || 0), 0);
  const totalVariants = variants.length;
  const totalValue = variants.reduce((total, v) => total + (Number(v.selling_price || 0) * Number(v.quantity || 0)), 0);
  const firstVariant = variants[0];
  const lowestPrice = variants.length > 0 ? Math.min(...variants.map(v => Number(v.selling_price || 0))) : 0;
  const highestPrice = variants.length > 0 ? Math.max(...variants.map(v => Number(v.selling_price || 0))) : 0;
  const priceRange = lowestPrice === highestPrice ? `Rs. ${lowestPrice.toLocaleString()}` : `Rs. ${lowestPrice.toLocaleString()} - Rs. ${highestPrice.toLocaleString()}`;

  const getInitials = (name) => {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "PR";
  };

  return (
    <div className="min-h-screen space-y-6 " style={{ color: "var(--text-primary)" }}>
      {/* BACK BUTTON */}
      <button type="button" onClick={() => router.push("/admin/products")} className="text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </button>

      {/* HEADER CARD */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              {getInitials(product.name)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{product.name}</h1>
                <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgba(16,185,129,.15)", color: "var(--success)" }}>
                  {product.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{product.description?.slice(0, 80) || "No description"}...</p>
            </div>
          </div>

          <button type="button" onClick={handleEdit} className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:scale-105" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <Pencil className="h-4 w-4" /> Edit Product
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs font-medium uppercase mb-1" style={{ color: "var(--text-muted)" }}>Category</p>
            <p className="text-2xl font-bold">{product.category_id?.name || "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase mb-1" style={{ color: "var(--text-muted)" }}>Brand</p>
            <p className="text-2xl font-bold">{product.brand_id?.name || "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase mb-1" style={{ color: "var(--text-muted)" }}>Variants</p>
            <p className="text-2xl font-bold">{totalVariants}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase mb-1" style={{ color: "var(--text-muted)" }}>Unit</p>
            <p className="text-2xl font-bold">{totalStock}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <p className="text-xs font-medium uppercase mb-2" style={{ color: "var(--text-muted)" }}>Total Stock</p>
            <p className={`text-2xl font-bold ${totalStock === 0 ? "text-red-500" : "text-emerald-500"}`}>{totalStock}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <p className="text-xs font-medium uppercase mb-2" style={{ color: "var(--text-muted)" }}>Reserved</p>
            <p className="text-2xl font-bold" style={{ color: "var(--info)" }}>0</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <p className="text-xs font-medium uppercase mb-2" style={{ color: "var(--text-muted)" }}>Available</p>
            <p className={`text-2xl font-bold ${totalStock === 0 ? "text-red-500" : "text-emerald-500"}`}>{totalStock}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <p className="text-xs font-medium uppercase mb-2" style={{ color: "var(--text-muted)" }}>Price Range</p>
            <p className="text-2xl font-bold">{priceRange}</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex gap-1 rounded-xl p-1 overflow-x-auto" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <button type="button" onClick={() => setActiveTab("overview")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${activeTab === "overview" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Package className="h-4 w-4" /> Overview
        </button>
        <button type="button" onClick={() => setActiveTab("variants")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${activeTab === "variants" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Layers3 className="h-4 w-4" /> Variants
        </button>
        <button type="button" onClick={() => setActiveTab("category")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${activeTab === "category" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <FolderOpen className="h-4 w-4" /> Category
        </button>
        <button type="button" onClick={() => setActiveTab("brand")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${activeTab === "brand" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Store className="h-4 w-4" /> Brand
        </button>
        <button type="button" onClick={() => setActiveTab("activity")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${activeTab === "activity" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Activity className="h-4 w-4" /> Activity
        </button>
      </div>

      {/* CONTENT CARD */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" style={{ color: "var(--accent)" }} />
                Product Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Product Name</span>
                  <span className="text-sm font-semibold text-right">{product.name}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Category</span>
                  <span className="text-sm font-semibold text-right">{product.category_id?.name || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Brand</span>
                  <span className="text-sm font-semibold text-right">{product.brand_id?.name || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Status</span>
                  <span className="text-sm font-semibold uppercase text-right">{product.status}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Tax Rate</span>
                  <span className="text-sm font-semibold text-right">{product.tax || 0}%</span>
                </div>
                <div className="py-3">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Description</span>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{product.description || "No description available."}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5" style={{ color: "var(--accent)" }} />
                System Metadata
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Product Name</span>
                  <span className="text-sm font-semibold">{product.name}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Category</span>
                  <span className="text-sm font-semibold">{product.category_id?.name || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Brand</span>
                  <span className="text-sm font-semibold">{product.brand_id?.name || "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Unit</span>
                    <span className="text-sm font-semibold">{totalStock}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Status</span>
                    <span className="text-sm font-semibold">{product.status}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Active</span>
                    <span className="text-sm font-semibold">{product.status === "active" ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Tax Rate</span>
                    <span className="text-sm font-semibold">{product.tax || 0}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Variants</span>
                    <span className="text-sm font-semibold">{totalVariants}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Total Stock</span>
                    <span className="text-sm font-semibold">{totalStock}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Created</span>
                  <span className="text-sm font-semibold">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Updated</span>
                  <span className="text-sm font-semibold">{product.updated_at ? new Date(product.updated_at).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VARIANTS TAB */}
        {activeTab === "variants" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Product Variants</h2>
              <p className="mt-1" style={{ color: "var(--text-muted)" }}>Manage pricing, stock, attributes and images for each variant</p>
            </div>
            {variants.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium">No variants available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {variants.map((variant, index) => (
                  <VariantCard key={variant._id} variant={variant} number={index + 1} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ CATEGORY TAB - BEAUTIFUL CARD DESIGN */}
        {activeTab === "category" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Category Details</h2>
              <p className="mt-1" style={{ color: "var(--text-muted)" }}>Information about the assigned product category</p>
            </div>
            {product.category_id ? (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                {/* Card Header */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5 border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    <FolderOpen className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold">{product.category_id.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                        Code: {product.category_id.category_code || "N/A"}
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                        ID: {product.category_id._id}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Card Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Description</h4>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {product.category_id.description || "No description available for this category."}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Category Metadata</h4>
                    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Status</span>
                        <span className="text-sm font-semibold text-emerald-500">Active</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Assigned Product</span>
                        <span className="text-sm font-semibold">{product.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                <FolderOpen className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium">No category assigned</p>
              </div>
            )}
          </div>
        )}

        {/* ✅ BRAND TAB - BEAUTIFUL CARD DESIGN */}
        {activeTab === "brand" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Brand Details</h2>
              <p className="mt-1" style={{ color: "var(--text-muted)" }}>Information about the assigned product brand</p>
            </div>
            {product.brand_id ? (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                {/* Card Header */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5 border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    <Store className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold">{product.brand_id.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                        Code: {product.brand_id.brand_code || "N/A"}
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                        ID: {product.brand_id._id}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Card Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Description</h4>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {product.brand_id.description || "No description available for this brand."}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Brand Metadata</h4>
                    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Status</span>
                        <span className="text-sm font-semibold text-emerald-500">Active</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Assigned Product</span>
                        <span className="text-sm font-semibold">{product.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                <Store className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium">No brand assigned</p>
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Activity Log</h2>
              <p style={{ color: "var(--text-muted)" }}>Track all changes and updates made to this product</p>
            </div>
            
            <div className="relative space-y-6">
              <div className="absolute left-8 top-0 bottom-0 w-0.5" style={{ backgroundColor: "var(--border-color)" }} />

              <div className="relative flex gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl z-10" style={{ backgroundColor: "rgba(16,185,129,.15)", border: "2px solid var(--success)" }}>
                  <User className="h-7 w-7" style={{ color: "var(--success)" }} />
                </div>
                <div className="flex-1 rounded-xl p-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Product Created</h3>
                      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Initial product creation</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgba(16,185,129,.15)", color: "var(--success)" }}>
                      Initial
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                        <User className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Created by:</span>
                        <span className="ml-2 font-medium">{product.createdby?.email || product.createdby || "Unknown User"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                        <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Created on:</span>
                        <span className="ml-2 font-medium">{product.created_at ? new Date(product.created_at).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {product.updatedby ? (
                <div className="relative flex gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl z-10" style={{ backgroundColor: "rgba(59,130,246,.15)", border: "2px solid var(--info)" }}>
                    <Activity className="h-7 w-7" style={{ color: "var(--info)" }} />
                  </div>
                  <div className="flex-1 rounded-xl p-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">Product Updated</h3>
                        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Last modification details</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgba(59,130,246,.15)", color: "var(--info)" }}>
                        Modified
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                          <User className="h-4 w-4" style={{ color: "var(--accent)" }} />
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Updated by:</span>
                          <span className="ml-2 font-medium">{product.updatedby?.email || product.updatedby || "Unknown User"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                          <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Updated on:</span>
                          <span className="ml-2 font-medium">{product.updated_at ? new Date(product.updated_at).toLocaleString() : "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl z-10" style={{ backgroundColor: "var(--bg-secondary)", border: "2px dashed var(--border-color)" }}>
                    <Clock className="h-7 w-7" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="flex-1 rounded-xl p-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", opacity: 0.7 }}>
                    <h3 className="text-lg font-semibold">Product Updated</h3>
                    <p className="mt-2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Never</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Product has not been updated since creation.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-5" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-xl font-bold">{editingProduct ? "Edit Product" : "New Product"}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Add product and variant information</p>
              </div>
              <button type="button" title="Close" onClick={closeProductModal} className="rounded-lg p-2"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">{currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}</div>
                <span className="text-sm font-medium">Product Info</span>
              </div>
              <div className="h-px w-12" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${currentStep === 2 ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}>2</div>
                <span className="text-sm font-medium">Variants</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Category *">
                      <select required value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="input-field">
                        <option value="">Select product category</option>
                        {categories.map((category) => (<option key={category._id} value={category._id}>{category.name}</option>))}
                      </select>
                    </Field>
                    <Field label="Brand *">
                      <select required value={formData.brand_id} onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })} className="input-field">
                        <option value="">Select product brand</option>
                        {brands.map((brand) => (<option key={brand._id} value={brand._id}>{brand.name}</option>))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Product Name *">
                    <input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" />
                  </Field>
                  <Field label="Description">
                    <textarea rows={4} placeholder="Enter product description..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field resize-none" />
                  </Field>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Tax (%)">
                      <input type="number" min="0" placeholder="e.g. 18" value={formData.tax} onChange={(e) => setFormData({ ...formData, tax: e.target.value })} className="input-field" />
                    </Field>
                    <Field label="Status">
                      <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-field">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={handleNextStep} className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      Next: Variants <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} /> Variants ({formData.variants.length})</h4>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
                    </div>
                    <button type="button" onClick={addVariant} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      <Plus className="h-4 w-4" /> Add Variant
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.variants.map((variant, index) => (
                      <div key={variant._id || index} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border-color)" }}>
                        <div className="flex cursor-pointer items-center justify-between px-5 py-4" style={{ backgroundColor: "var(--bg-tertiary)" }} onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                          <div>
                            <p className="font-semibold">{variant.sku || `Variant ${index + 1}`}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index + 1}`}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <IconButton title="Duplicate variant" onClick={(e) => { e.stopPropagation(); duplicateVariant(index); }}><Copy className="h-4 w-4" /></IconButton>
                            <IconButton title="Delete variant" color="var(--danger)" background="rgba(239,68,68,.10)" onClick={(e) => { e.stopPropagation(); removeVariant(index); }}><Trash2 className="h-4 w-4" /></IconButton>
                            <ChevronDown className={`h-5 w-5 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {expandedVariant === index && (
                          <div className="space-y-6 p-5">
                            <div>
                              <SectionTitle>Identification</SectionTitle>
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="SKU *"><input required type="text" placeholder="e.g. sku_4" value={variant.sku} onChange={(e) => updateVariant(index, "sku", e.target.value)} className="input-field" /></Field>
                                <Field label="Variant Title *"><input required type="text" placeholder="e.g. Black - Large" value={variant.title} onChange={(e) => updateVariant(index, "title", e.target.value)} className="input-field" /></Field>
                              </div>
                              <div className="mt-4">
                                <Field label="Variant Description"><textarea rows={3} placeholder="Enter variant description..." value={variant.description} onChange={(e) => updateVariant(index, "description", e.target.value)} className="input-field resize-none" /></Field>
                              </div>
                            </div>

                            <div>
                              <SectionTitle>Pricing & Stock</SectionTitle>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                <NumberField label="Cost Price *" placeholder="e.g. 1000" value={variant.cost_price} onChange={(value) => updateVariant(index, "cost_price", value)} />
                                <NumberField label="Selling Price *" placeholder="e.g. 1500" value={variant.selling_price} onChange={(value) => updateVariant(index, "selling_price", value)} />
                                <NumberField label="Quantity" placeholder="e.g. 50" value={variant.quantity} onChange={(value) => updateVariant(index, "quantity", value)} />
                                <NumberField label="Min Qty" placeholder="e.g. 5" value={variant.min_qnt} onChange={(value) => updateVariant(index, "min_qnt", value)} />
                                <NumberField label="Max Qty" placeholder="e.g. 100" value={variant.max_qnt} onChange={(value) => updateVariant(index, "max_qnt", value)} />
                              </div>
                            </div>

                            <div>
                              <SectionTitle>Attributes</SectionTitle>
                              <div className="space-y-3">
                                {variant.attributes.map((attribute, attrIndex) => {
                                  const preset = ATTRIBUTE_PRESETS.find((p) => p.name === attribute.name);
                                  const isCustom = !!attribute.isCustom;
                                  return (
                                    <div key={attrIndex} className="flex flex-wrap items-center gap-3">
                                      <select value={attribute.name} onChange={(e) => {
                                        const variants = [...formData.variants];
                                        const attributes = [...variants[index].attributes];
                                        attributes[attrIndex] = { ...attributes[attrIndex], name: e.target.value, value: "", isCustom: false };
                                        variants[index] = { ...variants[index], attributes };
                                        setFormData({ ...formData, variants });
                                      }} className="input-field min-w-[160px] flex-1">
                                        {ATTRIBUTE_PRESETS.map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}
                                      </select>

                                      {preset ? (
                                        <>
                                          <select value={isCustom ? "__custom__" : attribute.value} onChange={(e) => {
                                            const val = e.target.value;
                                            const variants = [...formData.variants];
                                            const attributes = [...variants[index].attributes];
                                            attributes[attrIndex] = { ...attributes[attrIndex], isCustom: val === "__custom__", value: val === "__custom__" ? (preset.name === "Color" ? "#000000" : "") : val };
                                            variants[index] = { ...variants[index], attributes };
                                            setFormData({ ...formData, variants });
                                          }} className="input-field min-w-[160px] flex-1">
                                            {preset.values.map((v) => (<option key={v} value={v}>{v}</option>))}
                                            <option value="__custom__">+ Custom</option>
                                          </select>
                                          {isCustom && (preset.name === "Color" ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              <input type="color" value={attribute.value || "#000000"} onChange={(e) => updateAttribute(index, attrIndex, "value", e.target.value)} className="w-12 h-10 cursor-pointer rounded border" style={{ borderColor: "var(--border-color)" }} title="Pick custom RGB color" />
                                              <div className="flex items-center gap-2 flex-1">
                                                <div className="w-6 h-6 rounded border" style={{ backgroundColor: attribute.value || "#000000", borderColor: "var(--border-color)" }} />
                                                <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>{attribute.value || "#000000"}</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <input type="text" placeholder="Custom value..." value={attribute.value} onChange={(e) => updateAttribute(index, attrIndex, "value", e.target.value)} className="input-field flex-1" />
                                          ))}
                                        </>
                                      ) : (
                                        <input type="text" placeholder="Value e.g. Black" value={attribute.value} onChange={(e) => updateAttribute(index, attrIndex, "value", e.target.value)} className="input-field flex-1" />
                                      )}
                                      <IconButton title="Remove attribute" color="var(--danger)" background="rgba(239,68,68,.10)" onClick={() => removeAttribute(index, attrIndex)}><Trash2 className="h-4 w-4" /></IconButton>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => addAttribute(index)} className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent)" }}><Plus className="h-4 w-4" /> Add Attribute</button>
                              </div>
                            </div>

                            <div>
                              <SectionTitle>Product Images</SectionTitle>
                              <label className="block cursor-pointer rounded-xl border-2 border-dashed p-7 text-center" style={{ borderColor: "var(--border-color)" }}>
                                <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(index, e)} />
                                <Upload className="mx-auto mb-3 h-7 w-7" />
                                <p className="text-sm font-medium">Click to select product images</p>
                                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Images automatically optimized</p>
                              </label>
                              {variant.images.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-3">
                                  {variant.images.map((image, imageIndex) => (
                                    <div key={imageIndex} className="relative">
                                      <img src={image.preview} alt="" className="h-24 w-24 rounded-lg object-cover" />
                                      <button type="button" onClick={() => removeImage(index, imageIndex)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"><X className="h-4 w-4" /></button>
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

                  <div className="flex justify-between border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
                    <button type="button" onClick={() => setCurrentStep(1)} className="rounded-lg px-5 py-2.5 text-sm font-medium" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>← Back</button>
                    <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      {updateMutation.isPending ? "Saving..." : "Update Product"} <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Variant Card Component
function VariantCard({ variant, number }) {
  const attributes = Object.entries(variant.attributes || {});
  const isLowStock = Number(variant.quantity) <= Number(variant.min_qnt);
  
  return (
    <div className="rounded-2xl overflow-hidden transition-all hover:shadow-lg flex flex-col" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
      <div className="p-5 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight">{variant.title || `Variant ${number}`}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>#{number}</span>
                <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>{variant.sku}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold" style={{ color: "var(--success)" }}>Rs. {Number(variant.selling_price || 0).toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{variant.quantity || 0} units</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5">
        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Selling</span>
          </div>
          <p className="text-base font-bold" style={{ color: "var(--success)" }}>Rs. {Number(variant.selling_price || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5" style={{ color: "var(--info)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Buying</span>
          </div>
          <p className="text-base font-bold">Rs. {Number(variant.cost_price || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Box className="h-3.5 w-3.5" style={{ color: isLowStock ? "var(--danger)" : "var(--text-muted)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Min</span>
          </div>
          <p className={`text-base font-bold ${isLowStock ? "text-red-500" : ""}`}>{variant.min_qnt || 0}</p>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Box className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Max</span>
          </div>
          <p className="text-base font-bold">{variant.max_qnt || 0}</p>
        </div>
      </div>

      {attributes.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Attributes</p>
          <div className="flex flex-wrap gap-2">
            {attributes.map(([name, value]) => (
              <div key={name} className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <span style={{ color: "var(--text-muted)" }}>{name}: </span><span>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {variant.images?.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Images</p>
          <div className="flex flex-wrap gap-2">
            {variant.images.slice(0, 3).map((image, index) => (
              <img key={index} src={getImageUrl(image.img_url)} alt="" className="h-14 w-14 rounded-lg object-cover" style={{ border: "1px solid var(--border-color)" }} />
            ))}
            {variant.images.length > 3 && (
              <div className="h-14 w-14 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>+{variant.images.length - 3}</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
        <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /><span>{variant.created_at ? new Date(variant.created_at).toLocaleDateString() : "—"}</span></div>
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><span>{variant.updated_at ? new Date(variant.updated_at).toLocaleDateString() : "—"}</span></div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

function NumberField({ label, value, placeholder, onChange }) {
  return (
    <Field label={label}>
      <input type="number" min="0" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="input-field" />
    </Field>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{children}</p>
  );
}

function IconButton({ children, onClick, title, color = "var(--text-muted)", background = "var(--bg-card)" }) {
  return (
    <button type="button" title={title} onClick={onClick} className="rounded-lg p-2 transition hover:scale-110" style={{ color, backgroundColor: background }}>
      {children}
    </button>
  );
}