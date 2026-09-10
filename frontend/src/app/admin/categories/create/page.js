"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { categoryApi } from "../../../../apis/admin/categoryApi";
import { attributeApi } from "../../../../apis/admin/attributeApi";

// ================= ICONS =================
const Icons = {
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
  Spinner: ({ className }) => (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  ),
  Filter: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1.994 1.994 0 013 6.586V4z" />
    </svg>
  ),

  Search: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  ArrowLeft: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  Folder: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  Layers: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  FileText: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

/* ================= HELPERS & HOOKS ================= */
const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return getId(value._id);
    if (value.$oid) return String(value.$oid);
  }
  return "";
};

const getAttributeId = (attribute) => {
  const aid = attribute?.attribute_id;
  if (!aid) return String(attribute?._id || "");
  if (typeof aid === "string") return aid;
  if (typeof aid === "object" && aid._id) return String(aid._id);
  return String(aid);
};

const sanitizeOptionLabels = (raw) => {
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
};

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

/* ================= REUSABLE COMPONENTS ================= */

const ProfessionalMultiSelect = ({ attribute, value, onChange, onAddNewOption }) => {
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

  const options = sanitizeOptionLabels(attribute?.values);
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
          <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 pl-8 pr-2.5 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]" autoFocus />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-0.5 min-h-0 scrollbar-thin">
        {filteredValues.length > 0 ? (
          filteredValues.map((label, idx) => {
            const isSelected = selected.includes(label);
            return (
              <button key={idx} type="button" onClick={() => toggleOption(label)} className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${isSelected ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>
                <span className="truncate">{label}</span>
                <span className={`w-4 h-4 flex items-center justify-center shrink-0 ml-2 rounded border transition-colors ${isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)]"}`}>
                  {isSelected && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                </span>
              </button>
            );
          })
        ) : (
          <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">No matching values</div>
        )}
      </div>
      {onAddNewOption && (
        <div className="px-2 py-1.5 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-tertiary)]/30">
          <div className="flex gap-1">
            <input type="text" placeholder="Add new..." value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNewOption()} className="flex-1 min-w-0 h-7 px-2 text-[11px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" />
            <button onClick={handleAddNewOption} disabled={!newOption.trim()} className="h-7 px-2 text-[10px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5 shrink-0">
              <Icons.Plus className="w-3 h-3" /> Add
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
        <Icons.ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ml-1.5 text-[var(--text-muted)] ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(renderDropdown(), document.body)}
    </div>
  );
};

const ProfessionalSingleSelect = ({ value, onChange, placeholder = "Select...", disabled = false, icon, options: propOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const options = sanitizeOptionLabels(propOptions || []);
  const filteredOptions = options.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  const renderDropdown = () => (
    <div ref={dropdownRef} className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden flex flex-col" style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: '320px' }}>
      <div className="p-2 border-b border-[var(--border-color)] shrink-0">
        <div className="relative">
          <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 pl-8 pr-2.5 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]" autoFocus />
        </div>
      </div>
      <div className="overflow-y-auto py-0.5 flex-1 min-h-0 scrollbar-thin">
        {filteredOptions.map((label) => {
          const isSelected = value === label;
          return (
            <button key={label} type="button" onClick={() => { onChange(label); setIsOpen(false); setSearch(""); }} className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${isSelected ? "text-[var(--accent)] bg-[var(--accent-soft)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>
              <span className="truncate">{label}</span>
              {isSelected && <Icons.Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          );
        })}
        {filteredOptions.length === 0 && <div className="px-3 py-4 text-xs text-center text-[var(--text-muted)]">No options found</div>}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <button type="button" ref={triggerRef} disabled={disabled} onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs flex items-center justify-between outline-none transition-colors bg-[var(--bg-input)] border rounded disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? "border-[var(--accent)] ring-1 ring-[var(--accent-soft)]" : "border-[var(--border-color)] hover:border-[var(--text-muted)]"}`}>
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-[var(--text-muted)]">{icon}</span>}
          <span className={`truncate ${value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{value || placeholder}</span>
        </div>
        <Icons.ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform text-[var(--text-muted)] ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(renderDropdown(), document.body)}
    </div>
  );
};

const ProfessionalCategoryTypeSelect = ({ value, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(["Mobile", "PC", "Clothing"]);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState("");
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const pos = useDropdownPosition(triggerRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsAdding(false);
        setNewType("");
        setSearch("");
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsAdding(false);
        setNewType("");
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  const handleConfirmAdd = () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    const exists = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
    if (exists) onChange(exists);
    else {
      setOptions((prev) => [...prev, trimmed]);
      onChange(trimmed);
    }
    setIsOpen(false);
    setIsAdding(false);
    setNewType("");
    setSearch("");
  };

  const renderDropdown = () => (
    <div ref={containerRef} className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden flex flex-col" style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: '320px' }}>
      <div className="p-2 border-b border-[var(--border-color)] shrink-0">
        <div className="relative">
          <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 pl-8 pr-2.5 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]" autoFocus />
        </div>
      </div>
      <div className="overflow-y-auto py-0.5 flex-1 min-h-0 scrollbar-thin">
        {filteredOptions.map((label) => {
          const isSelected = value === label;
          return (
            <button key={label} type="button" onClick={() => { onChange(label); setIsOpen(false); setSearch(""); }} className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${isSelected ? "text-[var(--accent)] bg-[var(--accent-soft)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>
              <span className="truncate">{label}</span>
              {isSelected && <Icons.Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          );
        })}
        {filteredOptions.length === 0 && <div className="px-3 py-4 text-xs text-center text-[var(--text-muted)]">No types found</div>}
      </div>
      <div className="p-2 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-tertiary)]/30">
        {isAdding ? (
          <div className="flex gap-1.5">
            <input ref={inputRef} type="text" value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleConfirmAdd(); if (e.key === "Escape") { setIsAdding(false); setNewType(""); } }} placeholder="New type..." className="flex-1 h-8 px-2.5 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" />
            <button type="button" onClick={handleConfirmAdd} disabled={!newType.trim()} className="h-8 px-2.5 text-[10px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 rounded flex items-center gap-1 transition-colors">
              <Icons.Plus className="w-3 h-3" /> Add
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 0); }} className="w-full px-2 py-1.5 text-left text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] rounded flex items-center gap-1.5 transition-colors">
            <Icons.Plus className="w-3.5 h-3.5" /> Add Category Type
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <button type="button" ref={triggerRef} disabled={disabled} onClick={() => !disabled && setIsOpen((p) => !p)} className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs flex items-center justify-between outline-none transition-colors bg-[var(--bg-input)] border rounded disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? "border-[var(--accent)] ring-1 ring-[var(--accent-soft)]" : "border-[var(--border-color)] hover:border-[var(--text-muted)]"}`}>
        <span className={`truncate ${value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{value || "Select Category Type..."}</span>
        <Icons.ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform text-[var(--text-muted)] ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(renderDropdown(), document.body)}
    </div>
  );
};

/* ================= MAIN PAGE ================= */

export default function CategoryFormPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const categoryId = params?.id || searchParams?.get("id");
  const isEditMode = !!categoryId;

  // Reuse exact card style from List Page to ensure consistency
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  const [activeTab, setActiveTab] = useState("details");
  const [openAttributeKey, setOpenAttributeKey] = useState(null);
  const [showAttributeModal, setShowAttributeModal] = useState(false);

  const [newAttributeData, setNewAttributeData] = useState({ name: "", code: "", data_type: "multi_select", values: [], value: "" });

  const [formData, setFormData] = useState({
    category_code: "",
    category_type: "",
    name: "",
    description: "",
    parent_category_id: "",
    status: "active",
    attributes: [],
  });

  const [autoCode, setAutoCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const loadedSeedTypeRef = useRef("");

  const fetchNextCode = async () => {
    try {
      setLoadingCode(true);
      const res = await categoryApi.getNextCode();
      const nextCode = res?.nextCode || res?.data?.nextCode || res;
      if (nextCode) {
        setAutoCode(nextCode);
        setFormData((p) => ({ ...p, category_code: nextCode }));
      }
    } catch { setAutoCode(""); } finally { setLoadingCode(false); }
  };

  const { data: existingCategory, isLoading: isLoadingCategory } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => categoryApi.getById(categoryId),
    enabled: isEditMode,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: categoryApi.getAllAdmin,
  });

  const { data: seededAttributes = [], isLoading: loadingSeeded } = useQuery({
    queryKey: ["seeded-attributes", formData.category_type?.toLowerCase()],
    queryFn: () => attributeApi.getAll({ category: formData.category_type?.toLowerCase() }),
    enabled: !!formData.category_type,
  });

  useEffect(() => {
    if (!isEditMode && !autoCode) fetchNextCode(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEditMode && existingCategory) {
      const cat = existingCategory;
      const catType = cat.category_type || "";
      const loadedAttrs = (cat.attributes || []).map((a, i) => ({
        ...a,
        ui_key: a.ui_key || `edit-${getAttributeId(a) || a.seed_code || `idx-${i}`}-${i}`,
      }));

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        category_code: cat.category_code || "",
        category_type: catType,
        name: cat.name || "",
        description: cat.description || "",
        parent_category_id: getId(cat.parent_category_id),
        status: cat.status || "active",
        attributes: loadedAttrs,
      });

      loadedSeedTypeRef.current = catType;
      setAutoCode(cat.category_code || "");
    }
  }, [isEditMode, existingCategory]);

  useEffect(() => {
    if (isEditMode) return;
    const categoryType = formData.category_type?.toLowerCase();
    const isSeededCategory = ["mobile", "pc", "clothing"].includes(categoryType);
    if (isSeededCategory) {
      loadedSeedTypeRef.current = "";
    }
  }, [formData.category_type, isEditMode]);

  useEffect(() => {
    const categoryType = formData.category_type?.toLowerCase();
    const isSeededCategory = ["mobile", "pc", "clothing"].includes(categoryType);

    if (!isSeededCategory) {
      if (loadedSeedTypeRef.current) {
        setFormData((p) => ({ ...p, attributes: [] }));
        loadedSeedTypeRef.current = "";
      }
      return;
    }

    if (seededAttributes.length === 0) return;

    const firstSeededCategory = seededAttributes[0]?.category?.toLowerCase();
    if (firstSeededCategory && firstSeededCategory !== categoryType) return;

    if (isEditMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((p) => {
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
    } else {
      if (loadedSeedTypeRef.current !== categoryType) {
        const newAttrs = seededAttributes.map((attr, index) => {
          const mappedSeedType = attr.data_type === "select" || attr.data_type === "color" ? "multi_select" : attr.data_type;
          const options = (attr.values || []).map(v => v.label || v.value || v);
          const stableId = String(getId(attr._id) || getId(attr.attribute_id) || `${categoryType}-${attr.code || index}`);
          return {
            ui_key: `seeded-${stableId}`,
            attribute_id: attr._id,
            seed_code: attr.code,
            seed_name: attr.name,
            seed_type: mappedSeedType,
            seed_options: options,
            is_visible: true,
            is_searchable: true,
            sort_order: index,
            value: mappedSeedType === "multi_select" ? options : "",
          };
        });
        setFormData((p) => ({ ...p, attributes: newAttrs }));
        loadedSeedTypeRef.current = categoryType;
      }
    }
  }, [formData.category_type, seededAttributes, isEditMode, formData.attributes]);

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? categoryApi.update(id, data) : categoryApi.create(data)),
    onSuccess: async (savedRes, variables) => {
      try {
        const savedCategory = savedRes?.data?.data || savedRes?.data || savedRes;
        const categoryId = variables?.id || savedCategory?._id;
        const attrs = (variables?.data?.attributes) || formData.attributes || [];
        const properAttrs = attrs
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
        if (categoryId && properAttrs.length > 0) {
          try {
            await categoryApi.updateAttributes(String(categoryId), properAttrs);
          } catch (err) {
            console.error("Failed to sync category attributes:", err);
          }
        }
      } catch (syncErr) {
        console.error("Attribute sync step failed:", syncErr);
      }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["attributes"] }),
      ]);
      toast.success(variables.id ? "Category updated successfully" : "Category created successfully");
      router.push("/admin/categories");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Save failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    if (!formData.category_type) { toast.error("Please select a Category Type"); return; }
    saveMutation.mutate({ id: isEditMode ? categoryId : null, data: { ...formData, parent_category_id: formData.parent_category_id || null } });
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
      sort_order: formData.attributes.length,
      value: newAttributeData.data_type === "multi_select" ? newAttributeData.values || [] : (newAttributeData.value || ""),
      _creating: true,
    };
    setFormData((p) => ({ ...p, attributes: [...p.attributes, newAttrConfig] }));
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
        setFormData((p) => ({
          ...p,
          attributes: p.attributes.map((a) => (
            a.ui_key === tempKey
              ? { ...a, attribute_id: String(createdId), _creating: false }
              : a
          )),
        }));
      } else {
        setFormData((p) => ({
          ...p,
          attributes: p.attributes.map((a) => (a.ui_key === tempKey ? { ...a, _creating: false } : a)),
        }));
      }
    } catch (err) {
      console.error("Failed to persist attribute", err);
      setFormData((p) => ({
        ...p,
        attributes: p.attributes.map((a) => (a.ui_key === tempKey ? { ...a, _creating: false, _createError: true } : a)),
      }));
    }
  };

  const updateAttributeConfig = (key, field, val) => {
    setFormData((p) => ({
      ...p,
      attributes: p.attributes.map((item) => {
        const keyStr = String(key || "");
        const itemKey = String(item.ui_key || "");
        const itemAttrId = getAttributeId(item);
        if (
          itemKey === keyStr ||
          itemAttrId === keyStr ||
          String(item.seed_code || "") === keyStr
        ) {
          return { ...item, [field]: val };
        }
        return item;
      }),
    }));
  };

  const handleAddAttributeValue = async (inputKey, config) => {
    const raw = String(config?._draftValue || "").trim();
    if (!raw) return;
    if (!config) return;

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

    const queryKey = ["seeded-attributes", formData.category_type?.toLowerCase()];

    try {
      let updatedAttribute = null;
      let nextSelected = currentSelected;
      let nextSeedOptions = currentSeedOptions;
      let nextAttributeId = getAttributeId(config) || null;

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
        const response = await attributeApi.update(nextAttributeId, {
          values: [...normalized, newValue],
        });
        updatedAttribute = response?._id ? response : (response?.data || response);
        const responseValues = Array.isArray(updatedAttribute?.values) ? updatedAttribute.values : [...normalized, newValue];
        nextSeedOptions = responseValues.map((v) => v.label || v.value || "").filter(Boolean);
      } else {
        const created = await attributeApi.create({
          code: `${config.seed_code || inputKey}-value-${Date.now()}`, // eslint-disable-line react-hooks/purity
          name: raw,
          data_type: config.seed_type || "text",
          values: [{ label: raw, value: raw.toLowerCase(), sort_order: 0, is_active: true }],
        });
        updatedAttribute = created;
        nextAttributeId = String(created?._id || created?.id || created?.data?._id || created?.data?.id || "");
        nextSeedOptions = [raw];
      }

      if (!nextSelected.includes(raw)) nextSelected = [...nextSelected, raw];

      updateAttributeConfig(inputKey, "value", nextSelected);
      updateAttributeConfig(inputKey, "seed_options", nextSeedOptions);
      if (nextAttributeId && nextAttributeId !== getAttributeId(config)) {
        updateAttributeConfig(inputKey, "attribute_id", nextAttributeId);
      }

      if (updatedAttribute && nextAttributeId) {
        queryClient.setQueryData(queryKey, (prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex((a) => String(a._id) === String(nextAttributeId));
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...updatedAttribute, _id: nextAttributeId };
          } else {
            list.push(updatedAttribute);
          }
          return list;
        });
      }

      toast.success("Option added successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save option");
    }
  };

  if (isLoadingCategory) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icons.Spinner className="w-7 h-7 text-[var(--accent)]" />
          <p className="text-xs text-[var(--text-muted)]">Loading category details...</p>
        </div>
      </div>
    );
  }

  return (
    // REMOVED min-h-screen bg-[var(--bg-primary)] to prevent double background
    <div className="w-full h-full overflow-y-auto space-y-5">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
          >
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div className="leading-tight">
            <h1 className="text-[24px] leading-7 font-bold tracking-tight text-[var(--text-primary)]">
              {isEditMode ? "Edit Category" : "Create Category"}
            </h1>
            <p className="text-[13px] mt-1 text-[var(--text-muted)]">
              Configure product classification and attributes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 px-4 text-[13px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="category-form"
            disabled={saveMutation.isPending}
            className="h-9 px-4 text-[13px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? <Icons.Spinner className="w-4 h-4" /> : <Icons.Check className="w-4 h-4" />}
            {isEditMode ? "Update Category" : "Create Category"}
          </button>
        </div>
      </div>

      {/* ================= MAIN FORM ================= */}
      <form id="category-form" onSubmit={handleSubmit} className="w-full">
        {/* GRID LAYOUT MATCHING LIST PAGE WIDTH */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">

          {/* ================= LEFT: CATEGORY INFORMATION ================= */}
          <section className="rounded-lg overflow-hidden flex flex-col" style={cardStyle}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                <Icons.Folder className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Category Information</h2>
                <p className="text-[10px] text-[var(--text-muted)]">Basic details and classification</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Row 1: Code + Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Category Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.category_code}
                      onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                      readOnly={isEditMode}
                      className="w-full h-[42px] px-4 text-sm font-mono outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                      placeholder="AUTO-GENERATED"
                    />
                    {loadingCode && <Icons.Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)]" />}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Name <span className="text-[var(--danger)]">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full h-[42px] px-4 text-sm outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                    placeholder="e.g. Smartphones"
                  />
                </div>
              </div>

              {/* Row 2: Type + Parent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Type <span className="text-[var(--danger)]">*</span></label>
                  <ProfessionalCategoryTypeSelect
                    value={formData.category_type}
                    onChange={(val) => setFormData({ ...formData, category_type: val })}
                    disabled={isEditMode}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Parent Category</label>
                  <ProfessionalSingleSelect
                    value={allCategories.find((c) => String(c._id) === String(formData.parent_category_id))?.name || ""}
                    onChange={(name) => { const f = allCategories.find((c) => c.name === name); setFormData((p) => ({ ...p, parent_category_id: f ? String(f._id) : "" })); }}
                    placeholder="Root Category"
                    options={["", ...allCategories.filter((c) => String(c._id) !== String(categoryId)).map((c) => c.name)]}
                  />
                </div>
              </div>

              {/* Row 3: Description */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 text-sm outline-none resize-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="Brief description..."
                />
              </div>

              {/* Row 4: Status */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</label>
                <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                  {[{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }].map((opt) => {
                    const isActive = formData.status === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: opt.id })}
                        className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                      >
                        <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id === "active" ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ================= RIGHT: ATTRIBUTES & FEATURES ================= */}
          <section className="rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-140px)]" style={cardStyle}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                  <Icons.Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">Attributes & Features</h2>
                  <p className="text-[10px] text-[var(--text-muted)]">Define product specifications</p>
                </div>
              </div>
              {formData.category_type && (
                <button
                  type="button"
                  onClick={() => setShowAttributeModal(true)}
                  className="h-9 px-3 text-[10px] font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Icons.Plus className="w-3.5 h-3.5" /> Add Attribute
                </button>
              )}
            </div>

            <div className="p-5 flex-1 overflow-auto scrollbar-thin">
              {!formData.category_type ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-primary)]/30 text-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-4 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-color)]">
                    <Icons.Filter className="w-7 h-7 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">No Category Type Selected</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-[240px]">Select a category type to configure attributes.</p>
                </div>
              ) : formData.attributes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formData.attributes.map((config, index) => {
                    const seedName = config.seed_name || `Attribute ${index + 1}`;
                    const inputKey = config.ui_key || `attr-${getId(config.attribute_id) || getId(config._id) || config.seed_code || index}`;
                    const isOpen = openAttributeKey === inputKey;
                    const selectedValues = Array.isArray(config.value) ? config.value : [];
                    
                    // Determine Icon based on type
                    let TypeIcon = Icons.Filter;
                    if (config.seed_type === "boolean") TypeIcon = Icons.Check;

                    const assignedCount = config.seed_type === "multi_select"
                      ? selectedValues.length
                      : (config.value !== undefined && config.value !== null && String(config.value).trim() !== "" ? 1 : 0);
                    const isAssigned = assignedCount > 0;
                    
                    // Badge Label Logic
                    let typeBadgeLabel = "Multi Select";
                    if (config.seed_type === "boolean") typeBadgeLabel = "Boolean";

                    return (
                      <div
                        key={inputKey}
                        className={`rounded-xl border overflow-visible transition-all duration-200 ${isOpen ? "border-[var(--accent)]/50 bg-[var(--bg-primary)] shadow-md ring-1 ring-[var(--accent)]/10" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"}`}
                      >
                        {/* FIXED: Outer Button */}
                        <button
                          type="button"
                          onClick={() => setOpenAttributeKey((prev) => (prev === inputKey ? null : inputKey))}
                          className="w-full px-4 py-4 flex items-center justify-between text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-10 h-10 flex items-center justify-center shrink-0 rounded-lg transition-colors ${isOpen ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25" : "bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)] group-hover:border-[var(--text-muted)]"}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{seedName}</h4>
                                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded border border-[var(--border-color)]">
                                  {typeBadgeLabel}
                                </span>
                                {isAssigned && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/25">
                                    <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
                                    Assigned
                                  </span>
                                )}
                              </div>
                              
                              {/* CONTENT DISPLAY AREA */}
                              <div className="flex flex-wrap gap-1.5 min-h-[20px] items-center">
                                {config.seed_type === "boolean" ? (
                                  // FIXED: BOOLEAN TOGGLE IN CARD HEADER (Using Div instead of Button)
                                  <div 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="flex rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-0.5 cursor-pointer"
                                  >
                                    {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                                      const isActive = config.value === opt.id;
                                      return (
                                        <div
                                          key={String(opt.id)}
                                          onClick={() => updateAttributeConfig(inputKey, "value", opt.id)}
                                          className={`px-3 py-1 text-[10px] font-medium flex items-center justify-center gap-1.5 rounded transition-all select-none ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                                        >
                                          <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                                          {opt.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  selectedValues.length > 0 ? (
                                    <>
                                      {selectedValues.slice(0, 3).map((val, i) => (
                                        <span key={i} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/15">
                                          {val}
                                        </span>
                                      ))}
                                      {selectedValues.length > 3 && (
                                        <span className="text-[10px] font-medium text-[var(--text-muted)] self-center">+{selectedValues.length - 3}</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[11px] italic text-[var(--text-muted)]">No options assigned</span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                          <Icons.ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180 text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`} />
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
                                            const attrIdForUpdate = getAttributeId(config);
                                            if (attrIdForUpdate) {
                                              const fullAttr = seededAttributes.find(a => String(a._id) === attrIdForUpdate);
                                              if (fullAttr) {
                                                const remaining = (fullAttr.values || []).filter((v) => {
                                                  const lbl = v.label || v.value || "";
                                                  return lbl !== val;
                                                });
                                                attributeApi.update(attrIdForUpdate, {
                                                  values: remaining.map((v) => ({
                                                    label: v.label || v.value || "",
                                                    value: v.value || v.label || "",
                                                    sort_order: v.sort_order ?? 0,
                                                    is_active: v.is_active !== false,
                                                  })),
                                                }).then(() => {
                                                  queryClient.invalidateQueries({ queryKey: ["seeded-attributes", formData.category_type?.toLowerCase()] });
                                                }).catch(() => {});
                                              }
                                            }
                                                                  }}
                                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                          aria-label={`Remove ${val}`}
                                        >
                                          <Icons.X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-3 py-3 text-center text-[11px] italic text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]/40">
                                      No options assigned yet
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <input
                                    type="text"
                                    id={`opt-input-${inputKey}`}
                                    placeholder={`Add option (e.g. 8 GB)`}
                                    className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
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
                                    className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors"
                                  >
                                    <Icons.Plus className="w-3.5 h-3.5" /> Add Option
                                  </button>
                                </div>
                              </div>
                             ) : (
                               // BOOLEAN EXPANDED VIEW
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
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-primary)]/30 text-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-4 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-color)]">
                    <Icons.Layers className="w-7 h-7 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">No Attributes Added</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-[240px] mb-5">Start defining what makes products unique.</p>
                  <button
                    type="button"
                    onClick={() => setShowAttributeModal(true)}
                    className="h-9 px-4 text-[10px] font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Icons.Plus className="w-3.5 h-3.5" /> Create First Attribute
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </form>

      {/* ================= ADD ATTRIBUTE MODAL ================= */}
      {showAttributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-card)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-card)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <Icons.FileText className="w-4 h-4" />
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
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-[var(--danger)]">*</span></label>
                <input
                  type="text"
                  value={newAttributeData.name}
                  onChange={(e) => setNewAttributeData({ ...newAttributeData, name: e.target.value })}
                  autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                  placeholder="e.g. Color, Size, RAM"
                />
              </div>

              {/* UPDATED DATA TYPE SECTION WITH PROFESSIONAL SPACING */}
              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Data Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "multi_select", label: "Options", icon: <Icons.Filter className="w-4 h-4" /> },
                    { id: "boolean", label: "Boolean", icon: <Icons.Check className="w-4 h-4" /> },
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
                        {type.icon}
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
                      <div
                        key={`opt-${idx}`}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg"
                      >
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
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          aria-label="Remove option"
                        >
                          <Icons.X className="w-3.5 h-3.5" />
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
                      <Icons.Plus className="w-3.5 h-3.5" /> Add Option
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Add one or more options. You can also add more after creating the attribute.</p>
                </div>
              )}

              {/* BOOLEAN TOGGLE UI - YES / NO */}
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
                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">This will be the default Yes/No state for this attribute.</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-card)] flex items-center justify-end gap-3 bg-[var(--bg-primary)]/30">
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
    </div>
  );
}