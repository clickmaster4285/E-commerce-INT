"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import useBannerSocketSync from "../../../hooks/useBannerSocket";
import { dealApi } from "../../../apis/admin/dealApi";
import { DealFormModal, SelectionModal } from "../deals/page";
import { productApi } from "../../../apis/admin/productApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";

// ==========================================
// API SETUP
// ==========================================
const API_BASE = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "";
const API_URL = `${API_BASE}/api`;

const bannerAxios = axios.create({
  baseURL: API_URL,
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
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const SortIndicator = ({ active, direction }) => (<svg className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>{active && direction === "desc" ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}</svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const UploadIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const CopyIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>);
const InfoIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const TagIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>);
const DotsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>);
const PowerIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 2v10" /></svg>);

// ==========================================
// HELPERS
// ==========================================
const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

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
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
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
    className="w-full h-10 px-3 rounded-md text-sm border outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-gray-400"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full h-10 px-3 rounded-md text-sm border outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
  >
    {children}
  </select>
);

const Textarea = ({ ...props }) => (
  <textarea
    {...props}
    className="w-full px-3 py-2.5 rounded-md text-sm border outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-gray-400 resize-none"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
  />
);

/* ==================== DRAG AND DROP IMAGE UPLOAD (FIXED) ==================== */
const ImageUploadBox = ({ label, file, setFile, preview, required, dimensions }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to get valid preview URL
  const getPreviewUrl = () => {
    if (!file) return null;
    if (file instanceof File) return URL.createObjectURL(file);
    if (typeof file === 'string') {
      // If it's already a URL string (from DB), use it directly or prepend base
      return file.startsWith('http') ? file : `${API_BASE}${file.startsWith('/') ? '' : '/'}${file}`;
    }
    return null;
  };

  const currentPreview = preview || getPreviewUrl();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
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
      const droppedFile = droppedFiles[0];
      if (droppedFile.type.startsWith('image/')) {
        setFile(droppedFile);
      } else {
        toast.error("Please upload an image file");
      }
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation(); // Prevent triggering click on container
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {/* Drop Zone / Preview Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !currentPreview && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-4 transition-all duration-200 
          ${currentPreview 
            ? "border-emerald-500/50 bg-emerald-500/5 cursor-default" 
            : isDragging 
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]" 
              : "hover:border-emerald-400 hover:bg-black/5 cursor-pointer"
          }`}
        style={{ 
          borderColor: currentPreview ? "" : isDragging ? "" : "var(--border-color)", 
          backgroundColor: currentPreview ? "" : isDragging ? "" : "var(--bg-tertiary)" 
        }}
      >
        {currentPreview ? (
          <div className="relative w-full group">
            <img src={currentPreview} alt={label} className="w-full h-32 object-cover rounded-md border border-white/10" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-md border-2 border-[var(--bg-card)]"
              title="Remove image"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div 
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                isDragging ? "bg-emerald-500/20 text-emerald-400" : "bg-transparent"
              }`}
              style={{ backgroundColor: isDragging ? "" : "var(--bg-secondary)" }}
            >
              <UploadIcon className={`w-6 h-6 ${isDragging ? "animate-bounce" : ""}`} style={{ color: isDragging ? "" : "var(--text-muted)" }} />
            </div>
            
            {isDragging ? (
              <p className="text-sm font-bold text-emerald-400">Drop image here</p>
            ) : (
              <>
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  Click to upload or drag and drop
                </p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  SVG, PNG, JPG or GIF
                </p>
                {dimensions && (
                  <p className="text-[10px] mt-0.5 font-mono opacity-70" style={{ color: "var(--text-secondary)" }}>
                    Recommended: {dimensions}
                  </p>
                )}
              </>
            )}
          </div>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
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
    className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-white/5 ${danger ? "text-red-400 hover:bg-red-500/10" : success ? "text-emerald-400 hover:bg-emerald-500/10" : ""}`}
    style={{ color: danger || success ? undefined : "var(--text-primary)" }}
  >
    {icon} {label}
  </button>
);

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function BannersPage() {
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
    primaryButton: { text: "", linkType: "custom_url", link: "", dealId: "" },
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      toast.success(variables.id ? "Banner updated successfully" : "Banner added successfully");
      resetForm();
      setShowModal(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Operation failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => {
      markSelfAction("delete");
      return Promise.all(ids.map((id) => adminBannerApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      setSelectedIds([]);
      toast.success("Banner(s) deleted successfully");
    },
     onError: (error) => toast.error(error.response?.data?.message || "Delete failed"),
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
      toast.success(variables.newStatus === "active" ? "Banner activated" : "Banner deactivated");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Failed to update status"),
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

  const dealSaveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? dealApi.update(id, data) : dealApi.create(data)),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["banner-deal-options"] });
      toast.success("Deal created successfully");
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
    if (!String(dealFormData.name || "").trim()) return toast.error("Deal name is required");

    const dealValue = dealFormData.value === "" ? NaN : Number(dealFormData.value);
    if (["percentage", "fixed_amount"].includes(dealFormData.value_type)) {
      if (Number.isNaN(dealValue) || dealValue < 0) return toast.error("Please enter a valid deal value");
      if (dealFormData.value_type === "percentage" && dealValue > 100) return toast.error("Percentage cannot be greater than 100");
    }

    if (dealFormData.value_type === "buy_x_get_y") {
      if (!dealFormData.buy_quantity || Number(dealFormData.buy_quantity) <= 0) return toast.error("Please enter a valid Buy Quantity");
      if (!dealFormData.get_quantity || Number(dealFormData.get_quantity) <= 0) return toast.error("Please enter a valid Get Quantity");
    }

    if (dealFormData.target_type === "product" && dealFormData.selected_product_ids.length === 0) return toast.error("Select at least one product");
    if (dealFormData.target_type === "category" && dealFormData.selected_category_ids.length === 0) return toast.error("Select at least one category");
    if (dealFormData.target_type === "brand" && dealFormData.selected_brand_ids.length === 0) return toast.error("Select at least one brand");

    const startDate = dealFormData.start_at ? dateToISO(dealFormData.start_at) : new Date().toISOString();
    const endDate = dealFormData.end_at ? dateToISO(dealFormData.end_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

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
      toast.error("Position must be a positive whole number (1 or greater)");
      return;
    }

    const fd = new FormData();
    // ✅ Dates ko proper ISO string mein convert karo
    if (form.startDate) {
      form.startDate = dateToISO(form.startDate);
    }
    if (form.endDate) {
      form.endDate = dateToISO(form.endDate);
    }
    Object.entries(form).forEach(([key, value]) => {
      // Skip fields that should never be sent from the frontend
      if (['_id', '__v', 'createdAt', 'updatedAt', 'createdby', 'updatedby'].includes(key)) {
        return;
      }

      // 1. Skip existing image strings. Backend will retain them if not replaced by a new File.
      if (['desktopImage', 'tabletImage', 'mobileImage'].includes(key) && typeof value === 'string') {
        return;
      }

      // 2. FIX: Handle nested primaryButton object to remove empty dealId (Prevents MongoDB ObjectId cast error)
      if (key === 'primaryButton' && typeof value === 'object' && value !== null) {
        const cleanPrimaryButton = { ...value };
        if (!cleanPrimaryButton.dealId || String(cleanPrimaryButton.dealId).trim() === '') {
          delete cleanPrimaryButton.dealId;
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
        // Dates ko ISO string mein bhejo
        if (key === 'startDate' || key === 'endDate') {
          if (value) fd.append(key, typeof value === 'string' && value.includes('T') ? new Date(value).toISOString() : value);
        } else {
          fd.append(key, value);
        }
      }
    });
    // ✅ Auto status: dates ke hisaab se status compute karo
    const nowDate = new Date();
    const startD = form.startDate ? new Date(form.startDate) : null;
    const endD = form.endDate ? new Date(form.endDate) : null;
    let autoStatus = "active";
    if (endD && endD < nowDate) autoStatus = "expired";
    else if (startD && startD > nowDate) autoStatus = "scheduled";
    fd.append("status", autoStatus);
    bannerMutation.mutate({ data: fd, id: editingBanner?._id });
  };

   const handleEdit = (banner) => {
    setEditingBanner(banner);
    setPositionDuplicate("");
    // ✅ UTC time ko local time mein convert karo (datetime-local input ke liye)
    const formatDateInput = (d) => {
      if (!d) return "";
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return "";
      // Local time ko ISO string format mein convert karo (YYYY-MM-DDTHH:MM)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    setForm({
      ...banner,
      startDate: formatDateInput(banner.startDate),
      endDate: formatDateInput(banner.endDate),
      primaryButton: {
        text: banner.primaryButton?.text || "",
        linkType: banner.primaryButton?.linkType || "custom_url",
        link: banner.primaryButton?.link || "",
        dealId: (() => {
          const d = banner.primaryButton?.dealId;
          if (!d) return "";
          if (typeof d === "object" && d._id) return String(d._id);
          return String(d);
        })()
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
    if (file instanceof File) return URL.createObjectURL(file);
    const cleanPath = file.startsWith('/') ? file : `/${file}`;
    return `${API_BASE}${cleanPath}`;
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
      <select value={value} onChange={onChange} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
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
          className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
          style={{ color: "var(--text-secondary)" }}
          title="Actions"
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
                label="View Details"
                onClick={() => { setActionMenu(null); router.push(`${pathname}/${id}`); }}
              />
              <MenuItem
                icon={<EditIcon className="w-4 h-4" />}
                label="Edit Banner"
                onClick={() => { setActionMenu(null); handleEdit(banner); }}
              />
              <MenuItem
                icon={<CopyIcon className="w-4 h-4" />}
                label="Duplicate"
                onClick={() => { 
                  setActionMenu(null); 
                  adminBannerApi.duplicate(id).then(() => { 
                    queryClient.invalidateQueries({ queryKey: ["adminBanners"] }); 
                    toast.success("Duplicated"); 
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
                label="Delete"
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
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Banner Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage homepage, promotional, and category banners</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="List view"><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="Grid view"><GridIcon /></button>
            </div>
            <button onClick={handleOpenAdd} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <PlusIcon /> Add Banner
            </button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Banners", value: stats.total, color: "var(--text-primary)" },
            { label: "Active", value: stats.active, color: "var(--success-text)" },
            { label: "Scheduled", value: stats.scheduled, color: "var(--info-text)" },
            { label: "Expired", value: stats.expired, color: "var(--text-muted)" },
            { label: "Draft", value: stats.draft, color: "var(--warning-text)" },
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
              placeholder="Search banners..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" 
              style={inputStyle} 
            />
          </div>

          {/* Filters (Right Side) */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <SelectFilter value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
            </SelectFilter>
            <SelectFilter value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="homepage_hero">Homepage Hero</option>
              <option value="promotional">Promotional</option>
              <option value="product">Product</option>
              <option value="collection">Collection</option>
            </SelectFilter>
          </div>
        </div>

        {/* ===== Bulk Selection Bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--success-text)" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} disabled={deleteMutation.isPending} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                <TrashIcon className="w-3.5 h-3.5" /> Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* ===== Data Display ===== */}
        {loading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}>
            <Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading banners...</span>
          </div>
        ) : paginatedBanners.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterStatus !== "all" ? "No banners match your filters" : "No banners yet"}</p>
            {!search && filterStatus === "all" && (
              <button onClick={handleOpenAdd} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>+ Add your first banner</button>
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
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Preview</th>
                    <SortHeader label="Title" sortKey="title" />
                    <SortHeader label="Type" sortKey="bannerType" />
                    <SortHeader label="Status" sortKey="status" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Schedule</th>
                    <SortHeader label="Pos" sortKey="position" />
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
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
                        <td className="px-4 py-2.5 font-medium text-[13px]">{banner.title}</td>
                        <td className="px-4 py-2.5 capitalize text-[13px]" style={{ color: "var(--text-secondary)" }}>{banner.bannerType.replace("_", " ")}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={banner.status} /></td>
                        <td className="px-4 py-2.5 text-[13px] hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                          {banner.startDate ? formatDate(banner.startDate) : "—"} to {banner.endDate ? formatDate(banner.endDate) : "—"}
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
                    <p className="font-semibold text-[13px] truncate">{banner.title}</p>
                    <p className="text-[11px] capitalize mt-0.5" style={{ color: "var(--text-muted)" }}>{banner.bannerType.replace("_", " ")}</p>
                  </div>
                  <StatusBadge status={banner.status} />
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pos: {banner.position}</span>
                  <ActionButtons banner={banner} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Pagination ===== */}
        {totalBanners > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalBanners)} of {totalBanners} banners</p>
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
                  <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{editingBanner ? "Edit Banner" : "Create New Banner"}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Fill in the details below to {editingBanner ? "update" : "create"} your banner</p>
                </div>
                <button onClick={() => { setShowModal(false); resetForm(); }} disabled={bannerMutation.isPending} className="p-2 rounded-lg transition disabled:opacity-50 hover:bg-gray-500/10">
                  <CloseIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                
                {/* 1. Basic Information */}
                <FormSection number="1" title="Basic Information" description="Define your banner's identity and type">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Banner Title" required helpText="Internal name for admin reference">
                      <Input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)} required placeholder="e.g., Summer Sale 2024" />
                    </FormField>
                    <FormField label="Banner Type" helpText="Determines where this banner appears">
                      <Select value={form.bannerType} onChange={(e) => updateForm("bannerType", e.target.value)}>
                        <option value="homepage_hero">Homepage Hero</option>
                        <option value="promotional">Promotional</option>
                        <option value="product">Product</option>
                        <option value="collection">Collection</option>
                        <option value="popup">Popup</option>
                      </Select>
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <FormField label="Position" required helpText="Display order (lowest first). Auto-suggested to next available.">
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
                <FormSection number="2" title="Banner Image" description="Upload the banner image">
                  <div className="grid grid-cols-1 gap-4">
                    <ImageUploadBox
                      label="Desktop Image"
                      required
                      dimensions="1920x600px recommended"
                      file={form.desktopImage}
                      setFile={(f) => updateForm("desktopImage", f)}
                      preview={getImagePreview(form.desktopImage)}
                    />
                  </div>
                  <div className="mt-4">
                    <FormField label="Alt Text" helpText="For SEO and accessibility">
                      <Input type="text" value={form.altText} onChange={(e) => updateForm("altText", e.target.value)} placeholder="Describe the banner image" />
                    </FormField>
                  </div>
                </FormSection>

                {/* 3. Banner Content */}
                <FormSection number="3" title="Banner Content" description="Text content displayed on the banner">
                  <div className="space-y-4">
                    <FormField label="Eyebrow / Small Heading" helpText="Small text above main heading">
                      <Input type="text" value={form.eyebrow} onChange={(e) => updateForm("eyebrow", e.target.value)} placeholder="e.g., SUMMER COLLECTION" />
                    </FormField>
                    <FormField label="Main Heading" required helpText="Primary bold text on banner">
                      <Input type="text" value={form.heading} onChange={(e) => updateForm("heading", e.target.value)} placeholder="e.g., UP TO 50% OFF" />
                    </FormField>
                    <FormField label="Description" helpText="Brief description below heading">
                      <Textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows="3" placeholder="Shop our latest collection..." />
                    </FormField>
                  </div>
                </FormSection>

                {/* 4. Call to Action */}
                <FormSection number="4" title="Call to Action" description="Button, link & deal configuration">
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField label="Button Text" helpText="Text displayed on button">
                        <Input type="text" value={form.primaryButton.text} onChange={(e) => updateNested("primaryButton", "text", e.target.value)} placeholder="e.g., Shop Now" />
                      </FormField>
                      <FormField label="Link Type" helpText="Where button click leads">
                        <Select value={form.primaryButton.linkType} onChange={(e) => updateNested("primaryButton", "linkType", e.target.value)}>
                          <option value="custom_url">Custom URL</option>
                          <option value="product">Product Page</option>
                          <option value="category">Category Page</option>
                          <option value="deal">Deal Page</option>
                          <option value="none">No Link</option>
                        </Select>
                      </FormField>
                      {form.primaryButton.linkType === "deal" && (
                        <FormField label="Select Deal" required helpText="Banner button opens this deal on the storefront">
                          <Select
                            value={form.primaryButton.dealId || ""}
                            onChange={(e) => updateNested("primaryButton", "dealId", e.target.value)}
                          >
                            <option value="">— Choose a deal —</option>
                            {deals.map((d) => (
                              <option key={d._id || d.id} value={d._id || d.id}>
                                {d.name}{d.isActive ? "" : " (disabled)"}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      )}
                      {form.primaryButton.linkType === "custom_url" && (
                        <FormField label="Target URL" required helpText="Full URL destination">
                          <Input type="text" value={form.primaryButton.link} onChange={(e) => updateNested("primaryButton", "link", e.target.value)} placeholder="https://..." />
                        </FormField>
                      )}
                    </div>
                  </div>
                </FormSection>

                {/* 5. Schedule */}
                <FormSection number="5" title="Schedule" description="Set when banner should be active">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Start Date & Time" helpText="When banner becomes active">
                      <Input type="datetime-local" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} />
                    </FormField>
                    <FormField label="End Date & Time" helpText="When banner expires">
                      <Input type="datetime-local" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} />
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
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bannerMutation.isPending || !!positionDuplicate}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold transition disabled:opacity-50 hover:opacity-90 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                  >
                    {bannerMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner className="w-4 h-4" />
                        Saving...
                      </span>
                    ) : editingBanner ? "Update Banner" : "Create Banner"}
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
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80 border" style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "var(--bg-tertiary)" }}>Cancel</button>
                <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                  {deleteMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}
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