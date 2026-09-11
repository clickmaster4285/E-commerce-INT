"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Check,
  ArrowLeft,
  ChevronDown,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { variantApi } from "@/apis/admin/variantApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";

const API_ORIGIN =
  process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

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
  images: [],
});

// ===========================================================
// Compact Sub-Attribute Select
// ===========================================================
function SubAttributeSelect({ subAttribute, values, selectedValue, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState("");
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  // Derive value objects from subAttribute (database source of truth) with local update support
  const [localValueObjects, setLocalValueObjects] = useState(() => {
    if (subAttribute?.values && Array.isArray(subAttribute.values)) return subAttribute.values;
    if (Array.isArray(values) && values.length) return values.map((v, i) => ({ label: String(v), value: String(v), sort_order: i, is_active: true }));
    return [];
  });

  // Sync when prop updates
  useEffect(() => {
    if (subAttribute?.values && Array.isArray(subAttribute.values)) {
      setLocalValueObjects(subAttribute.values);
    }
  }, [subAttribute?.values]);

  const valueObjects = localValueObjects;

  const stringValues = valueObjects.map((v) => String(v?.label || v?.value || v || "").trim()).filter(Boolean);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = stringValues.filter((v) =>
    String(v).toLowerCase().includes(search.toLowerCase())
  );

  const handleAddNew = async () => {
    const trimmed = addText.trim();
    if (!trimmed) {
      setAddError("Enter a value.");
      return;
    }

    const exists = valueObjects.some(
      (v) => String(v?.value || v?.label || v).trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setAddError("Value already exists.");
      return;
    }

    setSaving(true);
    setAddError("");
    try {
      const updatedValues = [
        ...valueObjects,
        { label: trimmed, value: trimmed, sort_order: valueObjects.length, is_active: true },
      ];
      await attributeApi.update(subAttribute._id, { values: updatedValues });
      setLocalValueObjects(updatedValues);
      setAddText("");
      setShowAdd(false);
      setOpen(false);
      onChange(trimmed);
      toast.success(`Added "${trimmed}"`);
    } catch (err) {
      console.error("Add value error:", err);
      setAddError("Failed to save value.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowAdd(false);
    setAddText("");
    setAddError("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter") {
      handleAddNew();
    }
  };

  return (
    <div ref={dropdownRef}>
      {!showAdd ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setOpen((p) => !p);
              if (showAdd) setShowAdd(false);
            }}
            className="w-full h-10 px-3 rounded-lg text-sm flex items-center justify-between outline-none transition border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: "var(--border-color)",
              color: selectedValue ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <span className="truncate">{selectedValue || `Select...`}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              style={{ color: "var(--text-muted)" }}
            />
          </button>

          {open && (
            <div
              className="absolute z-50 mt-1 w-full rounded-lg shadow-xl overflow-hidden"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                className="p-2 border-b"
                style={{ borderColor: "var(--border-color)" }}
              >
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs rounded outline-none border"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                />
              </div>
              <div
                className="flex flex-col"
                style={{ maxHeight: "260px" }}
              >
                <div className="overflow-y-auto">
                  <div className="py-1">
                    {filtered.map((v) => {
                      const isSelected = String(selectedValue) === String(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            onChange(isSelected ? "" : v);
                            setOpen(false);
                            setSearch("");
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2.5"
                          style={{
                            color: isSelected ? "var(--accent)" : "var(--text-primary)",
                          }}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : ""}`}
                            style={{
                              borderColor: isSelected ? undefined : "var(--border-color)",
                            }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className="truncate">{v}</span>
                        </button>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div
                        className="px-3 py-2.5 text-xs text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No values found
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="border-t shrink-0 bg-[var(--bg-card)]"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdd(true);
                      setOpen(false);
                      setSearch("");
                      setAddError("");
                      setAddText("");
                      onChange("");
                    }}
                    className="w-full px-3 py-2.5 text-left text-xs font-semibold transition hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                    style={{ color: "var(--accent)" }}
                  >
                    <span>+</span>
                    <span>Add new value</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Enter new value..."
            value={addText}
            onChange={(e) => {
              setAddText(e.target.value);
              setAddError("");
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 h-10 px-3 rounded-lg text-sm outline-none border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: addError ? "#ef4444" : "var(--border-color)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddNew}
            disabled={saving || !addText.trim()}
            className="h-10 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 transition shrink-0"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              cursor: saving || !addText.trim() ? "not-allowed" : "pointer",
            }}
          >
            {saving ? (
              <div
                className="w-3 h-3 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--accent-text)", borderTopColor: "transparent" }}
              />
            ) : (
              "Add"
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="h-10 px-3 rounded-lg text-xs font-medium inline-flex items-center transition hover:bg-[var(--bg-tertiary)] shrink-0"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {addError && (
        <p className="text-[11px] text-red-500 mt-1">{addError}</p>
      )}
    </div>
  );
}

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
  const [initialized, setInitialized] = useState(false);
  const [variantAttributes, setVariantAttributes] = useState({});

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
  // Category Attributes Hierarchy Query
  // ----------------------------------------------------------------
  const categoryId = product?.category_id?._id || product?.category_id || null;

  const {
    data: categoryAttributesTree = [],
  } = useQuery({
    queryKey: ["category-attributes-hierarchy", categoryId],
    queryFn: () => categoryApi.getAttributesHierarchy(categoryId),
    enabled: !!categoryId,
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
      const tabParam = searchParams?.get("tab");
      const redirectUrl = `/admin/products/${id}${tabParam ? `?tab=${tabParam}` : ""}`;
      router.push(redirectUrl);
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
  // Initialize Form Data
  // ----------------------------------------------------------------
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
      attributes: v.attributes || {},
      images: (v.images || []).map((img) => ({
        existing: true,
        metadata: img,
        preview: getImageUrl(img.img_url),
      })),
    }));

    let finalVariants;

    if (isEditMode) {
      const selectedVariant = existingVariants.find(
        (v) => String(v._id) === String(editVariantId)
      );
      finalVariants = selectedVariant ? [selectedVariant] : [];
    } else {
      finalVariants = [createEmptyVariant("")];
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

    setInitialized(true);

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
          toast.error("SKU auto-generate failed");
        });
    }
  }, [product, initialized, isEditMode, editVariantId]);

  // ----------------------------------------------------------------
  // Update helpers
  // ----------------------------------------------------------------
  const updateVariant = (field, value) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[0] = { ...variants[0], [field]: value };
      return { ...prev, variants };
    });
  };

  // ----------------------------------------------------------------
  // Initialize variant attributes state
  // ----------------------------------------------------------------
  const initAttrsRef = useRef(false);
  useEffect(() => {
    if (!product || !initialized || !categoryAttributesTree.length) return;
    if (initAttrsRef.current) return;

    const variantData = (product.variants || []).find(
      (v) => isEditMode && String(v._id) === String(editVariantId)
    );
    const existingAttributes = variantData?.attributes || {};
    if (!existingAttributes || Object.keys(existingAttributes).length === 0) return;

    const flat = [];
    const collect = (nodes) => {
      nodes.forEach((n) => {
        flat.push(n);
        if (n.sub_attributes?.length) collect(n.sub_attributes);
      });
    };
    collect(categoryAttributesTree);

    const byId = new Map(flat.map((a) => [String(a._id), a]));

    const isHierarchical = (val) =>
      val && typeof val === "object" && !Array.isArray(val) &&
      Object.values(val).every(
        (v) => v && typeof v === "object" && !Array.isArray(v)
      );

    let next;
    if (isHierarchical(existingAttributes)) {
      next = existingAttributes;
    } else {
      next = {};
      Object.entries(existingAttributes).forEach(([key, raw]) => {
        const value = raw && typeof raw === "object" ? raw.value : raw;
        const idHint = raw && typeof raw === "object" ? raw.id : null;
        const attr = byId.get(String(idHint || key));
        if (!attr) return;
        const mainName = attr.parent_attribute_id
          ? byId.get(String(attr.parent_attribute_id))?.name
          : attr.name;
        if (!mainName) return;
        if (!next[mainName]) next[mainName] = {};
        next[mainName][attr.name] = value;
      });
    }

    if (next && Object.keys(next).length > 0) {
      Promise.resolve().then(() => {
        setVariantAttributes(next);
        initAttrsRef.current = true;
      });
    }
  }, [product, initialized, categoryAttributesTree, isEditMode, editVariantId]);

  useEffect(() => {
    if (!isEditMode) initAttrsRef.current = false;
  }, [isEditMode]);

  const updateVariantAttribute = (mainName, subName, value) => {
    setVariantAttributes((prev) => {
      const next = { ...prev };
      const mainGroup = { ...(next[mainName] || {}) };
      if (value === "" || value === null || value === undefined) {
        delete mainGroup[subName];
      } else {
        mainGroup[subName] = value;
      }
      if (Object.keys(mainGroup).length === 0) {
        delete next[mainName];
      } else {
        next[mainName] = mainGroup;
      }
      return next;
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

  const handleImageUpload = async (e) => {
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
        variants[0] = { ...variants[0], images: [...variants[0].images, ...imgs] };
        return { ...prev, variants };
      });
      toast.success("Image optimized");
    } catch (error) {
      console.error("Image Error:", error);
      toast.error("Image processing failed");
    }
    e.target.value = "";
  };

  const removeImage = (ii) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      const image = variants[0].images[ii];
      if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
      variants[0] = {
        ...variants[0],
        images: variants[0].images.filter((_, i) => i !== ii),
      };
      return { ...prev, variants };
    });
  };

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!id) {
      toast.error("Product ID missing");
      return;
    }
    if (!formData || !formData.variants?.length) {
      toast.error("At least one variant is required");
      return;
    }

    try {
      const variant = formData.variants[0];
      const sku = (variant.sku || "").trim();
      if (!sku) {
        toast.error("SKU is required");
        return;
      }

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

      const data = new FormData();
      data.append("category_id", formData.category_id || "");
      data.append("brand_id", formData.brand_id || "");
      data.append("name", (formData.name || "").trim());
      data.append("description", formData.description || "");
      data.append("tax", formData.tax || "0");
      data.append("status", formData.status || "active");

      const imageVariantIndexes = [];

      const variantsPayload = [variant].map((v, index) => {
        const existingImages = (v.images || [])
          .filter((image) => image.existing)
          .map((image) => image.metadata);

        (v.images || [])
          .filter((image) => !image.existing && image.file)
          .forEach((image) => {
            data.append("images", image.file);
            imageVariantIndexes.push(index);
          });

        let finalSku = (v.sku || "").trim();
        if (product) {
          const original = product.variants?.find(
            (orig) => orig._id && String(orig._id) === String(v._id)
          );
          if (original) finalSku = original.sku;
        }

        return {
          _id: v._id || undefined,
          sku: finalSku,
          title: (v.title || "").trim(),
          description: v.description || "",
          cost_price: Number(v.cost_price || 0),
          selling_price: Number(v.selling_price || 0),
          quantity: Number(v.quantity || 0),
          min_qnt: Number(v.min_qnt || 0),
          max_qnt: Number(v.max_qnt ?? 0),
          attributes: variantAttributes,
          existing_images: existingImages,
        };
      });

      data.append("variants", JSON.stringify(variantsPayload));
      data.append("image_variant_indexes", JSON.stringify(imageVariantIndexes));

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
        style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      >
        <div
          className="rounded-xl py-10 px-14 flex flex-col items-center gap-3"
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
            onClick={() => {
              const tabParam = searchParams?.get("tab");
              router.push(`/admin/products/${id}${tabParam ? `?tab=${tabParam}` : ""}`);
            }}
            className="mt-4 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const variant = formData.variants[0];

  return (
    <>
      {/* Background Overlay */}
      <div
        className="fixed inset-0 z-[9999]"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(5px)",
        }}
        onClick={() => router.push(`/admin/products/${id}`)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-start justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="w-full max-w-[780px] rounded-xl shadow-2xl flex flex-col pointer-events-auto my-6"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-3 mb-1.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                    Add New Variant
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Configure variant details for this product.
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-6">
              {/* Identification */}
              <section>
                <h3
                  className="text-[10px] font-bold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Identification
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      SKU <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. SKU-001"
                      value={variant.sku}
                      readOnly={!!variant._id}
                      onChange={(ev) => updateVariant("sku", ev.target.value)}
                      className="h-10 px-3 rounded-lg text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Variant Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Black / Large"
                      value={variant.title}
                      onChange={(ev) => updateVariant("title", ev.target.value)}
                      className="h-10 px-3 rounded-lg text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Variant Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional description..."
                    value={variant.description}
                    onChange={(ev) => updateVariant("description", ev.target.value)}
                    className="px-3 py-2.5 rounded-lg text-sm w-full outline-none resize-none focus:ring-1 focus:ring-[var(--accent)]"
                    style={inputStyle}
                  />
                </div>
              </section>

              {/* Category Attributes */}
              {categoryAttributesTree.length > 0 && (
                <section>
                  <div className="mb-3">
                    <h3
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Category Attributes
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryAttributesTree.map((mainAttr) => {
                      const subAttributes = Array.isArray(mainAttr.sub_attributes)
                        ? mainAttr.sub_attributes
                        : [];
                      const directValues = Array.isArray(mainAttr.values)
                        ? mainAttr.values
                            .map((v) => (typeof v === "string" ? v : v?.label || v?.value))
                            .filter(Boolean)
                        : [];

                      const mainGroup = variantAttributes?.[mainAttr.name] || {};

                      // If sub-attributes exist, render each sub-attribute as its own card in the 2-col grid
                      if (subAttributes.length > 0) {
                        return subAttributes.map((sub) => {
                          const subValues = Array.isArray(sub.values)
                            ? sub.values
                                .map((v) => (typeof v === "string" ? v : v?.label || v?.value))
                                .filter(Boolean)
                            : [];
                          return (
                            <div key={`${mainAttr._id}-${sub._id}`} className="space-y-1.5">
                              <label
                                className="block text-xs font-medium"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {sub.name}
                              </label>
                              <SubAttributeSelect
                                subAttribute={sub}
                                values={subValues}
                                selectedValue={mainGroup?.[sub.name] || ""}
                                onChange={(val) => updateVariantAttribute(mainAttr.name, sub.name, val)}
                              />
                            </div>
                          );
                        });
                      }

                      // Direct attribute (no sub-attributes)
                      if (directValues.length > 0) {
                        return (
                          <div key={mainAttr._id} className="space-y-1.5">
                            <label
                              className="block text-xs font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {mainAttr.name}
                            </label>
                            <SubAttributeSelect
                              subAttribute={{ _id: mainAttr._id, name: mainAttr.name }}
                              values={directValues}
                              selectedValue={mainGroup?.[mainAttr.name] || ""}
                              onChange={(val) => updateVariantAttribute(mainAttr.name, mainAttr.name, val)}
                            />
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </section>
              )}

              {/* Pricing & Stock */}
              <section>
                <h3
                  className="text-[10px] font-bold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Pricing & Stock
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { l: "Cost Price", f: "cost_price", p: "0.00", req: true },
                    { l: "Selling Price", f: "selling_price", p: "0.00", req: true },
                    { l: "Quantity", f: "quantity", p: "0", req: false },
                    { l: "Min Qty", f: "min_qnt", p: "0", req: false },
                    { l: "Max Qty", f: "max_qnt", p: "0", req: false },
                  ].map(({ l, f, p: placeholder, req }) => (
                    <div key={f}>
                      <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        {l}
                        {req && <span className="text-red-500"> *</span>}
                      </label>
                      <input
                        required={req}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={placeholder}
                        value={variant[f]}
                        onChange={(ev) => updateVariant(f, ev.target.value)}
                        className="h-10 px-3 rounded-lg text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>

                {variant.cost_price !== "" &&
                  variant.selling_price !== "" &&
                  Number(variant.selling_price) <= Number(variant.cost_price) && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20 mt-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <p className="text-xs font-medium text-red-500">
                        Selling Price must be greater than Cost Price
                      </p>
                    </div>
                  )}
              </section>

              {/* Product Images */}
              <section>
                <h3
                  className="text-[10px] font-bold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Product Images
                </h3>

                <label
                  className="block cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]/30"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                  />
                  <Upload className="mx-auto mb-2 w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Click to select images
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    JPG, PNG or WebP • Auto-optimized
                  </p>
                </label>

                {variant.images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {variant.images.map((image, imageIndex) => (
                      <div key={imageIndex} className="relative group">
                        <img
                          src={image.preview}
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover border"
                          style={{ borderColor: "var(--border-color)" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(imageIndex)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex items-center justify-between border-t"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}
            >
              <button
                type="button"
                onClick={() => {
                  const tabParam = searchParams?.get("tab");
                  router.push(`/admin/products/${id}${tabParam ? `?tab=${tabParam}` : ""}`);
                }}
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
                className="h-9 px-5 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 transition hover:opacity-90"
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
                      className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-t-transparent"
                      style={{ borderColor: "var(--accent-text)", borderTopColor: "transparent" }}
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Variant <Check className="w-4 h-4" />
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
