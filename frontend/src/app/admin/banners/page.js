"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";

// ==========================================
// API SETUP
// ==========================================
const API_BASE = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || "http://localhost:5000";
const API_URL = `${API_BASE}/api`;

const adminBannerApi = {
  getAll: async () => {
    const res = await axios.get(`${API_URL}/banners`);
    return res.data.data || [];
  },
  create: async (data) => {
    const res = await axios.post(`${API_URL}/banners`, data, { headers: { "Content-Type": "multipart/form-data" } });
    return res.data.data;
  },
  update: async (id, data) => {
    const res = await axios.put(`${API_URL}/banners/${id}`, data, { headers: { "Content-Type": "multipart/form-data" } });
    return res.data.data;
  },
  delete: async (id) => {
    await axios.delete(`${API_URL}/banners/${id}`);
  },
  toggle: async (id) => {
    const res = await axios.patch(`${API_URL}/banners/${id}/toggle`);
    return res.data.data;
  },
  duplicate: async (id) => {
    const res = await axios.post(`${API_URL}/banners/${id}/duplicate`);
    return res.data.data;
  },
};

// ==========================================
// ICONS
// ==========================================
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const ListIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
);
const GridIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
const SortIndicator = ({ active, direction }) => (
  <svg className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    {active && direction === "desc" ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
  </svg>
);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);
const UploadIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);
const ImageIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);
const CopyIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
);

// ==========================================
// HELPERS
// ==========================================
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

const StatusBadge = ({ status }) => {
  const styles = {
    active: { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" },
    inactive: { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
    scheduled: { backgroundColor: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" },
    expired: { backgroundColor: "rgba(107,114,128,0.1)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)" },
    draft: { backgroundColor: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={s}>
      {status}
    </span>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function BannersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [sortConfig, setSortConfig] = useState({ key: "position", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const defaultForm = {
    title: "", bannerType: "homepage_hero", position: 0,
    desktopImage: null, tabletImage: null, mobileImage: null,
    altText: "", backgroundColor: "#ffffff",
    eyebrow: "", heading: "", description: "",
    primaryButton: { text: "", linkType: "custom_url", link: "" },
    startDate: "", endDate: "", autoPublish: false, autoDisable: true,
    displayRules: { pages: ["homepage"], devices: ["desktop", "tablet", "mobile"] },
  };

  const [form, setForm] = useState(defaultForm);
  const [removeDesktop, setRemoveDesktop] = useState(false);
  const [removeTablet, setRemoveTablet] = useState(false);
  const [removeMobile, setRemoveMobile] = useState(false);

  const resetForm = () => {
    setForm(defaultForm);
    setRemoveDesktop(false); setRemoveTablet(false); setRemoveMobile(false);
    setEditingBanner(null);
  };

  // --- React Query ---
  const { data: banners = [], isLoading: loading } = useQuery({
    queryKey: ["adminBanners"],
    queryFn: adminBannerApi.getAll,
    retry: false,
  });

  const bannerMutation = useMutation({
    mutationFn: ({ data, id }) => id ? adminBannerApi.update(id, data) : adminBannerApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      toast.success(variables.id ? "Banner updated successfully" : "Banner added successfully");
      resetForm();
      setShowModal(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Operation failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => adminBannerApi.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      setSelectedIds([]);
      toast.success("Banner(s) deleted successfully");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Delete failed"),
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

  const totalBanners = sortedBanners.length;
  const totalPages = Math.ceil(totalBanners / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBanners = sortedBanners.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterType]);

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
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value instanceof File) fd.append(key, value);
      else if (typeof value === "object" && value !== null) fd.append(key, JSON.stringify(value));
      else if (value !== null && value !== undefined) fd.append(key, value);
    });
    if (removeDesktop) fd.append("removeDesktop", "true");
    if (removeTablet) fd.append("removeTablet", "true");
    if (removeMobile) fd.append("removeMobile", "true");

    bannerMutation.mutate({ data: fd, id: editingBanner?._id });
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    const formatDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 16) : "");
    setForm({
      ...banner,
      startDate: formatDateInput(banner.startDate),
      endDate: formatDateInput(banner.endDate),
      primaryButton: banner.primaryButton || { text: "", linkType: "custom_url", link: "" },
      displayRules: banner.displayRules || { pages: ["homepage"], devices: ["desktop", "tablet", "mobile"] },
    });
    setShowModal(true);
  };

  const handleOpenAdd = () => { resetForm(); setShowModal(true); };
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

  // --- Reusable Styles ---
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SectionTitle = ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-color)" }}>{children}</h3>
  );

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

  const ActionButtons = ({ banner }) => (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <button onClick={(e) => { e.stopPropagation(); router.push(`${pathname}/${banner._id}`); }} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-emerald-500/10 flex items-center justify-center" style={{ color: "#34d399" }} title="View">
        <EyeIcon className="w-4 h-4" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); handleEdit(banner); }} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit">
        <EditIcon className="w-4 h-4" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); adminBannerApi.duplicate(banner._id).then(() => { queryClient.invalidateQueries({ queryKey: ["adminBanners"] }); toast.success("Duplicated"); }); }} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Duplicate">
        <CopyIcon className="w-4 h-4" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); handleDelete(banner); }} disabled={deleteMutation.isPending} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center" title="Delete">
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );

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
    <div className="w-full min-h-screen p-6" style={{ color: "var(--text-primary)" }}>
      <div className="w-full max-w-7xl mx-auto space-y-6">
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Banners", value: stats.total, color: "var(--text-primary)" },
            { label: "Active", value: stats.active, color: "#34d399" },
            { label: "Scheduled", value: stats.scheduled, color: "#60a5fa" },
            { label: "Expired", value: stats.expired, color: "#9ca3af" },
            { label: "Draft", value: stats.draft, color: "#fbbf24" },
          ].map((stat, i) => (
            <div key={i} className="rounded-lg p-4" style={cardStyle}>
              <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
              <p className="text-[20px] font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ===== Search & Filters ===== */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
            <input type="text" placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
          </div>
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

        {/* ===== Bulk Selection Bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} disabled={deleteMutation.isPending} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--danger)" }}>
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
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(banner._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                        </td>
                        <td className="px-4 py-2.5">
                          <img src={`${API_BASE}/${banner.desktopImage}`} alt={banner.altText} className="w-24 h-12 object-cover rounded border" style={{ borderColor: "var(--border-color)" }} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedBanners.map((banner) => (
              <div key={banner._id} onClick={() => router.push(`${pathname}/${banner._id}`)} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                <img src={`${API_BASE}/${banner.desktopImage}`} alt={banner.altText} className="w-full h-32 object-cover rounded-md" style={{ border: "1px solid var(--border-color)" }} />
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

        {/* ===== Add/Edit Modal - IMPROVED SPACING ===== */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-3xl rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{editingBanner ? "Edit Banner" : "Add New Banner"}</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} disabled={bannerMutation.isPending} className="p-1 rounded transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                
                {/* 1. Basic Information */}
                <div>
                  <SectionTitle>1. Basic Information</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Banner Title *</label>
                      <input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)} required className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="Summer Sale Hero" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Banner Type</label>
                      <select value={form.bannerType} onChange={(e) => updateForm("bannerType", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle}>
                        <option value="homepage_hero">Homepage Hero</option>
                        <option value="promotional">Promotional</option>
                        <option value="product">Product</option>
                        <option value="collection">Collection</option>
                        <option value="popup">Popup</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Position (Sort Order)</label>
                      <input type="number" value={form.position} onChange={(e) => updateForm("position", parseInt(e.target.value))} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} />
                    </div>
                  </div>
                </div>

                {/* 2. Responsive Images */}
                <div>
                  <SectionTitle>2. Responsive Images</SectionTitle>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Desktop Image *</label>
                        <div className="flex items-center gap-3">
                          <div className="w-full h-10 rounded-md flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                            {form.desktopImage ? <img src={form.desktopImage instanceof File ? URL.createObjectURL(form.desktopImage) : `${API_BASE}/${editingBanner?.desktopImage}`} alt="Desktop" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                          </div>
                        </div>
                        <input type="file" accept="image/*" onChange={(e) => updateForm("desktopImage", e.target.files?.[0])} className="mt-2 text-xs" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Tablet Image</label>
                        <div className="w-full h-10 rounded-md flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                          {form.tabletImage ? <img src={form.tabletImage instanceof File ? URL.createObjectURL(form.tabletImage) : `${API_BASE}/${editingBanner?.tabletImage}`} alt="Tablet" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                        </div>
                        <input type="file" accept="image/*" onChange={(e) => updateForm("tabletImage", e.target.files?.[0])} className="mt-2 text-xs" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Mobile Image</label>
                        <div className="w-full h-10 rounded-md flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                          {form.mobileImage ? <img src={form.mobileImage instanceof File ? URL.createObjectURL(form.mobileImage) : `${API_BASE}/${editingBanner?.mobileImage}`} alt="Mobile" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                        </div>
                        <input type="file" accept="image/*" onChange={(e) => updateForm("mobileImage", e.target.files?.[0])} className="mt-2 text-xs" style={{ color: "var(--text-muted)" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Content */}
                <div>
                  <SectionTitle>3. Banner Content</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Eyebrow / Small Heading</label>
                      <input type="text" value={form.eyebrow} onChange={(e) => updateForm("eyebrow", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="Summer Collection" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Main Heading</label>
                      <input type="text" value={form.heading} onChange={(e) => updateForm("heading", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="UP TO 50% OFF" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
                      <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows="3" className="px-3 py-2 rounded-md text-sm w-full outline-none resize-none" style={inputStyle} placeholder="Brief description..." />
                    </div>
                  </div>
                </div>

                {/* 4. Call to Action */}
                <div>
                  <SectionTitle>4. Call to Action</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Button Text</label>
                      <input type="text" value={form.primaryButton.text} onChange={(e) => updateNested("primaryButton", "text", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="Shop Now" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Link Type</label>
                      <select value={form.primaryButton.linkType} onChange={(e) => updateNested("primaryButton", "linkType", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle}>
                        <option value="custom_url">Custom URL</option>
                        <option value="product">Product</option>
                        <option value="category">Category</option>
                        <option value="none">No Link</option>
                      </select>
                    </div>
                    {form.primaryButton.linkType === "custom_url" && (
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Target URL</label>
                        <input type="text" value={form.primaryButton.link} onChange={(e) => updateNested("primaryButton", "link", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="https://..." />
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Display Rules */}
                <div>
                  <SectionTitle>5. Display Rules</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Show On Pages:</label>
                      <div className="flex flex-wrap gap-3">
                        {["homepage", "category", "product", "cart", "checkout"].map((page) => (
                          <label key={page} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.displayRules.pages.includes(page)} onChange={(e) => {
                              const pages = e.target.checked ? [...form.displayRules.pages, page] : form.displayRules.pages.filter(p => p !== page);
                              updateNested("displayRules", "pages", pages);
                            }} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                            <span className="text-[13px] capitalize" style={{ color: "var(--text-primary)" }}>{page}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Show On Devices:</label>
                      <div className="flex flex-wrap gap-3">
                        {["desktop", "tablet", "mobile"].map((device) => (
                          <label key={device} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.displayRules.devices.includes(device)} onChange={(e) => {
                              const devices = e.target.checked ? [...form.displayRules.devices, device] : form.displayRules.devices.filter(d => d !== device);
                              updateNested("displayRules", "devices", devices);
                            }} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                            <span className="text-[13px] capitalize" style={{ color: "var(--text-primary)" }}>{device}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Schedule */}
                <div>
                  <SectionTitle>6. Schedule</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Start Date & Time</label>
                      <input type="datetime-local" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>End Date & Time</label>
                      <input type="datetime-local" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.autoPublish} onChange={(e) => updateForm("autoPublish", e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Auto-publish on start date</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.autoDisable} onChange={(e) => updateForm("autoDisable", e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Auto-disable after end date</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} disabled={bannerMutation.isPending} className="flex-1 h-10 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                  <button type="submit" disabled={bannerMutation.isPending} className="flex-1 h-10 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    {bannerMutation.isPending ? "Saving..." : editingBanner ? "Update" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== Delete Confirmation Modal ===== */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">{deleteTarget.banners.length === 1 ? `Delete "${deleteTarget.banners[0].title}"?` : `Delete ${deleteTarget.banners.length} banners?`}</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>
                  {deleteMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}