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
// Professional Hierarchical Attribute Group Component
// Renders: Main Attribute (e.g. Processor) → Sub-Attributes
// (e.g. Brand, Series) → Values (e.g. Intel)
//
// Storage shape (preserved in DB):
//   { "Processor": { "Brand": "Intel", "Series": "Core i5" }, ... }
// ===========================================================
function HierarchicalAttributeGroup({ mainAttribute, selectedValues, onChange }) {
  const [expanded, setExpanded] = useState(true);

  const subAttributes = Array.isArray(mainAttribute.sub_attributes)
    ? mainAttribute.sub_attributes
    : [];

  const directValues = Array.isArray(mainAttribute.values)
    ? mainAttribute.values.map((v) => (typeof v === "string" ? v : v?.label || v?.value)).filter(Boolean)
    : [];

  const mainGroup = selectedValues?.[mainAttribute.name] || {};
  const totalSelected = subAttributes.reduce(
    (acc, sub) => acc + (mainGroup?.[sub.name] ? 1 : 0),
    0
  );

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-tertiary)",
        border: "1px solid var(--border-color)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full px-4 py-3 flex items-center justify-between text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            {mainAttribute.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {mainAttribute.name}
            </p>
            <p
              className="text-[11px] truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {subAttributes.length > 0
                ? `${subAttributes.length} sub-attribute${subAttributes.length !== 1 ? "s" : ""}${totalSelected > 0 ? ` • ${totalSelected} selected` : ""}`
                : `${directValues.length} value${directValues.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 pt-1 space-y-3 border-t"
          style={{ borderColor: "var(--border-color)" }}
        >
          {subAttributes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              {subAttributes.map((sub) => {
                const subValues = Array.isArray(sub.values)
                  ? sub.values
                      .map((v) => (typeof v === "string" ? v : v?.label || v?.value))
                      .filter(Boolean)
                  : [];

                return (
                  <SubAttributeSelect
                    key={sub._id}
                    subAttribute={sub}
                    values={subValues}
                    selectedValue={mainGroup?.[sub.name] || ""}
                    onChange={(val) => onChange(mainAttribute.name, sub.name, val)}
                  />
                );
              })}
            </div>
          ) : directValues.length > 0 ? (
            <div className="pt-3">
              <SubAttributeSelect
                subAttribute={{ _id: mainAttribute._id, name: mainAttribute.name }}
                values={directValues}
                selectedValue={mainGroup?.[mainAttribute.name] || ""}
                onChange={(val) => onChange(mainAttribute.name, mainAttribute.name, val)}
              />
            </div>
          ) : (
            <p
              className="text-[11px] text-center py-3"
              style={{ color: "var(--text-muted)" }}
            >
              No sub-attributes defined.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================
// Professional Sub-Attribute Select (Dropdown with search)
// ===========================================================
function SubAttributeSelect({ subAttribute, values, selectedValue, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = values.filter((v) =>
    String(v).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-1.5">
      <label
        className="block text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {subAttribute.name}
      </label>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="w-full h-9 px-3 rounded-lg text-sm flex items-center justify-between outline-none transition focus:ring-1 focus:ring-[var(--accent)]"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: selectedValue ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          <span className="truncate">{selectedValue || `Select ${subAttribute.name}...`}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            style={{ color: "var(--text-muted)" }}
          />
        </button>

        {open && (
          <div
            className="absolute z-50 mt-1 w-full rounded-lg shadow-lg overflow-hidden"
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
                placeholder={`Search ${subAttribute.name}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 px-2 text-xs rounded outline-none"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
                autoFocus
              />
            </div>

            <div className="max-h-48 overflow-y-auto py-1">
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
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2"
                    style={{
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : ""}`}
                      style={
                        !isSelected
                          ? { borderColor: "var(--border-color)" }
                          : undefined
                      }
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {v}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div
                  className="px-3 py-2 text-xs text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  No values found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
  // Category Attributes Hierarchy Query (Main → Sub → Values)
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
  // Initialize variant attributes state from the loaded variant data.
  // Stored as: { MainAttributeName: { SubAttributeName: value } }
  // This preserves the Main → Sub → Value hierarchy in the database.
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

    // Build a flat id → attribute map for lookup
    const flat = [];
    const collect = (nodes) => {
      nodes.forEach((n) => {
        flat.push(n);
        if (n.sub_attributes?.length) collect(n.sub_attributes);
      });
    };
    collect(categoryAttributesTree);

    const byId = new Map(flat.map((a) => [String(a._id), a]));

    // Detect the saved shape:
    //   1) Hierarchical: { MainName: { SubName: value } } → hydrate as-is.
    //   2) Flat id → value: rebuild by resolving ids against the category tree.
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
      // Defer to next tick to avoid cascading-render warnings.
      Promise.resolve().then(() => {
        setVariantAttributes(next);
        initAttrsRef.current = true;
      });
    }
  }, [product, initialized, categoryAttributesTree, isEditMode, editVariantId]);

  // Reset the initializer ref when leaving edit mode / new variant creation
  useEffect(() => {
    if (!isEditMode) initAttrsRef.current = false;
  }, [isEditMode]);

  // Update a single sub-attribute's selected value, preserving the
  // Main Attribute → Sub-Attribute → Value hierarchy.
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

      // ✅ FIXED: Ensure attributes object is explicitly sent as empty {}
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
          max_qnt: Number(v.max_qnt || 0),
          // ✅ Persist hierarchical (Main → Sub → Value) selections as a flat map
          // keyed by the sub-attribute id; the backend stores it as Mixed so the
          // structure is preserved on read.
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

  const variant = formData.variants[0];

  // ----------------------------------------------------------------
  // Main Render
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
                      onChange={(ev) => updateVariant("sku", ev.target.value)}
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
                      onChange={(ev) => updateVariant("title", ev.target.value)}
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
                    onChange={(ev) => updateVariant("description", ev.target.value)}
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
                        onChange={(ev) => updateVariant(f, ev.target.value)}
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

              {/* Category Attributes (Main Attribute → Sub-Attribute → Values) */}
              {categoryAttributesTree.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Layers className="w-3 h-3" />
                      Category Attributes
                    </p>
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {categoryAttributesTree.length} main attribute
                      {categoryAttributesTree.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {categoryAttributesTree.map((mainAttr) => (
                      <HierarchicalAttributeGroup
                        key={mainAttr._id}
                        mainAttribute={mainAttr}
                        selectedValues={variantAttributes}
                        onChange={updateVariantAttribute}
                      />
                    ))}
                  </div>
                </div>
              )}

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
                    onChange={handleImageUpload}
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
                          onClick={() => removeImage(imageIndex)}
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