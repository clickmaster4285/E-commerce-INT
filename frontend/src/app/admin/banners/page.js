"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import useBannerSocketSync from "../../../hooks/admin/useBannerSocket";
import { dealApi } from "../../../apis/admin/dealApi";
import { DealFormModal, SelectionModal } from "../deals/_components/dealModals";
import { productApi } from "../../../apis/admin/productApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

// ==========================================
// API SETUP
// ==========================================
// Base URL env se (frontend/.env → NEXT_PUBLIC_SERVERURL).
// Pehle yahan env se `/api` hatakar wapas `/api` lagaya jata tha
// (`replace(/\/api$/)` → `${API_BASE}/api`) — pure redundant round-trip jo
// `/api/api` jaisi galti ka bhi risk rakhta tha.
const API_BASE_URL =
  (process.env.NEXT_PUBLIC_SERVERURL || "").trim().replace(/\/+$/, "") || null;
const API_ORIGIN = API_BASE_URL?.replace(/\/api\/?$/, "") || null;

const getImageUrl = (file) => {
  if (typeof file !== "string" || !file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  if (!API_ORIGIN) return null;
  return `${API_ORIGIN}/${file.replace(/^\/+/, "")}`;
};

const bannerAxios = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

bannerAxios.interceptors.request.use(
  (config) => {
    try {
      const cookies = document.cookie.split(";");
      const accessTokenCookie = cookies.find((cookie) =>
        cookie.trim().startsWith("accessToken=")
      );

      if (accessTokenCookie) {
        const token = accessTokenCookie
          .split("=")
          .slice(1)
          .join("=")
          .trim();

        if (token) {
          config.headers.Authorization = `Bearer ${decodeURIComponent(token)}`;
        }
      }
    } catch (error) {
      console.error("Banner auth token read error:", error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
};

const paginated = (res, fallbackLimit) => {
  const d = res?.data;
  if (Array.isArray(d)) {
    return {
      items: d,
      pagination: { total: d.length, page: 1, limit: d.length || 1, pages: 1, hasNext: false, hasPrev: false },
    };
  }
  return {
    items: Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [],
    pagination: d?.pagination || { total: 0, page: 1, limit: fallbackLimit, pages: 1, hasNext: false, hasPrev: false },
  };
};

const adminBannerApi = {
  getAll: async () => {
    const res = await bannerAxios.get("/banners");
    return res.data.data || [];
  },

  getAllPaginated: async ({ page = 1, limit = 20, search = "", status = "all", bannerType = "all" } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status && status !== "all") params.status = status;
    if (bannerType && bannerType !== "all") params.bannerType = bannerType;
    const res = await bannerAxios.get("/banners", { params });
    return paginated(res, limit);
  },
  create: async (data) => {
    const res = await bannerAxios.post("/banners", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },
  update: async (id, data) => {
    const res = await bannerAxios.put(`/banners/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },
  delete: async (id) => {
    await bannerAxios.delete(`/banners/${id}`);
  },
  duplicate: async (id) => {
    const res = await bannerAxios.post(`/banners/${id}/duplicate`);
    return res.data.data;
  },
};

// ==========================================
// ICONS
// ==========================================
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
/* =========================================================
   SKELETON LOADING UI — existing `.skeleton` shimmer utility (globals.css) reuse
   ✅ Wahi pattern jo products page par use hua hai: wrapper, paddings aur column
      widths real table / grid cards jaise hi rakhe gaye hain, is liye data aane
      par layout shift nahi hota (pehle yahan sirf spinner tha).
   ✅ Sirf loading state ke liye — real table/grid design me koi change nahi.
========================================================= */
// `.skeleton` (globals.css) apna border-radius deta hai, is liye pills ke liye inline radius
const SKELETON_ROUND = { borderRadius: "9999px" };

function BannerRowsSkeleton({ rows = 10 }) {
  const { t } = useTranslation();
  return (
    <tbody aria-busy="true" aria-label={t("admin.promotions.ui.generated.14451ce42db3")}>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`banner-skeleton-${i}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
          {/* checkbox */}
          <td className="px-4 py-2.5"><span className="skeleton block h-4 w-4 rounded" /></td>
          {/* preview image */}
          <td className="px-4 py-2.5"><span className="skeleton block h-12 w-24 rounded" /></td>
          {/* title */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-3 w-[130px] rounded align-middle" /></td>
          {/* type */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-3 w-[70px] rounded align-middle" /></td>
          {/* status */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-5 w-[66px] align-middle" style={SKELETON_ROUND} /></td>
          {/* schedule */}
          <td className="px-4 py-2.5 hidden lg:table-cell"><span className="skeleton inline-block h-3 w-[150px] rounded align-middle" /></td>
          {/* position */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-3 w-6 rounded align-middle" /></td>
          {/* actions */}
          <td className="px-4 py-2.5 whitespace-nowrap w-1">
            <div className="flex items-center justify-end"><span className="skeleton block h-[38px] w-[44px] rounded-md" /></div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function BannerCardsSkeleton({ cards = 8, cardStyle }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-busy="true" aria-label={t("admin.promotions.ui.generated.14451ce42db3")}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={`banner-card-skeleton-${i}`} className="rounded-lg p-4 flex flex-col gap-3" style={cardStyle}>
          <span className="skeleton block h-32 w-full rounded-md" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="skeleton block h-3 w-[75%] rounded" />
              <span className="skeleton mt-1.5 block h-2.5 w-[45%] rounded" />
            </div>
            <span className="skeleton inline-block h-5 w-[66px]" style={SKELETON_ROUND} />
          </div>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <span className="skeleton inline-block h-3 w-[46px] rounded align-middle" />
            <span className="skeleton block h-[38px] w-[44px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const SortIndicator = ({ active, direction }) => (<svg className={`w-3 h-3 transition ${active ? "" : "opacity-40"}`} style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>{active && direction === "desc" ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}</svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const UploadIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const CopyIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>);
const PhotoIcon = ({ className = "w-4 h-4", style }) => (<svg className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6.5 6.5h.01M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>);

const InfoIcon = ({ className = "w-4 h-4", style }) => (<svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const TagIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>);
const DotsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>);
const PowerIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 2v10" /></svg>);

// ==========================================
// HELPERS
// ==========================================
const formatDate = (d, locale = "en") => d ? new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—";

const StatusBadge = ({ status }) => {
  const styles = {
    active: { backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" },
    inactive: { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" },
    scheduled: { backgroundColor: "var(--info-soft)", color: "var(--info-text)", border: "1px solid color-mix(in srgb, var(--info) 28%, transparent)" },
    expired: { backgroundColor: "rgba(107,114,128,0.1)", color: "var(--text-muted)", border: "1px solid rgba(107,114,128,0.3)" },
    draft: { backgroundColor: "var(--warning-soft)", color: "var(--warning-text)", border: "1px solid color-mix(in srgb, var(--warning) 28%, transparent)" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={s}>
      {status}
    </span>
  );
};

// ==========================================
// PROFESSIONAL FORM COMPONENTS
// ==========================================
const FormSection = ({ number, title, description, children }) => (
  <div className="rounded-lg border p-6 shadow-sm" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: "var(--accent)" }}>
          {number}
        </div>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
      {description && <p className="text-xs ml-10" style={{ color: "var(--text-muted)" }}>{description}</p>}
    </div>
    {children}
  </div>
);

const FormField = ({ label, required, helpText, children }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-primary)" }}>
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {helpText && (
      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
        <InfoIcon className="w-3 h-3" />
        {helpText}
      </p>
    )}
  </div>
);

const Input = ({ ...props }) => (
  <input
    {...props}
    className="w-full h-10 px-3 rounded-md text-sm border outline-none transition-all duration-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] placeholder:text-gray-400"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full h-10 px-3 rounded-md text-sm border outline-none transition-all duration-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
  >
    {children}
  </select>
);

const Textarea = ({ ...props }) => (
  <textarea
    {...props}
    className="w-full px-3 py-2.5 rounded-md text-sm border outline-none transition-all duration-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] placeholder:text-gray-400 resize-none"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
  />
);

/* ==========================================================
   BANNER IMAGE — SIZE / FORMAT RULES
   ------------------------------------------------------------
   Ye limit backend se EXACTLY match karti hai:
   backend/middleware/uploadMiddleware.js → MAX_UPLOAD_MB = 15

   Client par validate karne se admin ko 20MB+ file bhejne ka wait
   nahi karna padta (upload pura hone ke baad 413 aata tha). Ab file
   select karte hi foran clear error milta hai aur upload hota hi nahi.
   ========================================================== */
const MAX_IMAGE_MB = 15;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const formatBytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ✅ Blob URL memory leak fix — pehle har render par naya objectURL
   ban raha tha (URL.revokeObjectURL kabhi call nahi hota tha), jo
   long admin session me memory barhata raha. Ab ek File = ek URL,
   aur File GC hone par WeakMap bhi saath hi chala jata hai. */
const previewUrlCache = new WeakMap();
const getFilePreviewUrl = (file) => {
  if (typeof window === "undefined" || !(file instanceof File)) return null;
  const cached = previewUrlCache.get(file);
  if (cached) return cached;
  const url = URL.createObjectURL(file);
  previewUrlCache.set(file, url);
  return url;
};

/* null = valid, string = user-facing error */
const validateImageFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Unsupported file type. Please upload a JPG, PNG or WEBP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is ${formatBytes(file.size)}. Maximum allowed size is ${MAX_IMAGE_MB} MB.`;
  }
  return null;
};

/* ==================== DRAG AND DROP IMAGE UPLOAD (FIXED) ==================== */
const ImageUploadBox = ({ label, file, setFile, preview, required, dimensions }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to get valid preview URL
  const getPreviewUrl = () => {
    if (!file) return null;
    if (typeof File !== "undefined" && file instanceof File) return getFilePreviewUrl(file);
    return getImageUrl(file);
  };

  const currentPreview = preview || getPreviewUrl();

  // ✅ Ek hi jagah validate — click aur drag/drop dono yahan se guzarte hain
  const acceptFile = (candidate) => {
    if (!candidate) return;
    const error = validateImageFile(candidate);
    if (error) {
      toast.error(error, { description: t("admin.banners.validation.imageSize", { size: MAX_IMAGE_MB }) });
      // Input value reset — warna same file dobara select karne par change na fire ho
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(candidate);
  };

  const handleFileChange = (e) => {
    acceptFile(e.target.files?.[0]);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentPreview) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (currentPreview) return; // Don't allow drop if image already exists

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      acceptFile(droppedFiles[0]);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation(); // Prevent triggering click on container
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {/* Label + size rule ek hi line par (label left, rule right) */}
      <div className="flex items-center justify-between gap-3">
        <label className="block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <p
          className="inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap"
          style={{ color: "var(--text-muted)" }}
        >
          <PhotoIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />{t("admin.promotions.ui.generated.0706025b2bbc")}{" "}{MAX_IMAGE_MB}{" "}{t("admin.promotions.ui.generated.b6f07cc2b713")}</p>
      </div>

      {/* Drop Zone / Preview Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !currentPreview && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-4 transition-all duration-200
          ${currentPreview
            ? "cursor-default"
            : isDragging
              ? "scale-[1.01]"
              : "hover:opacity-90 cursor-pointer"
          }`}
        style={{
          borderColor: currentPreview || isDragging ? "var(--accent)" : "var(--border-color)",
          backgroundColor: currentPreview || isDragging ? "var(--accent-soft)" : "var(--bg-tertiary)"
        }}
      >
        {currentPreview ? (
          <div className="relative w-full group">
            <img src={currentPreview} alt={label} className="w-full h-32 object-cover rounded-md border border-white/10" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-md border-2 border-[var(--bg-card)]"
              title={t("admin.shared.media.remove")}
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? "animate-none" : ""}`}
              style={{ backgroundColor: isDragging ? "var(--accent-soft)" : "var(--bg-secondary)", color: isDragging ? "var(--accent)" : "var(--text-muted)" }}
            >
              <UploadIcon className={`w-6 h-6 ${isDragging ? "animate-bounce" : ""}`} />
            </div>

            {isDragging ? (
              <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{t("admin.promotions.ui.generated.1afa92fb9bde")}</p>
            ) : (
              <>
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{t("admin.promotions.ui.generated.ad7e385dcc48")}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{t("admin.productDetail.page.imageFormats")}</p>
                {dimensions && (
                  <p className="text-[10px] mt-0.5 font-mono opacity-70" style={{ color: "var(--text-secondary)" }}>{t("admin.promotions.ui.generated.913ef290eadb")}{" "}{dimensions}
                  </p>
                )}
              </>
            )}
          </div>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_ACCEPT}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

const Checkbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer group">
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: "var(--accent)" }}
      />
    </div>
    <span className="text-sm transition" style={{ color: "var(--text-primary)" }}>{label}</span>
  </label>
);

/* ==================== DROPDOWN MENU ITEM ==================== */
const MenuItem = ({ icon, label, onClick, danger, success }) => (
  <button
    role="menuitem"
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-[var(--bg-tertiary)]"
    style={{ color: danger ? "var(--danger-text)" : success ? "var(--success-text)" : "var(--text-primary)" }}
  >
    {icon} {label}
  </button>
);

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function BannersPage() {
  const { t, locale, dir } = useTranslation();
  const { contentOf, nameOf, productNameOf } = useLocalized();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { markSelfAction } = useBannerSocketSync();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? "grid" : "list";
    }
    return "list";
  });
  const [sortConfig, setSortConfig] = useState({ key: "position", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionMenu, setActionMenu] = useState(null); // { id, top, left }
  const [currentPage, setCurrentPage] = useState(1);
  
  const itemsPerPage = 20;

  const defaultForm = {
    title: "", bannerType: "homepage_hero", position: 1,
    desktopImage: null,
    altText: "", backgroundColor: "#ffffff",
    eyebrow: "", heading: "", description: "",
    primaryButton: { text: "", linkType: "custom_url", link: "", dealId: "", productId: "", categoryId: "", brandId: "" },
    startDate: "", endDate: "",
  };

  const [form, setForm] = useState(defaultForm);
  const [positionDuplicate, setPositionDuplicate] = useState("");

  // --- React Query ---
  const { data: paginatedBannersData, isLoading: loading } = useQuery({
    queryKey: ["adminBanners", "paginated", currentPage, search, filterStatus, filterType],
    queryFn: () => adminBannerApi.getAllPaginated({ page: currentPage, limit: itemsPerPage, search, status: filterStatus === "all" ? "" : filterStatus, bannerType: filterType === "all" ? "" : filterType }),
    retry: false,
  });
  const banners = paginatedBannersData?.items || paginatedBannersData || normalizeArrayResponse(paginatedBannersData);
  const pagination = paginatedBannersData?.pagination || { total: banners.length, page: currentPage, limit: itemsPerPage, pages: 1, hasNext: false, hasPrev: false };

  // Smallest available positive position (must be after banners is defined)
  const getNextPosition = useCallback(() => {
    const used = new Set(banners.map((b) => b.position).filter((p) => Number.isInteger(p) && p >= 1));
    let pos = 1;
    while (used.has(pos)) pos++;
    return pos;
  }, [banners]);

  const resetForm = () => {
    setForm({ ...defaultForm, position: getNextPosition() });
    setEditingBanner(null);
    setPositionDuplicate("");
  };

  // Check if a position is duplicate (respects edit mode)
  const checkPositionDuplicate = useCallback((pos, excludeId = null) => {
    const n = parseInt(pos, 10);
    if (!Number.isFinite(n) || n < 1) {
      setPositionDuplicate(n < 1 && n !== "" ? "Position must be 1 or greater" : "");
      return;
    }
    const match = banners.find((b) => b.position === n && b._id !== excludeId);
    if (match) {
      setPositionDuplicate(`Position ${n} is already used by "${match.title}". Please choose another position.`);
    } else {
      setPositionDuplicate("");
    }
  }, [banners]);

  const { data: deals = [] } = useQuery({
    queryKey: ["banner-deal-options"],
    queryFn: dealApi.getAll,
    staleTime: 60 * 1000,
  });

  const bannerMutation = useMutation({
    mutationFn: ({ data, id }) => {
      markSelfAction(id ? "update" : "create");
      return id ? adminBannerApi.update(id, data) : adminBannerApi.create(data);
    },
    onSuccess: (responseData, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      toast.success(variables.id ? t("admin.banners.toast.updated") : t("admin.banners.toast.added"));
      // ✅ FIXED: After save, refresh the banners list and close modal
      // The query invalidation will trigger a refetch automatically
      resetForm();
      setShowModal(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || t("admin.banners.toast.operationFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => {
      markSelfAction("delete");
      return Promise.all(ids.map((id) => adminBannerApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      setSelectedIds([]);
      toast.success(t("admin.banners.toast.deleted"));
    },
     onError: (error) => toast.error(error.response?.data?.message || t("admin.banners.toast.deleteFailedShort")),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, newStatus }) => {
      markSelfAction("update");
      const fd = new FormData();
      fd.append("status", newStatus);
      return adminBannerApi.update(id, fd);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      toast.success(variables.newStatus === "active" ? t("admin.banners.toast.activated") : t("admin.banners.toast.deactivated"));
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || t("admin.banners.toast.statusFailed")),
  });

  // --- Derived Data ---
  const filteredBanners = useMemo(() => {
    return banners.filter((b) => {
      const matchSearch = b.title?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || b.status === filterStatus;
      const matchType = filterType === "all" || b.bannerType === filterType;
      return matchSearch && matchStatus && matchType;
    });
  }, [banners, search, filterStatus, filterType]);

  const sortedBanners = useMemo(() => {
    const arr = [...filteredBanners];
    if (!sortConfig.key) return arr;
    arr.sort((a, b) => {
      let va = a[sortConfig.key], vb = b[sortConfig.key];
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredBanners, sortConfig]);

  const paginatedBanners = banners; // server paginated; no client .slice()
  const totalPages = pagination.pages || 1;
  const totalBanners = pagination.total || banners.length;
  const startIndex = (currentPage - 1) * itemsPerPage;

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterType]);
  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [actionMenu]);

  // --- Deal Form State (for inline deal creation) ---
  const [dealFormType, setDealFormType] = useState(null);
  const [dealFormData, setDealFormData] = useState({
    name: "", code: "", description: "", target_type: "all",
    selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
    value_type: "percentage", value: "", min_order_value: "",
    buy_quantity: "", get_quantity: "", get_discount_value: "", bundle_price: "",
    bundle_image: "",
    min_quantity: "",
    start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
    status: "active", is_featured: false,
  });
  const [dealSelector, setDealSelector] = useState({ open: false, type: null });

  const resetDealForm = () => {
    setDealFormData({
      name: "", code: "", description: "", target_type: "all",
      selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
      value_type: "percentage", value: "", min_order_value: "",
      buy_quantity: "", get_quantity: "", get_discount_value: "", bundle_price: "",
      bundle_image: "",
      min_quantity: "",
      start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
      status: "active", is_featured: false,
    });
    setDealFormType(null);
    setDealSelector({ open: false, type: null });
  };

  const getId = (item) => item?._id || item?.id || String(item);
  const getName = (item, type) => {
    if (!item) return "";
    if (type === "product") return item.title || item.name || "Untitled Product";
    if (type === "category") return item.title || item.name || "Untitled Category";
    return item.title || item.name || "Untitled Brand";
  };
  const getProductPrice = (product) => {
    if (product?.pricing?.sellingPrice) return Number(product.pricing.sellingPrice) || 0;
    if (product?.pricing?.price) return Number(product.pricing.price) || 0;
    if (product?.price) return Number(product.price) || 0;
    if (product?.sellingPrice) return Number(product.sellingPrice) || 0;
    return 0;
  };
  const getProductImage = (product) => {
    if (product?.images?.[0]) return typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url || product.images[0]?.src;
    if (product?.image) return typeof product.image === 'string' ? product.image : product.image?.url;
    return null;
  };
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  };
  const formatCurrency = (amount) => {
    const n = Number(amount) || 0;
    return `$${n.toFixed(2)}`;
  };

  const getSelectedItems = (type) => {
    const key = type === "product" ? "selected_product_ids" : type === "category" ? "selected_category_ids" : "selected_brand_ids";
    return dealFormData[key] || [];
  };

  const dateToISO = (value) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  // ✅ NEW: Convert ISO string to YYYY-MM-DD format (timezone-safe, local date)
  // Handles both ISO strings (2026-10-12T00:00:00.000Z) and date objects
  const dateToInputFormat = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    // Use local date, not UTC to avoid timezone shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dealSaveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? dealApi.update(id, data) : dealApi.create(data)),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["banner-deal-options"] });
      toast.success(t("admin.deals.toast.created"));
      const newDealId = result?._id || result?.id || result?.data?._id || result?.data?.id;
      if (newDealId && !variables.id) {
        setForm(prev => ({ ...prev, linkedDealId: newDealId }));
      }
      resetDealForm();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to save deal"),
  });

  const dealInputStyle = { backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" };
  const dealCardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  const handleDealSubmit = (e) => {
    e.preventDefault();
    if (!String(dealFormData.name || "").trim()) return toast.error(t("admin.deals.validation.nameRequired"));

    const dealValue = dealFormData.value === "" ? NaN : Number(dealFormData.value);
    if (["percentage", "fixed_amount"].includes(dealFormData.value_type)) {
      if (Number.isNaN(dealValue) || dealValue < 0) return toast.error(t("admin.deals.validation.value"));
      if (dealFormData.value_type === "percentage" && dealValue > 100) return toast.error(t("admin.deals.validation.percentage"));
    }

    if (dealFormData.value_type === "buy_x_get_y") {
      if (!dealFormData.buy_quantity || Number(dealFormData.buy_quantity) <= 0) return toast.error(t("admin.deals.validation.buyQty"));
      if (!dealFormData.get_quantity || Number(dealFormData.get_quantity) <= 0) return toast.error(t("admin.deals.validation.getQty"));
    }

    // ✅ Bundle deal ke liye bundle price zaroori hai
    if (dealFormData.value_type === "bundle" && (!dealFormData.bundle_price || Number(dealFormData.bundle_price) <= 0)) {
      return toast.error(t("admin.promotions.ui.generated.183c6ea27eca"));
    }

    if (dealFormData.target_type === "product" && dealFormData.selected_product_ids.length === 0) return toast.error(t("admin.discounts.validation.selectProduct"));
    if (dealFormData.target_type === "category" && dealFormData.selected_category_ids.length === 0) return toast.error(t("admin.discounts.validation.selectCategory"));
    if (dealFormData.target_type === "brand" && dealFormData.selected_brand_ids.length === 0) return toast.error(t("admin.discounts.validation.selectBrand"));

    const startDate = dealFormData.start_at ? dateToISO(dealFormData.start_at) : new Date().toISOString();
    const endDate = dealFormData.end_at ? dateToISO(dealFormData.end_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error(t("admin.discounts.validation.dateOrder"));

    const cleanProductIds = dealFormData.selected_product_ids.map(id => String(id?._id || id));
    const cleanCategoryIds = dealFormData.selected_category_ids.map(id => String(id?._id || id));
    const cleanBrandIds = dealFormData.selected_brand_ids.map(id => String(id?._id || id));

    const payload = {
      name: String(dealFormData.name).trim(),
      description: String(dealFormData.description || "").trim() || undefined,
      applyTo: dealFormData.target_type,
      productIds: dealFormData.target_type === "product" ? cleanProductIds : [],
      categoryIds: dealFormData.target_type === "category" ? cleanCategoryIds : [],
      brandIds: dealFormData.target_type === "brand" ? cleanBrandIds : [],
      type: dealFormData.value_type,
      discountValue: ["percentage", "fixed_amount"].includes(dealFormData.value_type) ? dealValue : 0,
      minOrderValue: dealFormData.min_order_value ? Number(dealFormData.min_order_value) : 0,
      buyQuantity: dealFormData.buy_quantity ? Number(dealFormData.buy_quantity) : 1,
      getQuantity: dealFormData.get_quantity ? Number(dealFormData.get_quantity) : 1,
      getDiscountValue: dealFormData.get_discount_value ? Number(dealFormData.get_discount_value) : 100,
      bundlePrice: dealFormData.bundle_price ? Number(dealFormData.bundle_price) : 0,
      // ✅ Bundle image — sirf bundle deal par save hoti hai, warna clear
      image: dealFormData.value_type === "bundle" ? String(dealFormData.bundle_image || "") : "",
      minQuantity: dealFormData.min_quantity ? Number(dealFormData.min_quantity) : 1,
      startDate, endDate,
      usageLimit: dealFormData.usage_limit !== "" ? Number(dealFormData.usage_limit) : null,
      perUserLimit: dealFormData.per_user_limit !== "" ? Number(dealFormData.per_user_limit) : null,
      isActive: dealFormData.status === "active",
      isFeatured: Boolean(dealFormData.is_featured),
    };

    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null) delete payload[key]; });
    dealSaveMutation.mutate({ id: null, data: payload });
  };

  // --- End Deal Form State ---

  // --- Data Queries ---
  const { data: productsResponse = [] } = useQuery({ queryKey: ["admin-products"], queryFn: productApi.getAll, staleTime: 60000 });
  const products = useMemo(() => normalizeArrayResponse(productsResponse), [productsResponse]);
  const { data: categoriesResponse = [] } = useQuery({ queryKey: ["admin-categories-list"], queryFn: categoryApi.getAll, staleTime: 60000 });
  const categories = useMemo(() => normalizeArrayResponse(categoriesResponse), [categoriesResponse]);
  const { data: brandsResponse = [] } = useQuery({ queryKey: ["admin-brands-list"], queryFn: brandApi.getAll, staleTime: 60000 });
  const brands = useMemo(() => normalizeArrayResponse(brandsResponse), [brandsResponse]);

  const stats = useMemo(() => ({
    total: banners.length,
    active: banners.filter(b => b.status === "active").length,
    scheduled: banners.filter(b => b.status === "scheduled").length,
    expired: banners.filter(b => b.status === "expired").length,
    draft: banners.filter(b => b.status === "draft").length,
  }), [banners]);

  const allSelected = paginatedBanners.length > 0 && paginatedBanners.every((b) => selectedIds.includes(b._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : paginatedBanners.map((b) => b._id));
  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  // --- Handlers ---
  const handleSubmit = (e) => {
    e.preventDefault();

    // Prevent submit if position is duplicate
    if (positionDuplicate) {
      toast.error(positionDuplicate);
      return;
    }

    // Prevent submit if position is invalid
    const pos = parseInt(form.position, 10);
    if (!Number.isFinite(pos) || pos < 1) {
      toast.error(t("admin.banners.validation.positionPositive"));
      return;
    }

    // Entity link types ke liye selection required
    if (form.primaryButton.linkType === "product" && !String(form.primaryButton.productId || "").trim()) {
      toast.error(t("admin.banners.validation.productRequired"));
      return;
    }
    if (form.primaryButton.linkType === "category" && !String(form.primaryButton.categoryId || "").trim()) {
      toast.error(t("admin.banners.validation.categoryRequired"));
      return;
    }
    if (form.primaryButton.linkType === "brand" && !String(form.primaryButton.brandId || "").trim()) {
      toast.error(t("admin.banners.validation.brandRequired"));
      return;
    }

    // ✅ Dates ko proper ISO string mein convert karo.
    // NOTE: form state ko MUTATE mat karo (`form.startDate = ...`). Pehle yahi hota
    // tha — error aane par modal me jo value dikh rahi hai wo corrupt ISO string ho
    // jati thi, aur date input use reject karke field khaali kar deta tha.
    const isoStart = dateToISO(form.startDate);
    const isoEnd = dateToISO(form.endDate);

    // Range validation — deals/discounts me ye check lagaya hua hai, banners me
    // missing tha. Galat range save hone se banner storefront pe kabhi dikhta hi nahi.
    if (isoStart && isoEnd && new Date(isoEnd) < new Date(isoStart)) {
      toast.error(t("admin.banners.validation.endDate"));
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      // startDate/endDate loop ke baad explicitly append hote hain (ISO ke saath)
      if (key === "startDate" || key === "endDate") return;

      // Skip fields that should never be sent from the frontend
      // FIX: status ko loop mein skip karo — wo neeche auto-status block mein exactly
      // ek baar append hota hai. Pehle dono jagah append hone se multipart mein
      // status ["active","active"] array ban jata tha aur Mongoose cast error deta tha
      // ("Cast to string failed ... (type Array) at path "status"") — edit fail hoti thi.
      if (['_id', '__v', 'createdAt', 'updatedAt', 'createdby', 'updatedby', 'status'].includes(key)) {
        return;
      }

      // 1. Skip existing image strings. Backend will retain them if not replaced by a new File.
      if (['desktopImage', 'tabletImage', 'mobileImage'].includes(key) && typeof value === 'string') {
        return;
      }

      // 2. FIX: Handle nested primaryButton object — empty ID fields remove karo
      // (Prevents MongoDB ObjectId cast error) aur entity selection se link banao,
      // taake storefront ButtonLink (jo button.link use karta hai) sahi page par le jaye.
      if (key === 'primaryButton' && typeof value === 'object' && value !== null) {
        const cleanPrimaryButton = { ...value };
        ['dealId', 'productId', 'categoryId', 'brandId'].forEach((idKey) => {
          if (!cleanPrimaryButton[idKey] || String(cleanPrimaryButton[idKey]).trim() === '') {
            delete cleanPrimaryButton[idKey];
          }
        });
        if (cleanPrimaryButton.linkType === 'product' && cleanPrimaryButton.productId) {
          cleanPrimaryButton.link = `/product/${cleanPrimaryButton.productId}`;
        } else if (cleanPrimaryButton.linkType === 'category' && cleanPrimaryButton.categoryId) {
          // ✅ `/category/<id>` ka koi route hi nahi hai → storefront par 404.
          // Baqi har jagah (Header, HomeCategories, HomeNav, PopularCategories)
          // isi pattern par jata hai, is liye wahi use karo.
          cleanPrimaryButton.link = `/filtering-product?category=${cleanPrimaryButton.categoryId}`;
        } else if (cleanPrimaryButton.linkType === 'brand' && cleanPrimaryButton.brandId) {
          cleanPrimaryButton.link = `/brand/${cleanPrimaryButton.brandId}`;
        }
        fd.append(key, JSON.stringify(cleanPrimaryButton));
        return;
      }

      // 3. FIX: Skip empty linkedDealId to prevent MongoDB ObjectId cast errors
      if (key === 'linkedDealId' && (!value || String(value).trim() === '')) {
        return;
      }

         // 4. Append valid values
      if (value instanceof File) {
        fd.append(key, value);
      } else if (typeof value === "object" && value !== null) {
        fd.append(key, JSON.stringify(value));
      } else if (value !== null && value !== undefined) {
        fd.append(key, value);
      }
    });

    // Dates ab loop se bahar append hoti hain — hamesha exact ISO value jayegi,
    // chahe form state me blank ho ya date-input ne value normalize ki ho.
    if (isoStart) fd.append("startDate", isoStart);
    if (isoEnd) fd.append("endDate", isoEnd);

    // ✅ Auto status: dates ke hisaab se status compute karo
    const nowDate = new Date();
    const startD = isoStart ? new Date(isoStart) : null;
    const endD = isoEnd ? new Date(isoEnd) : null;
    let autoStatus = "active";
    if (endD && endD < nowDate) autoStatus = "expired";
    else if (startD && startD > nowDate) autoStatus = "scheduled";
    fd.append("status", autoStatus);
    bannerMutation.mutate({ data: fd, id: editingBanner?._id });
  };

   const handleEdit = (banner) => {
    setEditingBanner(banner);
    setPositionDuplicate("");
    // ✅ FIX: Schedule fields <Input type="date"> hain, jo sirf "YYYY-MM-DD" accept
    // karte hain. Pehle yahan "YYYY-MM-DDTHH:MM" (datetime-local format) bana rahe
    // the — woh date input ke liye INVALID value hai, browser use reject karke field
    // KHALI render kar deta tha. Isliye Edit karte hi start/end date "gayab" ho jate
    // the (chahe DB me maujood hon), aur save pe blank value FormData me add nahi hoti.
    // dateToInputFormat() exactly "YYYY-MM-DD" deta hai — wahi format chahiye tha.
    const toId = (v) => {
      if (!v) return "";
      if (typeof v === "object" && v._id) return String(v._id);
      return String(v);
    };
    setForm({
      ...banner,
      startDate: dateToInputFormat(banner.startDate),
      endDate: dateToInputFormat(banner.endDate),
      primaryButton: {
        text: banner.primaryButton?.text || "",
        linkType: banner.primaryButton?.linkType || "custom_url",
        link: banner.primaryButton?.link || "",
        dealId: (() => {
          const d = banner.primaryButton?.dealId;
          if (!d) return "";
          if (typeof d === "object" && d._id) return String(d._id);
          return String(d);
        })(),
        productId: toId(banner.primaryButton?.productId),
        categoryId: toId(banner.primaryButton?.categoryId),
        brandId: toId(banner.primaryButton?.brandId),
      },
     });
    setShowModal(true);
  };

  const handleOpenAdd = () => { resetForm(); setShowModal(true); };

  // ✅ Deep-link support: /admin/banners?edit=<id> opens the existing edit modal
  // (navigated from the Banner Details page "Edit" action)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId || !Array.isArray(banners) || banners.length === 0) return;
    const target = banners.find((b) => b?._id === editId);
    if (!target) return;
    handleEdit(target);
    window.history.replaceState({}, "", "/admin/banners");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners]);

  const handleToggleStatus = (banner) => {
    const id = banner?._id;
    const isActive = banner?.status === "active" || banner?.status === "scheduled";
    toggleStatusMutation.mutate({ id, newStatus: isActive ? "inactive" : "active" });
  };
  const handleDelete = (banner) => setDeleteTarget({ banners: [banner] });
  const handleBulkDelete = () => setDeleteTarget({ banners: banners.filter((b) => selectedIds.includes(b._id)) });
  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.banners.map((b) => b._id), { onSettled: () => setDeleteTarget(null) });
  };
  
  const handleSort = (key) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateNested = (parent, field, value) => setForm((prev) => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }));

  const getImagePreview = (file) => {
    if (!file) return null;
    if (typeof File !== "undefined" && file instanceof File) return getFilePreviewUrl(file);
    return getImageUrl(file);
  };

  // --- Reusable Styles ---
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button type="button" onClick={() => handleSort(sortKey)} className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80" style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label}
        <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const SelectFilter = ({ value, onChange, children }) => (
    <div className="relative">
      <select value={value} onChange={onChange} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent-soft)]" style={inputStyle}>
        {children}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </span>
    </div>
  );

  const ActionButtons = ({ banner }) => {
    const id = banner._id;
    const open = actionMenu?.id === id;

    const toggleMenu = (e) => {
      e.stopPropagation();
      if (open) { setActionMenu(null); return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 250; // 5 items height
      const menuWidth = 176;
      const top = rect.bottom + 6 + menuHeight > window.innerHeight
        ? rect.top - 6 - menuHeight
        : rect.bottom + 6;
      const left = Math.max(8, rect.right - menuWidth);
      setActionMenu({ id, top, left });
    };

    return (
      <div className="flex items-center justify-end">
        <button
          onClick={toggleMenu}
          aria-label={`Actions for ${banner?.title || "banner"}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-[var(--bg-tertiary)] flex items-center justify-center"
          style={{ color: "var(--text-secondary)" }}
          title={t("admin.featuredProducts.ui.actions")}
        >
          <DotsIcon className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActionMenu(null); }} />
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 w-44 rounded-lg shadow-xl border py-1"
              style={{
                top: actionMenu.top,
                left: actionMenu.left,
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-color)",
              }}
            >
              <MenuItem
                icon={<EyeIcon className="w-4 h-4" />}
                label={t("admin.promotions.ui.generated.e45a7490664f")}
                onClick={() => { setActionMenu(null); router.push(`${pathname}/${id}`); }}
              />
              <MenuItem
                icon={<EditIcon className="w-4 h-4" />}
                label={t("admin.promotions.ui.generated.4c1ac215acc0")}
                onClick={() => { setActionMenu(null); handleEdit(banner); }}
              />
              <MenuItem
                icon={<CopyIcon className="w-4 h-4" />}
                label={t("admin.promotions.ui.generated.5e4cd5ffe4f2")}
                onClick={() => { 
                  setActionMenu(null); 
                  adminBannerApi.duplicate(id).then(() => { 
                    queryClient.invalidateQueries({ queryKey: ["adminBanners"] }); 
                    toast.success(t("admin.banners.toast.duplicatedShort")); 
                  }); 
                }}
              />
              <MenuItem
                icon={<PowerIcon className="w-4 h-4" />}
                label={(banner.status === "active" || banner.status === "scheduled") ? "Deactivate" : "Activate"}
                danger={(banner.status === "active" || banner.status === "scheduled")}
                success={!((banner.status === "active" || banner.status === "scheduled"))}
                onClick={() => { setActionMenu(null); handleToggleStatus(banner); }}
              />
              <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
              <MenuItem
                icon={<TrashIcon className="w-4 h-4" />}
                label={t("admin.promotions.ui.generated.9485989ff514")}
                danger
                onClick={() => { setActionMenu(null); handleDelete(banner); }}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (currentPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  return (
    <div className="w-full min-h-screen" dir={dir} lang={locale} style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.banners.page.heading")}</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.51b820dfa0f7")}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title={t("admin.brands.ui.listView")}><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title={t("admin.featuredProducts.ui.gridView")}><GridIcon /></button>
            </div>
            <button onClick={handleOpenAdd} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <PlusIcon /> {t("admin.banners.page.addBanner")}
            </button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: t("admin.promotions.ui.generated.299c3da20015"), value: stats.total, color: "var(--text-primary)" },
            { label: t("admin.banners.page.active"), value: stats.active, color: "var(--success-text)" },
            { label: t("admin.promotions.ui.generated.e891e3709fb4"), value: stats.scheduled, color: "var(--info-text)" },
            { label: t("admin.shared.status.expired"), value: stats.expired, color: "var(--text-muted)" },
            { label: t("admin.shared.status.draft"), value: stats.draft, color: "var(--warning-text)" },
          ].map((stat, i) => (
            <div key={i} className="rounded-lg p-4" style={cardStyle}>
              <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
              <p className="text-[20px] font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ===== Professional Toolbar: Search Left, Filters Right ===== */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Wider Search Bar (Left Side) */}
          <div className="relative w-full md:w-[400px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
              <SearchIcon />
            </span>
            <input 
              type="text" 
              placeholder={t("admin.banners.page.searchPlaceholder")} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-[var(--accent-soft)]"
              style={inputStyle} 
            />
          </div>

          {/* Filters (Right Side) */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <SelectFilter value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">{t("admin.attributes.filter.allStatus")}</option>
              <option value="active">{t("admin.banners.page.active")}</option>
              <option value="inactive">{t("common.inactive")}</option>
              <option value="expired">{t("admin.shared.status.expired")}</option>
            </SelectFilter>
            <SelectFilter value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">{t("admin.promotions.ui.generated.5afd80c9916f")}</option>
              <option value="homepage_hero">{t("admin.promotions.ui.generated.59b57435cfd9")}</option>
              <option value="promotional">{t("admin.promotions.ui.generated.6cde26a45732")}</option>
              <option value="product">{t("common.product")}</option>
              <option value="collection">{t("admin.promotions.ui.generated.2037de437c80")}</option>
            </SelectFilter>
          </div>
        </div>

        {/* ===== Bulk Selection Bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--success-text)" }}>{selectedIds.length}{" "}{t("admin.promotions.ui.generated.835f3b50e337")}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("admin.featuredProducts.modal.clear")}</button>
              <button onClick={handleBulkDelete} disabled={deleteMutation.isPending} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                <TrashIcon className="w-3.5 h-3.5" /> {t("admin.discounts.page.deleteSelected")}
              </button>
            </div>
          </div>
        )}

        {/* ===== Data Display ===== */}
        {loading ? (
          /* ✅ SKELETON — spinner ki jagah real layout ka skeleton:
             list view me wahi table shell + shimmer rows, grid view me shimmer cards */
          viewMode === "list" ? (
            <div className="rounded-lg overflow-hidden" style={cardStyle}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <tr>
                      <th className="px-4 py-3 w-10"><span className="skeleton block h-4 w-4 rounded" /></th>
                      <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.banners.page.preview")}</th>
                      <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.banners.detail.title")}</th>
                      <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.d0a3e7f81a98")}</th>
                      <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.brands.detail.productTableStatus")}</th>
                      <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>{t("admin.banners.page.schedule")}</th>
                      <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.banners.page.positionShort")}</th>
                      <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{t("admin.banners.page.actions")}</th>
                    </tr>
                  </thead>
                  <BannerRowsSkeleton rows={itemsPerPage} />
                </table>
              </div>
            </div>
          ) : (
            <BannerCardsSkeleton cards={8} cardStyle={cardStyle} />
          )
        ) : paginatedBanners.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterStatus !== "all" ? t("admin.banners.page.noMatch") : t("admin.banners.page.noBannerYet")}</p>
            {!search && filterStatus === "all" && (
              <button onClick={handleOpenAdd} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>+ {t("admin.banners.page.addFirst")}</button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("admin.banners.page.preview")}</th>
                    <SortHeader label={t("admin.banners.detail.title")} sortKey="title" />
                    <SortHeader label={t("admin.promotions.ui.generated.d0a3e7f81a98")} sortKey="bannerType" />
                    <SortHeader label={t("admin.brands.detail.productTableStatus")} sortKey="status" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>{t("admin.banners.page.schedule")}</th>
                    <SortHeader label={t("admin.promotions.ui.generated.1478c028a167")} sortKey="position" />
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{t("admin.banners.page.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBanners.map((banner, index) => {
                    const isSelected = selectedIds.includes(banner._id);
                    return (
                      <tr key={banner._id} onClick={() => router.push(`${pathname}/${banner._id}`)} className="transition cursor-pointer" style={{ borderBottom: index < paginatedBanners.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(banner._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                        </td>
                        <td className="px-4 py-2.5">
                          <img src={getImagePreview(banner.desktopImage)} alt={banner.altText} className="w-24 h-12 object-cover rounded border" style={{ borderColor: "var(--border-color)" }} />
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[13px]">{contentOf(banner.title, banner.translations?.title)}</td>
                        <td className="px-4 py-2.5 capitalize text-[13px]" style={{ color: "var(--text-secondary)" }}>{banner.bannerType.replace("_", " ")}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={banner.status} /></td>
                        <td className="px-4 py-2.5 text-[13px] hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                          {banner.startDate ? formatDate(banner.startDate, locale) : "—"}{" "}{t("admin.promotions.ui.generated.4374aaee247f")}{" "}{banner.endDate ? formatDate(banner.endDate, locale) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-[13px]">{banner.position}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1">
                          <ActionButtons banner={banner} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedBanners.map((banner) => (
              <div key={banner._id} onClick={() => router.push(`${pathname}/${banner._id}`)} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                <img src={getImagePreview(banner.desktopImage)} alt={banner.altText} className="w-full h-32 object-cover rounded-md" style={{ border: "1px solid var(--border-color)" }} />
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] truncate">{contentOf(banner.title, banner.translations?.title)}</p>
                    <p className="text-[11px] capitalize mt-0.5" style={{ color: "var(--text-muted)" }}>{banner.bannerType.replace("_", " ")}</p>
                  </div>
                  <StatusBadge status={banner.status} />
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.e9b0086c168c")}{" "}{banner.position}</span>
                  <ActionButtons banner={banner} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Pagination ===== */}
        {totalBanners > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("admin.featuredProducts.ui.showing")}{" "}{startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalBanners)}{" "}{t("admin.featuredProducts.ui.of")}{" "}{totalBanners}{" "}{t("admin.nav.item.banners")}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeftIcon className="w-4 h-4" /></button>
              <div className="flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> : (
                      <button onClick={() => setCurrentPage(page)} className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)", color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}` }}>{page}</button>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRightIcon className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* ===== PROFESSIONAL MODAL FORM ===== */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}>
              {/* Modal Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{editingBanner ? t("admin.banners.page.editBanner") : t("admin.banners.page.addBanner")}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t("admin.promotions.ui.generated.f85396668ef1")}{" "}{editingBanner ? t("admin.banners.page.editBanner").toLowerCase() : t("admin.banners.page.addBanner").toLowerCase()}{" "}{t("admin.promotions.ui.generated.193cff426bba")}</p>
                </div>
                <button onClick={() => { setShowModal(false); resetForm(); }} disabled={bannerMutation.isPending} className="p-2 rounded-lg transition disabled:opacity-50 hover:bg-gray-500/10">
                  <CloseIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                
                {/* 1. Basic Information */}
                <FormSection number="1" title={t("admin.categories.form.basicInfo")} description={t("admin.promotions.ui.generated.fc15c43868d9")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label={t("admin.promotions.ui.generated.fb4e62a66212")} required helpText={t("admin.promotions.ui.generated.7276662c1b5b")}>
                      <Input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)} required placeholder={t("admin.promotions.ui.generated.a589c4e03cdf")} />
                    </FormField>
                    <FormField label={t("admin.promotions.ui.generated.b28b426cddce")} helpText={t("admin.promotions.ui.generated.016a111cc7b8")}>
                      <Select value={form.bannerType} onChange={(e) => updateForm("bannerType", e.target.value)}>
                        <option value="homepage_hero">{t("admin.promotions.ui.generated.59b57435cfd9")}</option>
                        <option value="promotional">{t("admin.promotions.ui.generated.6cde26a45732")}</option>
                        <option value="product">{t("common.product")}</option>
                        <option value="collection">{t("admin.promotions.ui.generated.2037de437c80")}</option>
                        <option value="popup">{t("admin.promotions.ui.generated.3b6fb9033a83")}</option>
                      </Select>
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <FormField label={t("admin.promotions.ui.generated.90be16585da2")} required helpText={t("admin.promotions.ui.generated.9b4539d532ea")}>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={form.position}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateForm("position", val === "" ? "" : val);
                            if (val !== "") checkPositionDuplicate(val, editingBanner?._id || null);
                            else setPositionDuplicate("");
                          }}
                          placeholder="e.g., 1"
                          style={positionDuplicate ? { borderColor: "var(--danger)" } : {}}
                        />
                        {positionDuplicate && (
                          <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: "var(--danger)" }}>
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {positionDuplicate}
                          </p>
                        )}
                      </div>
                    </FormField>
                  </div>
                </FormSection>

                {/* 2. Responsive Images */}
                <FormSection number="2" title={t("admin.promotions.ui.generated.21ab35490f09")} description={t("admin.promotions.ui.generated.1e3643257aa2")}>
                  <div className="grid grid-cols-1 gap-4">
                    <ImageUploadBox
                      label={t("admin.promotions.ui.generated.74e894d2ba1b")}
                      required
                      dimensions="1920x600px recommended"
                      file={form.desktopImage}
                      setFile={(f) => updateForm("desktopImage", f)}
                      preview={getImagePreview(form.desktopImage)}
                    />
                  </div>
               
                </FormSection>

                {/* 3. Banner Content */}
                <FormSection number="3" title={t("admin.promotions.ui.generated.f243628d5358")} description={t("admin.promotions.ui.generated.b0c97aeaa329")}>
                  <div className="space-y-4">
                    <FormField label={t("admin.promotions.ui.generated.2a8669ea5f98")} helpText={t("admin.promotions.ui.generated.e6ff69230b64")}>
                      <Input type="text" value={form.eyebrow} onChange={(e) => updateForm("eyebrow", e.target.value)} placeholder={t("admin.promotions.ui.generated.8b9078dcbffb")} />
                    </FormField>
                    <FormField label={t("admin.banners.detail.heading")} required helpText={t("admin.promotions.ui.generated.281b01376894")}>
                      <Input type="text" value={form.heading} onChange={(e) => updateForm("heading", e.target.value)} placeholder={t("admin.promotions.ui.generated.7567f0cc3da4")} />
                    </FormField>
                    <FormField label={t("common.description")} helpText={t("admin.promotions.ui.generated.318959db31c9")}>
                      <Textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows="3" placeholder={t("admin.promotions.ui.generated.b187c59b57e4")} />
                    </FormField>
                  </div>
                </FormSection>

                {/* 4. Call to Action */}
                <FormSection number="4" title={t("admin.promotions.ui.generated.c8db8ba44a0c")} description="Button, link & deal configuration">
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField label={t("admin.promotions.ui.generated.9905b0ab47e6")} helpText={t("admin.promotions.ui.generated.f1365e5fb311")}>
                        <Input type="text" value={form.primaryButton.text} onChange={(e) => updateNested("primaryButton", "text", e.target.value)} placeholder={t("admin.promotions.ui.generated.cc3936825cbc")} />
                      </FormField>
                      <FormField label={t("admin.promotions.ui.generated.a1b4254f5c21")} helpText={t("admin.promotions.ui.generated.36aae8e46c09")}>
                        <Select value={form.primaryButton.linkType} onChange={(e) => updateNested("primaryButton", "linkType", e.target.value)}>
                          <option value="custom_url">{t("admin.promotions.ui.generated.c234572ce0d7")}</option>
                          <option value="product">{t("admin.promotions.ui.generated.9ae00634a948")}</option>
                          <option value="category">{t("admin.promotions.ui.generated.813068322e61")}</option>
                          <option value="brand">{t("admin.promotions.ui.generated.80a72e79f7e9")}</option>
                          <option value="deal">{t("admin.promotions.ui.generated.3c3aa4dcbf06")}</option>
                          <option value="none">{t("admin.promotions.ui.generated.65194c1f81b3")}</option>
                        </Select>
                      </FormField>
                      {form.primaryButton.linkType === "product" && (
                        <FormField label={t("admin.promotions.ui.generated.171e528920c0")} required helpText={t("admin.promotions.ui.generated.74e8464d31d8")}>
                          <Select
                            value={form.primaryButton.productId || ""}
                            onChange={(e) => updateNested("primaryButton", "productId", e.target.value)}
                          >
                            <option value="">{t("admin.promotions.ui.generated.741c59e5d0f9")}</option>
                            {products.map((p) => (
                              <option key={p._id || p.id} value={p._id || p.id}>
                                {productNameOf(p) || p.title}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      )}
                      {form.primaryButton.linkType === "category" && (
                        <FormField label={t("admin.productDetail.page.selectCategory")} required helpText={t("admin.promotions.ui.generated.5607aae0a2fd")}>
                          <Select
                            value={form.primaryButton.categoryId || ""}
                            onChange={(e) => updateNested("primaryButton", "categoryId", e.target.value)}
                          >
                            <option value="">{t("admin.promotions.ui.generated.ea15f779a748")}</option>
                            {categories.map((c) => (
                              <option key={c._id || c.id} value={c._id || c.id}>
                                {nameOf(c)}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      )}
                      {form.primaryButton.linkType === "brand" && (
                        <FormField label={t("admin.productDetail.page.selectBrand")} required helpText={t("admin.promotions.ui.generated.698dfd15b57e")}>
                          <Select
                            value={form.primaryButton.brandId || ""}
                            onChange={(e) => updateNested("primaryButton", "brandId", e.target.value)}
                          >
                            <option value="">{t("admin.promotions.ui.generated.63b100e956ff")}</option>
                            {brands.map((b) => (
                              <option key={b._id || b.id} value={b._id || b.id}>
                                {nameOf(b)}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      )}
                      {form.primaryButton.linkType === "deal" && (
                        <FormField label={t("admin.promotions.ui.generated.a66063367127")} required helpText={t("admin.promotions.ui.generated.9ee5b6313eef")}>
                          <Select
                            value={form.primaryButton.dealId || ""}
                            onChange={(e) => updateNested("primaryButton", "dealId", e.target.value)}
                          >
                            <option value="">{t("admin.promotions.ui.generated.05c0d0455546")}</option>
                            {deals.map((d) => (
                              <option key={d._id || d.id} value={d._id || d.id}>
                                {contentOf(d.name, d.translations?.name)}{d.isActive ? "" : ` (${t("admin.banners.page.disabled")})`}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      )}
                      {form.primaryButton.linkType === "custom_url" && (
                        <FormField label={t("admin.promotions.ui.generated.e79411425b71")} required helpText={t("admin.promotions.ui.generated.3cec9bd6d577")}>
                          <Input type="text" value={form.primaryButton.link} onChange={(e) => updateNested("primaryButton", "link", e.target.value)} placeholder={t("admin.promotions.ui.generated.98204c44686b")} />
                        </FormField>
                      )}
                    </div>
                  </div>
                </FormSection>

                {/* 5. Schedule */}
                <FormSection number="5" title={t("admin.banners.page.schedule")} description={t("admin.promotions.ui.generated.bad8452adcc7")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label={t("admin.discounts.form.startDate")} helpText={t("admin.promotions.ui.generated.66da02d35798")}>
                      <Input type="date" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} />
                    </FormField>
                    <FormField label={t("admin.promotions.ui.generated.269c8b374312")} helpText={t("admin.promotions.ui.generated.ce497a6f87ec")}>
                      <Input type="date" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} />
                    </FormField>
                  </div>
                </FormSection>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    disabled={bannerMutation.isPending}
                    className="flex-1 h-11 rounded-lg text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}
                  >{t("admin.discounts.delete.cancel")}</button>
                  <button
                    type="submit"
                    disabled={bannerMutation.isPending || !!positionDuplicate}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold transition disabled:opacity-50 hover:opacity-90 bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
                  >
                    {bannerMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner className="w-4 h-4" />{t("common.saving")}</span>
                    ) : editingBanner ? t("admin.banners.toast.updated") : t("admin.banners.toast.added")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== DELETE CONFIRMATION MODAL ===== */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)", animation: "modalScaleIn 0.2s ease-out" }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--danger, var(--danger))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{deleteTarget.banners.length === 1 ? `Delete "${deleteTarget.banners[0].title}"?` : `Delete ${deleteTarget.banners.length} banners?`}</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{t("admin.products.delete.body")}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border" style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>{t("admin.discounts.delete.cancel")}</button>
                <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                  {deleteMutation.isPending ? <><Spinner className="w-3.5 h-3.5" />{" "}{t("admin.promotions.ui.generated.30f6237868a6")}</> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== INLINE DEAL FORM MODAL ===== */}
        {dealFormType && (
          <DealFormModal
            formType={dealFormType}
            formData={dealFormData}
            setFormData={setDealFormData}
            editingDeal={null}
            saveMutation={dealSaveMutation}
            setShowModal={() => resetDealForm()}
            resetForm={resetDealForm}
            setSelector={setDealSelector}
            getSelectedItems={getSelectedItems}
            handleSubmit={handleDealSubmit}
            inputStyle={dealInputStyle}
            products={products}
            categories={categories}
            brands={brands}
          />
        )}

        {/* ===== INLINE SELECTION MODAL ===== */}
        {dealSelector.open && (
          <SelectionModal
            type={dealSelector.type}
            items={dealSelector.type === "product" ? products : dealSelector.type === "category" ? categories : brands}
            selectedIds={dealSelector.type === "product" ? dealFormData.selected_product_ids : dealSelector.type === "category" ? dealFormData.selected_category_ids : dealFormData.selected_brand_ids}
            onClose={() => setDealSelector({ open: false, type: null })}
            onApply={(ids) => {
              const key = dealSelector.type === "product" ? "selected_product_ids" : dealSelector.type === "category" ? "selected_category_ids" : "selected_brand_ids";
              setDealFormData(prev => ({ ...prev, [key]: ids }));
              setDealSelector({ open: false, type: null });
            }}
            inputStyle={dealInputStyle}
            cardStyle={dealCardStyle}
          />
        )}

      </div>
    </div>
  );
}

