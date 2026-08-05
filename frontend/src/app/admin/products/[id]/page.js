"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  ArrowLeft,
  Box,
  CalendarDays,
  CircleDollarSign,
  Layers3,
  Package,
  Tag,
  User,
  Clock,
  Activity,
  Pencil,
  TrendingUp,
  Database,
} from "lucide-react";

import { productApi } from "@/apis/productApi";

const API_ORIGIN =
  process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5000";

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_ORIGIN}${url}`;
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState("info");

  const id = params?.id;

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  // Edit button click par products page par redirect karo with edit query
  const handleEdit = () => {
    router.push(`/admin/products?edit=${id}`);
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

  return (
    <div className="space-y-6">
      {/* HEADER - EDIT BUTTON YAHAN HAI */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push("/admin/products")} className="rounded-lg p-2 transition hover:scale-105" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Manage product details, variants and track activity</p>
          </div>
        </div>

        {/* ✅ EDIT BUTTON - HEADER MEIN */}
        <button type="button" onClick={handleEdit} className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:scale-105" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <Pencil className="h-4 w-4" /> Edit Product
        </button>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Layers3} label="Total Variants" value={totalVariants} color="var(--info)" />
        <StatCard icon={Box} label="Total Stock" value={totalStock} color="var(--success)" />
        <StatCard icon={CircleDollarSign} label="Inventory Value" value={`Rs. ${totalValue.toLocaleString()}`} color="var(--accent)" />
        <StatCard icon={Database} label="Status" value={product.status} color={product.status === "active" ? "var(--success)" : "var(--danger)"} />
      </div>

      {/* TABS MENU */}
      <div className="flex gap-2 rounded-xl p-1.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <button type="button" onClick={() => setActiveTab("info")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${activeTab === "info" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Package className="h-4 w-4" /> Product Info
        </button>
        <button type="button" onClick={() => setActiveTab("variants")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${activeTab === "variants" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Layers3 className="h-4 w-4" /> Variants ({totalVariants})
        </button>
        <button type="button" onClick={() => setActiveTab("activity")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${activeTab === "activity" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          <Activity className="h-4 w-4" /> Activity
        </button>
      </div>

      {/* PRODUCT INFO TAB */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{product.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>{product.description || "No description available."}</p>
                </div>
                <StatusBadge status={product.status} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox icon={Layers3} label="Category" value={product.category_id?.name || "—"} />
                <InfoBox icon={Tag} label="Brand" value={product.brand_id?.name || "—"} />
                <InfoBox icon={CircleDollarSign} label="Tax Rate" value={`${product.tax || 0}%`} />
                <InfoBox icon={TrendingUp} label="Low Stock Alert" value={variants.some((v) => Number(v.quantity) <= Number(v.min_qnt)) ? "Yes" : "No"} color={variants.some((v) => Number(v.quantity) <= Number(v.min_qnt)) ? "var(--danger)" : "var(--success)"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VARIANTS TAB */}
      {activeTab === "variants" && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Product Variants</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Manage pricing, stock, attributes and images for each variant</p>
          </div>
          {variants.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="font-medium">No variants available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {variants.map((variant, index) => (
                <VariantCard key={variant._id} variant={variant} number={index + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY TAB - UPDATED SIRF TAB DIKHEGA JAB UPDATE HO */}
      {activeTab === "activity" && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Activity Log</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Track all changes and updates made to this product</p>
          </div>

          <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="p-6 space-y-6">
              
              {/* CREATED BY - HAMESHA SHOW */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(16,185,129,.15)" }}>
                  <User className="h-6 w-6" style={{ color: "var(--success)" }} />
                </div>
                <div className="flex-1 rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Product Created</h3>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(16,185,129,.15)", color: "var(--success)" }}>Initial</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      <span style={{ color: "var(--text-muted)" }}>Created by:</span>
                      <span className="font-medium">{product.createdby?.email || product.createdby || "Unknown User"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />
                      <span style={{ color: "var(--text-muted)" }}>Created on:</span>
                      <span className="font-medium">{product.created_at ? new Date(product.created_at).toLocaleString() : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* UPDATED BY - SIRF TAB SHOW JAB UPDATEDBY EXIST KARE */}
              {product.updatedby && (
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(59,130,246,.15)" }}>
                    <Activity className="h-6 w-6" style={{ color: "var(--info)" }} />
                  </div>
                  <div className="flex-1 rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Product Updated</h3>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(59,130,246,.15)", color: "var(--info)" }}>Modified</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4" style={{ color: "var(--accent)" }} />
                        <span style={{ color: "var(--text-muted)" }}>Updated by:</span>
                        <span className="font-medium">{product.updatedby?.email || product.updatedby || "Unknown User"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />
                        <span style={{ color: "var(--text-muted)" }}>Updated on:</span>
                        <span className="font-medium">{product.updated_at ? new Date(product.updated_at).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AGAR KABHI UPDATE NAHI HUA */}
              {!product.updatedby && (
                <div className="rounded-lg p-4 text-center text-sm" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                  No updates yet. Product is in its original state.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components (same as before)
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
          <p className="mt-2 text-2xl font-bold" style={{ color: color || "var(--text-primary)" }}>{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, number }) {
  const attributes = Object.entries(variant.attributes || {});
  const isLowStock = Number(variant.quantity) <= Number(variant.min_qnt);
  return (
    <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: "var(--bg-tertiary)" }}>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{variant.title || `Variant ${number}`}</p>
            {isLowStock && <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(239,68,68,.15)", color: "var(--danger)" }}>Low Stock</span>}
          </div>
          <p className="mt-1 text-xs font-mono" style={{ color: "var(--accent)" }}>{variant.sku}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div><span style={{ color: "var(--text-muted)" }}>Stock: </span><span className={`font-semibold ${isLowStock ? "text-red-500" : ""}`}>{variant.quantity || 0}</span></div>
        </div>
      </div>
      <div className="space-y-5 p-5">
        {variant.description && <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{variant.description}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SmallDetail label="Cost Price" value={`Rs. ${Number(variant.cost_price || 0).toLocaleString()}`} />
          <SmallDetail label="Selling Price" value={`Rs. ${Number(variant.selling_price || 0).toLocaleString()}`} />
          <SmallDetail label="Quantity" value={variant.quantity || 0} highlight={isLowStock} />
          <SmallDetail label="Min Qty" value={variant.min_qnt || 0} />
          <SmallDetail label="Max Qty" value={variant.max_qnt || 0} />
        </div>
        {attributes.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Attributes</p>
            <div className="flex flex-wrap gap-2">
              {attributes.map(([name, value]) => (
                <div key={name} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{name}: </span><span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {variant.images?.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Images</p>
            <div className="flex flex-wrap gap-3">
              {variant.images.map((image, index) => (
                <img key={index} src={getImageUrl(image.img_url)} alt={`${variant.title || variant.sku} ${index + 1}`} className="h-24 w-24 rounded-lg object-cover" style={{ border: "1px solid var(--border-color)" }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)" }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: color || "var(--accent)" }} />
        <p className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="font-semibold" style={{ color: color || "inherit" }}>{value ?? "—"}</p>
    </div>
  );
}

function SmallDetail({ label, value, highlight }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)", border: highlight ? "1px solid var(--danger)" : "none" }}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-red-500" : ""}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span className="inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize" style={{ backgroundColor: active ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)", color: active ? "var(--success)" : "var(--danger)" }}>
      {status}
    </span>
  );
}