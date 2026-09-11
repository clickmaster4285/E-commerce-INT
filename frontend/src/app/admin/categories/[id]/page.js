"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";
import { useSocket } from "@/hooks/useSocket";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";
import { toast } from "sonner";
import { createPortal } from "react-dom";

/* =========================================================
   ICONS
========================================================= */

function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={sw}
        d={d}
      />
    </svg>
  );
}

const D = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
};

/* =========================================================
   HELPERS
========================================================= */

function getId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return getId(value._id);
    if (value.$oid) return String(value.$oid);
    if (typeof value.toString === "function") {
      const result = value.toString();
      if (result && result !== "[object Object]") return result;
    }
  }
  return "";
}

function formatDateTime(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAttributeId(attribute) {
  const aid = attribute?.attribute_id;
  if (!aid) return String(attribute?._id || "");
  if (typeof aid === "string") return aid;
  if (typeof aid === "object" && aid._id) return String(aid._id);
  return String(aid);
}

function sanitizeOptionLabels(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (!item) continue;
    let label = typeof item === "string" ? item : item.label || item.value || item.name;
    if (typeof label !== "string") continue;
    const trimmed = label.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

function getDataTypeLabel(type) {
  const map = { multi_select: "Multi Select", select: "Select", color: "Color", boolean: "Yes / No" };
  return map[type] || type || "Multi Select";
}

function getDataTypeBadgeStyle(type) {
  switch (type) {
    case "multi_select":
    case "select":
      return { backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" };
    case "boolean":
      return { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" };
    case "color":
      return { backgroundColor: "rgba(236,72,153,0.1)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.2)" };
    default:
      return { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" };
  }
}

function useClickOutside(ref, handler, triggerRef) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      if (triggerRef?.current?.contains(event.target)) return;
      handlerRef.current(event);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, triggerRef]);
}

function useDropdownPosition(triggerRef, isOpen) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, direction: 'down' });
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const DROPDOWN_MAX_H = 320;
    const GAP = 6;
    const shouldFlip = spaceBelow < DROPDOWN_MAX_H && spaceAbove > spaceBelow;
    const vw = window.innerWidth;
    let width = Math.max(rect.width, 280);
    if (width > vw - 32) width = vw - 32;
    let left = rect.left;
    if (left + width > vw - 16) left = vw - width - 16;
    if (left < 16) left = 16;
    let top;
    let direction;
    if (shouldFlip) {
      top = rect.top - GAP - DROPDOWN_MAX_H;
      if (top < 16) top = 16;
      direction = 'up';
    } else {
      top = rect.bottom + GAP;
      if (top + DROPDOWN_MAX_H > window.innerHeight - 16) {
        top = window.innerHeight - DROPDOWN_MAX_H - 16;
      }
      direction = 'down';
    }
    setPosition({ top, left, width, direction });
  }, [triggerRef, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);
  return position;
}

/* =========================================================
   UI COMPONENTS
========================================================= */

// Reuse exact card style from List/Create pages
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

function StatusBadge({ active = true }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: active ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
        color: active ? "#34d399" : "#ef4444",
        border: `1px solid ${active ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button", icon, className = "" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: primary
          ? "var(--accent)"
          : danger
          ? "transparent"
          : "transparent",
        color: primary
          ? "white"
          : danger
          ? "var(--danger)"
          : "var(--text-secondary)",
        border: primary
          ? "none"
          : danger
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid var(--border-color)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function AttributePill({ label }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium"
      style={{
        backgroundColor: "rgba(139,92,246,0.10)",
        color: "#8b5cf6",
        border: "1px solid rgba(139,92,246,0.20)",
      }}
    >
      {label}
    </span>
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

const MultiSelectIcons = {
  Plus: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  X: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  ChevronDown: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Check: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Search: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
};

function ProfessionalMultiSelect({ attribute, value, onChange, onAddNewOption }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newOption, setNewOption] = useState("");
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const pos = useDropdownPosition(triggerRef, isOpen);
  useClickOutside(dropdownRef, () => setIsOpen(false), triggerRef);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const options = sanitizeOptionLabels(attribute?.seed_options || attribute?.values || []);
  const selected = sanitizeOptionLabels(Array.isArray(value) ? value : []).filter((v) => options.includes(v));
  const filteredValues = options.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (label) => {
    const exists = selected.includes(label);
    onChange(exists ? selected.filter((i) => i !== label) : [...selected, label]);
  };

  const handleAddNewOption = async () => {
    const trimmed = newOption.trim();
    if (!trimmed || !onAddNewOption) return;
    try {
      await onAddNewOption(trimmed);
      if (!selected.includes(trimmed)) onChange([...selected, trimmed]);
      setNewOption("");
      setSearch("");
    } catch (err) { console.error(err); }
  };

  const renderDropdown = () => (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl flex flex-col overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: '320px' }}
    >
      <div className="p-2 border-b border-[var(--border-color)] shrink-0">
        <div className="relative">
          <MultiSelectIcons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 pl-8 pr-2.5 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]" autoFocus />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-0.5 min-h-0">
        {filteredValues.length > 0 ? (
          filteredValues.map((label, idx) => {
            const isSelected = selected.includes(label);
            return (
              <button key={idx} type="button" onClick={() => toggleOption(label)} className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${isSelected ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>
                <span className="truncate">{label}</span>
                <span className={`w-4 h-4 flex items-center justify-center shrink-0 ml-2 rounded border transition-colors ${isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)]"}`}>
                  {isSelected && <MultiSelectIcons.Check className="w-2.5 h-2.5 text-white" />}
                </span>
              </button>
            );
          })
        ) : (
          <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">No matching values</div>
        )}
      </div>
      {onAddNewOption && (
        <div className="px-2 py-1.5 border-t border-[var(--border-color)] shrink-0">
          <div className="flex gap-1">
            <input type="text" placeholder="Add new..." value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNewOption()} className="flex-1 min-w-0 h-7 px-2 text-[11px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" />
            <button onClick={handleAddNewOption} disabled={!newOption.trim()} className="h-7 px-2 text-[10px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5 shrink-0">
              <MultiSelectIcons.Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full">
      <button type="button" ref={triggerRef} onClick={() => setIsOpen(!isOpen)} className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs flex items-center justify-between outline-none transition-colors rounded border ${isOpen ? "border-[var(--accent)] ring-1 ring-[var(--accent-soft)] bg-[var(--bg-input)]" : "border-[var(--border-color)] hover:border-[var(--text-muted)] bg-[var(--bg-input)]"}`}>
        <div className="flex flex-wrap items-center gap-1 text-left w-full min-w-0">
          {selected.length === 0 ? (
            <span className="text-[var(--text-muted)]">Select values...</span>
          ) : (
            <>
              {selected.slice(0, 3).map((item) => (
                <span key={item} className="inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/20">{item}</span>
              ))}
              {selected.length > 3 && <span className="text-[10px] font-medium text-[var(--text-muted)]">+{selected.length - 3}</span>}
            </>
          )}
        </div>
        <MultiSelectIcons.ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ml-1.5 text-[var(--text-muted)] ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(renderDropdown(), document.body)}
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const categoryId = getId(params?.id);
  const { socket } = useSocket();
  const backPath = "/admin/categories";

  const [tab, setTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category_code: "",
    category_type: "",
    description: "",
    parent_category_id: "",
    sort_order: 0,
    is_active: true,
    attributes: [],
  });

  const [openAttributeKey, setOpenAttributeKey] = useState(null);
  const [expandedReadOnlyAttr, setExpandedReadOnlyAttr] = useState(null);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [attrToDelete, setAttrToDelete] = useState(null);
  const [newAttributeData, setNewAttributeData] = useState({ name: "", code: "", data_type: "multi_select", values: [], value: "" });
  const loadedSeedTypeRef = useRef("");

  useAttributeSocketSync();

  // Queries
  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  const { data: adminCategories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: categoryApi.getAllAdmin,
  });

  const { data: category, isLoading: loading, isError } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => categoryApi.getById(categoryId),
    enabled: !!categoryId,
    retry: false,
  });

  const { data: categoryAttributes = [] } = useQuery({
    queryKey: ["category-attributes", categoryId],
    queryFn: () => categoryApi.getAttributes(categoryId),
    enabled: !!categoryId,
  });

  const { data: seededAttributes = [] } = useQuery({
    queryKey: ["seeded-attributes", form.category_type?.toLowerCase()],
    queryFn: () => attributeApi.getAll({ category: form.category_type?.toLowerCase() }),
    enabled: !!form.category_type && showEdit,
  });

  // Derived data
  const variantAttributes = useMemo(() => {
    return categoryAttributes.filter((attr) => attr.category_config?.is_variant_option);
  }, [categoryAttributes]);

  const parentCategoryName = useMemo(() => {
    if (!category) return "Root Category";
    const parentId = getId(category.parent_category_id);
    if (!parentId) return "Root Category";
    if (category.parent_category_id && typeof category.parent_category_id === "object") {
      return category.parent_category_id.name || "Root Category";
    }
    const found = allCategories.find((item) => String(item._id) === String(parentId));
    return found?.name || "Root Category";
  }, [category, allCategories]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: async (_saved, variables) => {
      try {
        const properAttrs = form.attributes
          .filter((a) => a && (a.attribute_id || a.seed_code))
          .map((a) => {
            const raw = a.attribute_id || a._id;
            let aid;
            if (!raw) aid = undefined;
            else if (typeof raw === "string") aid = raw;
            else if (typeof raw === "object" && raw._id) aid = String(raw._id);
            else aid = String(raw);
            return {
              attribute_id: aid || undefined,
              is_visible: a.is_visible !== false,
              is_searchable: Boolean(a.is_searchable),
              is_variant_option: a.is_variant_option !== false,
              sort_order: typeof a.sort_order === "number" ? a.sort_order : 0,
              value: Array.isArray(a.value) ? a.value : (a.value != null ? String(a.value) : ""),
            };
          })
          .filter((a) => !!a.attribute_id);
        if (properAttrs.length > 0) {
          await categoryApi.updateAttributes(String(variables.id || categoryId), properAttrs);
        }
      } catch (err) {
        console.error("Attribute sync failed:", err);
        toast.warning("Category updated, but some attributes failed to save.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["category", categoryId] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] }),
      ]);
      setShowEdit(false);
      toast.success("Category updated successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => categoryApi.delete(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.removeQueries({ queryKey: ["category", categoryId] });
      toast.success("Category deleted successfully");
      router.push(backPath);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete category");
    },
  });

  // Enrich attributes with seed data when edit modal is open
  useEffect(() => {
    if (!showEdit) return;
    const categoryType = form.category_type?.toLowerCase();
    const isSeededCategory = ["mobile", "pc", "clothing"].includes(categoryType);

    if (!isSeededCategory) {
      if (loadedSeedTypeRef.current) {
        loadedSeedTypeRef.current = "";
      }
      return;
    }

    if (seededAttributes.length === 0) return;

    const firstSeededCategory = seededAttributes[0]?.category?.toLowerCase();
    if (firstSeededCategory && firstSeededCategory !== categoryType) return;

    setForm((p) => {
      const needsEnrichment = p.attributes.some((a) => a.attribute_id && !a.seed_name) ||
        p.attributes.some((a) => {
          const attrId = getAttributeId(a);
          const seedAttr = seededAttributes.find((sa) => String(sa._id) === String(attrId));
          return seedAttr && a.seed_name !== seedAttr.name;
        });
      if (!needsEnrichment) return p;

      const enrichedAttrs = p.attributes.map((existingAttr) => {
        const attrId = getAttributeId(existingAttr);
        const seedAttr = seededAttributes.find((sa) => String(sa._id) === String(attrId));

        if (seedAttr) {
          const mappedSeedType = seedAttr.data_type === "select" || seedAttr.data_type === "color" ? "multi_select" : seedAttr.data_type;
          const seedOptions = (seedAttr.values || []).map(v => v.label || v.value || v);
          return {
            ...existingAttr,
            seed_code: seedAttr.code,
            seed_name: seedAttr.name,
            seed_type: mappedSeedType,
            seed_options: seedOptions,
          };
        }

        const populatedAttr = existingAttr.attribute_id;
        if (populatedAttr && typeof populatedAttr === "object" && populatedAttr.name) {
          const mappedSeedType = populatedAttr.data_type === "select" || populatedAttr.data_type === "color" ? "multi_select" : populatedAttr.data_type;
          const seedOptions = (populatedAttr.values || []).map(v => v.label || v.value || v);
          return {
            ...existingAttr,
            seed_code: populatedAttr.code,
            seed_name: populatedAttr.name,
            seed_type: mappedSeedType,
            seed_options: seedOptions,
          };
        }

        return existingAttr;
      });
      return { ...p, attributes: enrichedAttrs };
    });
  }, [showEdit, form.category_type, seededAttributes, form.attributes]);

  // Handlers
  function openEdit() {
    if (!category) return;
    const catType = category.category_type || "";
    const loadedAttrs = (category.attributes || []).map((a, i) => ({
      ...a,
      ui_key: a.ui_key || `edit-${getAttributeId(a) || a.seed_code || `idx-${i}`}-${i}`,
    }));

    setForm({
      category_code: category.category_code || "",
      category_type: catType,
      name: category.name || "",
      description: category.description || "",
      parent_category_id: getId(category.parent_category_id) || "",
      sort_order: category.sort_order ?? 0,
      is_active: category.is_active !== false,
      attributes: loadedAttrs,
    });

    loadedSeedTypeRef.current = catType;
    setShowEdit(true);
  }

  function submitEdit(e) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error("Category name is required"); return; }
    if (!form.category_type) { toast.error("Category type is required"); return; }

    updateMutation.mutate({
      id: categoryId,
      data: {
        category_code: form.category_code,
        category_type: form.category_type,
        name: form.name.trim(),
        description: form.description.trim(),
        parent_category_id: getId(form.parent_category_id) || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      },
    });
  }

  const updateAttributeConfig = (key, field, val) => {
    setForm((p) => ({
      ...p,
      attributes: p.attributes.map((item) => {
        const keyStr = String(key || "");
        const itemKey = String(item.ui_key || "");
        const itemAttrId = getAttributeId(item);
        if (itemKey === keyStr || itemAttrId === keyStr || String(item.seed_code || "") === keyStr) {
          return { ...item, [field]: val };
        }
        return item;
      }),
    }));
  };

  const handleAddAttributeFromModal = async () => {
    if (!newAttributeData.name.trim()) { toast.error("Attribute name is required"); return; }
    const code = newAttributeData.code.trim() || newAttributeData.name.trim().toLowerCase().replace(/\s+/g, "_");
    const tempKey = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newAttrConfig = {
      ui_key: tempKey,
      attribute_id: null,
      seed_code: code,
      seed_name: newAttributeData.name,
      seed_type: newAttributeData.data_type,
      seed_options: newAttributeData.values || [],
      is_visible: true,
      is_searchable: true,
      sort_order: form.attributes.length,
      value: newAttributeData.data_type === "multi_select" ? newAttributeData.values || [] : (newAttributeData.value || ""),
      _creating: true,
    };
    setForm((p) => ({ ...p, attributes: [...p.attributes, newAttrConfig] }));
    setShowAttributeModal(false);
    setNewAttributeData({ name: "", code: "", data_type: "multi_select", values: [], value: "" });
    toast.success("Attribute added");
    try {
      const valuesPayload = (newAttrConfig.seed_options || []).map((opt) => {
        const label = typeof opt === "string" ? opt : (opt?.label || opt?.value || String(opt));
        return { label, value: String(label).toLowerCase() };
      });
      const created = await attributeApi.create({
        code: newAttrConfig.seed_code,
        name: newAttrConfig.seed_name,
        data_type: newAttrConfig.seed_type,
        values: valuesPayload,
      });
      const createdId = created?._id || created?.id || created?.data?._id || created?.data?.id;
      if (createdId) {
        setForm((p) => ({
          ...p,
          attributes: p.attributes.map((a) => (
            a.ui_key === tempKey ? { ...a, attribute_id: String(createdId), _creating: false } : a
          )),
        }));
      } else {
        setForm((p) => ({
          ...p,
          attributes: p.attributes.map((a) => (a.ui_key === tempKey ? { ...a, _creating: false } : a)),
        }));
      }
    } catch (err) {
      console.error("Failed to persist attribute", err);
      setForm((p) => ({
        ...p,
        attributes: p.attributes.map((a) => (a.ui_key === tempKey ? { ...a, _creating: false, _createError: true } : a)),
      }));
    }
  };

  const handleAddAttributeValue = async (inputKey, config) => {
    const raw = String(config?._draftValue || "").trim();
    if (!raw || !config) return;

    const currentSelected = Array.isArray(config.value) ? config.value : [];
    const currentSeedOptions = Array.isArray(config.seed_options) ? config.seed_options : [];

    if (currentSelected.some((v) => String(v).toLowerCase() === raw.toLowerCase())) {
      toast.error("Option already assigned");
      return;
    }
    if (currentSeedOptions.some((o) => String(o).toLowerCase() === raw.toLowerCase())) {
      toast.error("Option already exists");
      return;
    }

    try {
      let nextSelected = [...currentSelected, raw];
      let nextSeedOptions = currentSeedOptions;
      let nextAttributeId = config.attribute_id ? getAttributeId(config) : null;

      if (nextAttributeId) {
        const fullAttr = seededAttributes.find((a) => String(a._id) === String(nextAttributeId));
        const existingValues = Array.isArray(fullAttr?.values) ? fullAttr.values : [];
        const normalized = existingValues.map((v) => ({
          label: v.label || v.value || "",
          value: v.value || v.label || "",
          sort_order: typeof v.sort_order === "number" ? v.sort_order : 0,
          is_active: v.is_active !== false,
        }));
        if (normalized.some((v) => String(v.value).toLowerCase() === raw.toLowerCase())) {
          toast.error("Option already exists");
          return;
        }
        const newValue = { label: raw, value: raw.toLowerCase(), sort_order: normalized.length, is_active: true };
        const response = await attributeApi.update(nextAttributeId, { values: [...normalized, newValue] });
        const responseValues = Array.isArray(response?.values) ? response.values : [...normalized, newValue];
        nextSeedOptions = responseValues.map((v) => v.label || v.value || "").filter(Boolean);
      } else {
        const created = await attributeApi.create({
          code: `${config.seed_code || inputKey}-value-${Date.now()}`,
          name: raw,
          data_type: config.seed_type || "multi_select",
          values: [{ label: raw, value: raw.toLowerCase(), sort_order: 0, is_active: true }],
        });
        nextAttributeId = String(created?._id || created?.id || created?.data?._id || created?.data?.id || "");
        nextSeedOptions = [raw];
      }

      updateAttributeConfig(inputKey, "value", nextSelected);
      updateAttributeConfig(inputKey, "seed_options", nextSeedOptions);
      if (nextAttributeId && nextAttributeId !== getAttributeId(config)) {
        updateAttributeConfig(inputKey, "attribute_id", nextAttributeId);
      }

      toast.success("Option added successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save option");
    }
  };

  const handleDeleteAttribute = async () => {
    if (!attrToDelete) return;
    const attrId = getAttributeId(attrToDelete);
    try {
      const remainingAttrs = (category.attributes || []).filter((a) => {
        const id = getAttributeId(a);
        return id !== attrId;
      });
      await categoryApi.updateAttributes(String(categoryId), remainingAttrs.map((a) => ({
        attribute_id: getAttributeId(a),
        is_visible: a.is_visible !== false,
        is_searchable: a.is_searchable !== false,
        is_variant_option: a.category_config?.is_variant_option !== false,
        sort_order: a.category_config?.sort_order ?? 0,
        value: a.value ?? "",
      })));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] }),
        queryClient.invalidateQueries({ queryKey: ["category", categoryId] }),
      ]);
      toast.success("Attribute removed from category");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to remove attribute");
    }
    setAttrToDelete(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Loading category details...
          </span>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="p-8 text-center max-w-sm rounded-xl" style={cardStyle}>
          <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">Category Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>
            Back to Categories
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-10" style={{ color: "var(--text-primary)" }}>

      {/* HEADER - MATCHES LIST PAGE STYLE */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all shrink-0 mt-1"
          >
            <Ico d={D.back} className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[24px] leading-7 font-bold tracking-tight">{category.name}</h1>
              <StatusBadge active={true} />
            </div>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              {category.description || "No description provided"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={openEdit} icon={<Ico d={D.edit} className="w-4 h-4" />}>
            Edit
          </Button>
          <Button
            danger
            onClick={() => setShowDelete(true)}
            icon={<Ico d={D.trash} className="w-4 h-4" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* TABS - PROFESSIONAL STYLE */}
      <div className="flex items-center gap-6 border-b" style={{ borderColor: "var(--border-color)" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "attributes", label: "Attributes", count: categoryAttributes.length },
          { id: "history", label: "History" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="relative py-3 text-[13px] font-medium transition-colors outline-none"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  ({item.count})
                </span>
              )}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* LEFT - Category Type Information */}
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                  <Ico d={D.folder} className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Category Details</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Basic information and metadata</p>
                </div>
              </div>
              
              <div className="p-5">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Name</p>
                      <p className="text-[14px] font-medium text-[var(--text-primary)]">{category.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Category Code</p>
                      <p className="text-[14px] font-mono text-[var(--text-secondary)]">{category.category_code || category.slug || "—"}</p>
                    </div>
                  </div>

                  {category.description && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Description</p>
                      <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">
                        {category.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-[var(--border-color)]">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Created At</p>
                      <p className="text-[14px] text-[var(--text-secondary)]">{formatDateTime(category.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Updated At</p>
                      <p className="text-[14px] text-[var(--text-secondary)]">{formatDateTime(category.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT - Summary & Variants */}
          <div className="space-y-5">
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Summary</h3>
              </div>
              <div className="p-5 space-y-1">
                <StatRow label="Total Attributes" value={categoryAttributes.length} />
                <StatRow label="Parent Category" value={parentCategoryName} />
                <StatRow label="Status" value={<StatusBadge active={true} />} />
              </div>
            </div>

            {/* Variant Attributes */}
            {variantAttributes.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Variant Attributes</h3>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {variantAttributes.map((attr) => (
                      <AttributePill key={attr._id} label={attr.name} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attributes Preview - Full Width */}
          <div className="lg:col-span-3">
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Attributes Preview</h3>
              </div>
              <div className="p-5">
                {categoryAttributes.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]/30">
                    <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                      No attributes assigned yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {categoryAttributes.slice(0, 5).map((attr) => (
                      <div
                        key={attr._id}
                        className="p-3 rounded-lg border bg-[var(--bg-input)]"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <p className="text-[13px] font-medium mb-1 truncate text-[var(--text-primary)]">{attr.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {getDataTypeLabel(attr.data_type)}
                        </p>
                      </div>
                    ))}
                    {categoryAttributes.length > 5 && (
                      <div
                        className="p-3 rounded-lg border flex items-center justify-center bg-[var(--bg-input)]"
                        style={{
                          borderColor: "var(--border-color)",
                          borderStyle: "dashed",
                        }}
                      >
                        <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                          +{categoryAttributes.length - 5} more
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATTRIBUTES TAB */}
      {tab === "attributes" && (
        <div className="space-y-4">
          {/* Attributes Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                {categoryAttributes.length} {categoryAttributes.length === 1 ? "Attribute" : "Attributes"}
              </h3>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                Assigned attributes for {category.name} category
              </p>
            </div>
            <div className="flex items-center gap-2">
              {variantAttributes.length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  {variantAttributes.length} Variant {variantAttributes.length === 1 ? "Attribute" : "Attributes"}
                </span>
              )}
            </div>
          </div>

          {/* Attribute List */}
          {categoryAttributes.length === 0 ? (
            <div className="rounded-xl py-12 flex flex-col items-center justify-center gap-3" style={cardStyle}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <Ico d={D.box} className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>No attributes assigned</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                This category does not have any attributes assigned yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {categoryAttributes.map((attr) => {
                const optionLabels = sanitizeOptionLabels(attr.values);
                const optionCount = optionLabels.length;
                const isMultiSelect = attr.data_type === "multi_select" || attr.data_type === "select";
                const isBoolean = attr.data_type === "boolean";
                const isVariant = attr.category_config?.is_variant_option;
                const PREVIEW_LIMIT = 3;
                const visibleOptions = optionLabels.slice(0, PREVIEW_LIMIT);
                const hiddenCount = optionCount - PREVIEW_LIMIT;

                const boolValue = isBoolean ? (() => {
                  const trueEntry = optionLabels.find((l) => l.toLowerCase() === "yes" || l.toLowerCase() === "true");
                  const falseEntry = optionLabels.find((l) => l.toLowerCase() === "no" || l.toLowerCase() === "false");
                  if (attr.value === true || attr.value === "true" || trueEntry) return "Yes";
                  if (attr.value === false || attr.value === "false" || falseEntry) return "No";
                  return null;
                })() : null;

                return (
                  <div
                    key={attr._id}
                    className="rounded-xl overflow-hidden transition-all duration-150 flex flex-col"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    {/* Card Header */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa" }}
                          >
                            <Ico d={D.box} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{attr.name}</h4>
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.code}</span>
                          </div>
                        </div>
                        {isVariant && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0"
                            style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            Variant
                          </span>
                        )}
                      </div>

                      {/* Data Type Badge + Option Count */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                          style={getDataTypeBadgeStyle(attr.data_type)}
                        >
                          {getDataTypeLabel(attr.data_type)}
                        </span>
                        {isMultiSelect && optionCount > 0 && (
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {optionCount} {optionCount === 1 ? "option" : "options"}
                          </span>
                        )}
                        {isBoolean && boolValue && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{
                              backgroundColor: boolValue === "Yes" ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)",
                              color: boolValue === "Yes" ? "#34d399" : "#9ca3af",
                              border: `1px solid ${boolValue === "Yes" ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)"}`,
                            }}
                          >
                            {boolValue}
                          </span>
                        )}
                      </div>

                      {/* Options Preview */}
                      {isMultiSelect && optionCount > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {visibleOptions.map((label, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded truncate max-w-[70px]"
                              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
                            >
                              {label}
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>
                              +{hiddenCount} more
                            </span>
                          )}
                        </div>
                      )}

                      {isBoolean && !boolValue && (
                        <p className="text-[10px] italic" style={{ color: "var(--text-muted)" }}>No value set</p>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div
                      className="px-4 py-2.5 mt-auto flex items-center gap-2 border-t"
                      style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/attributes/${getAttributeId(attr)}/edit`)}
                        className="flex-1 h-7 text-[10px] font-semibold flex items-center justify-center gap-1 rounded-md transition-colors"
                        style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                      >
                        <Ico d={D.edit} className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttrToDelete(attr)}
                        className="flex-1 h-7 text-[10px] font-semibold flex items-center justify-center gap-1 rounded-md transition-colors"
                        style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "var(--danger)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                      >
                        <Ico d={D.trash} className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Activity History</h3>
          </div>
          <div className="p-6">
            <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-color)]">
              
              {/* Created Event */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-emerald-500 shadow-sm" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Category Created</p>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Initial category setup and configuration.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {formatDateTime(category.created_at)}
                  </span>
                </div>
              </div>

              {/* Updated Event */}
              {category.updated_at && category.updated_at !== category.created_at && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-blue-500 shadow-sm" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">Category Updated</p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Category details or attributes were modified.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                      {formatDateTime(category.updated_at)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl flex flex-col"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Edit Category</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Update category information and attributes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <Ico d={D.close} className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
              {/* Category Information */}
              <div className="space-y-4">
                <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Category Information</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Category Code
                    </label>
                    <input
                      value={form.category_code}
                      readOnly
                      className="w-full h-10 px-3 rounded-lg text-[13px] font-mono outline-none bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Name *
                    </label>
                    <input
                      value={form.name}
                      required
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg text-[13px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Category Type *
                    </label>
                    <div className="w-full h-10 px-3 rounded-lg text-[13px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-2 cursor-not-allowed">
                      <span className="truncate">{form.category_type || "—"}</span>
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] shrink-0">Locked</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Parent Category
                    </label>
                    <select
                      value={form.parent_category_id}
                      onChange={(e) => setForm({ ...form, parent_category_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg text-[13px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors cursor-pointer appearance-none"
                    >
                      <option value="">Root Category</option>
                      {adminCategories.filter((c) => String(c._id) !== String(categoryId)).map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                    {[
                      { id: true, label: "Active" },
                      { id: false, label: "Inactive" },
                    ].map((opt) => {
                      const isActive = form.is_active === opt.id;
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => setForm({ ...form, is_active: opt.id })}
                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${
                            isActive
                              ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm"
                              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id ? "bg-emerald-500" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Attributes Section */}
              <div className="space-y-4" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Assigned Attributes</h3>
                  {form.category_type && (
                    <button
                      type="button"
                      onClick={() => setShowAttributeModal(true)}
                      className="h-8 px-3 text-[10px] font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Ico d={D.box} className="w-3.5 h-3.5" /> Add Attribute
                    </button>
                  )}
                </div>

                {!form.category_type ? (
                  <div className="py-8 text-center border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]/30">
                    <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No category type selected</p>
                  </div>
                ) : form.attributes.length > 0 ? (
                  <div className="space-y-3">
                    {form.attributes.map((config, index) => {
                      const seedName = config.seed_name || `Attribute ${index + 1}`;
                      const inputKey = config.ui_key || `attr-${getAttributeId(config) || config.seed_code || index}`;
                      const isOpen = openAttributeKey === inputKey;
                      const selectedValues = Array.isArray(config.value) ? config.value : [];
                      const TypeIcon = config.seed_type === "boolean" ? D.check : D.box;
                      const typeBadgeLabel = config.seed_type === "multi_select" ? "Multi Select" : "Yes / No";

                      return (
                        <div
                          key={inputKey}
                          className={`rounded-xl border overflow-visible transition-all duration-200 ${isOpen ? "border-[var(--accent)]/50 bg-[var(--bg-primary)] shadow-md ring-1 ring-[var(--accent)]/10" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"}`}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenAttributeKey((prev) => (prev === inputKey ? null : inputKey))}
                            className="w-full px-4 py-3 flex items-center justify-between text-left group"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-[13px] font-bold text-[var(--text-primary)] truncate">{seedName}</h4>
                                  <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded border border-[var(--border-color)]">
                                    {typeBadgeLabel}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 min-h-[18px]">
                                  {config.seed_type === "multi_select" ? (
                                    selectedValues.length > 0 ? (
                                      selectedValues.slice(0, 4).map((val, i) => (
                                        <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/15">
                                          {val}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[11px] italic text-[var(--text-muted)]">No options assigned</span>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/15">
                                      {config.value === true ? "Yes" : config.value === false ? "No" : "Not set"}
                                    </span>
                                  )}
                              </div>
                              </div>
                            </div>
                            <Ico d={D.back} className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-90 text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-3 border-t border-[var(--border-color)]/50 bg-[var(--bg-primary)]/50 rounded-b-xl">
                              {config.seed_type === "multi_select" ? (
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Assigned Options</label>
                                    <span className="text-[10px] font-medium text-[var(--text-muted)]">{selectedValues.length} assigned</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {selectedValues.length > 0 ? (
                                      selectedValues.map((val, i) => (
                                        <div
                                          key={`${inputKey}-opt-${i}`}
                                          className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg"
                                        >
                                          <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/20">
                                            {i + 1}
                                          </span>
                                          <span className="flex-1 min-w-0 text-xs text-[var(--text-primary)] truncate">{val}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = selectedValues.filter((_, idx) => idx !== i);
                                              updateAttributeConfig(inputKey, "value", next);
                                            }}
                                            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                          >
                                            <Ico d={D.close} className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="px-3 py-3 text-center text-[11px] italic text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-lg">
                                        No options assigned yet
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <input
                                      type="text"
                                      id={`opt-input-${inputKey}`}
                                      placeholder={`Add option (e.g. 8 GB)`}
                                      className="flex-1 min-w-0 h-[32px] px-3 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                                      onKeyDown={async (e) => {
                                        if (e.key !== "Enter") return;
                                        e.preventDefault();
                                        const input = e.currentTarget;
                                        const raw = input.value.trim();
                                        if (!raw) return;
                                        input.value = "";
                                        await handleAddAttributeValue(inputKey, { ...config, _draftValue: raw });
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const input = document.getElementById(`opt-input-${inputKey}`);
                                        if (!input) return;
                                        const raw = input.value.trim();
                                        if (!raw) return;
                                        await handleAddAttributeValue(inputKey, { ...config, _draftValue: raw });
                                        input.value = "";
                                      }}
                                      className="h-[32px] px-3 text-[10px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors"
                                    >
                                      <Ico d={D.box} className="w-3 h-3" /> Add
                                    </button>
                                  </div>
                                </div>
                              ) : config.seed_type === "boolean" ? (
                                <div className="space-y-2">
                                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Current State</label>
                                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                                    {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                                      const isActive = config.value === opt.id;
                                      return (
                                        <button
                                          key={String(opt.id)}
                                          type="button"
                                          onClick={() => updateAttributeConfig(inputKey, "value", opt.id)}
                                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                                        >
                                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <p className="text-[10px] text-[var(--text-muted)]">Toggle to switch between Yes and No.</p>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]/30">
                    <p className="text-[13px] mb-3" style={{ color: "var(--text-muted)" }}>No attributes assigned</p>
                    <button
                      type="button"
                      onClick={() => setShowAttributeModal(true)}
                      className="h-8 px-4 text-[10px] font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
                    >
                      + Add First Attribute
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <Button onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button
                  primary
                  type="submit"
                  disabled={updateMutation.isPending}
                  icon={updateMutation.isPending ? <Spin className="w-4 h-4" /> : <Ico d={D.check} className="w-4 h-4" />}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ATTRIBUTE MODAL */}
      {showAttributeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(600px, 85vh)" }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <Ico d={D.edit} className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Add New Attribute</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Configure properties for products in this category.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAttributeModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
              >
                <Ico d={D.close} className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="px-5 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
              {/* Attribute Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newAttributeData.name}
                  onChange={(e) => setNewAttributeData({ ...newAttributeData, name: e.target.value })}
                  autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="e.g. Color, Size, RAM"
                />
              </div>

              {/* Data Type */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Data Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "multi_select", label: "Multiple Options", desc: "Choose from a list of values" },
                    { id: "boolean", label: "Yes / No", desc: "Set this attribute to Yes or No" },
                  ].map((type) => {
                    const isActive = newAttributeData.data_type === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewAttributeData({
                          ...newAttributeData,
                          data_type: type.id,
                          ...(type.id === "boolean" ? { values: [], value: "yes" } : { value: "" }),
                        })}
                        className={`h-auto py-3 px-3 text-left rounded-lg border transition-all ${isActive
                          ? "bg-[var(--accent-soft)]/40 text-[var(--accent)] border-[var(--accent)]/40 shadow-sm ring-1 ring-[var(--accent)]/10"
                          : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                      >
                        <span className="block text-[11px] font-semibold leading-tight">{type.label}</span>
                        <span className={`block text-[10px] mt-1 leading-tight ${isActive ? "text-[var(--accent)]/70" : "text-[var(--text-muted)]"}`}>{type.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multiple Options Section */}
              {newAttributeData.data_type === "multi_select" && (
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Options</label>
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
                        >
                          <Ico d={D.close} className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="new-attr-option-input"
                      placeholder="Add an option (e.g. 8 GB)"
                      className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
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
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Ico d={D.box} className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              )}

              {/* Yes / No Section */}
              {newAttributeData.data_type === "boolean" && (
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Default Value</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "yes", label: "Yes" },
                      { id: "no", label: "No" },
                    ].map((opt) => {
                      const isActive = newAttributeData.value === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewAttributeData({ ...newAttributeData, value: opt.id })}
                          className={`h-11 text-[12px] font-semibold flex items-center justify-center gap-2 rounded-lg border transition-all ${isActive
                            ? opt.id === "yes"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10"
                              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--text-muted)]/30 shadow-sm"
                            : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${isActive
                            ? opt.id === "yes"
                              ? "bg-emerald-500 border-emerald-500"
                              : "bg-[var(--text-muted)] border-[var(--text-muted)]"
                            : "border-[var(--border-color)] bg-transparent"
                          }`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">This will be the default value for this attribute.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 shrink-0">
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
                className="h-9 px-5 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm"
              >
                Add Attribute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.10)", color: "var(--danger)" }}
              >
                <Ico d={D.trash} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Delete Category?</h3>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span className="font-medium text-[var(--text-primary)]">{category.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button
                danger
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                icon={deleteMutation.isPending ? <Spin className="w-4 h-4" /> : null}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ATTRIBUTE MODAL */}
      {attrToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.10)", color: "var(--danger)" }}
              >
                <Ico d={D.trash} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Remove Attribute?</h3>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to remove <span className="font-medium text-[var(--text-primary)]">{attrToDelete.name}</span> from this category? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setAttrToDelete(null)}>Cancel</Button>
              <Button
                danger
                onClick={handleDeleteAttribute}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}