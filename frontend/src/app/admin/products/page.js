"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
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
    values: ["Black", "White", "Gray", "Red", "Blue", "Green", "Yellow",  "Brown", "Pink", "Orange", "Purple", "Gold", "Silver"],
  },
  {
    name: "Size",
    values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"],
  },
  {
    name: "Material",
    values: ["Cotton", "Polyester", "Leather", "Denim", "Wool", "Silk", "Linen", "Nylon",],
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

const API_ORIGIN =
  process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5000";

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

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  return `${API_ORIGIN}${url}`;
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

          if (!blob) {
            resolve(file);
            return;
          }

          const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";

          resolve(
            new File([blob], newName, {
              type: "image/webp",
              lastModified: Date.now(),
            }),
          );
        },
        "image/webp",
        0.82,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(file);
    };

    image.src = imageUrl;
  });
};

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [viewMode, setViewMode] = useState("table");

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);

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

  // ==========================================
  // QUERIES
  // ==========================================

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
  });

  // ==========================================
  // CREATE
  // ==========================================

  const createMutation = useMutation({
    mutationFn: productApi.create,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products"],
      });

      toast.success("Product created successfully");
      closeProductModal();
    },

    onError: (error) => {
      toast.error(error.response?.data?.message || "Product creation failed");
    },
  });

  // ==========================================
  // UPDATE
  // ==========================================

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products"],
      });

      toast.success("Product updated successfully");
      closeProductModal();
    },

    onError: (error) => {
      toast.error(error.response?.data?.message || "Product update failed");
    },
  });

  // ==========================================
  // DELETE
  // ==========================================

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products"],
      });

      toast.success("Product deleted successfully");

      setShowDeleteModal(false);
      setProductToDelete(null);
    },

    onError: (error) => {
      toast.error(error.response?.data?.message || "Product delete failed");
    },
  });

  // ==========================================
  // PRODUCT DETAIL PAGE
  // ==========================================

  const openProductDetails = (product) => {
    router.push(`/admin/products/${product._id}`);
  };

  // ==========================================
  // CLOSE PRODUCT MODAL
  // ==========================================

  const closeProductModal = () => {
    formData.variants.forEach((variant) => {
      variant.images.forEach((image) => {
        if (image.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(image.preview);
        }
      });
    });

    setShowModal(false);
    setEditingProduct(null);
    setCurrentStep(1);
    setExpandedVariant(0);
  };

  // ==========================================
  // NEW PRODUCT
  // ==========================================

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

  // ==========================================
  // SKU
  // ==========================================

  const getNextLocalSku = async () => {
    const result = await variantApi.getNextSku();

    const databaseSku = getSkuNumber(result.sku);

    const localSku = Math.max(
      0,
      ...formData.variants.map((variant) => getSkuNumber(variant.sku)),
    );

    const nextNumber = Math.max(databaseSku, localSku + 1);

    return `sku_${nextNumber}`;
  };

  // ==========================================
  // VARIANTS
  // ==========================================

  const addVariant = async () => {
    try {
      const sku = await getNextLocalSku();

      const newIndex = formData.variants.length;

      setFormData((prev) => ({
        ...prev,
        variants: [...prev.variants, createEmptyVariant(sku)],
      }));

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

        attributes: oldVariant.attributes.map((item) => ({
          ...item,
        })),

        images: [],
      };

      setFormData((prev) => {
        const variants = [...prev.variants];

        variants.splice(index + 1, 0, copiedVariant);

        return {
          ...prev,
          variants,
        };
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

      variants[index] = {
        ...variants[index],
        [field]: value,
      };

      return {
        ...prev,
        variants,
      };
    });
  };

  // ==========================================
  // ATTRIBUTES
  // ==========================================

  const addAttribute = (variantIndex) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[variantIndex] = {
        ...variants[variantIndex],
        attributes: [
          ...variants[variantIndex].attributes,
          { name: "", value: "", isCustom: false }, // 👈 Naya
        ],
      };
      return { ...prev, variants };
    });
  };

  const updateAttribute = (variantIndex, attrIndex, field, value) => {
    setFormData((prev) => {
      const variants = [...prev.variants];

      const attributes = [...variants[variantIndex].attributes];

      attributes[attrIndex] = {
        ...attributes[attrIndex],
        [field]: value,
      };

      variants[variantIndex] = {
        ...variants[variantIndex],
        attributes,
      };

      return {
        ...prev,
        variants,
      };
    });
  };

  const removeAttribute = (variantIndex, attrIndex) => {
    setFormData((prev) => {
      const variants = [...prev.variants];

      variants[variantIndex] = {
        ...variants[variantIndex],

        attributes: variants[variantIndex].attributes.filter(
          (_, i) => i !== attrIndex,
        ),
      };

      return {
        ...prev,
        variants,
      };
    });
  };

  // ==========================================
  // IMAGE
  // ==========================================

  const handleImageUpload = async (variantIndex, event) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];

    const validFiles = selectedFiles.filter((file) =>
      validTypes.includes(file.type),
    );

    if (validFiles.length !== selectedFiles.length) {
      toast.error("Only JPG, PNG and WebP images are allowed");
    }

    try {
      const compressedFiles = await Promise.all(
        validFiles.map((file) => compressProductImage(file)),
      );

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

        return {
          ...prev,
          variants,
        };
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

      if (image.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(image.preview);
      }

      variants[variantIndex] = {
        ...variants[variantIndex],

        images: variants[variantIndex].images.filter(
          (_, i) => i !== imageIndex,
        ),
      };

      return {
        ...prev,
        variants,
      };
    });
  };

  // ==========================================
  // EDIT
  // ==========================================

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

          attributes: Object.entries(variant.attributes || {}).map(
            ([name, value]) => ({
              name,
              value: String(value),
            }),
          ),

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

  // ==========================================
  // DELETE
  // ==========================================

  const handleDelete = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;

    deleteMutation.mutate(productToDelete._id);
  };

  // ==========================================
  // NEXT STEP
  // ==========================================

  const handleNextStep = () => {
    if (!formData.category_id) {
      toast.error("Please select category");
      return;
    }

    if (!formData.brand_id) {
      toast.error("Please select brand");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setCurrentStep(2);
  };

  // ==========================================
  // SUBMIT
  // ==========================================

  const handleSubmit = (event) => {
    event.preventDefault();

    const skuSet = new Set();

    for (const variant of formData.variants) {
      const sku = variant.sku.trim();

      if (!sku) {
        toast.error("SKU is required");
        return;
      }

      if (skuSet.has(sku)) {
        toast.error(`Duplicate SKU: ${sku}`);
        return;
      }

      skuSet.add(sku);

      if (!variant.title.trim()) {
        toast.error("Variant title is required");
        return;
      }

      if (variant.cost_price === "" || variant.selling_price === "") {
        toast.error("Cost price and selling price are required");

        return;
      }
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

        if (name) {
          attributes[name] = attribute.value;
        }
      });

      const existingImages = variant.images
        .filter((image) => image.existing)
        .map((image) => image.metadata);

      variant.images
        .filter((image) => !image.existing && image.file)
        .forEach((image) => {
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
      updateMutation.mutate({
        id: editingProduct._id,
        data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const getCategoryName = (product) => {
    return (
      product.category_id?.name ||
      categories.find((category) => category._id === product.category_id)
        ?.name ||
      "Unknown"
    );
  };

  const getBrandName = (product) => {
    return (
      product.brand_id?.name ||
      brands.find((brand) => brand._id === product.brand_id)?.name ||
      "Unknown"
    );
  };

  // ==========================================
  // FILTER
  // ==========================================

  const filteredProducts = products.filter((product) => {
    const keyword = search.trim().toLowerCase();

    const skuMatch = (product.variants || []).some((variant) =>
      variant.sku?.toLowerCase().includes(keyword),
    );

    const matchSearch =
      !keyword || product.name?.toLowerCase().includes(keyword) || skuMatch;

    const categoryId = product.category_id?._id || product.category_id;

    const brandId = product.brand_id?._id || product.brand_id;

    const matchCategory =
      filterCategory === "all" || categoryId === filterCategory;

    const matchBrand = filterBrand === "all" || brandId === filterBrand;

    const matchStatus =
      filterStatus === "all" || product.status === filterStatus;

    return matchSearch && matchCategory && matchBrand && matchStatus;
  });

  // ==========================================
  // PAGINATION
  // ==========================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE),
  );

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,

    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const changeSearch = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const changeCategory = (value) => {
    setFilterCategory(value);
    setCurrentPage(1);
  };

  const changeBrand = (value) => {
    setFilterBrand(value);
    setCurrentPage(1);
  };

  const changeStatus = (value) => {
    setFilterStatus(value);
    setCurrentPage(1);
  };

  // ==========================================
  // STATS
  // ==========================================

  const activeProducts = products.filter(
    (product) => product.status === "active",
  ).length;

  const totalVariants = products.reduce(
    (total, product) => total + (product.variants || []).length,
    0,
  );

  const totalStock = products.reduce(
    (total, product) =>
      total +
      (product.variants || []).reduce(
        (variantTotal, variant) => variantTotal + Number(variant.quantity || 0),

        0,
      ),

    0,
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ==========================================
  // LOADING
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
          style={{
            borderColor: "var(--accent)",

            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen space-y-6 p-6"
      style={{
        // backgroundColor:
        //   "var(--bg-primary)",

        color: "var(--text-primary)",
      }}
    >
      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Package
              className="h-8 w-8"
              style={{
                color: "var(--accent)",
              }}
            />
            Products
          </h1>

          <p
            className="mt-1 text-sm"
            style={{
              color: "var(--text-muted)",
            }}
          >
            Manage products, variants, stock and pricing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded-lg p-1"
            style={{
              backgroundColor: "var(--bg-card)",

              border: "1px solid var(--border-color)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`rounded-md p-2 transition ${
                viewMode === "table" ? "bg-emerald-600 text-white" : ""
              }`}
            >
              <List className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`rounded-md p-2 transition ${
                viewMode === "grid" ? "bg-emerald-600 text-white" : ""
              }`}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={openNewProduct}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:scale-105"
            style={{
              backgroundColor: "var(--accent)",

              color: "var(--accent-text)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Products" value={products.length} />

        <StatCard
          title="Active Products"
          value={activeProducts}
          color="var(--success)"
        />

        <StatCard
          title="Total Variants"
          value={totalVariants}
          color="var(--info)"
        />

        <StatCard title="Units in Stock" value={totalStock} />
      </div>

      {/* FILTERS */}

      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: "var(--bg-card)",

          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
              style={{
                color: "var(--text-muted)",
              }}
            />

            <input
              type="text"
              value={search}
              placeholder="Search by product name or SKU..."
              onChange={(e) => changeSearch(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filterCategory}
              onChange={(e) => changeCategory(e.target.value)}
              className="input-field min-w-[160px] flex-1"
            >
              <option value="all">All Categories</option>

              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={filterBrand}
              onChange={(e) => changeBrand(e.target.value)}
              className="input-field min-w-[160px] flex-1"
            >
              <option value="all">All Brands</option>

              {brands.map((brand) => (
                <option key={brand._id} value={brand._id}>
                  {brand.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => changeStatus(e.target.value)}
              className="input-field min-w-[160px] flex-1"
            >
              <option value="all">All Status</option>

              <option value="active">Active</option>

              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE */}

      {viewMode === "table" && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            backgroundColor: "var(--bg-card)",

            border: "1px solid var(--border-color)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                }}
              >
                <tr>
                  <TableHeading>Product</TableHeading>

                  <TableHeading>Category</TableHeading>

                  <TableHeading>Brand</TableHeading>

                  <TableHeading>Price</TableHeading>

                  <TableHeading>Stock</TableHeading>

                  <TableHeading>Status</TableHeading>

                  <TableHeading right>Actions</TableHeading>
                </tr>
              </thead>

              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-14 text-center"
                      style={{
                        color: "var(--text-muted)",
                      }}
                    >
                      <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      No products found
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const firstVariant = product.variants?.[0];

                    const quantity = Number(firstVariant?.quantity || 0);

                    const minimum = Number(firstVariant?.min_qnt || 0);

                    const lowStock = quantity <= minimum;

                    const image = firstVariant?.images?.[0]?.img_url;

                    return (
                      <tr
                        key={product._id}
                        onClick={() => openProductDetails(product)}
                        className="cursor-pointer transition hover:bg-black/5"
                        style={{
                          borderTop: "1px solid var(--border-color)",
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {image ? (
                              <img
                                src={getImageUrl(image)}
                                alt={product.name}
                                className="h-11 w-11 rounded-lg object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-lg font-bold"
                                style={{
                                  backgroundColor: "var(--bg-tertiary)",
                                }}
                              >
                                {product.name?.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <p className="font-semibold">{product.name}</p>

                              <p
                                className="text-xs font-mono"
                                style={{
                                  color: "var(--text-muted)",
                                }}
                              >
                                {firstVariant?.sku || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {getCategoryName(product)}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {getBrandName(product)}
                        </td>

                        <td className="px-6 py-4 font-semibold text-emerald-500">
                          Rs.{" "}
                          {Number(
                            firstVariant?.selling_price || 0,
                          ).toLocaleString()}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                lowStock
                                  ? "font-semibold text-red-500"
                                  : "font-semibold text-emerald-500"
                              }
                            >
                              {quantity}
                            </span>

                            {lowStock && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={product.status} />
                        </td>

                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <IconButton
                              title="Edit product"
                              color="var(--info)"
                              background="rgba(59,130,246,.10)"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>

                            <IconButton
                              title="Delete product"
                              color="var(--danger)"
                              background="rgba(239,68,68,.10)"
                              onClick={() => handleDelete(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
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

      {/* GRID */}

      {viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedProducts.map((product) => {
            const variant = product.variants?.[0];

            const image = variant?.images?.[0]?.img_url;

            return (
              <div
                key={product._id}
                onClick={() => openProductDetails(product)}
                className="cursor-pointer overflow-hidden rounded-xl transition hover:-translate-y-1"
                style={{
                  backgroundColor: "var(--bg-card)",

                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  className="flex aspect-square items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                  }}
                >
                  {image ? (
                    <img
                      src={getImageUrl(image)}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-16 w-16 opacity-20" />
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="font-bold">{product.name}</h3>

                    <p
                      className="mt-1 text-xs font-mono"
                      style={{
                        color: "var(--text-muted)",
                      }}
                    >
                      {variant?.sku || "—"}
                    </p>
                  </div>

                  <p
                    className="text-xl font-bold"
                    style={{
                      color: "var(--accent)",
                    }}
                  >
                    Rs. {Number(variant?.selling_price || 0).toLocaleString()}
                  </p>

                  <div className="flex items-center justify-between">
                    <StatusBadge status={product.status} />

                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        title="Edit"
                        color="var(--info)"
                        background="rgba(59,130,246,.10)"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>

                      <IconButton
                        title="Delete"
                        color="var(--danger)"
                        background="rgba(239,68,68,.10)"
                        onClick={() => handleDelete(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}

      {filteredProducts.length > ITEMS_PER_PAGE && (
        <div
          className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: "var(--border-color)",
          }}
        >
          <p
            className="text-sm"
            style={{
              color: "var(--text-muted)",
            }}
          >
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of{" "}
            {filteredProducts.length} products
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: "var(--bg-card)",

                border: "1px solid var(--border-color)",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-2 text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: "var(--bg-card)",

                border: "1px solid var(--border-color)",
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}

      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-xl p-5 shadow-2xl"
            style={{
              backgroundColor: "var(--bg-card)",

              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>

              <div>
                <h3 className="font-semibold">
                  Delete "{productToDelete.name}
                  "?
                </h3>

                <p
                  className="mt-1 text-sm leading-5"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  This action cannot be undone. Product, variants and images
                  will be permanently removed.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);

                  setProductToDelete(null);
                }}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--bg-tertiary)",

                  border: "1px solid var(--border-color)",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={confirmDelete}
                className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl"
            style={{
              backgroundColor: "var(--bg-card)",

              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="sticky top-0 z-20 flex items-center justify-between px-6 py-5"
              style={{
                backgroundColor: "var(--bg-card)",

                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div>
                <h3 className="text-xl font-bold">
                  {editingProduct ? "Edit Product" : "New Product"}
                </h3>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  Add product and variant information
                </p>
              </div>

              <button
                type="button"
                title="Close"
                onClick={closeProductModal}
                className="rounded-lg p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* STEPS */}

            <div
              className="flex items-center gap-4 px-6 py-4"
              style={{
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                  {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                </div>

                <span className="text-sm font-medium">Product Info</span>
              </div>

              <div
                className="h-px w-12"
                style={{
                  backgroundColor: "var(--border-color)",
                }}
              />

              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    currentStep === 2
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  2
                </div>

                <span className="text-sm font-medium">Variants</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* STEP 1 */}

              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Category *">
                      <select
                        required
                        value={formData.category_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category_id: e.target.value,
                          })
                        } 
                        className="input-field " 
                        
                      >
                        <option   value="">Select product category</option>

                        {categories.map((category) => (
                          <option  key={category._id} value={category._id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Brand *">
                      <select
                      
                        required
                        value={formData.brand_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            brand_id: e.target.value,
                          })
                        }
                        className="input-field"
                      >
                        <option value="">Select product brand</option>

                        {brands.map((brand) => (
                          <option key={brand._id} value={brand._id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Product Name *">
                    <input
                      required
                      type="text"
                      placeholder="e.g. Cotton T-Shirt"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value,
                        })
                      }
                      className="input-field"
                    />
                  </Field>

                  <Field label="Description">
                    <textarea
                      rows={4}
                      placeholder="Enter product description..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="input-field resize-none"
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Tax (%)">
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 18"
                        value={formData.tax}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tax: e.target.value,
                          })
                        }
                        className="input-field"
                      />
                    </Field>

                    <Field label="Status">
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value,
                          })
                        }
                        className="input-field"
                      >
                        <option value="active">Active</option>

                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--accent)",

                        color: "var(--accent-text)",
                      }}
                    >
                      Next: Variants
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-lg font-bold">
                        <Sparkles
                          className="h-5 w-5"
                          style={{
                            color: "var(--accent)",
                          }}
                        />
                        Variants ({formData.variants.length})
                      </h4>

                      <p
                        className="mt-1 text-xs"
                        style={{
                          color: "var(--text-muted)",
                        }}
                      >
                        SKU, pricing, stock, attributes and images
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addVariant}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--accent)",

                        color: "var(--accent-text)",
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Variant
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.variants.map((variant, index) => (
                      <div
                        key={variant._id || index}
                        className="overflow-hidden rounded-xl"
                        style={{
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div
                          className="flex cursor-pointer items-center justify-between px-5 py-4"
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                          }}
                          onClick={() =>
                            setExpandedVariant(
                              expandedVariant === index ? -1 : index,
                            )
                          }
                        >
                          <div>
                            <p className="font-semibold">
                              {variant.sku || `Variant ${index + 1}`}
                            </p>

                            <p
                              className="text-xs"
                              style={{
                                color: "var(--text-muted)",
                              }}
                            >
                              {variant.title || `Variant #${index + 1}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <IconButton
                              title="Duplicate variant"
                              onClick={(e) => {
                                e.stopPropagation();

                                duplicateVariant(index);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </IconButton>

                            <IconButton
                              title="Delete variant"
                              color="var(--danger)"
                              background="rgba(239,68,68,.10)"
                              onClick={(e) => {
                                e.stopPropagation();

                                removeVariant(index);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>

                            <ChevronDown
                              className={`h-5 w-5 transition-transform ${
                                expandedVariant === index ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {expandedVariant === index && (
                          <div className="space-y-6 p-5">
                            <div>
                              <SectionTitle>Identification</SectionTitle>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="SKU *">
                                  <input
                                    required
                                    type="text"
                                    placeholder="e.g. sku_4"
                                    value={variant.sku}
                                    onChange={(e) =>
                                      updateVariant(
                                        index,
                                        "sku",
                                        e.target.value,
                                      )
                                    }
                                    className="input-field"
                                  />
                                </Field>

                                <Field label="Variant Title *">
                                  <input
                                    required
                                    type="text"
                                    placeholder="e.g. Black - Large"
                                    value={variant.title}
                                    onChange={(e) =>
                                      updateVariant(
                                        index,
                                        "title",
                                        e.target.value,
                                      )
                                    }
                                    className="input-field"
                                  />
                                </Field>
                              </div>

                              <div className="mt-4">
                                <Field label="Variant Description">
                                  <textarea
                                    rows={3}
                                    placeholder="Enter variant description..."
                                    value={variant.description}
                                    onChange={(e) =>
                                      updateVariant(
                                        index,
                                        "description",
                                        e.target.value,
                                      )
                                    }
                                    className="input-field resize-none"
                                  />
                                </Field>
                              </div>
                            </div>

                            <div>
                              <SectionTitle>Pricing & Stock</SectionTitle>

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                <NumberField
                                  label="Cost Price *"
                                  placeholder="e.g. 1000"
                                  value={variant.cost_price}
                                  onChange={(value) =>
                                    updateVariant(index, "cost_price", value)
                                  }
                                />

                                <NumberField
                                  label="Selling Price *"
                                  placeholder="e.g. 1500"
                                  value={variant.selling_price}
                                  onChange={(value) =>
                                    updateVariant(index, "selling_price", value)
                                  }
                                />

                                <NumberField
                                  label="Quantity"
                                  placeholder="e.g. 50"
                                  value={variant.quantity}
                                  onChange={(value) =>
                                    updateVariant(index, "quantity", value)
                                  }
                                />

                                <NumberField
                                  label="Min Qty"
                                  placeholder="e.g. 5"
                                  value={variant.min_qnt}
                                  onChange={(value) =>
                                    updateVariant(index, "min_qnt", value)
                                  }
                                />

                                <NumberField
                                  label="Max Qty"
                                  placeholder="e.g. 100"
                                  value={variant.max_qnt}
                                  onChange={(value) =>
                                    updateVariant(index, "max_qnt", value)
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <SectionTitle>Attributes</SectionTitle>

                              <div className="space-y-3">
                                {variant.attributes.map(
                                  (attribute, attrIndex) => {
                                    const preset = ATTRIBUTE_PRESETS.find(
                                      (p) => p.name === attribute.name,
                                    );
                                    const isCustom = !!attribute.isCustom;

                                    return (
                                      <div
                                        key={attrIndex}
                                        className="flex flex-wrap items-center gap-3"
                                      >
                                        {/* 1. Attribute Name Select */}
                                        <select
                                          value={attribute.name}
                                          onChange={(e) => {
                                            const variants = [
                                              ...formData.variants,
                                            ];
                                            const attributes = [
                                              ...variants[index].attributes,
                                            ];
                                            attributes[attrIndex] = {
                                              ...attributes[attrIndex],
                                              name: e.target.value,
                                              value: "",
                                              isCustom: false,
                                            };
                                            variants[index] = {
                                              ...variants[index],
                                              attributes,
                                            };
                                            setFormData({
                                              ...formData,
                                              variants,
                                            });
                                          }}
                                          className="input-field min-w-[160px] flex-1"
                                        >
                                          {ATTRIBUTE_PRESETS.map((p) => (
                                            <option key={p.name} value={p.name}>
                                              {p.name}
                                            </option>
                                          ))}
                                        </select>

                                        {/* 2. Attribute Value (Conditional) */}
                                        {preset ? (
                                          <>
                                            <select
                                              value={
                                                isCustom
                                                  ? "__custom__"
                                                  : attribute.value
                                              }
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                const variants = [
                                                  ...formData.variants,
                                                ];
                                                const attributes = [
                                                  ...variants[index].attributes,
                                                ];
                                                attributes[attrIndex] = {
                                                  ...attributes[attrIndex],
                                                  isCustom:
                                                    val === "__custom__",
                                                  value:
                                                    val === "__custom__"
                                                      ? preset.name === "Color"
                                                        ? "#000000"
                                                        : ""
                                                      : val,
                                                };
                                                variants[index] = {
                                                  ...variants[index],
                                                  attributes,
                                                };
                                                setFormData({
                                                  ...formData,
                                                  variants,
                                                });
                                              }}
                                              className="input-field min-w-[160px] flex-1"
                                            >
                                              {preset.values.map((v) => (
                                                <option key={v} value={v}>
                                                  {v}
                                                </option>
                                              ))}
                                              <option value="__custom__">
                                                + Custom
                                              </option>
                                            </select>

                                            {/* 3. Custom Input (Color Picker ya Text) */}
                                            {isCustom &&
  (preset.name === "Color" ? (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={attribute.value || "#000000"}
          onChange={(e) =>
            updateAttribute(
              index,
              attrIndex,
              "value",
              e.target.value
            )
          }
          className="w-12 h-10 cursor-pointer rounded border"
          style={{ borderColor: "var(--border-color)" }}
          title="Pick custom RGB color"
        />
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-6 h-6 rounded border"
            style={{
              backgroundColor: attribute.value || "#000000",
              borderColor: "var(--border-color)",
            }}
          />
          <span
            className="text-sm font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {attribute.value || "#000000"}
          </span>
        </div>
      </div>
    </div>
  ) : (
                                                <input
                                                  type="text"
                                                  placeholder="Custom value..."
                                                  value={attribute.value}
                                                  onChange={(e) =>
                                                    updateAttribute(
                                                      index,
                                                      attrIndex,
                                                      "value",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="input-field flex-1"
                                                />
                                              ))}
                                          </>
                                        ) : (
                                          /* 4. Fallback: Jab koi preset select na ho */
                                          <input
                                            type="text"
                                            placeholder="Value e.g. Black"
                                            value={attribute.value}
                                            onChange={(e) =>
                                              updateAttribute(
                                                index,
                                                attrIndex,
                                                "value",
                                                e.target.value,
                                              )
                                            }
                                            className="input-field flex-1"
                                          />
                                        )}

                                        {/* 5. Remove Button */}
                                        <IconButton
                                          title="Remove attribute"
                                          color="var(--danger)"
                                          background="rgba(239,68,68,.10)"
                                          onClick={() =>
                                            removeAttribute(index, attrIndex)
                                          }
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </IconButton>
                                      </div>
                                    );
                                  },
                                )}

                                <button
                                  type="button"
                                  onClick={() => addAttribute(index)}
                                  className="flex items-center gap-2 text-sm font-semibold"
                                  style={{ color: "var(--accent)" }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Add Attribute
                                </button>
                              </div>
                            </div>

                            <div>
                              <SectionTitle>Product Images</SectionTitle>

                              <label
                                className="block cursor-pointer rounded-xl border-2 border-dashed p-7 text-center"
                                style={{
                                  borderColor: "var(--border-color)",
                                }}
                              >
                                <input
                                  hidden
                                  multiple
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={(e) => handleImageUpload(index, e)}
                                />

                                <Upload className="mx-auto mb-3 h-7 w-7" />

                                <p className="text-sm font-medium">
                                  Click to select product images
                                </p>

                                <p
                                  className="mt-1 text-xs"
                                  style={{
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  JPG, PNG or WebP • Images automatically
                                  optimized
                                </p>
                              </label>

                              {variant.images.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-3">
                                  {variant.images.map((image, imageIndex) => (
                                    <div key={imageIndex} className="relative">
                                      <img
                                        src={image.preview}
                                        alt=""
                                        className="h-24 w-24 rounded-lg object-cover"
                                      />

                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeImage(index, imageIndex)
                                        }
                                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                                      >
                                        <X className="h-4 w-4" />
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

                  <div
                    className="flex justify-between border-t pt-5"
                    style={{
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="rounded-lg px-5 py-2.5 text-sm font-medium"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",

                        border: "1px solid var(--border-color)",
                      }}
                    >
                      ← Back
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--accent)",

                        color: "var(--accent-text)",
                      }}
                    >
                      {isSubmitting
                        ? "Saving..."
                        : editingProduct
                          ? "Update Product"
                          : "Create Product"}

                      <Check className="h-4 w-4" />
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

function Field({ label, children }) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function NumberField({ label, value, placeholder, onChange }) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </Field>
  );
}

function SectionTitle({ children }) {
  return (
    <p
      className="mb-3 text-xs font-bold uppercase tracking-wider"
      style={{
        color: "var(--text-muted)",
      }}
    >
      {children}
    </p>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--bg-card)",

        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-sm"
        style={{
          color: "var(--text-muted)",
        }}
      >
        {title}
      </p>

      <p
        className="mt-1 text-2xl font-bold"
        style={{
          color: color || "var(--text-primary)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function TableHeading({ children, right = false }) {
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${
        right ? "text-right" : "text-left"
      }`}
      style={{
        color: "var(--text-muted)",
      }}
    >
      {children}
    </th>
  );
}

function StatusBadge({ status }) {
  const active = status === "active";

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
      style={{
        backgroundColor: active
          ? "rgba(16,185,129,.15)"
          : "rgba(239,68,68,.15)",

        color: active ? "var(--success)" : "var(--danger)",
      }}
    >
      {status}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
  color = "var(--text-muted)",
  background = "var(--bg-card)",
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg p-2 transition hover:scale-110"
      style={{
        color,
        backgroundColor: background,
      }}
    >
      {children}
    </button>
  );
}
