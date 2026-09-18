"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brandApi } from "../../../../apis/admin/brandApi";
import { productApi } from "../../../../apis/admin/productApi";
import { useBrandSocketSync } from "@/hooks/useBrandSocketSync.js";

/* =========================================================
   ICONS & HELPERS
========================================================= */
function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d={d} />
    </svg>
  );
}

const D = {
  back: "M15 19l-7-7 7-7",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  link: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  check: "M5 13l4 4L19 7",
  globe: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  chevron: "M9 5l7 7-7 7",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  minus: "M20 12H4",
};

function ini(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function logoUrl(brand) {
  if (brand?.logo?.img_url) {
    if (brand.logo.img_url.startsWith("http")) return brand.logo.img_url;
    const serverUrl = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
    return `${serverUrl}/${brand.logo.img_url.replace(/^\//, "")}`;
  }
  return "";
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusPill({ active }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor: active ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
        color: active ? "#34d399" : "#f87171",
        border: `1px solid ${active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? "#34d399" : "#f87171" }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({
  children,
  onClick,
  danger = false,
  primary = false,
  disabled = false,
  type = "button",
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{
        backgroundColor: primary
          ? "var(--accent)"
          : danger
          ? "rgba(239,68,68,.08)"
          : "transparent",
        color: primary
          ? "var(--accent-text)"
          : danger
          ? "var(--danger)"
          : "var(--text-primary)",
        border: primary
          ? "none"
          : danger
          ? "1px solid rgba(239,68,68,.25)"
          : "1px solid var(--border-color)",
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon, title, action }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
}

// Updated InfoRow with tighter padding (py-2)
function InfoRow({ label, value, green = false, mono = false, isLast = false }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-2" 
      style={{ borderBottom: !isLast ? "1px solid var(--border-color)" : "none" }}
    >
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className={`text-[12px] text-right truncate max-w-[60%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function BrandDetailPage() {
  useBrandSocketSync();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const brandId = params.id;
  const queryClient = useQueryClient();

  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/brands";

  const [tab, setTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const [form, setForm] = useState({
    brand_code: "",
    name: "",
    description: "",
    country: "",
    is_active: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  const { data: brand, isLoading: loading } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => brandApi.getById(brandId),
    enabled: !!brandId,
  });

  const { data: brandProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["brand-products", brandId],
    queryFn: () => productApi.getByBrand(brandId),
    enabled: !!brandId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => brandApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["brand", brandId]);
      queryClient.invalidateQueries(["brands"]);
      setLogoFile(null);
      setLogoPreview("");
      setShowEdit(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => brandApi.delete(brandId),
    onSuccess: () => {
      queryClient.invalidateQueries(["brands"]);
      router.push(backPath);
    },
  });

  function openEdit() {
    if (!brand) return;
    setForm({
      brand_code: brand.brand_code || "",
      name: brand.name || "",
      description: brand.description || "",
      country: brand.country || "",
      is_active: brand.is_active !== undefined ? brand.is_active : true,
    });
    setLogoPreview(logoUrl(brand));
    setLogoFile(null);
    setShowEdit(true);
  }

  function submitEdit(e) {
    e.preventDefault();
    const data = new FormData();
    data.append("brand_code", form.brand_code);
    data.append("name", form.name);
    data.append("description", form.description || "");
    data.append("country", form.country || "");
    data.append("is_active", form.is_active.toString());
    if (logoFile) data.append("logo", logoFile);
    updateMutation.mutate({ id: brandId, data });
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Logo size must be less than 10MB.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  const totalProducts = brandProducts.length;
  const logoSrc = brand ? logoUrl(brand) : "";
  const hasLogo = Boolean(brand?.logo?.img_url) && !logoFailed;
  const hasUpdates = Boolean(
    brand?.created_at && brand?.updated_at && brand.created_at !== brand.updated_at
  );

  if (loading) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="h-5 w-5" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Loading brand details...
          </span>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center">
        <Card className="max-w-sm p-8 text-center">
          <h2 className="mb-2 text-lg font-semibold">Brand Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>
            Back to Brands
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-10" style={{ color: "var(--text-primary)" }}>
      {/* ===== HEADER ===== */}
      <div>
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <button
            onClick={() => router.push(backPath)}
            className="transition hover:text-[var(--accent)]"
            style={{ color: "var(--text-muted)" }}
          >
            Brands
          </button>
          <Ico d={D.chevron} className="h-2.5 w-2.5" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-primary)" }}>Brand Details</span>
        </div>

        {/* Header Card */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {/* Logo */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {hasLogo ? (
                  <img
                    src={logoSrc}
                    alt={brand.name}
                    onError={() => setLogoFailed(true)}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <span className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                    {ini(brand.name)}
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-xl font-bold tracking-tight">{brand.name}</h1>
                  <StatusPill active={brand.is_active} />
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span
                    className="rounded border px-1.5 py-0.5 font-mono"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {brand.brand_code || "—"}
                  </span>
                  {brand.country && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Ico d={D.globe} className="h-3 w-3" />
                        {brand.country}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => router.push(backPath)}>
                <Ico d={D.back} className="h-3.5 w-3.5" /> Back
              </Button>
              <Button primary onClick={openEdit}>
                <Ico d={D.edit} className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                danger
                disabled={deleteMutation.isPending}
                onClick={() => setShowDelete(true)}
              >
                <Ico d={D.trash} className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div
        className="flex items-center gap-6 overflow-x-auto border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        {[
          { id: "overview", label: "Overview" },
          { id: "products", label: "Products", badge: totalProducts },
          { id: "activity", label: "Activity" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="relative flex items-center gap-2 py-2.5 text-[12px] font-medium whitespace-nowrap transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              {item.label}
              {item.badge !== undefined && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px]"
                  style={{
                    backgroundColor: active ? "rgba(16,185,129,.12)" : "var(--bg-tertiary)",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
              {active && (
                <span
                  className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === "overview" && (
        <div className="space-y-4">
          
          {/* TOP ROW: INFO (Wide), LOGO (Narrow), DESC (Narrow) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* 1. BRAND INFORMATION (Reduced Width - Spans 2 cols) */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader
                  title="Brand Information"
                  icon={<Ico d={D.tag} className="h-4 w-4" />}
                />
                <div className="px-4 pb-4"> {/* Added pb-4 for bottom padding */}
                  <InfoRow label="Brand Code" value={brand.brand_code} mono />
                  <InfoRow
                    label="Status"
                    value={brand.is_active ? "Active" : "Inactive"}
                    green={brand.is_active}
                  />
                  <InfoRow label="Country" value={brand.country || "—"} />

                  {/* Created Section */}
                  <div className="py-2 border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Created By
                      </span>
                      <span className="text-[12px] font-medium">
                        {brand.createdby?.name || "System"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Created At
                      </span>
                      <span className="text-[12px]">{formatDateTime(brand.created_at)}</span>
                    </div>
                  </div>

                  {/* Updated Section */}
                  <div className="pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Last Updated By
                      </span>
                      <span className="text-[12px] font-medium">
                        {brand.updatedby?.name || (hasUpdates ? "Unknown" : "—")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Last Updated At
                      </span>
                      <span className="text-[12px]">
                        {hasUpdates ? formatDateTime(brand.updated_at) : "Never"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 2. BRAND LOGO (Spans 1 col) */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader
                  title="Brand Logo"
                  icon={<Ico d={D.image} className="h-4 w-4" />}
                />
                <div className="p-4 flex flex-col">
                  {hasLogo ? (
                    <div className="flex flex-col">
                      <div
                        className="mb-3 flex items-center justify-center overflow-hidden rounded-lg"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          minHeight: "140px", // Fixed reasonable height
                          maxHeight: "200px"
                        }}
                      >
                        <img
                          src={logoSrc}
                          alt={brand.name}
                          onError={() => setLogoFailed(true)}
                          className="max-h-full max-w-full object-contain p-2"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium">
                            {brand.logo.img_url?.split("/").pop()}
                          </p>
                          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {fileSize(brand.logo.img_size)}
                          </p>
                        </div>
                        <a
                          href={logoSrc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] hover:underline"
                          style={{ color: "var(--accent)" }}
                        >
                          View <Ico d={D.link} className="inline h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-lg py-8"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px dashed var(--border-color)",
                      }}
                    >
                      <Ico d={D.image} className="mb-3 h-6 w-6 opacity-40" sw={1.4} />
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        No logo uploaded
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* 3. DESCRIPTION (Spans 1 col) - Height Auto Fixed */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader
                  title="Description"
                  icon={<Ico d={D.activity} className="h-4 w-4" />}
                />
                <div className="p-4">
                  {brand.description ? (
                    <p
                      className="whitespace-pre-wrap break-words text-[12px] leading-6"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {brand.description}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div
                        className="mb-2 flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: "var(--bg-tertiary)" }}
                      >
                        <Ico d={D.minus} className="h-3 w-3 opacity-50" sw={1.6} />
                      </div>
                      <p className="text-[11px] font-medium">No description added</p>
                      <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Add a description to provide more context about this brand.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

          </div>

          {/* BOTTOM ROW: PRODUCTS (Full Width) */}
          <div className="col-span-4">
             <Card>
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center gap-2">
                  <Ico d={D.box} className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <h3 className="text-[12px] font-semibold">Products</h3>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {totalProducts}
                  </span>
                </div>
                <button
                  onClick={() => setTab("products")}
                  className="flex items-center gap-1 text-[11px] hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  View All <Ico d={D.chevron} className="h-3 w-3" />
                </button>
              </div>

              {productsLoading ? (
                <div className="flex justify-center py-10">
                  <Spin />
                </div>
              ) : brandProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <Ico d={D.box} className="h-4 w-4 opacity-50" sw={1.5} />
                  </div>
                  <p className="text-[12px] font-medium">No products linked yet</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Link products to see them here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead style={{ backgroundColor: "var(--bg-table)" }}>
                      <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <th
                          className="py-2.5 pl-4 pr-2 text-left text-[10px] font-medium"
                          style={{ color: "var(--text-muted)" }}
                        >
                          PRODUCT NAME
                        </th>
                        <th
                          className="px-2 py-2.5 text-left text-[10px] font-medium"
                          style={{ color: "var(--text-muted)" }}
                        >
                          CODE
                        </th>
                        <th
                          className="py-2.5 pr-4 text-left text-[10px] font-medium"
                          style={{ color: "var(--text-muted)" }}
                        >
                          STATUS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {brandProducts.slice(0, 5).map((product, index) => (
                        <tr
                          key={product._id || index}
                          style={{
                            borderBottom:
                              index < 4 && index < brandProducts.length - 1
                                ? "1px solid var(--border-color)"
                                : "none",
                          }}
                        >
                          <td className="py-2.5 pl-4 pr-2 font-medium">{product.name}</td>
                          <td
                            className="px-2 py-2.5 font-mono text-[11px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {product.product_code || product.sku}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor:
                                  product.status === "active"
                                    ? "rgba(34,197,94,.10)"
                                    : "rgba(239,68,68,.10)",
                                color:
                                  product.status === "active"
                                    ? "var(--success)"
                                    : "var(--danger)",
                              }}
                            >
                              {product.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

        </div>
      )}

      {/* ===== PRODUCTS TAB ===== */}
      {tab === "products" && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="All Products"
              icon={<Ico d={D.box} className="h-4 w-4" />}
              action={
                <div className="relative">
                  <Ico
                    d={D.search}
                    className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="h-8 w-[200px] rounded-md border pl-8 pr-3 text-[11px] outline-none"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              }
            />
            {productsLoading ? (
              <div className="flex items-center justify-center gap-2 py-14">
                <Spin />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Loading products...
                </span>
              </div>
            ) : brandProducts.length === 0 ? (
              <div className="py-16 text-center">
                <Ico d={D.box} className="mx-auto mb-3 h-12 w-12 opacity-40" sw={1.4} />
                <p className="text-[12px] font-medium">No products yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead style={{ backgroundColor: "var(--bg-table)" }}>
                    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <th
                        className="py-3 pl-4 pr-2 text-left text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        PRODUCT
                      </th>
                      <th
                        className="px-2 py-3 text-left text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        DESCRIPTION
                      </th>
                      <th
                        className="px-2 py-3 text-left text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        CATEGORY
                      </th>
                      <th
                        className="py-3 pr-4 text-center text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandProducts.map((product, index) => (
                      <tr
                        key={product._id || index}
                        style={{ borderBottom: "1px solid var(--border-color)" }}
                      >
                        <td className="align-top py-3 pl-4 pr-2">
                          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {product.name || "—"}
                          </p>
                          <p
                            className="mt-1 font-mono text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {product.product_code || product.sku || "No code"}
                          </p>
                        </td>
                        <td className="max-w-[280px] align-top px-2 py-3">
                          <p
                            className="line-clamp-2 text-[11px] leading-5"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {product.description || "No description provided."}
                          </p>
                        </td>
                        <td className="px-2 py-3" style={{ color: "var(--text-secondary)" }}>
                          {product.category_id?.name || "—"}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span
                            className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium"
                            style={{
                              backgroundColor:
                                product.status === "active"
                                  ? "rgba(34,197,94,.10)"
                                  : "rgba(239,68,68,.10)",
                              color:
                                product.status === "active"
                                  ? "var(--success)"
                                  : "var(--danger)",
                            }}
                          >
                            {product.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===== ACTIVITY TAB ===== */}
      {tab === "activity" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader
              title="Full Activity Timeline"
              icon={<Ico d={D.activity} className="h-4 w-4" />}
            />
            <div className="space-y-5 p-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: "rgba(16,185,129,.12)",
                      color: "var(--accent)",
                    }}
                  >
                    <Ico d={D.plus} className="h-3.5 w-3.5" />
                  </div>
                  {hasUpdates && (
                    <div
                      className="mt-1 h-full w-px"
                      style={{ backgroundColor: "var(--border-color)" }}
                    />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-[13px] font-medium">Brand Created</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Created by{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {brand.createdby?.name || "System"}
                    </span>
                    {brand.createdby?.email && (
                      <span className="block text-[10px] opacity-70">
                        {brand.createdby.email}
                      </span>
                    )}
                  </p>
                  <p
                    className="mt-2 font-mono text-[10px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatDateTime(brand.created_at)}
                  </p>
                </div>
              </div>

              {hasUpdates ? (
                <div className="flex gap-3">
                  <div>
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: "rgba(96,165,250,.12)",
                        color: "#60a5fa",
                      }}
                    >
                      <Ico d={D.pencil} className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">Brand Updated</p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Updated by{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {brand.updatedby?.name || "Unknown User"}
                      </span>
                      {brand.updatedby?.email && (
                        <span className="block text-[10px] opacity-70">
                          {brand.updatedby.email}
                        </span>
                      )}
                    </p>
                    <p
                      className="mt-2 font-mono text-[10px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatDateTime(brand.updated_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="ml-10 rounded-lg border px-3 py-2"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    No updates recorded yet.
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="User Details"
              icon={<Ico d={D.user} className="h-4 w-4" />}
            />
            <div className="space-y-4 p-4">
              <div>
                <p
                  className="mb-2 text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Creator
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--accent)",
                    }}
                  >
                    {ini(brand.createdby?.name)}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium">
                      {brand.createdby?.name || "Unknown"}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {brand.createdby?.email || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {hasUpdates && (
                <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <p
                    className="mb-2 text-[10px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Last Editor
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--accent)",
                      }}
                    >
                      {ini(brand.updatedby?.name)}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">
                        {brand.updatedby?.name || "Unknown"}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {brand.updatedby?.email || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,.4)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border-color)" }}
            >
              <div>
                <h2 className="text-[14px] font-semibold">Edit Brand</h2>
                <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Update brand information
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
              >
                <Ico d={D.close} className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1.5 block text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Brand Code
                  </label>
                  <input
                    value={form.brand_code}
                    disabled
                    readOnly
                    className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none opacity-60"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Brand Name *
                  </label>
                  <input
                    value={form.name}
                    required
                    disabled={updateMutation.isPending}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  disabled={updateMutation.isPending}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full resize-none rounded-lg border px-3 py-2.5 text-[13px] outline-none"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  disabled={updateMutation.isPending}
                  className="w-full text-[11px] file:mr-4 file:rounded-md file:border-0 file:bg-white/5 file:px-4 file:py-2 file:text-[11px] file:font-semibold file:text-[var(--text-primary)] hover:file:bg-white/10"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>

              <div
                className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end"
                style={{ borderColor: "var(--border-color)" }}
              >
                <Button disabled={updateMutation.isPending} onClick={() => setShowEdit(false)}>
                  Cancel
                </Button>
                <Button primary type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Spin className="h-3.5 w-3.5" /> Saving...
                    </>
                  ) : (
                    <>
                      <Ico d={D.check} className="h-3.5 w-3.5" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-hidden rounded-xl p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,.4)",
            }}
          >
            <div className="flex gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(239,68,68,.10)", color: "#f87171" }}
              >
                <Ico d={D.warn} className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Delete Brand?</h3>
                <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete{" "}
                  <span style={{ color: "var(--text-primary)" }}>{brand.name}</span>? This
                  action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
              <Button
                danger
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Spin className="h-3.5 w-3.5" /> Deleting...
                  </>
                ) : (
                  <>
                    <Ico d={D.trash} className="h-3.5 w-3.5" /> Delete Brand
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}