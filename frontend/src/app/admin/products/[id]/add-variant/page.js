"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Check,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { variantApi } from "@/apis/admin/variantApi";

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
          attributes: {}, // Explicitly send empty attributes object
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