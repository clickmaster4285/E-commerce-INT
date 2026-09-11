"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { attributeApi } from "../../../apis/admin/attributeApi";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";

// --- Icons ---
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
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
  const map = { text: "Text", number: "Number", decimal: "Decimal", multi_select: "Multi Select", select: "Select", color: "Color", boolean: "Yes / No" };
  return map[type] || type;
};

const ATTRS_PER_PAGE = 15;

export default function AttributesPage() {
  useAttributeSocketSync();
  const queryClient = useQueryClient();

  // State
  const [attributeSearch, setAttributeSearch] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [attributePage, setAttributePage] = useState(1);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(attributeSearch.trim());
      setAttributePage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [attributeSearch]);

  // Add Attribute Modal State
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [newAttributeData, setNewAttributeData] = useState({ name: "", code: "", data_type: "multi_select", values: [], value: "" });

  // Edit Attribute Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", data_type: "multi_select", values: [], value: false });
  const [editOptionInput, setEditOptionInput] = useState("");

  // ===== SERVER-SIDE PAGINATED QUERY =====
  const { data: paginatedAttrsData, isLoading: attributesLoading, isFetching } = useQuery({
    queryKey: ["attributes", "paginated", attributePage, search],
    queryFn: () =>
      attributeApi.getAllPaginated({
        page: attributePage,
        limit: ATTRS_PER_PAGE,
        search,
      }),
    retry: false,
    staleTime: 0,
    keepPreviousData: true,
  });

  // Normalize response (handles both paginated and legacy array)
  const attributesRaw = Array.isArray(paginatedAttrsData)
    ? paginatedAttrsData
    : paginatedAttrsData?.items || paginatedAttrsData?.data || paginatedAttrsData?.attributes || [];
  const pagination = Array.isArray(paginatedAttrsData)
    ? { total: attributesRaw.length, page: 1, limit: ATTRS_PER_PAGE, pages: 1 }
    : paginatedAttrsData?.pagination || { total: 0, page: 1, limit: ATTRS_PER_PAGE, pages: 1 };

  // Client-side sort within the current page (server handles search + paging)
  const sortedAttributes = useMemo(() => {
    const arr = [...attributesRaw];
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
  }, [attributesRaw, sortConfig]);

  const totalAttributes = pagination.total || 0;
  const totalAttributePages = Math.max(1, pagination.pages || 1);
  const attrStartIndex = totalAttributes === 0 ? 0 : (attributePage - 1) * ATTRS_PER_PAGE + 1;
  const attrEndIndex = Math.min(attributePage * ATTRS_PER_PAGE, totalAttributes);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [attributePage]);

  const goToAttributePage = (p) => {
    if (p >= 1 && p <= totalAttributePages && p !== attributePage) {
      setAttributePage(p);
    }
  };

  // ===== ADD ATTRIBUTE MUTATION =====
  const addAttributeMutation = useMutation({
    mutationFn: async (data) => {
      const created = await attributeApi.create(data);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
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

  // ===== EDIT ATTRIBUTE =====
  const openEditModal = (attr) => {
    setEditingAttribute(attr);
    const dataType = attr.data_type || "multi_select";
    let booleanValue = false;
    if (dataType === "boolean") {
      const vals = attr.values || [];
      const trueEntry = vals.find((v) => (v.value || v).toString() === "true" || (v.label || v).toString().toLowerCase() === "yes");
      if (trueEntry) booleanValue = true;
    }
    const values = (attr.values || []).map((v) => {
      const label = typeof v === "string" ? v : (v?.label || v?.value || String(v));
      return String(label);
    }).filter(Boolean);
    setEditForm({ name: attr.name || "", data_type: dataType, values, value: booleanValue });
    setEditOptionInput("");
    setShowEditModal(true);
  };

  const editAttributeMutation = useMutation({
    mutationFn: async (data) => {
      return await attributeApi.update(editingAttribute?._id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      setShowEditModal(false);
      setEditingAttribute(null);
      setEditForm({ name: "", data_type: "multi_select", values: [], value: false });
      setEditOptionInput("");
      toast.success("Attribute updated successfully");
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || "Failed to update attribute"),
  });

  const handleSaveEdit = () => {
    if (!editForm.name.trim()) { toast.error("Attribute name is required"); return; }
    const valuesPayload = editForm.data_type === "multi_select"
      ? (editForm.values || []).map((opt) => {
          const label = String(opt || "").trim();
          return { label, value: label.toLowerCase() };
        })
      : editForm.data_type === "boolean"
        ? [{ label: editForm.value ? "Yes" : "No", value: editForm.value ? "true" : "false", sort_order: 0, is_active: true }]
        : [];
    editAttributeMutation.mutate({
      name: editForm.name.trim(),
      data_type: editForm.data_type,
      values: valuesPayload,
    });
  };

  const addEditOption = () => {
    const val = editOptionInput.trim();
    if (!val) return;
    if ((editForm.values || []).some((v) => v.toLowerCase() === val.toLowerCase())) return;
    setEditForm({ ...editForm, values: [...(editForm.values || []), val] });
    setEditOptionInput("");
  };

  const removeEditOption = (idx) => {
    setEditForm({ ...editForm, values: (editForm.values || []).filter((_, i) => i !== idx) });
  };

  // ===== RENDER HELPERS =====
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
    if (total <= 5) for (let i = 1; i <= total; i++) pages.push(i);
    else if (current <= 3) pages.push(1, 2, 3, 4, "...", total);
    else if (current >= total - 2) pages.push(1, "...", total - 3, total - 2, total - 1, total);
    else pages.push(1, "...", current - 1, current, current + 1, "...", total);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4 mt-4" style={cardStyle}>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => go(current - 1)} disabled={current === 1}
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
          <button onClick={() => go(current + 1)} disabled={current === total}
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
      <button onClick={(e) => { e.stopPropagation(); openEditModal(attr); }}
        className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
        style={{ color: "var(--text-secondary)" }} title="Edit">
        <EditIcon className="w-4 h-4" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); /* Delete handler placeholder */ }}
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
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Attribute Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>All attributes</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setShowAttributeModal(true)} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-sm" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <span>+ Add Attribute</span>
            </button>
          </div>
        </div>

        {/* Attribute Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search attributes by name or code..." value={attributeSearch} onChange={e => setAttributeSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
        </div>

        {/* Attribute Table */}
        <div className={`rounded-lg overflow-hidden transition-opacity ${isFetching && !attributesLoading ? "opacity-60" : "opacity-100"}`} style={cardStyle}>
          {attributesLoading ? (
            <div className="rounded-lg py-14 flex items-center justify-center gap-2">
              <Spinner /> <span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading attributes...</span>
            </div>
          ) : sortedAttributes.length === 0 ? (
            <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3">
              <SlidersIcon className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search ? "No attributes found" : "No attributes available"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <SortHeader label="Attribute Name" sortKey="name" />
                    <SortHeader label="Data Type" sortKey="type" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Category</th>
                    <SortHeader label="Options Count" sortKey="options" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAttributes.map((attr, index) => {
                    const isActive = attr.is_active !== false;
                    const opts = attr.values?.length || 0;
                    return (
                      <tr key={attr._id} className="transition cursor-pointer"
                        style={{ borderBottom: index < sortedAttributes.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: "var(--bg-card)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                        onClick={() => openEditModal(attr)}>
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
                          <span className="text-[12px] font-medium capitalize" style={{ color: "var(--text-secondary)" }}>
                            {attr.category ? attr.category : "—"}
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

        <Pagination current={attributePage} total={totalAttributePages} go={goToAttributePage}
          label={totalAttributes > 0 ? `Showing ${attrStartIndex}–${attrEndIndex} of ${totalAttributes} attributes` : "No attributes"} />

      </div>

      {/* ===== Add Attribute Modal ===== */}
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
                  <p className="text-[11px] text-[var(--text-muted)]">Configure properties for products.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAttributeModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <span>×</span>
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-red-500">*</span></label>
                <input type="text" value={newAttributeData.name}
                  onChange={(e) => setNewAttributeData({ ...newAttributeData, name: e.target.value })} autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                  placeholder="e.g. Color, Size, RAM" />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Data Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "multi_select", label: "Options" },
                    { id: "boolean", label: "Yes / No" },
                  ].map((type) => {
                    const isActive = newAttributeData.data_type === type.id;
                    return (
                      <button key={type.id} type="button"
                        onClick={() => setNewAttributeData({ ...newAttributeData, data_type: type.id })}
                        className={`h-14 text-[11px] font-semibold flex flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-200 ${isActive
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/40 shadow-sm"
                          : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"}`}>
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
                        <button type="button"
                          onClick={() => {
                            const next = (newAttributeData.values || []).filter((_, i) => i !== idx);
                            setNewAttributeData({ ...newAttributeData, values: next });
                          }}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-tertiary)] transition-colors"
                          aria-label="Remove option">
                          <span>×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" id="new-attr-option-input" placeholder="Add an option (e.g. 8 GB)"
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
                      }} />
                    <button type="button"
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
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors">
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
                        <button key={String(opt.id)} type="button"
                          onClick={() => setNewAttributeData({ ...newAttributeData, value: opt.id })}
                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
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
              <button type="button" onClick={() => setShowAttributeModal(false)}
                className="h-9 px-4 text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleAddAttributeFromModal} disabled={addAttributeMutation.isPending}
                className="h-9 px-5 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50">
                {addAttributeMutation.isPending ? "Adding..." : "Add Attribute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Attribute Modal ===== */}
      {showEditModal && editingAttribute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[420px] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <SlidersIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Edit Attribute</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Update attribute details and values.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowEditModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <span>×</span>
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                  placeholder="e.g. Color, Size, RAM" />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "multi_select", label: "Multi Options" },
                    { id: "boolean", label: "Yes / No" },
                  ].map((type) => {
                    const isActive = editForm.data_type === type.id;
                    return (
                      <button key={type.id} type="button"
                        onClick={() => setEditForm({ ...editForm, data_type: type.id, values: type.id === "boolean" ? editForm.values : editForm.values })}
                        className={`h-14 text-[11px] font-semibold flex flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-200 ${isActive
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/40 shadow-sm"
                          : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"}`}>
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editForm.data_type === "multi_select" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Options</label>
                  <div className="space-y-1.5">
                    {(editForm.values || []).map((opt, idx) => (
                      <div key={`edit-opt-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg">
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/20">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-[var(--text-primary)] truncate">{opt}</span>
                        <button type="button" onClick={() => removeEditOption(idx)}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-tertiary)] transition-colors"
                          aria-label="Remove option">
                          <span>×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Add an option..." value={editOptionInput}
                      onChange={(e) => setEditOptionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditOption(); } }}
                      className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]" />
                    <button type="button" onClick={addEditOption}
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors">
                      <span>+ Add</span>
                    </button>
                  </div>
                </div>
              )}

              {editForm.data_type === "boolean" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Default Value</label>
                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                    {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                      const isActive = editForm.value === opt.id;
                      return (
                        <button key={String(opt.id)} type="button"
                          onClick={() => setEditForm({ ...editForm, value: opt.id })}
                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 bg-[var(--bg-primary)]/30">
              <button type="button" onClick={() => setShowEditModal(false)}
                className="h-9 px-4 text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSaveEdit} disabled={editAttributeMutation.isPending}
                className="h-9 px-5 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50">
                {editAttributeMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}