"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Check,
  Copy,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { variantApi } from "@/apis/admin/variantApi";

const API_ORIGIN =
  process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const ATTRIBUTE_PRESETS = [
  {
    name: "Color",
    values: [
      "Black",
      "White",
      "Gray",
      "Red",
      "Blue",
      "Green",
      "Yellow",
      "Brown",
      "Pink",
      "Orange",
      "Purple",
      "Gold",
      "Silver",
    ],
  },
  {
    name: "Size",
    values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"],
  },
  {
    name: "Material",
    values: [
      "Cotton",
      "Polyester",
      "Leather",
      "Denim",
      "Wool",
      "Silk",
      "Linen",
      "Nylon",
    ],
  },
  {
    name: "Fit",
    values: [
      "Regular Fit",
      "Slim Fit",
      "Loose Fit",
      "Relaxed Fit",
      "Oversized",
      "Skinny",
      "Straight",
      "Tapered",
    ],
  },
  {
    name: "Pattern",
    values: [
      "Solid",
      "Striped",
      "Checked",
      "Plaid",
      "Printed",
      "Floral",
      "Camouflage",
    ],
  },
  {
    name: "Sleeve",
    values: [
      "Full Sleeve",
      "Half Sleeve",
      "Sleeveless",
      "3/4 Sleeve",
      "Long Sleeve",
      "Short Sleeve",
      "Cap Sleeve",
    ],
  },
  {
    name: "Collar",
    values: [
      "Round Neck",
      "V-Neck",
      "Collared",
      "Mandarin Collar",
      "Polo Collar",
      "Turtleneck",
      "Hooded",
      "Boat Neck",
    ],
  },
  {
    name: "Occasion",
    values: [
      "Casual",
      "Formal",
      "Party",
      "Wedding",
      "Sports",
      "Gym",
      "Office",
      "Outdoor",
      "Daily Wear",
      "Festive",
    ],
  },
  {
    name: "Gender",
    values: ["Men", "Women", "Unisex", "Boys", "Girls", "Kids", "Teen"],
  },
  {
    name: "Season",
    values: [
      "Summer",
      "Winter",
      "Spring",
      "Autumn",
      "All Season",
      "Monsoon",
    ],
  },
  {
    name: "Care",
    values: [
      "Machine Wash",
      "Hand Wash",
      "Dry Clean Only",
      "Do Not Bleach",
      "Iron Safe",
      "Wash Separately",
    ],
  },
  {
    name: "Style",
    values: [
      "Casual",
      "Formal",
      "Sporty",
      "Classic",
      "Modern",
      "Vintage",
      "Bohemian",
      "Streetwear",
      "Ethnic",
      "Western",
    ],
  },
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

const inputStyle = {
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

  // ----------------------------------------------------------------
  // Product Query
  // ----------------------------------------------------------------
  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  // ----------------------------------------------------------------
  // Update Mutation
  // ----------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(isEditMode ? "Variant updated!" : "Variant added!");
      router.push(`/admin/products/${id}`);
    },
    onError: (err) => {
      console.error("Save Error:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to save variant."
      );
    },
  });

  // ----------------------------------------------------------------
  // Initialize Form Data – FILTER OUT sku_8 AND sku_7
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!product || initialized) return;

    // Build existing variants from product
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
        name,
        value: String(value),
        isCustom: false,
      })),
      images: (v.images || []).map((img) => ({
        existing: true,
        metadata: img,
        preview: getImageUrl(img.img_url),
      })),
    }));

    // ===== REMOVE sku_8 AND sku_7 (case‑insensitive) =====
    const filteredVariants = existingVariants.filter(
      (v) => {
        const sku = (v.sku || "").trim().toLowerCase();
        return sku !== "sku_8" && sku !== "sku_7";
      }
    );

    let finalVariants;
    let expandIndex;

    if (isEditMode) {
      // Edit mode: show ONLY the selected variant
      const selectedVariant = filteredVariants.find(
        (v) => String(v._id) === String(editVariantId)
      );

      finalVariants = selectedVariant ? [selectedVariant] : [];
      expandIndex = 0;
    } else {
      // Add mode: show ONLY a new empty variant
      const newVariant = createEmptyVariant("");
      finalVariants = [newVariant];
      expandIndex = 0;
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

    // Auto‑generate SKU for the new variant if not in edit mode
    if (!isEditMode) {
      variantApi
        .getNextSku()
        .then((res) => {
          setFormData((prev) => {
            if (!prev) return prev;
            const variants = [...prev.variants];
            variants[variants.length - 1] = {
              ...variants[variants.length - 1],
              sku: res.sku,
            };
            return { ...prev, variants };
          });
        })
        .catch((error) => {
          console.error("SKU Error:", error);
          toast.error("SKU auto‑generate failed");
        });
    }
  }, [product, initialized, isEditMode, editVariantId]);

  // ----------------------------------------------------------------
  // Duplicate / Remove / Update helpers (unchanged)
  // ----------------------------------------------------------------
  const duplicateVariant = async (index) => {
    try {
      const result = await variantApi.getNextSku();
      const old = formData.variants[index];
      const copy = {
        ...old,
        _id: null,
        sku: result.sku,
        attributes: old.attributes.map((item) => ({ ...item })),
        images: [],
      };
      setFormData((prev) => {
        const variants = [...prev.variants];
        variants.splice(index + 1, 0, copy);
        return { ...prev, variants };
      });
      setExpandedVariant(index + 1);
    } catch (error) {
      console.error("Duplicate Error:", error);
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
    if (expandedVariant === index) setExpandedVariant(-1);
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[index] = { ...variants[index], [field]: value };
      return { ...prev, variants };
    });
  };

  const addAttribute = (vi) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[vi] = {
        ...variants[vi],
        attributes: [...variants[vi].attributes, { name: "", value: "", isCustom: false }],
      };
      return { ...prev, variants };
    });
  };

  const updateAttribute = (vi, ai, field, value) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      const attributes = [...variants[vi].attributes];
      attributes[ai] = { ...attributes[ai], [field]: value };
      variants[vi] = { ...variants[vi], attributes };
      return { ...prev, variants };
    });
  };

  const removeAttribute = (vi, ai) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[vi] = {
        ...variants[vi],
        attributes: variants[vi].attributes.filter((_, i) => i !== ai),
      };
      return { ...prev, variants };
    });
  };

  // ----------------------------------------------------------------
  // Image compression & upload
  // ----------------------------------------------------------------
  const compressProductImage = (file) =>
    new Promise((resolve) => {
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);
      image.onload = () => {
        const MAX = 1400;
        let width = image.width,
          height = image.height;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
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
            resolve(
              new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, "") + ".webp",
                { type: "image/webp", lastModified: Date.now() }
              )
            );
          },
          "image/webp",
          0.82
        );
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        resolve(file);
      };
      image.src = imageUrl;
    });

  const handleImageUpload = async (vi, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );
    if (valid.length !== files.length) {
      toast.error("Only JPG, PNG and WebP allowed");
    }
    try {
      const compressed = await Promise.all(valid.map((file) => compressProductImage(file)));
      const imgs = compressed.map((file) => ({
        file,
        existing: false,
        preview: URL.createObjectURL(file),
      }));
      setFormData((prev) => {
        const variants = [...prev.variants];
        variants[vi] = { ...variants[vi], images: [...variants[vi].images, ...imgs] };
        return { ...prev, variants };
      });
      toast.success("Image optimized");
    } catch (error) {
      console.error("Image Error:", error);
      toast.error("Image processing failed");
    }
    e.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      const image = variants[vi].images[ii];
      if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
      variants[vi] = {
        ...variants[vi],
        images: variants[vi].images.filter((_, i) => i !== ii),
      };
      return { ...prev, variants };
    });
  };

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("========== SAVE VARIANT CLICKED ==========");
    if (!id) {
      toast.error("Product ID missing");
      return;
    }
    if (!formData || !formData.variants?.length) {
      toast.error("At least one variant is required");
      return;
    }

    try {
      const skuSet = new Set();
      for (const variant of formData.variants) {
        const sku = (variant.sku || "").trim();
        if (!sku) {
          toast.error("SKU is required");
          return;
        }
        if (skuSet.has(sku)) {
          toast.error(`Duplicate SKU: ${sku}`);
          return;
        }
        skuSet.add(sku);

        const title = (variant.title || "").trim();
        if (!title) {
          toast.error("Variant title is required");
          return;
        }
        if (variant.cost_price === "" || variant.selling_price === "") {
          toast.error("Cost & Selling price required");
          return;
        }
        if (Number(variant.selling_price) <= Number(variant.cost_price)) {
          toast.error(`Selling Price must be greater than Cost Price for "${title}"`);
          return;
        }
      }

      const data = new FormData();
      data.append("category_id", formData.category_id || "");
      data.append("brand_id", formData.brand_id || "");
      data.append("name", (formData.name || "").trim());
      data.append("description", formData.description || "");
      data.append("tax", formData.tax || "0");
      data.append("status", formData.status || "active");

      const imageVariantIndexes = [];

      const variants = formData.variants.map((variant, index) => {
        const attributes = {};
        (variant.attributes || []).forEach((attribute) => {
          const name = (attribute.name || "").trim();
          if (name) attributes[name] = attribute.value || "";
        });

        const existingImages = (variant.images || [])
          .filter((image) => image.existing)
          .map((image) => image.metadata);

        (variant.images || [])
          .filter((image) => !image.existing && image.file)
          .forEach((image) => {
            data.append("images", image.file);
            imageVariantIndexes.push(index);
          });

        let finalSku = (variant.sku || "").trim();
        if (product) {
          const original = product.variants?.find(
            (orig) => orig._id && String(orig._id) === String(variant._id)
          );
          if (original) finalSku = original.sku;
        }

        return {
          _id: variant._id || undefined,
          sku: finalSku,
          title: (variant.title || "").trim(),
          description: variant.description || "",
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

      console.log("Product ID:", id);
      console.log("Variants:", variants);
      console.log("Image Indexes:", imageVariantIndexes);

      updateMutation.mutate({ id, data });
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("An unexpected error occurred");
    }
  };

  // ----------------------------------------------------------------
  // Loading / Error states
  // ----------------------------------------------------------------
  if (isLoading || !formData) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-[9999]"
        style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      >
        <div
          className="rounded-xl py-12 px-16 flex flex-col items-center gap-3"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Failed to load product
          </p>
          <button
            type="button"
            onClick={() => router.push(`/admin/products/${id}`)}
            className="mt-4 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // Main Render
  // Add mode intentionally renders ONLY the variant form.
  // Existing product variants are never shown above the form.
  // ----------------------------------------------------------------
  return (
    <>
      {/* Background Overlay */}
      <div
        className="fixed inset-0 z-[9999]"
        style={{
          backgroundColor: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(5px)",
        }}
        onClick={() => router.push(`/admin/products/${id}`)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-4xl rounded-xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
          style={{
            maxHeight: "90vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto custom-scrollbar"
          >
            <div className="p-6 space-y-6">
              {formData.variants.length > 0 && (() => {
                const variant = formData.variants[0];
                const index = 0;

                return (
                  <div className="space-y-6">
                    {/* Identification */}
                    <div className="space-y-3">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Identification
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            className="block text-xs mb-1.5 font-medium"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            SKU <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. sku_4"
                            value={variant.sku}
                            readOnly={!!variant._id}
                            onChange={(ev) =>
                              updateVariant(index, "sku", ev.target.value)
                            }
                            className="h-9 px-3 rounded-lg text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label
                            className="block text-xs mb-1.5 font-medium"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Variant Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. Black - Large"
                            value={variant.title}
                            onChange={(ev) =>
                              updateVariant(index, "title", ev.target.value)
                            }
                            className="h-9 px-3 rounded-lg text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          className="block text-xs mb-1.5 font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Variant Description
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Optional description..."
                          value={variant.description}
                          onChange={(ev) =>
                            updateVariant(index, "description", ev.target.value)
                          }
                          className="px-3 py-2 rounded-lg text-sm w-full outline-none resize-none focus:ring-1 focus:ring-[var(--accent)]"
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    {/* Pricing & Stock */}
                    <div className="space-y-3">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Pricing & Stock
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[
                          { l: "Cost Price", f: "cost_price", p: "0.00", req: true },
                          { l: "Selling Price", f: "selling_price", p: "0.00", req: true },
                          { l: "Quantity", f: "quantity", p: "0", req: false },
                          { l: "Min Qty", f: "min_qnt", p: "0", req: false },
                          { l: "Max Qty", f: "max_qnt", p: "0", req: false },
                        ].map(({ l, f, p: placeholder, req }) => (
                          <div key={f}>
                            <label
                              className="block text-xs mb-1.5 font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {l}
                              {req && <span className="text-red-500"> *</span>}
                            </label>
                            <input
                              required={req}
                              type="number"
                              min="0"
                              placeholder={placeholder}
                              value={variant[f]}
                              onChange={(ev) =>
                                updateVariant(index, f, ev.target.value)
                              }
                              className="h-9 px-3 rounded-lg text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]"
                              style={inputStyle}
                            />
                          </div>
                        ))}
                      </div>

                      {variant.cost_price !== "" &&
                        variant.selling_price !== "" &&
                        Number(variant.selling_price) <= Number(variant.cost_price) && (
                          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                            <p className="text-xs font-medium text-red-500">
                              Selling Price must be greater than Cost Price
                            </p>
                          </div>
                        )}
                    </div>

                    {/* Attributes */}
                    <div className="space-y-3">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Attributes
                      </p>

                      <div className="space-y-3">
                        {variant.attributes.map((attr, ai) => {
                          const preset = ATTRIBUTE_PRESETS.find(
                            (p) => p.name === attr.name
                          );
                          const isCustom = !!attr.isCustom;

                          return (
                            <div key={ai} className="flex flex-wrap items-center gap-2">
                              <select
                                value={attr.name}
                                onChange={(ev) => {
                                  setFormData((prev) => {
                                    const variants = [...prev.variants];
                                    const attributes = [...variants[index].attributes];
                                    attributes[ai] = {
                                      ...attributes[ai],
                                      name: ev.target.value,
                                      value: "",
                                      isCustom: false,
                                    };
                                    variants[index] = {
                                      ...variants[index],
                                      attributes,
                                    };
                                    return { ...prev, variants };
                                  });
                                }}
                                className="h-9 px-3 rounded-lg text-sm min-w-[140px] flex-1 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                style={inputStyle}
                              >
                                <option value="">Select attribute</option>
                                {ATTRIBUTE_PRESETS.map((p) => (
                                  <option key={p.name} value={p.name}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>

                              {preset ? (
                                <>
                                  <select
                                    value={isCustom ? "__custom__" : attr.value}
                                    onChange={(ev) => {
                                      const value = ev.target.value;
                                      setFormData((prev) => {
                                        const variants = [...prev.variants];
                                        const attributes = [...variants[index].attributes];
                                        attributes[ai] = {
                                          ...attributes[ai],
                                          isCustom: value === "__custom__",
                                          value:
                                            value === "__custom__"
                                              ? preset.name === "Color"
                                                ? "#000000"
                                                : ""
                                              : value,
                                        };
                                        variants[index] = {
                                          ...variants[index],
                                          attributes,
                                        };
                                        return { ...prev, variants };
                                      });
                                    }}
                                    className="h-9 px-3 rounded-lg text-sm min-w-[140px] flex-1 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                    style={inputStyle}
                                  >
                                    {preset.values.map((v) => (
                                      <option key={v} value={v}>
                                        {v}
                                      </option>
                                    ))}
                                    <option value="__custom__">+ Custom Value</option>
                                  </select>

                                  {isCustom && preset.name === "Color" ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        type="color"
                                        value={attr.value || "#000000"}
                                        onChange={(ev) =>
                                          updateAttribute(index, ai, "value", ev.target.value)
                                        }
                                        className="w-9 h-9 cursor-pointer rounded-lg border border-[var(--border-color)] bg-transparent"
                                      />
                                      <span
                                        className="text-xs font-mono"
                                        style={{ color: "var(--text-muted)" }}
                                      >
                                        {attr.value || "#000000"}
                                      </span>
                                    </div>
                                  ) : isCustom ? (
                                    <input
                                      type="text"
                                      placeholder="Enter custom value..."
                                      value={attr.value}
                                      onChange={(ev) =>
                                        updateAttribute(index, ai, "value", ev.target.value)
                                      }
                                      className="h-9 px-3 rounded-lg text-sm flex-1 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                      style={inputStyle}
                                    />
                                  ) : null}
                                </>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Value e.g. Black"
                                  value={attr.value}
                                  onChange={(ev) =>
                                    updateAttribute(index, ai, "value", ev.target.value)
                                  }
                                  className="h-9 px-3 rounded-lg text-sm flex-1 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                  style={inputStyle}
                                />
                              )}

                              <button
                                type="button"
                                title="Remove Attribute"
                                onClick={() => removeAttribute(index, ai)}
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition hover:bg-red-500/10"
                                style={{
                                  color: "#f87171",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => addAttribute(index)}
                          className="flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition"
                          style={{
                            color: "var(--accent)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          Add Attribute
                        </button>
                      </div>
                    </div>

                    {/* Product Images */}
                    <div className="space-y-3">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Product Images
                      </p>

                      <label
                        className="block cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]/50"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <input
                          hidden
                          multiple
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(ev) => handleImageUpload(index, ev)}
                        />

                        <Upload
                          className="mx-auto mb-2 w-5 h-5"
                          style={{ color: "var(--text-muted)" }}
                        />

                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Click to select images
                        </p>

                        <p
                          className="text-xs mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          JPG, PNG or WebP • Auto-optimized
                        </p>
                      </label>

                      {variant.images.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {variant.images.map((image, imageIndex) => (
                            <div key={imageIndex} className="relative group">
                              <img
                                src={image.preview}
                                alt=""
                                className="h-20 w-20 rounded-lg object-cover border border-[var(--border-color)]"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index, imageIndex)}
                                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div
              className="sticky bottom-0 px-6 py-4 flex items-center justify-between bg-[var(--bg-card)] border-t"
              style={{ borderColor: "var(--border-color)" }}
            >
              <button
                type="button"
                onClick={() => router.push(`/admin/products/${id}`)}
                className="h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition hover:bg-[var(--bg-tertiary)]"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-9 px-6 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 transition hover:opacity-90 shadow-lg shadow-green-900/20"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-text)",
                  border: "none",
                  cursor: updateMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {updateMutation.isPending ? (
                  <>
                    <div
                      className="w-4 h-4 animate-spin rounded-full border-2 border-t-transparent"
                      style={{
                        borderColor: "var(--accent-text)",
                        borderTopColor: "transparent",
                      }}
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    {isEditMode ? "Update Variant" : "Save Variant"}
                    <Check className="w-4 h-4" />
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