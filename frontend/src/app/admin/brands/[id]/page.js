"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Country } from "country-state-city";
import { brandApi } from "../../../../apis/admin/brandApi"; // Adjust path as needed
import { productApi } from "../../../../apis/admin/productApi"; // Adjust path as needed
import { useBrandSocketSync } from "@/hooks/useBrandSocketSync.js";
import { useSocket } from "@/hooks/useSocket";

/* =========================================================
ICON COMPONENTS
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
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  link: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  down: "M19 9l-7 7-7-7",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  check: "M5 13l4 4L19 7",
  globe: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  chevron: "M9 5l7 7-7 7",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
};

/* =========================================================
HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
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
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
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
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        backgroundColor: active ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
        color: active ? "var(--success)" : "var(--danger)",
        border: `1px solid ${active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
      }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "var(--success)" : "var(--danger)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="inline-flex min-h-[44px] h-10 md:h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: primary ? "var(--accent)" : danger ? "rgba(239,68,68,.08)" : "var(--bg-tertiary)",
        color: primary ? "var(--accent-text)" : danger ? "var(--danger)" : "var(--text-primary)",
        border: primary ? "none" : danger ? "1px solid rgba(239,68,68,.25)" : "1px solid var(--border-color)",
      }}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, action }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
      {action}
    </div>
  );
}

function InfoRow({ label, value, green = false, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`text-[12px] text-right truncate max-w-[62%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* =========================================================
MAIN PAGE
========================================================= */
export default function BrandDetailPage() {
  useBrandSocketSync();
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const brandId = params.id;
  const queryClient = useQueryClient();
  
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/brands";

  const [tab, setTab] = useState("info");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  
  // Form State
  const [form, setForm] = useState({
    brand_code: "", name: "", description: "", country: "", is_active: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  // Countries
  const allCountries = useMemo(() => {
    return Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode }));
  }, []);

  // Fetch Specific Brand Details (Includes populated createdby/updatedby)
  const { data: brand, isLoading: loading } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => brandApi.getById(brandId),
    enabled: !!brandId,
  });

  // Fetch Products
  const { data: brandProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["brand-products", brandId],
    queryFn: () => productApi.getByBrand(brandId),
    enabled: !!brandId,
  });

  // Update Mutation
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

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => brandApi.delete(brandId),
    onSuccess: () => {
      queryClient.invalidateQueries(["brands"]);
      router.push(backPath);
    },
  });

  // Handlers
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

  // Derived Data
  const totalProducts = brandProducts.length;
  const logoSrc = brand ? logoUrl(brand) : "";
  const hasLogo = Boolean(brand?.logo?.img_url) && !logoFailed;
  
  // Check if updated
  const hasUpdates = Boolean(brand?.created_at && brand?.updated_at && brand.created_at !== brand.updated_at);

  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading brand details...</span>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Brand Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>Back to Brands</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full pb-8" style={{ color: "var(--text-primary)" }}>
      <div className="space-y-6">
        
        {/* HEADER */}
        <div>
          <div className="mb-4 flex items-center gap-2 text-[12px]">
            <button onClick={() => router.push(backPath)} className="transition hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>Brands</button>
            <Ico d={D.chevron} className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-primary)" }}>Brand Details</span>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                {hasLogo ? <img src={logoSrc} alt={brand.name} onError={() => setLogoFailed(true)} className="h-full w-full object-contain p-2" /> : <span className="text-xl font-semibold" style={{ color: "var(--accent)" }}>{ini(brand.name)}</span>}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{brand.name}</h1>
                  <StatusPill active={brand.is_active} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  <span className="font-mono">{brand.brand_code || "—"}</span>
                  {brand.country && <><span>•</span><span>{brand.country}</span></>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => router.push(backPath)}><Ico d={D.back} className="h-3.5 w-3.5" /> Back</Button>
              <Button primary onClick={openEdit}><Ico d={D.edit} className="h-3.5 w-3.5" /> Edit Brand</Button>
              <Button danger disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete</Button>
            </div>
          </div>
        </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)" }}>
          {[
            { id: "info", label: "Overview" },
            { id: "products", label: "Products", badge: totalProducts },
            { id: "activity", label: "Activity" },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)}
                className="relative flex items-center gap-2 py-3 text-[12px] font-medium whitespace-nowrap"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                {item.label}
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px]" style={{ backgroundColor: active ? "rgba(16,185,129,.10)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                    {item.badge}
                  </span>
                )}
                {active && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "info" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
            {/* Left column */}
            <div className="space-y-4 min-w-0">
              {/* Brand Information */}
              <Card>
                <CardHeader title="Brand Information" icon={<Ico d={D.tag} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Brand Name" value={brand.name} />
                  <InfoRow label="Brand Code" value={brand.brand_code} mono />
                  <InfoRow label="Country" value={brand.country || "—"} />
                  <InfoRow label="Status" value={brand.is_active ? "Active" : "Inactive"} green={brand.is_active} />

                  {/* Detailed Creation Info */}
                  <div className="py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created By</span>
                      <span className="text-[12px] font-medium">{brand.createdby?.name || "System"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created At</span>
                      <span className="text-[12px]">{formatDateTime(brand.created_at)}</span>
                    </div>
                  </div>

                  {/* Detailed Update Info */}
                  <div className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated By</span>
                      <span className="text-[12px] font-medium">{brand.updatedby?.name || (hasUpdates ? "Unknown" : "—")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated At</span>
                      <span className="text-[12px]">{hasUpdates ? formatDateTime(brand.updated_at) : "Never"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader title="Description" icon={<Ico d={D.activity} className="w-4 h-4" />} />
                <div className="p-5">
                  {brand.description ? (
                    <p className="text-[12px] leading-6 whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>{brand.description}</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-8">
                      <Ico d={D.activity} className="w-7 h-7 mb-3" sw={1.4} />
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No description provided.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right column — Logo */}
            <Card>
              <CardHeader title="Brand Logo" icon={<Ico d={D.image} className="w-4 h-4" />} />
              <div className="p-4">
                {hasLogo ? (
                  <div>
                    <div className="h-[170px] rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <img src={logoSrc} alt={brand.name} onError={() => setLogoFailed(true)} className="max-h-full max-w-full object-contain p-6" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] truncate" style={{ color: "var(--text-primary)" }}>{brand.logo.img_url?.split("/").pop()}</p>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{fileSize(brand.logo.img_size)}</p>
                      </div>
                      <a href={logoSrc} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1 shrink-0" style={{ color: "var(--accent)" }}>View <Ico d={D.link} className="w-3 h-3" /></a>
                    </div>
                  </div>
                ) : (
                  <div className="h-[170px] rounded-lg flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                    <Ico d={D.image} className="w-7 h-7 mb-3" sw={1.4} />
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No logo uploaded</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab === "products" && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Products Under This Brand" icon={<Ico d={D.box} className="w-4 h-4" />} />
              {productsLoading ? (
                <div className="py-14 flex justify-center items-center gap-2"><Spin /><span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Loading products...</span></div>
              ) : brandProducts.length === 0 ? (
                <div className="py-16 text-center">
                  <Ico d={D.box} className="w-12 h-12 mx-auto mb-3" sw={1.4} />
                  <p className="text-[12px] font-medium">No products yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead style={{ backgroundColor: "var(--bg-table)" }}>
                      <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <th className="text-left px-4 py-3 font-medium text-[10px]" style={{ color: "var(--text-muted)" }}>PRODUCT</th>
                        <th className="text-left px-4 py-3 font-medium text-[10px]" style={{ color: "var(--text-muted)" }}>DESCRIPTION</th>
                        <th className="text-left px-4 py-3 font-medium text-[10px]" style={{ color: "var(--text-muted)" }}>CATEGORY</th>
                        <th className="text-center px-4 py-3 font-medium text-[10px]" style={{ color: "var(--text-muted)" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brandProducts.map((product, index) => (
                        <tr key={product._id || index} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td className="px-4 py-3 align-top">
                            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{product.name || "—"}</p>
                            <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{product.product_code || product.sku || "No code"}</p>
                          </td>
                          <td className="max-w-[280px] px-4 py-3 align-top">
                            <p className="line-clamp-2 text-[11px] leading-5" style={{ color: "var(--text-secondary)" }}>{product.description || "No description provided."}</p>
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{product.category_id?.name || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: product.status === "active" ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)", color: product.status === "active" ? "var(--success)" : "var(--danger)" }}>
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

        {/* ACTIVITY TAB - DETAILED WHO & WHEN */}
        {tab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <Card>
              <CardHeader title="Activity Timeline" icon={<Ico d={D.activity} className="w-4 h-4" />} />
              <div className="p-5 space-y-6">
                
                {/* Created Event */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,.10)", color: "var(--accent)" }}>
                      <Ico d={D.plus} className="w-4 h-4" />
                    </div>
                    {hasUpdates && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-color)" }} />}
                  </div>
                  <div className="pb-2">
                    <p className="text-[13px] font-medium">Brand Created</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Created by <span className="font-semibold text-[var(--text-primary)]">{brand.createdby?.name || "System"}</span> 
                      {brand.createdby?.email && <span className="block text-[10px] opacity-70">{brand.createdby.email}</span>}
                    </p>
                    <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(brand.created_at)}
                    </p>
                  </div>
                </div>

                {/* Updated Event */}
                {hasUpdates ? (
                  <div className="flex gap-4">
                    <div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,.10)", color: "#60a5fa" }}>
                        <Ico d={D.pencil} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Brand Updated</p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Updated by <span className="font-semibold text-[var(--text-primary)]">{brand.updatedby?.name || "Unknown User"}</span>
                        {brand.updatedby?.email && <span className="block text-[10px] opacity-70">{brand.updatedby.email}</span>}
                      </p>
                      <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                        {formatDateTime(brand.updated_at)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ml-11 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No updates recorded yet.</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Activity Info Side Panel */}
            <Card>
              <CardHeader title="User Details" icon={<Ico d={D.user} className="w-4 h-4" />} />
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Creator</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                      {ini(brand.createdby?.name)}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{brand.createdby?.name || "Unknown"}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{brand.createdby?.email || "—"}</p>
                    </div>
                  </div>
                </div>
                
                {hasUpdates && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Last Editor</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                        {ini(brand.updatedby?.name)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium">{brand.updatedby?.name || "Unknown"}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{brand.updatedby?.email || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* EDIT MODAL (Unchanged logic, just included for completeness) */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl overflow-hidden max-h-[90vh]" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h2 className="text-[14px] font-semibold">Edit Brand</h2>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Update brand information</p>
              </div>
              <button type="button" onClick={() => setShowEdit(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                <Ico d={D.close} className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Brand Code</label>
                  <input value={form.brand_code} disabled readOnly className="w-full h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] outline-none opacity-60" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Brand Name *</label>
                  <input value={form.name} required disabled={updateMutation.isPending} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Description</label>
                <textarea rows={4} value={form.description} disabled={updateMutation.isPending} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-lg text-[16px] md:text-[13px] outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <Button disabled={updateMutation.isPending} onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button primary type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> Saving...</> : <><Ico d={D.check} className="w-3.5 h-3.5" /> Save Changes</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5 max-h-[90vh] overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,.10)", color: "#f87171" }}>
                <Ico d={D.warn} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Delete Brand?</h3>
                <p className="text-[11px] mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span style={{ color: "var(--text-primary)" }}>{brand.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-5">
              <Button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button danger disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> Deleting...</> : <><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete Brand</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
