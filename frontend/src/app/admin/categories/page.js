"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { useCategorySocketSync } from "@/hooks/useCategorySocketSync";

// ================= ICONS =================
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const FolderIcon = ({ className = "w-6 h-6" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);

const SortIndicator = ({ active, direction }) => (
  <svg className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    {active && direction === "desc" ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />}
  </svg>
);

/* ================= Helpers ================= */
const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return getId(value._id);
    if (value.$oid) return String(value.$oid);
  }
  return "";
};

const getCategoryName = (categoryId, categories) => {
  const category = categories.find((item) => String(item._id) === String(categoryId));
  return category?.name || "Root category";
};

/* ================= MAIN PAGE COMPONENT ================= */
export default function CategoriesPage() {
  useCategorySocketSync();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filterParent, setFilterParent] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: categoryApi.getAllAdmin,
    retry: false,
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => categoryApi.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setSelectedIds([]);
      toast.success("Category deleted successfully");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Category delete failed"),
  });

  /* ---------- Derived data ---------- */
  const filteredCategories = useMemo(() => categories.filter((c) => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.category_code?.toLowerCase().includes(search.toLowerCase());
    const matchParent = filterParent === "all" || (filterParent === "root" && !c.parent_category_id) || (filterParent === "child" && c.parent_category_id);
    return matchSearch && matchParent;
  }), [categories, search, filterParent]);

  const sortedCategories = useMemo(() => {
    const arr = [...filteredCategories];
    if (!sortConfig.key) {
      arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      return arr;
    }
    arr.sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "code": va = a.category_code?.toLowerCase() || ""; vb = b.category_code?.toLowerCase() || ""; break;
        case "name": va = a.name?.toLowerCase() || ""; vb = b.name?.toLowerCase() || ""; break;
        default: return 0;
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredCategories, sortConfig]);

  const totalCategories = sortedCategories.length;
  const totalPages = Math.ceil(totalCategories / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = sortedCategories.slice(startIndex, endIndex);

  useEffect(() => setCurrentPage(1), [search, filterParent]);

  const allCategories = categories.length;
  const rootCategoriesCount = categories.filter((c) => !c.parent_category_id).length;
  const childCategoriesCount = allCategories - rootCategoriesCount;
  const categoriesWithAttributes = categories.filter((c) => c.attributes && c.attributes.length > 0).length;

  const allSelected = paginatedCategories.length > 0 && paginatedCategories.every((c) => selectedIds.includes(c._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : paginatedCategories.map((c) => c._id));
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const isDeleting = deleteMutation.isPending;

  /* ---------- Handlers ---------- */
  const handleEdit = (category) => {
    router.push(`/admin/categories/${category._id}/edit`);
  };

  const handleCreate = () => {
    router.push(`/admin/categories/create`);
  };

  const handleDelete = (category) => setDeleteTarget({ categories: [category] });
  const handleBulkDelete = () => setDeleteTarget({ categories: categories.filter((c) => selectedIds.includes(c._id)) });
  
  const handleViewDetail = (category) => {
    const id = category?._id;
    if (!id) return;
    router.push(`/admin/categories/${id}`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const ids = deleteTarget.categories.map((c) => c._id);
    deleteMutation.mutate(ids, { onSettled: () => setDeleteTarget(null) });
  };

  const handleSort = (key) => setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const goToPage = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const renderPageNumbers = () => {
    const pages = []; const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) { for (let i = 1; i <= totalPages; i++) pages.push(i); } 
    else {
      if (currentPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  /* ---------- Reusable styles ---------- */
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button type="button" onClick={() => handleSort(sortKey)} className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80" style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label} <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const SelectFilter = ({ value, onChange, children }) => (
    <div className="relative">
      <select value={value} onChange={onChange} className="appearance-none h-10 md:h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[16px] md:text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
        {children}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
    </div>
  );

  const ActionButtons = ({ category }) => (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <button onClick={(e) => { e.stopPropagation(); handleViewDetail(category); }} className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details"><EyeIcon className="w-4 h-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); handleEdit(category); }} className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon className="w-4 h-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); handleDelete(category); }} disabled={isDeleting} className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center" title="Delete"><TrashIcon className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Category Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage category hierarchy and dynamic attributes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="List view"><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="Grid view"><GridIcon /></button>
            </div>
            <button onClick={handleCreate} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><PlusIcon /> Add Category</button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>Total Categories</p><p className="text-[18px] sm:text-[20px] font-bold mt-1">{allCategories}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>Root Categories</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-blue-500">{rootCategoriesCount}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>Child Categories</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-emerald-500">{childCategoriesCount}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>With Attributes</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-purple-500">{categoriesWithAttributes}</p></div>
        </div>

        {/* ===== Search ===== */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
        </div>

        {/* ===== Filters ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <SelectFilter value={filterParent} onChange={(e) => setFilterParent(e.target.value)}>
            <option value="all">All Categories</option><option value="root">Root Categories</option><option value="child">Child Categories</option>
          </SelectFilter>
        </div>

        {/* ===== Bulk selection bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 rounded-lg p-2.5 sm:p-0 sm:px-4 sm:h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold px-1.5 sm:px-0" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => setSelectedIds([])} className="flex-1 sm:flex-none h-9 sm:h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="flex-1 sm:flex-none h-9 sm:h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* ===== Loading / Empty / Table / Grid ===== */}
        {categoriesLoading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading categories...</span></div>
        ) : paginatedCategories.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterParent !== "all" ? "No categories match your filters" : "No categories yet"}</p>
            {!search && filterParent === "all" && <button onClick={handleCreate} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>+ Add your first category</button>}
          </div>
        ) : viewMode === "list" ? (
          <>
          <div className="hidden md:block rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    <SortHeader label="Category Code" sortKey="code" />
                    <SortHeader label="Category Name" sortKey="name" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Description</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Parent</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map((category, index) => {
                    const isSelected = selectedIds.includes(category._id);
                    const parentName = getCategoryName(category.parent_category_id, categories);
                    const isActive = category.status !== "inactive";
                    
                    return (
                      <tr key={category._id} className="transition cursor-pointer" style={{ borderBottom: index < paginatedCategories.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)" }}
                        onClick={() => handleViewDetail(category)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(category._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-2.5"><span className="text-[13px] font-mono truncate max-w-[100px] block" style={{ color: "var(--text-secondary)" }}>{category.category_code || "—"}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-4 h-4" /></div>
                            <span className="font-medium text-[13px] truncate max-w-[140px]">{category.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell max-w-[200px]"><p className="truncate text-[13px]" style={{ color: "var(--text-muted)" }}>{category.description || "—"}</p></td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{parentName === "Root category" ? "—" : parentName}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase" 
                            style={isActive 
                              ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" } 
                              : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1"><ActionButtons category={category} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ✅ MOBILE-ONLY card list (replaces table on <768px) — layout only, reuses existing handlers */}
          <div className="md:hidden space-y-2.5">
            {paginatedCategories.map((category) => {
              const isMobileSelected = selectedIds.includes(category._id);
              const parentName = getCategoryName(category.parent_category_id, categories);
              const isMobileActive = category.status !== "inactive";
              return (
                <div
                  key={category._id}
                  onClick={() => handleViewDetail(category)}
                  className="rounded-lg p-3 space-y-2.5 transition cursor-pointer"
                  style={{
                    ...cardStyle,
                    backgroundColor: isMobileSelected ? "var(--bg-tertiary)" : "var(--bg-card)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isMobileSelected}
                      onChange={() => toggleSelect(category._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded cursor-pointer shrink-0"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate leading-tight">{category.name}</p>
                      <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{category.category_code || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[11px] truncate min-w-0" style={{ color: "var(--text-muted)" }}>{parentName === "Root category" ? "Root" : parentName}</span>
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap" style={isMobileActive ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" } : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>{isMobileActive ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="flex items-center justify-end pt-2" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                    <ActionButtons category={category} />
                  </div>
                </div>
              );
            })}
          </div>
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {paginatedCategories.map((category) => {
              const parentName = getCategoryName(category.parent_category_id, categories);
              return (
                <div key={category._id} className="rounded-lg p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle} onClick={() => handleViewDetail(category)}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-5 h-5" /></div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[12px] sm:text-[13px] truncate">{category.name}</p>
                    <p className="text-[10px] sm:text-[11px] font-mono mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{category.category_code || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 sm:pt-3 gap-1" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] sm:text-[12px] truncate flex-1 min-w-0" style={{ color: "var(--text-muted)" }}>{parentName === "Root category" ? "Root" : parentName}</span>
                    <ActionButtons category={category} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== Pagination ===== */}
        {totalCategories > 20 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {startIndex + 1}-{Math.min(endIndex, totalCategories)} of {totalCategories} categories</p>
            <div className="flex items-center gap-2">
              <span className="sm:hidden text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>Page {currentPage} of {totalPages}</span>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title="Previous page"><ChevronLeftIcon className="w-4 h-4" /></button>
              <span className="hidden sm:inline-flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> : (
                      <button onClick={() => goToPage(page)} className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)", color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}` }}>{page}</button>
                    )}
                  </React.Fragment>
                ))}
              </span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title="Next page"><ChevronRightIcon className="w-4 h-4" /></button>
            </div>
          </div>
        )}
        {paginatedCategories.length > 0 && totalCategories <= 20 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Showing {paginatedCategories.length} of {allCategories} categories</p>}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-lg p-6" style={cardStyle}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}><svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
              <div className="flex-1 min-w-0"><h3 className="text-sm font-semibold">{deleteTarget.categories.length === 1 ? `Delete "${deleteTarget.categories[0].name}"?` : `Delete ${deleteTarget.categories.length} categories?`}</h3><p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The category(ies) will be permanently removed.</p></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mt-5 p-3 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-4 h-4" /></div>
              <div className="min-w-0"><p className="text-sm font-medium truncate">{deleteTarget.categories[0].name}</p><p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{deleteTarget.categories.length === 1 ? deleteTarget.categories[0].category_code || "—" : `+ ${deleteTarget.categories.length - 1} more`}</p></div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 h-10 rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 h-10 rounded-md text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>{isDeleting ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}