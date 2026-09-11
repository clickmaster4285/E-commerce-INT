"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { attributeApi } from "../../../apis/admin/attributeApi";
import { adminCategoryApi, categoryApi } from "../../../apis/admin/categoryApi";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";

// --- Icons (Same as Brand Page) ---
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const CheckIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
);
const ArrowLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
);
const SlidersIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
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

// --- Helpers ---
const getDataTypeLabel = (type) => {
  const map = { text: "Text", number: "Number", decimal: "Decimal", multi_select: "Multi Select", select: "Select", color: "Color", boolean: "Boolean" };
  return map[type] || type;
};

const CATS_PER_PAGE = 15;
const ATTRS_PER_PAGE = 15;

export default function AttributesPage() {
  useAttributeSocketSync();
  const router = useRouter();

  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [attributeSearch, setAttributeSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [categoryPage, setCategoryPage] = useState(1);
  const [attributePage, setAttributePage] = useState(1);
  
  // Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const dropdownRef = useRef(null);

  // Add Attribute Modal State
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [newAttributeData, setNewAttributeData] = useState({ name: "", code: "", data_type: "multi_select", values: [], value: "" });

  // Queries — paginated server-side for attributes
  const { data: paginatedAttrsData, isLoading: attributesLoading } = useQuery({
    queryKey: ["attributes", "paginated", attributePage, attributeSearch, selectedCategoryId],
    queryFn: () => attributeApi.getAllPaginated({ page: attributePage, limit: ATTRS_PER_PAGE, search: attributeSearch, category: selectedCategoryId || "" }),
    retry: false,
    staleTime: 0,
  });
  const paginatedAttributesRaw = paginatedAttrsData?.items || paginatedAttrsData || [];
  const pagination = paginatedAttrsData?.pagination || { total: 0, page: 1, limit: ATTRS_PER_PAGE, pages: 1, hasNext: false, hasPrev: false };
  const attributes = paginatedAttributesRaw;

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: adminCategoryApi.getAllAdmin,
  });

  // Derived Data & Stats Calculation
  const activeCategories = useMemo(() => categories.filter((c) => !c.is_deleted), [categories]);
  
  const categoryAttributeMap = useMemo(() => {
    const map = {};
    activeCategories.forEach((cat) => {
      map[cat._id] = (cat.attributes || []).map((a) => String(a.attribute_id));
    });
    return map;
  }, [activeCategories]);

  // Stats: use paginated results (same count for current page)
  const stats = useMemo(() => {
    const totalCats = activeCategories.length;
    const allAttrs = paginatedAttributesRaw; // paginated set from server
    const totalUniqueAttrs = pagination.total || paginatedAttributesRaw.length;
    const activeAttrs = allAttrs.filter(a => a.is_active !== false).length;
    const inactiveAttrs = Math.max(0, totalUniqueAttrs - activeAttrs);
    return { totalCats, totalUniqueAttrs, activeAttrs, inactiveAttrs };
  }, [activeCategories, paginatedAttributesRaw, pagination]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return activeCategories;
    const s = categorySearch.toLowerCase();
    return activeCategories.filter((cat) => cat.name?.toLowerCase().includes(s));
  }, [activeCategories, categorySearch]);

  const dropdownFiltered = useMemo(() => {
    if (!dropdownSearch) return activeCategories;
    const s = dropdownSearch.toLowerCase();
    return activeCategories.filter((cat) => cat.name?.toLowerCase().includes(s));
  }, [activeCategories, dropdownSearch]);

  const totalCategoryPages = Math.ceil(filteredCategories.length / CATS_PER_PAGE);
  const paginatedCategories = filteredCategories.slice((categoryPage - 1) * CATS_PER_PAGE, categoryPage * CATS_PER_PAGE);

  const selectedCategory = useMemo(() => 
    selectedCategoryId ? activeCategories.find((c) => c._id === selectedCategoryId) : null
  , [selectedCategoryId, activeCategories]);

  const categoryAttributes = useMemo(() => {
    if (!selectedCategoryId) return [];
    const attrIds = new Set(categoryAttributeMap[selectedCategoryId] || []);
    return attributes.filter((attr) => attrIds.has(String(attr._id)));
  }, [attributes, selectedCategoryId, categoryAttributeMap]);

  const displayedAttributes = selectedCategoryId ? categoryAttributes : attributes;

  const filteredAttributes = useMemo(() => {
    if (!attributeSearch) return displayedAttributes;
    const s = attributeSearch.toLowerCase();
    return displayedAttributes.filter((attr) => attr.name?.toLowerCase().includes(s) || attr.code?.toLowerCase().includes(s));
  }, [displayedAttributes, attributeSearch]);

  const sortedAttributes = useMemo(() => {
    const arr = [...filteredAttributes];
    if (!sortConfig.key) return arr;
    arr.sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "name": va = a.name?.toLowerCase() || ""; vb = b.name?.toLowerCase() || ""; break;
        case "type": va = a.data_type || ""; vb = b.data_type || ""; break;
        case "options": va = a.values?.length || 0; vb = b.values?.length || 0; break;
        default: return 0;
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredAttributes, sortConfig]);

  // Server pagination: results already paginated; pagination info from server
  const totalAttributes = pagination.total || paginatedAttributesRaw.length || 0;
  const totalAttributePages = pagination.pages || 1;
  const paginatedAttributes = paginatedAttributesRaw;

  // Effects & Handlers
  useEffect(() => {
    const onDoc = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const queryClient = useQueryClient();

  const handleCategoryClick = (catId) => {
    setSelectedCategoryId(catId);
    setAttributeSearch("");
    setAttributePage(1);
    setDropdownOpen(false);
  };

  const handleBack = () => {
    setSelectedCategoryId(null);
    setAttributeSearch("");
    setAttributePage(1);
  };

  const goToCategoryPage = (p) => p >= 1 && p <= totalCategoryPages && setCategoryPage(p);
  const goToAttributePage = (p) => p >= 1 && p <= totalAttributePages && setAttributePage(p);

  // Add Attribute Mutation
  const addAttributeMutation = useMutation({
    mutationFn: async (data) => {
      const created = await attributeApi.create(data);
      const createdId = created?._id || created?.id || created?.data?._id || created?.data?.id;
      if (selectedCategoryId && createdId) {
        await categoryApi.updateAttributes(selectedCategoryId, [{
          attribute_id: String(createdId),
          is_visible: true,
          is_searchable: true,
          is_variant_option: true,
          sort_order: 0,
          value: Array.isArray(data.values) ? data.values : (data.value || ""),
        }]);
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setShowAttributeModal(false);
      setNewAttributeData({ name: "", code: "", data_type: "multi_select", values: [], value: "" });
      toast.success("Attribute added successfully");
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || "Failed to add attribute"),
  });

  const handleAddAttributeFromModal = () => {
    if (!newAttributeData.name.trim()) { toast.error("Attribute name is required"); return; }
    const code = newAttributeData.code.trim() || newAttributeData.name.trim().toLowerCase().replace(/\s+/g, "_");
    const valuesPayload = (newAttributeData.values || []).map((opt) => {
      const label = typeof opt === "string" ? opt : (opt?.label || opt?.value || String(opt));
      return { label, value: String(label).toLowerCase() };
    });
    addAttributeMutation.mutate({
      code,
      name: newAttributeData.name,
      data_type: newAttributeData.data_type,
      values: valuesPayload,
    });
  };

  // Render Helpers
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button onClick={() => setSortConfig(prev => ({ key: sortKey, direction: prev.key === sortKey && prev.direction === "asc" ? "desc" : "asc" }))}
        className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80"
        style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label} <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const Pagination = ({ current, total, go, label }) => {
    if (total <= 1) return null;
    const pages = [];
    if (total <= 5) for(let i=1;i<=total;i++) pages.push(i);
    else if (current <= 3) pages.push(1,2,3,4,"...",total);
    else if (current >= total-2) pages.push(1,"...",total-3,total-2,total-1,total);
    else pages.push(1,"...",current-1,current,current+1,"...",total);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4 mt-4" style={cardStyle}>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => go(current-1)} disabled={current===1}
            className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title="Previous page">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="hidden sm:inline-flex items-center gap-1">
            {pages.map((page, i) => (
              <React.Fragment key={i}>
                {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> :
                  <button onClick={() => go(page)}
                    className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80"
                    style={{ backgroundColor: current === page ? "var(--accent)" : "var(--bg-tertiary)", color: current === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${current === page ? "var(--accent)" : "var(--border-color)"}` }}>
                    {page}
                  </button>}
              </React.Fragment>
            ))}
          </span>
          <button onClick={() => go(current+1)} disabled={current===total}
            className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title="Next page">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const ActionButtons = ({ attr }) => (
    <div className="flex items-center justify-end gap-0.5 sm:gap-2">
      {/* Removed View Button as requested */}
      <button onClick={(e) => { e.stopPropagation(); router.push(`/admin/attributes/${attr._id}/edit`); }} 
        className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" 
        style={{ color: "var(--text-secondary)" }} title="Edit">
        <EditIcon className="w-4 h-4" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); /* Add delete handler here */ }} 
        className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition text-red-500 hover:bg-red-500/10 flex items-center justify-center" 
        title="Delete">
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {!selectedCategoryId ? (
            <>
              <div>
                <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Attribute Management</h1>
                <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage attributes category-wise</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Category Search */}
                <div className="relative hidden sm:block w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
                  <input type="text" placeholder="Filter categories..." value={categorySearch} onChange={e=>setCategorySearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
                </div>

                {/* Smart Dropdown */}
                <div ref={dropdownRef} className="relative w-full sm:w-56 z-30">
                  <button onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="h-10 w-full px-3 rounded-lg text-[13px] flex items-center justify-between gap-2 outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                    style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    <span className="truncate">{selectedCategory ? selectedCategory.name : "All Categories"}</span>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden shadow-xl"
                      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
                      <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon className="w-3.5 h-3.5" /></span>
                          <input autoFocus value={dropdownSearch} onChange={e=>setDropdownSearch(e.target.value)} placeholder="Search..." 
                            className="w-full h-9 pl-8 pr-2 rounded-md text-[12px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
                        <button onClick={() => { setSelectedCategoryId(null); setDropdownOpen(false); }}
                          className={`w-full px-3 py-2 text-left text-[13px] flex items-center justify-between gap-2 transition ${!selectedCategoryId ? "bg-emerald-500/10 text-emerald-400" : "hover:bg-[var(--bg-tertiary)]"}`}>
                          All Categories {!selectedCategoryId && <CheckIcon />}
                        </button>
                        {dropdownFiltered.map(cat => {
                          const isSelected = selectedCategoryId === cat._id;
                          const count = (categoryAttributeMap[cat._id] || []).length;
                          return (
                            <button key={cat._id} onClick={() => handleCategoryClick(cat._id)}
                              className={`w-full px-3 py-2 text-left text-[13px] flex items-center justify-between gap-2 transition ${isSelected ? "bg-emerald-500/10 text-emerald-400" : "hover:bg-[var(--bg-tertiary)]"}`}>
                              <span className="truncate">{cat.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? "bg-emerald-500/20" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>{count}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => router.push("/admin/categories/create")} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <span>+ Add Category</span>
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* Main Content Area */}
        {!selectedCategoryId ? (
          /* CATEGORY LIST VIEW */
          <div className="space-y-5">
            {/* ===== STAT BOXES ===== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg p-4" style={cardStyle}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Categories</p>
                <p className="text-[24px] font-bold mt-1" style={{ color: "var(--text-primary)" }}>{stats.totalCats}</p>
              </div>
              <div className="rounded-lg p-4" style={cardStyle}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Active Attributes</p>
                <p className="text-[24px] font-bold mt-1" style={{ color: "#34d399" }}>{stats.activeAttrs}</p>
              </div>
              <div className="rounded-lg p-4" style={cardStyle}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Inactive Attributes</p>
                <p className="text-[24px] font-bold mt-1" style={{ color: "#ef4444" }}>{stats.inactiveAttrs}</p>
              </div>
              <div className="rounded-lg p-4" style={cardStyle}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Unique Attrs</p>
                <p className="text-[24px] font-bold mt-1" style={{ color: "#a78bfa" }}>{stats.totalUniqueAttrs}</p>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="grid grid-cols-12 gap-4 px-4 py-3 text-[12px] font-semibold uppercase tracking-wider" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              <div className="col-span-6">Category Name</div>
              <div className="col-span-4">Total Attributes</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            <div className="divide-y divide-[var(--border-color)]">
              {paginatedCategories.length === 0 ? (
                <div className="py-10 text-center"><p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No categories found matching your search.</p></div>
              ) : paginatedCategories.map((cat, idx) => {
                const count = (categoryAttributeMap[cat._id] || []).length;
                return (
                  <button key={cat._id} onClick={() => handleCategoryClick(cat._id)}
                    className="group w-full grid grid-cols-12 gap-4 px-4 py-3 items-center transition hover:bg-[var(--bg-tertiary)] text-left"
                    style={{ backgroundColor: "var(--bg-card)" }}>
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>
                        <SlidersIcon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-[13px] truncate" style={{ color: "var(--text-primary)" }}>{cat.name}</span>
                    </div>
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50"></div>
                        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{count} Attributes</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] group-hover:bg-white/5 group-hover:text-emerald-400 transition">
                        <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <Pagination current={categoryPage} total={totalCategoryPages} go={goToCategoryPage} 
              label={`Showing ${(categoryPage-1)*CATS_PER_PAGE+1}-${Math.min(categoryPage*CATS_PER_PAGE, filteredCategories.length)} of ${filteredCategories.length} categories`} />
          </div>
          </div>
        ) : (
          /* ATTRIBUTE WORKSPACE VIEW */
          <div className="-mt-6 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
            {/* Breadcrumb / Back */}
            <div className="flex flex-col gap-1">
              <button onClick={handleBack}
                className="inline-flex items-center gap-1.5 h-6 px-0 rounded-none text-[11px] font-medium transition hover:opacity-60 self-start tracking-wide"
                style={{ backgroundColor: "transparent", border: "none", color: "var(--text-muted)" }}>
                <ArrowLeftIcon className="w-3 h-3 opacity-60" /> Back to Categories
              </button>
            </div>

            {/* Main Header */}
            <div className="flex flex-row items-center justify-between gap-12">
              <div className="flex flex-col gap-0.5 min-w-0">
                <h1 className="text-[22px] md:text-[28px] font-extrabold tracking-tight leading-none truncate" style={{ color: "var(--text-primary)", textTransform: "uppercase" }}>
                  {selectedCategory?.name ? `${selectedCategory.name} ATTRIBUTES` : "Category Attributes"}
                </h1>
                <div className="flex items-center">
                  <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Manage attributes for this category</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowAttributeModal(true)} className="h-9 px-4 rounded-md text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-sm" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <span>+ Add Attribute</span>
                </button>
              </div>
            </div>

            {/* Attribute Search */}
            <div className="relative max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
              <input type="text" placeholder="Search attributes by name or code..." value={attributeSearch} onChange={e=>setAttributeSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
            </div>

            {/* Attribute Table */}
            <div className="rounded-lg overflow-hidden" style={cardStyle}>
              {attributesLoading ? (
                <div className="rounded-lg py-14 flex items-center justify-center gap-2">
                  <Spinner /> <span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading attributes...</span>
                </div>
              ) : paginatedAttributes.length === 0 ? (
                <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3">
                  <SlidersIcon className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{attributeSearch ? "No attributes found" : "No attributes assigned to this category"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                      <tr>
                        <SortHeader label="Attribute Name" sortKey="name" />
                        <SortHeader label="Data Type" sortKey="type" />
                        <SortHeader label="Options Count" sortKey="options" />
                        <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                        <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAttributes.map((attr, index) => {
                        const isActive = attr.is_active !== false;
                        const opts = attr.values?.length || 0;
                        return (
                          <tr key={attr._id} className="transition cursor-pointer"
                            style={{ borderBottom: index < paginatedAttributes.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: "var(--bg-card)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                            onClick={() => router.push(`/admin/attributes/${attr._id}/edit`)}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>
                                  <SlidersIcon className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-[13px] truncate block" style={{ color: "var(--text-primary)" }}>{attr.name}</span>
                                  {attr.code && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.code}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase" 
                                style={attr.data_type === 'multi_select' || attr.data_type === 'select' 
                                  ? { backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }
                                  : attr.data_type === 'text'
                                  ? { backgroundColor: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }
                                  : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                                {getDataTypeLabel(attr.data_type)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>{opts} Options</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                style={isActive ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" } : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap w-1">
                              <ActionButtons attr={attr} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

  const paginationLabelStart = Math.min((attributePage - 1) * ATTRS_PER_PAGE + 1, pagination.total || totalAttributes);
  const paginationLabelEnd = Math.min(attributePage * ATTRS_PER_PAGE, pagination.total || totalAttributes);

            <Pagination current={attributePage} total={totalAttributePages} go={goToAttributePage}
              label={`Showing ${paginationLabelStart}-${paginationLabelEnd} of ${totalAttributes} attributes`} />
          </div>
        )}
      </div>
      
      {/* Add Attribute Modal */}
      {showAttributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <SlidersIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Add New Attribute</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Configure properties for products in this category.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAttributeModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <span>×</span>
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newAttributeData.name}
                  onChange={(e) => setNewAttributeData({ ...newAttributeData, name: e.target.value })}
                  autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                  placeholder="e.g. Color, Size, RAM"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Data Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "multi_select", label: "Options" },
                    { id: "boolean", label: "Boolean" },
                  ].map((type) => {
                    const isActive = newAttributeData.data_type === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewAttributeData({ ...newAttributeData, data_type: type.id })}
                        className={`h-14 text-[11px] font-semibold flex flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-200 ${isActive 
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/40 shadow-sm" 
                          : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                        }`}
                      >
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {newAttributeData.data_type === "multi_select" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Options</label>
                  <div className="space-y-1.5">
                    {(newAttributeData.values || []).map((opt, idx) => (
                      <div key={`opt-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg">
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/20">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-[var(--text-primary)] truncate">{opt}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (newAttributeData.values || []).filter((_, i) => i !== idx);
                            setNewAttributeData({ ...newAttributeData, values: next });
                          }}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-tertiary)] transition-colors"
                          aria-label="Remove option"
                        >
                          <span>×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="new-attr-option-input"
                      placeholder="Add an option (e.g. 8 GB)"
                      className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (!val) return;
                          const exists = (newAttributeData.values || []).some((v) => v.toLowerCase() === val.toLowerCase());
                          if (exists) return;
                          setNewAttributeData({ ...newAttributeData, values: [...(newAttributeData.values || []), val] });
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("new-attr-option-input");
                        if (!input) return;
                        const val = input.value.trim();
                        if (!val) return;
                        const exists = (newAttributeData.values || []).some((v) => v.toLowerCase() === val.toLowerCase());
                        if (exists) { input.value = ""; return; }
                        setNewAttributeData({ ...newAttributeData, values: [...(newAttributeData.values || []), val] });
                        input.value = "";
                      }}
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <span>+ Add</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Add one or more options. You can also add more after creating the attribute.</p>
                </div>
              )}

              {newAttributeData.data_type === "boolean" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Default State</label>
                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                    {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                      const isActive = newAttributeData.value === opt.id;
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => setNewAttributeData({ ...newAttributeData, value: opt.id })}
                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                        >
                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">This will be the default Yes/No state for this attribute.</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 bg-[var(--bg-primary)]/30">
              <button
                type="button"
                onClick={() => setShowAttributeModal(false)}
                className="h-9 px-4 text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAttributeFromModal}
                disabled={addAttributeMutation.isPending}
                className="h-9 px-5 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {addAttributeMutation.isPending ? "Adding..." : "Add Attribute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}