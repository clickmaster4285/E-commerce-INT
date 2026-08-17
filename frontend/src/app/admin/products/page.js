"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  Globe,
  Power,
} from "lucide-react";

import { toast } from "sonner";

import { productApi } from "@/apis/productApi";
import { categoryApi } from "@/apis/categoryApi";
import { brandApi } from "@/apis/brandApi";
import { variantApi } from "@/apis/variantApi";

const ITEMS_PER_PAGE = 20;

const ATTRIBUTE_PRESETS = [
  {
    name: "Color",
    values: [
      "Black", "White", "Gray", "Red", "Blue", "Green", "Yellow", "Brown",
      "Pink", "Orange", "Purple", "Gold", "Silver",
    ],
  },
  {
    name: "Size",
    values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"],
  },
  {
    name: "Material",
    values: ["Cotton", "Polyester", "Leather", "Denim", "Wool", "Silk", "Linen", "Nylon"],
  },
  {
    name: "Fit",
    values: ["Regular Fit", "Slim Fit", "Loose Fit", "Relaxed Fit", "Oversized", "Skinny", "Straight", "Tapered"],
  },
  {
    name: "Pattern",
    values: ["Solid", "Striped", "Checked", "Plaid", "Printed", "Floral", "Camouflage"],
  },
  {
    name: "Sleeve",
    values: ["Full Sleeve", "Half Sleeve", "Sleeveless", "3/4 Sleeve", "Long Sleeve", "Short Sleeve", "Cap Sleeve"],
  },
  {
    name: "Collar",
    values: ["Round Neck", "V-Neck", "Collared", "Mandarin Collar", "Polo Collar", "Turtleneck", "Hooded", "Boat Neck"],
  },
  {
    name: "Occasion",
    values: ["Casual", "Formal", "Party", "Wedding", "Sports", "Gym", "Office", "Outdoor", "Daily Wear", "Festive"],
  },
  {
    name: "Gender",
    values: ["Men", "Women", "Unisex", "Boys", "Girls", "Kids", "Teen"],
  },
  {
    name: "Season",
    values: ["Summer", "Winter", "Spring", "Autumn", "All Season", "Monsoon"],
  },
  {
    name: "Care",
    values: ["Machine Wash", "Hand Wash", "Dry Clean Only", "Do Not Bleach", "Iron Safe", "Wash Separately"],
  },
  {
    name: "Style",
    values: ["Casual", "Formal", "Sporty", "Classic", "Modern", "Vintage", "Bohemian", "Streetwear", "Ethnic", "Western"],
  },
];

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

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
  attributes: [{ name: "Color", value: "black", isCustom: false }],
  images: [],
});

const getSkuNumber = (sku) => {
  const match = String(sku || "").match(/^sku_(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }
  return `${API_ORIGIN}${url}`;
};

const compressProductImage = (file) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    image.onload = () => {
      const MIN_WIDTH = 800;
      const MIN_HEIGHT = 800;

      if (image.width < MIN_WIDTH || image.height < MIN_HEIGHT) {
        URL.revokeObjectURL(imageUrl);
        reject(new Error(`Image quality is too low. Minimum resolution required is ${MIN_WIDTH}x${MIN_HEIGHT}px.`));
        return;
      }

      const MAX_SIDE = 2000;
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
          if (!blob) {
            reject(new Error("Image processing failed"));
            return;
          }
          const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          resolve(new File([blob], newName, { type: "image/webp", lastModified: Date.now() }));
        },
        "image/webp",
        0.95
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Failed to load image"));
    };

    image.src = imageUrl;
  });
};

const getFlagEmoji = (isoCode) => {
  if (!isoCode || isoCode.length !== 2) return "🌍";
  return isoCode.toUpperCase().split("").map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
};

// ✅ HELPER: Permission error check
const handlePermissionError = (error, fallbackMsg, accessType) => {
  const msg = error.response?.data?.message || error.message || fallbackMsg;
  if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("access denied")) {
    toast.error(msg, {
      duration: 6000,
      description: `Contact an administrator to grant you ${accessType} access.`,
    });
  } else {
    toast.error(msg);
  }
};

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

  // Modals
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    category_code: "",
    name: "",
    description: "",
  });
  const [loadingCategoryCode, setLoadingCategoryCode] = useState(false);

  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [brandFormData, setBrandFormData] = useState({
    brand_code: "",
    name: "",
    description: "",
    country: "",
    is_active: true,
  });
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const [brandLogoPreview, setBrandLogoPreview] = useState("");
  const [loadingBrandCode, setLoadingBrandCode] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  const [formData, setFormData] = useState({
    category_id: "",
    brand_id: "",
    name: "",
    description: "",
    tax: "0",
    status: "active",
    variants: [createEmptyVariant()],
  });

  const allCountries = useMemo(() => {
    return Country.getAllCountries().map((c) => ({
      name: c.name,
      isoCode: c.isoCode,
    }));
  }, []);

  // ==========================================
  // ✅ QUERIES — retry: false + permission error handling
  // ==========================================
  const { data: products = [], isLoading, isError: productsError, error: productsErrorMsg } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    retry: false,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    retry: false,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    retry: false,
  });

  // ✅ Permission error toast for products fetch
  useEffect(() => {
    if (productsError && productsErrorMsg) {
      const msg = productsErrorMsg.message || "";
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("access denied")) {
        toast.error("You don't have permission to view products.", {
          duration: 6000,
          description: "Contact an administrator to grant you access.",
        });
      }
    }
  }, [productsError, productsErrorMsg]);

  // ==========================================
  // ✅ MUTATIONS — All with permission error check
  // ==========================================
  const createMutation = useMutation({
    mutationFn: productApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
      closeProductModal();
    },
    onError: (error) => handlePermissionError(error, "Product creation failed", "product"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated successfully");
      closeProductModal();
    },
    onError: (error) => handlePermissionError(error, "Product update failed", "product"),
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted successfully");
      setShowDeleteModal(false);
      setProductToDelete(null);
    },
    onError: (error) => handlePermissionError(error, "Product delete failed", "product"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: productApi.toggleStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product status updated");
    },
    onError: (error) => handlePermissionError(error, "Status update failed", "product"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => categoryApi.create(data),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setFormData({ ...formData, category_id: newCategory._id });
      setShowNewCategoryModal(false);
      resetCategoryForm();
      toast.success("Category created and selected!");
    },
    onError: (error) => handlePermissionError(error, "Failed to create category", "category"),
  });

  const createBrandMutation = useMutation({
    mutationFn: (data) => brandApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      const newBrand = response.data || response;
      if (newBrand && newBrand._id) {
        setFormData((prev) => ({ ...prev, brand_id: newBrand._id }));
        toast.success("Brand created and selected!");
      } else {
        toast.error("Brand created but could not auto-select.");
      }
      setShowNewBrandModal(false);
      resetBrandForm();
    },
    onError: (error) => handlePermissionError(error, "Failed to create brand", "brand"),
  });

  // ==========================================
  // HANDLERS
  // ==========================================
  const openProductDetails = (product) => router.push(`/admin/products/${product._id}`);

  const handleToggleStatus = (product) => {
    toggleStatusMutation.mutate(product._id);
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

  const openNewProduct = async () => {
    try {
      const result = await variantApi.getNextSku();
      setFormData({
        category_id: "",
        brand_id: "",
        name: "",
        description: "",
        tax: "0",
        status: "active",
        variants: [createEmptyVariant(result.sku)],
      });
      setEditingProduct(null);
      setCurrentStep(1);
      setExpandedVariant(0);
      setShowModal(true);
    } catch {
      toast.error("Unable to generate next SKU");
    }
  };

  const getNextLocalSku = async () => {
    const result = await variantApi.getNextSku();
    const databaseSku = getSkuNumber(result.sku);
    const localSku = Math.max(0, ...formData.variants.map((variant) => getSkuNumber(variant.sku)));
    const nextNumber = Math.max(databaseSku, localSku + 1);
    return `sku_${nextNumber}`;
  };

  const addVariant = async () => {
    try {
      const sku = await getNextLocalSku();
      const newIndex = formData.variants.length;
      setFormData((prev) => ({ ...prev, variants: [...prev.variants, createEmptyVariant(sku)] }));
      setExpandedVariant(newIndex);
    } catch {
      toast.error("Unable to generate SKU");
    }
  };

  const duplicateVariant = async (index) => {
    try {
      const sku = await getNextLocalSku();
      const oldVariant = formData.variants[index];
      const copiedVariant = {
        ...oldVariant,
        _id: null,
        sku,
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
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
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

  const handleImageUpload = async (variantIndex, event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const validFiles = selectedFiles.filter((file) => validTypes.includes(file.type));
    if (validFiles.length !== selectedFiles.length) {
      toast.error("Only JPG, PNG and WebP images are allowed");
      event.target.value = "";
      return;
    }
    try {
      const compressedFiles = await Promise.all(validFiles.map((file) => compressProductImage(file)));
      const images = compressedFiles.map((file) => ({
        file,
        existing: false,
        preview: URL.createObjectURL(file),
      }));
      setFormData((prev) => {
        const variants = [...prev.variants];
        variants[variantIndex] = {
          ...variants[variantIndex],
          images: [...variants[variantIndex].images, ...images],
        };
        return { ...prev, variants };
      });
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error(error.message || "Image processing failed");
    }
    event.target.value = "";
  };

  const removeImage = (variantIndex, imageIndex) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      const image = variants[variantIndex].images[imageIndex];
      if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
      variants[variantIndex] = {
        ...variants[variantIndex],
        images: variants[variantIndex].images.filter((_, i) => i !== imageIndex),
      };
      return { ...prev, variants };
    });
  };

  const handleEdit = (product) => {
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
          attributes: Object.entries(variant.attributes || {}).map(([name, value]) => ({ name, value: String(value) })),
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

  const handleDelete = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;
    deleteMutation.mutate(productToDelete._id);
  };

  const handleNextStep = () => {
    if (!formData.category_id) return toast.error("Please select category");
    if (!formData.brand_id) return toast.error("Please select brand");
    if (!formData.name.trim()) return toast.error("Product name is required");
    setCurrentStep(2);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const skuSet = new Set();
    for (const variant of formData.variants) {
      const sku = variant.sku.trim();
      if (!sku) return toast.error("SKU is required");
      if (skuSet.has(sku)) return toast.error(`Duplicate SKU: ${sku}`);
      skuSet.add(sku);
      if (!variant.title.trim()) return toast.error("Variant title is required");
      if (variant.cost_price === "" || variant.selling_price === "") return toast.error("Cost price and selling price are required");
      const costPrice = Number(variant.cost_price);
      const sellingPrice = Number(variant.selling_price);
      if (sellingPrice <= costPrice) return toast.error(`Selling Price must be greater than Cost Price for variant "${variant.title || variant.sku}"`);
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
      let finalSku = variant.sku.trim();
      if (editingProduct) {
        const originalVariant = editingProduct.variants?.find((v) => v._id && String(v._id) === String(variant._id));
        if (originalVariant) finalSku = originalVariant.sku;
      }
      return {
        _id: variant._id || undefined,
        sku: finalSku,
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

    if (editingProduct) updateMutation.mutate({ id: editingProduct._id, data });
    else createMutation.mutate(data);
  };

  // ==========================================
  // CATEGORY MODAL LOGIC
  // ==========================================
  const resetCategoryForm = () => {
    setCategoryFormData({ category_code: "", name: "", description: "" });
    setLoadingCategoryCode(false);
  };

  const fetchNextCategoryCode = async () => {
    try {
      setLoadingCategoryCode(true);
      const response = await categoryApi.getNextCode();
      const nextCode = response?.nextCode || response?.data?.nextCode;
      if (nextCode && typeof nextCode === "string") {
        setCategoryFormData((prev) => ({ ...prev, category_code: nextCode }));
      } else {
        throw new Error("Invalid code format");
      }
    } catch (error) {
      if (error.message?.toLowerCase().includes("permission") || error.message?.toLowerCase().includes("access denied")) {
        console.log("⚠️ No categories permission — using local fallback code");
      } else {
        console.error("Failed to fetch next category code:", error);
      }
      const codedCategories = categories.filter((c) => c.category_code && /^CAT-\d+$/i.test(c.category_code));
      let nextNum = 1;
      if (codedCategories.length > 0) {
        const sorted = codedCategories.sort((a, b) => {
          const numA = parseInt(a.category_code.split("-")[1], 10);
          const numB = parseInt(b.category_code.split("-")[1], 10);
          return numB - numA;
        });
        const lastNum = parseInt(sorted[0].category_code.split("-")[1], 10);
        nextNum = lastNum + 1;
      }
      const fallbackCode = `CAT-${String(nextNum).padStart(3, "0")}`;
      setCategoryFormData((prev) => ({ ...prev, category_code: fallbackCode }));
    } finally {
      setLoadingCategoryCode(false);
    }
  };

  const handleOpenCategoryModal = () => {
    resetCategoryForm();
    setShowNewCategoryModal(true);
    fetchNextCategoryCode();
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    if (!categoryFormData.category_code.trim()) return toast.error("Category code is required");
    if (!categoryFormData.name.trim()) return toast.error("Category name is required");
    createCategoryMutation.mutate(categoryFormData);
  };

  // ==========================================
  // BRAND MODAL LOGIC
  // ==========================================
  const resetBrandForm = () => {
    setBrandFormData({ brand_code: "", name: "", description: "", country: "", is_active: true });
    setBrandLogoFile(null);
    setBrandLogoPreview("");
  };

  const fetchNextBrandCode = async () => {
    try {
      setLoadingBrandCode(true);
      const nextCode = await brandApi.getNextCode();
      setBrandFormData((prev) => ({ ...prev, brand_code: nextCode }));
    } catch (err) {
      if (err.message?.toLowerCase().includes("permission") || err.message?.toLowerCase().includes("access denied")) {
        console.log("⚠️ No brands permission — using local fallback code");
      } else {
        console.error("Failed to fetch next brand code:", err);
      }
      const lastBrand = brands.filter((b) => b.brand_code && /^BRD-\d+$/.test(b.brand_code)).sort((a, b) => {
        const numA = parseInt(a.brand_code.split("-")[1], 10);
        const numB = parseInt(b.brand_code.split("-")[1], 10);
        return numB - numA;
      })[0];
      let nextNum = 1;
      if (lastBrand) nextNum = parseInt(lastBrand.brand_code.split("-")[1], 10) + 1;
      const fallbackCode = `BRD-${String(nextNum).padStart(3, "0")}`;
      setBrandFormData((prev) => ({ ...prev, brand_code: fallbackCode }));
    } finally {
      setLoadingBrandCode(false);
    }
  };

  const handleOpenBrandModal = () => {
    resetBrandForm();
    setShowNewBrandModal(true);
    fetchNextBrandCode();
  };

  const handleBrandLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) return toast.error("Logo must be less than 10MB");
      setBrandLogoFile(file);
      setBrandLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleBrandSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("brand_code", brandFormData.brand_code);
    fd.append("name", brandFormData.name);
    fd.append("description", brandFormData.description || "");
    fd.append("country", brandFormData.country || "");
    fd.append("is_active", brandFormData.is_active.toString());
    if (brandLogoFile) fd.append("logo", brandLogoFile);
    createBrandMutation.mutate(fd);
  };

  // ==========================================
  // HELPERS & FILTERS
  // ==========================================
  const getCategoryName = (product) => product.category_id?.name || categories.find((c) => c._id === product.category_id)?.name || "Unknown";
  const getBrandName = (product) => product.brand_id?.name || brands.find((b) => b._id === product.brand_id)?.name || "Unknown";

  const filteredProducts = products.filter((product) => {
    const keyword = search.trim().toLowerCase();
    const skuMatch = (product.variants || []).some((variant) => variant.sku?.toLowerCase().includes(keyword));
    const matchSearch = !keyword || product.name?.toLowerCase().includes(keyword) || skuMatch;
    const categoryId = product.category_id?._id || product.category_id;
    const brandId = product.brand_id?._id || product.brand_id;
    const matchCategory = filterCategory === "all" || categoryId === filterCategory;
    const matchBrand = filterBrand === "all" || brandId === filterBrand;
    const matchStatus = filterStatus === "all" || product.status === filterStatus;
    return matchSearch && matchCategory && matchBrand && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const changeSearch = (value) => { setSearch(value); setCurrentPage(1); };
  const changeCategory = (value) => { setFilterCategory(value); setCurrentPage(1); };
  const changeBrand = (value) => { setFilterBrand(value); setCurrentPage(1); };
  const changeStatus = (value) => { setFilterStatus(value); setCurrentPage(1); };

  const activeProducts = products.filter((p) => p.status === "active").length;
  const totalVariants = products.reduce((total, p) => total + (p.variants || []).length, 0);
  const totalStock = products.reduce((total, p) => total + (p.variants || []).reduce((vTotal, v) => vTotal + Number(v.quantity || 0), 0), 0);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isToggling = toggleStatusMutation.isPending;

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen space-y-5" style={{ color: "var(--text-primary)" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-[24px] leading-7 font-bold tracking-tight">Product Management</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage products, variants, stock and pricing</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><Grid3x3 className="w-4 h-4" /></button>
          </div>
          <button onClick={openNewProduct} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Products</p><p className="text-[20px] font-bold mt-1">{products.length}</p></div>
        <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Active</p><p className="text-[20px] font-bold mt-1 text-emerald-500">{activeProducts}</p></div>
        <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Variants</p><p className="text-[20px] font-bold mt-1 text-blue-500">{totalVariants}</p></div>
        <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Units in Stock</p><p className="text-[20px] font-bold mt-1">{totalStock}</p></div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search className="w-4 h-4" /></span>
        <input type="text" placeholder="Search by product name or SKU..." value={search} onChange={(e) => changeSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select value={filterCategory} onChange={(e) => changeCategory(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></span>
        </div>
        <div className="relative">
          <select value={filterBrand} onChange={(e) => changeBrand(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
            <option value="all">All Brands</option>
            {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></span>
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={(e) => changeStatus(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></span>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "list" && (
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Product</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Category</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Brand</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Price</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Stock</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                  <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}><Package className="mx-auto mb-3 h-8 w-8 opacity-30" />No products found</td></tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const firstVariant = product.variants?.[0];
                    const quantity = Number(firstVariant?.quantity || 0);
                    const minimum = Number(firstVariant?.min_qnt || 0);
                    const lowStock = quantity <= minimum;
                    const image = firstVariant?.images?.[0]?.img_url;
                    return (
                      <tr key={product._id} onClick={() => openProductDetails(product)} className="transition cursor-pointer" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {image ? <img src={getImageUrl(image)} alt={product.name} className="h-8 w-8 rounded-full object-cover shrink-0" /> : <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{product.name?.charAt(0).toUpperCase()}</div>}
                            <div className="min-w-0">
                              <p className="font-medium text-[13px] truncate max-w-[140px]">{product.name}</p>
                              <p className="text-[11px] font-mono truncate" style={{ color: "var(--text-muted)" }}>{firstVariant?.sku || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{getCategoryName(product)}</td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{getBrandName(product)}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-500 text-[13px]">Rs. {Number(firstVariant?.selling_price || 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] font-medium ${lowStock ? "text-red-500" : "text-emerald-500"}`}>{quantity}</span>
                            {lowStock && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={product.status} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1" onClick={(e) => e.stopPropagation()}>
                          <ActionButtons 
                            product={product} 
                            onView={openProductDetails} 
                            onEdit={handleEdit} 
                            onDelete={handleDelete} 
                            onToggle={handleToggleStatus}
                            isDeleting={isDeleting} 
                            isToggling={isToggling}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedProducts.map((product) => {
            const variant = product.variants?.[0];
            const image = variant?.images?.[0]?.img_url;
            return (
              <div key={product._id} onClick={() => openProductDetails(product)} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                <div className="flex items-start justify-between">
                  {image ? <img src={getImageUrl(image)} alt={product.name} className="h-10 w-10 rounded-full object-cover shrink-0" /> : <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{product.name?.charAt(0).toUpperCase()}</div>}
                  <StatusBadge status={product.status} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] truncate">{product.name}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{variant?.sku || "—"}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="text-[13px] font-bold text-emerald-500">Rs. {Number(variant?.selling_price || 0).toLocaleString()}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionButtons 
                      product={product} 
                      onView={openProductDetails} 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                      onToggle={handleToggleStatus}
                      isDeleting={isDeleting}
                      isToggling={isToggling}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredProducts.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products</p>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Delete "{productToDelete.name}"?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }} className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button disabled={deleteMutation.isPending} onClick={confirmDelete} className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl shadow-2xl" style={cardStyle}>
            <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 rounded-t-xl" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-semibold">{editingProduct ? "Edit Product" : "New Product"}</h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Add product and variant information</p>
              </div>
              <button onClick={closeProductModal} className="p-1 rounded transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
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
                        <button type="button" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)} className="input-field w-full flex justify-between items-center text-left h-9 px-3 rounded-md text-sm" style={inputStyle}>
                          <span className="truncate">{formData.category_id ? categories.find((c) => c._id === formData.category_id)?.name : "Select product category"}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {isCategoryDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-48 overflow-y-auto" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                            {categories.map((cat) => (
                              <div key={cat._id} onClick={() => { setFormData({ ...formData, category_id: cat._id }); setIsCategoryDropdownOpen(false); }} className="px-3 py-2 text-sm cursor-pointer hover:bg-black/5" style={{ color: formData.category_id === cat._id ? "var(--accent)" : "var(--text-primary)" }}>{cat.name}</div>
                            ))}
                            <div onClick={() => { setIsCategoryDropdownOpen(false); handleOpenCategoryModal(); }} className="px-3 py-2 text-sm font-semibold cursor-pointer border-t flex items-center gap-2 hover:bg-black/5" style={{ borderColor: "var(--border-color)", color: "var(--accent)" }}><Plus className="h-4 w-4" /> Create New Category</div>
                          </div>
                        )}
                      </div>
                    </Field>
                    <Field label="Brand *">
                      <div className="relative">
                        <button type="button" onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)} className="input-field w-full flex justify-between items-center text-left h-9 px-3 rounded-md text-sm" style={inputStyle}>
                          <span className="truncate">{formData.brand_id ? brands.find((b) => b._id === formData.brand_id)?.name : "Select product brand"}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {isBrandDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-48 overflow-y-auto" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                            {brands.map((brand) => (
                              <div key={brand._id} onClick={() => { setFormData({ ...formData, brand_id: brand._id }); setIsBrandDropdownOpen(false); }} className="px-3 py-2 text-sm cursor-pointer hover:bg-black/5" style={{ color: formData.brand_id === brand._id ? "var(--accent)" : "var(--text-primary)" }}>{brand.name}</div>
                            ))}
                            <div onClick={() => { setIsBrandDropdownOpen(false); handleOpenBrandModal(); }} className="px-3 py-2 text-sm font-semibold cursor-pointer border-t flex items-center gap-2 hover:bg-black/5" style={{ borderColor: "var(--border-color)", color: "var(--accent)" }}><Plus className="h-4 w-4" /> Create New Brand</div>
                          </div>
                        )}
                      </div>
                    </Field>
                  </div>
                  <Field label="Product Name *">
                    <input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field w-full h-9 px-3 rounded-md text-sm" style={inputStyle} />
                  </Field>
                  <Field label="Description">
                    <textarea rows={3} placeholder="Enter product description..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field w-full px-3 py-2 rounded-md text-sm resize-none" style={inputStyle} />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Tax (%)">
                      <input type="number" min="0" max="100" placeholder="%" value={formData.tax} onChange={(e) => { let val = e.target.value; if (val === "") setFormData({ ...formData, tax: "" }); else { let num = Number(val); if (num < 0) num = 0; if (num > 100) num = 100; setFormData({ ...formData, tax: String(num) }); } }} className="input-field w-full h-9 px-3 rounded-md text-sm" style={inputStyle} />
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
                      <div key={variant._id || index} className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
                        <div className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-black/[0.02]" style={{ backgroundColor: "var(--bg-tertiary)" }} onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                          <div>
                            <p className="text-sm font-semibold">{variant.sku || `Variant ${index + 1}`}</p>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index + 1}`}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <IconButton title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateVariant(index); }}><Copy className="h-3.5 w-3.5" /></IconButton>
                            <IconButton title="Delete" color="var(--danger)" background="rgba(239,68,68,.10)" onClick={(e) => { e.stopPropagation(); removeVariant(index); }}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                        {expandedVariant === index && (
                          <div className="space-y-4 p-4">
                            <div>
                              <SectionTitle>Identification</SectionTitle>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="SKU *"><input required type="text" placeholder="e.g. sku_4" value={variant.sku} readOnly={!!editingProduct && !!variant._id} onChange={(e) => updateVariant(index, "sku", e.target.value)} className={`input-field w-full h-9 px-3 rounded-md text-sm ${editingProduct && variant._id ? "opacity-60 cursor-not-allowed" : ""}`} style={inputStyle} /></Field>
                                <Field label="Variant Title *"><input required type="text" placeholder="e.g. Black - Large" value={variant.title} onChange={(e) => updateVariant(index, "title", e.target.value)} className="input-field w-full h-9 px-3 rounded-md text-sm" style={inputStyle} /></Field>
                              </div>
                              <div className="mt-3"><Field label="Variant Description"><textarea rows={2} placeholder="Enter variant description..." value={variant.description} onChange={(e) => updateVariant(index, "description", e.target.value)} className="input-field w-full px-3 py-2 rounded-md text-sm resize-none" style={inputStyle} /></Field></div>
                            </div>
                            <div>
                              <SectionTitle>Pricing & Stock</SectionTitle>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                <NumberField label="Cost Price *" placeholder="1000" value={variant.cost_price} onChange={(v) => updateVariant(index, "cost_price", v)} />
                                <NumberField label="Selling Price *" placeholder="1500" value={variant.selling_price} onChange={(v) => updateVariant(index, "selling_price", v)} />
                                <NumberField label="Quantity" placeholder="50" value={variant.quantity} onChange={(v) => updateVariant(index, "quantity", v)} />
                                <NumberField label="Min Qty" placeholder="5" value={variant.min_qnt} onChange={(v) => updateVariant(index, "min_qnt", v)} />
                                <NumberField label="Max Qty" placeholder="100" value={variant.max_qnt} onChange={(v) => updateVariant(index, "max_qnt", v)} />
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
                                  const preset = ATTRIBUTE_PRESETS.find((p) => p.name === attribute.name);
                                  const isCustom = !!attribute.isCustom;
                                  return (
                                    <div key={attrIndex} className="flex flex-wrap items-center gap-2">
                                      <div className="relative min-w-[140px] flex-1">
                                        <select value={attribute.name} onChange={(e) => { const variants = [...formData.variants]; const attributes = [...variants[index].attributes]; attributes[attrIndex] = { ...attributes[attrIndex], name: e.target.value, value: "", isCustom: false }; variants[index] = { ...variants[index], attributes }; setFormData({ ...formData, variants }); }} className="input-field w-full appearance-none pr-8 h-9 pl-3 rounded-md text-sm cursor-pointer" style={inputStyle}>
                                          {ATTRIBUTE_PRESETS.map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                                      </div>
                                      {preset ? (
                                        <>
                                          <div className="relative min-w-[140px] flex-1">
                                            <select value={isCustom ? "__custom__" : attribute.value} onChange={(e) => { const val = e.target.value; const variants = [...formData.variants]; const attributes = [...variants[index].attributes]; attributes[attrIndex] = { ...attributes[attrIndex], isCustom: val === "__custom__", value: val === "__custom__" ? (preset.name === "Color" ? "#000000" : "") : val }; variants[index] = { ...variants[index], attributes }; setFormData({ ...formData, variants }); }} className="input-field w-full appearance-none pr-8 h-9 pl-3 rounded-md text-sm cursor-pointer" style={inputStyle}>
                                              {preset.values.map((v) => (<option key={v} value={v}>{v}</option>))}
                                              <option value="__custom__">+ Custom</option>
                                            </select>
                                            <ChevronDown className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                                          </div>
                                          {isCustom && (preset.name === "Color" ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              <input type="color" value={attribute.value || "#000000"} onChange={(e) => updateAttribute(index, attrIndex, "value", e.target.value)} className="h-9 w-10 cursor-pointer rounded border p-1" style={{ borderColor: "var(--border-color)" }} />
                                              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{attribute.value || "#000000"}</span>
                                            </div>
                                          ) : (
                                            <input type="text" placeholder="Custom value..." value={attribute.value} onChange={(e) => updateAttribute(index, attrIndex, "value", e.target.value)} className="input-field flex-1 h-9 px-3 rounded-md text-sm" style={inputStyle} />
                                          ))}
                                        </>
                                      ) : (
                                        <input type="text" placeholder="Value e.g. Black" value={attribute.value} onChange={(e) => updateAttribute(index, attrIndex, "value", e.target.value)} className="input-field flex-1 h-9 px-3 rounded-md text-sm" style={inputStyle} />
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
                                <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(index, e)} />
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
                  <div className="flex justify-between border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                    <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}><ChevronLeft className="h-4 w-4" /> Back</button>
                    <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{isSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"} <Check className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl overflow-visible shadow-2xl" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between rounded-t-xl" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">Create New Category</h3>
              <button
                onClick={() => { setShowNewCategoryModal(false); resetCategoryForm(); }}
                disabled={createCategoryMutation.isPending || loadingCategoryCode}
                className="p-1 rounded transition disabled:opacity-50 hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-visible" style={{ overflowClipMargin: "200px" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Category Code *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={categoryFormData.category_code}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, category_code: e.target.value })}
                      required
                      disabled={createCategoryMutation.isPending || loadingCategoryCode}
                      className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      placeholder={loadingCategoryCode ? "Generating..." : "CAT-001"}
                    />
                    {loadingCategoryCode && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                      </span>
                    )}
                  </div>
                  {!loadingCategoryCode && categoryFormData.category_code && (
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Auto-generated • You can change it</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Category Name *</label>
                  <input
                    type="text"
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    required
                    disabled={createCategoryMutation.isPending}
                    className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    placeholder="Electronics"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  rows="3"
                  disabled={createCategoryMutation.isPending}
                  className="px-3 py-2 rounded-md text-sm w-full outline-none disabled:opacity-50 resize-none"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  placeholder="Category details..."
                />
              </div>
              <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button
                  type="button"
                  onClick={() => { setShowNewCategoryModal(false); resetCategoryForm(); }}
                  disabled={createCategoryMutation.isPending}
                  className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending || loadingCategoryCode}
                  className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {createCategoryMutation.isPending ? "Creating..." : "Create & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand Modal */}
      {showNewBrandModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl overflow-visible shadow-2xl" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between rounded-t-xl" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">Create New Brand</h3>
              <button onClick={() => { setShowNewBrandModal(false); resetBrandForm(); }} disabled={createBrandMutation.isPending} className="p-1 rounded transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleBrandSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-visible" style={{ overflowClipMargin: "200px" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Brand Code *</label>
                  <div className="relative">
                    <input type="text" value={brandFormData.brand_code} onChange={(e) => setBrandFormData({ ...brandFormData, brand_code: e.target.value })} required disabled={createBrandMutation.isPending || loadingBrandCode} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={loadingBrandCode ? "Generating..." : "BRD-001"} />
                    {loadingBrandCode && <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Brand Name *</label>
                  <input type="text" value={brandFormData.name} onChange={(e) => setBrandFormData({ ...brandFormData, name: e.target.value })} required disabled={createBrandMutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Nike" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea value={brandFormData.description} onChange={(e) => setBrandFormData({ ...brandFormData, description: e.target.value })} rows="2" disabled={createBrandMutation.isPending} className="px-3 py-2 rounded-md text-sm w-full outline-none disabled:opacity-50 resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Brand details..." />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Brand Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                    {brandLogoPreview ? <img src={brandLogoPreview} alt="Preview" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6" style={{ color: "var(--text-muted)" }} />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="brand-logo-upload" className="cursor-pointer h-8 px-3 rounded-md text-xs font-medium flex items-center gap-2 transition hover:opacity-80 w-fit" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <Upload className="w-3.5 h-3.5" /> {brandLogoPreview ? "Change Image" : "Upload Image"}
                    </label>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>PNG, JPG, WEBP up to 10MB</p>
                  </div>
                  <input id="brand-logo-upload" type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleBrandLogoChange} disabled={createBrandMutation.isPending} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Country</label>
                  <div className="relative">
                    <select value={brandFormData.country} onChange={(e) => setBrandFormData({ ...brandFormData, country: e.target.value })} disabled={createBrandMutation.isPending} className="appearance-none h-9 w-full pl-3 pr-8 rounded-md text-sm outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <option value="">Select Country</option>
                      {allCountries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></span>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer h-9">
                  <input type="checkbox" checked={brandFormData.is_active} onChange={(e) => setBrandFormData({ ...brandFormData, is_active: e.target.checked })} disabled={createBrandMutation.isPending} className="w-4 h-4 rounded disabled:opacity-50" style={{ accentColor: "var(--accent)" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
                </label>
              </div>
              <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setShowNewBrandModal(false); resetBrandForm(); }} disabled={createBrandMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={createBrandMutation.isPending || loadingBrandCode} className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{createBrandMutation.isPending ? "Creating..." : "Create & Select"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// HELPER COMPONENTS
// ==========================================
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

function NumberField({ label, value, placeholder, onChange }) {
  return (
    <Field label={label}>
      <input type="number" min="0" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="input-field w-full h-9 px-3 rounded-md text-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
    </Field>
  );
}

function SectionTitle({ children }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={active ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function IconButton({ children, onClick, title, color = "var(--text-muted)", background = "transparent" }) {
  return (
    <button type="button" title={title} onClick={onClick} className="rounded p-1.5 transition hover:bg-black/5 flex items-center justify-center" style={{ color, backgroundColor: background }}>
      {children}
    </button>
  );
}

function ActionButtons({ product, onView, onEdit, onDelete, onToggle, isDeleting, isToggling }) {
  const isActive = product.status === "active";
  
  return (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <button 
        onClick={(e) => { e.stopPropagation(); onToggle(product); }} 
        disabled={isToggling}
        className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center disabled:opacity-50" 
        style={{ color: isActive ? "#f87171" : "#34d399" }} 
        title={isActive ? "Deactivate" : "Activate"}
      >
        <Power className="w-4 h-4" />
      </button>

      <button onClick={(e) => { e.stopPropagation(); onView(product); }} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-emerald-500/10 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details"><Eye className="w-4 h-4" /></button>
      
      <button onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><Pencil className="w-4 h-4" /></button>
      
      <button onClick={(e) => { e.stopPropagation(); onDelete(product); }} disabled={isDeleting} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center" title="Delete"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}